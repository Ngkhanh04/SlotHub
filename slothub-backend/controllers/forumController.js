const ForumPost = require('../models/ForumPost');
const ForumVote = require('../models/ForumVote');
const ForumComment = require('../models/ForumComment');
const ForumPostReward = require('../models/ForumPostReward');
const VendorVoucher = require('../models/VendorVoucher');
const MenuItem = require('../models/MenuItem');
const Vendor = require('../models/Vendor');
const VendorForumRule = require('../models/VendorForumRule');
const Notification = require('../models/Notification');
const {
    checkForumRewardsForPost,
    issueVoucherFromReward,
    ensurePostRewardFromGlobalRule,
    syncAllPostRewardsForVendor,
    isPostApproved,
} = require('../utils/forumHelpers');
const { notifyStudent } = require('../utils/persistence');

const APPROVED_QUERY = { $or: [{ status: 'approved' }, { status: { $exists: false } }] };

const POST_POPULATE = [
    { path: 'author', select: 'name avatar' },
    { path: 'menuItem', select: 'name imageUrl price rating' },
    { path: 'vendor', select: 'name imageUrl category' },
];

const isVendorRole = (role) => role === 'vendor' || role === 'vendor_owner';

const getMyVendor = async (userId) => Vendor.findOne({ owner: userId });

// [GET] Danh sách bài viết forum
const listPosts = async (req, res) => {
    try {
        const { sort = 'votes', vendorId, menuItemId, page = 1, limit = 20 } = req.query;
        const filter = { isActive: true, ...APPROVED_QUERY };
        if (vendorId) filter.vendor = vendorId;
        if (menuItemId) filter.menuItem = menuItemId;

        const sortOpt =
            sort === 'new' ? { createdAt: -1 }
                : sort === 'interactions' ? { interactionCount: -1 }
                    : { voteCount: -1 };

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const [posts, total] = await Promise.all([
            ForumPost.find(filter)
                .sort(sortOpt)
                .skip(skip)
                .limit(Math.min(50, Number(limit)))
                .populate(POST_POPULATE)
                .lean(),
            ForumPost.countDocuments(filter),
        ]);

        let votedPostIds = [];
        if (req.user?.id) {
            const votes = await ForumVote.find({
                user: req.user.id,
                post: { $in: posts.map((p) => p._id) },
            }).select('post');
            votedPostIds = votes.map((v) => String(v.post));
        }

        const rewards = await ForumPostReward.find({
            post: { $in: posts.map((p) => p._id) },
        }).select('post interactionThreshold discountAmount status');

        const vendorIds = [...new Set(posts.map((p) => String(p.vendor?._id || p.vendor)))];
        const globalRules = await VendorForumRule.find({ vendor: { $in: vendorIds }, isActive: true });
        const globalRuleMap = Object.fromEntries(globalRules.map((r) => [String(r.vendor), r]));

        const rewardMap = {};
        rewards.forEach((r) => { rewardMap[String(r.post)] = r; });

        const enriched = posts.map((p) => {
            const vid = String(p.vendor?._id || p.vendor);
            const globalRule = globalRuleMap[vid] || null;
            return {
                ...p,
                hasVoted: votedPostIds.includes(String(p._id)),
                reward: rewardMap[String(p._id)] || null,
                globalRule,
            };
        });

        return res.json({ posts: enriched, total, page: Number(page) });
    } catch (err) {
        console.error('[listPosts]', err);
        return res.status(500).json({ message: 'Lỗi tải diễn đàn' });
    }
};

// [GET] Bảng xếp hạng món được vote nhiều nhất
const getLeaderboard = async (req, res) => {
    try {
        const rows = await ForumPost.aggregate([
            { $match: { isActive: true, ...APPROVED_QUERY } },
            {
                $group: {
                    _id: '$menuItem',
                    totalVotes: { $sum: '$voteCount' },
                    totalInteractions: { $sum: '$interactionCount' },
                    postCount: { $sum: 1 },
                    topPostId: { $first: '$_id' },
                },
            },
            { $sort: { totalVotes: -1, totalInteractions: -1 } },
            { $limit: 20 },
        ]);

        const menuIds = rows.map((r) => r._id).filter(Boolean);
        const menus = await MenuItem.find({ _id: { $in: menuIds } })
            .populate('vendor', 'name imageUrl')
            .lean();
        const menuMap = Object.fromEntries(menus.map((m) => [String(m._id), m]));

        const leaderboard = rows.map((r, idx) => ({
            rank: idx + 1,
            menuItem: menuMap[String(r._id)] || { _id: r._id },
            totalVotes: r.totalVotes,
            totalInteractions: r.totalInteractions,
            postCount: r.postCount,
        }));

        return res.json(leaderboard);
    } catch (err) {
        console.error('[getLeaderboard]', err);
        return res.status(500).json({ message: 'Lỗi bảng xếp hạng' });
    }
};

// [GET] Chi tiết bài
const getPost = async (req, res) => {
    try {
        const post = await ForumPost.findById(req.params.id).populate(POST_POPULATE);
        if (!post || !post.isActive) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        }
        if (!isPostApproved(post)) {
            const isAuthor = String(post.author?._id || post.author) === String(req.user.id);
            const isAdmin = req.user.role === 'admin';
            if (!isAuthor && !isAdmin) {
                return res.status(404).json({ message: 'Không tìm thấy bài viết' });
            }
        }

        const [hasVoted, reward, comments, globalRule] = await Promise.all([
            req.user?.id
                ? ForumVote.exists({ post: post._id, user: req.user.id })
                : false,
            ForumPostReward.findOne({ post: post._id }),
            ForumComment.find({ post: post._id })
                .sort({ createdAt: 1 })
                .populate('author', 'name avatar')
                .limit(100),
            VendorForumRule.findOne({ vendor: post.vendor, isActive: true }),
        ]);

        return res.json({ post, hasVoted: !!hasVoted, reward, globalRule, comments });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải bài viết' });
    }
};

// [POST] Sinh viên đăng bài
const createPost = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Chỉ sinh viên mới được đăng bài' });
        }

        const { menuItemId, title, content, rating } = req.body;
        if (!menuItemId || !title?.trim() || !content?.trim()) {
            return res.status(400).json({ message: 'Vui lòng chọn món, tiêu đề và nội dung' });
        }

        const menuItem = await MenuItem.findById(menuItemId).populate('vendor', 'name');
        if (!menuItem) return res.status(404).json({ message: 'Món không tồn tại' });

        const post = await ForumPost.create({
            author: req.user.id,
            menuItem: menuItem._id,
            vendor: menuItem.vendor._id || menuItem.vendor,
            title: title.trim(),
            content: content.trim(),
            rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        });

        const populated = await ForumPost.findById(post._id).populate(POST_POPULATE);

        try {
            await Notification.create({
                audience: 'admin',
                recipientId: null,
                title: 'Bài forum chờ duyệt',
                message: `${req.user.name || 'Sinh viên'} đăng bài "${title.trim()}" — cần Admin duyệt.`,
                type: 'SYSTEM',
                actionLink: 'forum',
                isRead: false,
            });
        } catch (e) {
            console.error('[createPost notify]', e.message);
        }

        return res.status(201).json({
            message: 'Đã gửi bài! Admin sẽ duyệt trước khi hiển thị công khai.',
            post: populated,
        });
    } catch (err) {
        console.error('[createPost]', err);
        return res.status(500).json({ message: 'Lỗi đăng bài' });
    }
};

// [POST] Vote / bỏ vote
const toggleVote = async (req, res) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post || !post.isActive || !isPostApproved(post)) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        }

        const existing = await ForumVote.findOne({ post: post._id, user: req.user.id });
        let hasVoted;
        if (existing) {
            await existing.deleteOne();
            post.voteCount = Math.max(0, (post.voteCount || 1) - 1);
            hasVoted = false;
        } else {
            await ForumVote.create({ post: post._id, user: req.user.id });
            post.voteCount = (post.voteCount || 0) + 1;
            hasVoted = true;
        }
        await post.save();
        await checkForumRewardsForPost(req, post._id);

        const updated = await ForumPost.findById(post._id).select('voteCount commentCount interactionCount');
        return res.json({
            hasVoted,
            voteCount: updated.voteCount,
            interactionCount: updated.interactionCount,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi vote' });
    }
};

// [POST] Bình luận
const addComment = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ message: 'Nội dung bình luận trống' });
        }

        const post = await ForumPost.findById(req.params.id);
        if (!post || !post.isActive || !isPostApproved(post)) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        }

        const comment = await ForumComment.create({
            post: post._id,
            author: req.user.id,
            content: content.trim(),
        });

        post.commentCount = (post.commentCount || 0) + 1;
        await post.save();
        await checkForumRewardsForPost(req, post._id);

        const populated = await ForumComment.findById(comment._id).populate('author', 'name avatar');
        const updated = await ForumPost.findById(post._id).select('voteCount commentCount interactionCount');

        return res.status(201).json({
            comment: populated,
            interactionCount: updated.interactionCount,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi bình luận' });
    }
};

// [GET] Bài viết của sinh viên (kể cả chờ duyệt)
const getMyPosts = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Chỉ sinh viên' });
        }
        const { status } = req.query;
        const filter = { author: req.user.id, isActive: true };
        if (status) filter.status = status;

        const posts = await ForumPost.find(filter)
            .sort({ createdAt: -1 })
            .limit(20)
            .populate(POST_POPULATE)
            .lean();

        return res.json({ posts });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải bài của bạn' });
    }
};

// [GET] Voucher của sinh viên
const getMyVouchers = async (req, res) => {
    try {
        const vouchers = await VendorVoucher.find({
            issuedTo: req.user.id,
            status: 'active',
            expiresAt: { $gt: new Date() },
        })
            .populate('vendor', 'name imageUrl')
            .sort({ createdAt: -1 });

        return res.json(vouchers);
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải voucher' });
    }
};

// [GET/PUT] Vendor — quy tắc voucher chung cho mọi bài
const getVendorForumRule = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        const vendor = await getMyVendor(req.user.id);
        if (!vendor) return res.status(404).json({ message: 'Không tìm thấy gian hàng' });
        const rule = await VendorForumRule.findOne({ vendor: vendor._id });
        return res.json({ rule, vendor });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải quy tắc voucher' });
    }
};

const setVendorForumRule = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Chỉ chủ quầy mới được cấu hình voucher' });
        }
        const vendor = await getMyVendor(req.user.id);
        if (!vendor) return res.status(404).json({ message: 'Không tìm thấy gian hàng' });

        const { interactionThreshold, discountAmount, minOrder, validDays, isActive } = req.body;
        const threshold = Math.max(1, Number(interactionThreshold) || 10);
        const discount = Math.max(1000, Number(discountAmount) || 20000);

        const rule = await VendorForumRule.findOneAndUpdate(
            { vendor: vendor._id },
            {
                vendor: vendor._id,
                createdBy: req.user.id,
                interactionThreshold: threshold,
                discountAmount: discount,
                minOrder: Math.max(0, Number(minOrder) || 0),
                validDays: Math.min(90, Math.max(1, Number(validDays) || 14)),
                isActive: isActive !== false,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await syncAllPostRewardsForVendor(vendor._id, req.user.id);

        const approvedPosts = await ForumPost.find({
            vendor: vendor._id,
            isActive: true,
            ...APPROVED_QUERY,
        });
        for (const p of approvedPosts) {
            if ((p.interactionCount || 0) >= threshold) {
                await checkForumRewardsForPost(req, p._id);
            }
        }

        return res.json({
            message: `Đã lưu quy tắc chung: giảm ${discount.toLocaleString('vi-VN')}đ khi bài đạt ${threshold} tương tác (mọi bài về quầy)`,
            rule,
        });
    } catch (err) {
        console.error('[setVendorForumRule]', err);
        return res.status(500).json({ message: 'Lỗi lưu quy tắc voucher' });
    }
};

// [GET] Vendor — bài viết & phần thưởng quầy mình
const getVendorForumPosts = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        const vendor = await getMyVendor(req.user.id);
        if (!vendor) return res.status(404).json({ message: 'Không tìm thấy gian hàng' });

        const [posts, globalRule, rewards] = await Promise.all([
            ForumPost.find({ vendor: vendor._id, isActive: true, ...APPROVED_QUERY })
                .sort({ interactionCount: -1 })
                .populate(POST_POPULATE),
            VendorForumRule.findOne({ vendor: vendor._id }),
            ForumPostReward.find({ vendor: vendor._id }),
        ]);

        const rewardMap = Object.fromEntries(rewards.map((r) => [String(r.post), r]));

        const enriched = posts.map((p) => {
            const obj = p.toObject();
            const reward = rewardMap[String(p._id)] || null;
            const threshold = globalRule?.interactionThreshold || reward?.interactionThreshold || 0;
            return {
                ...obj,
                reward,
                progress: threshold
                    ? Math.min(100, Math.round(((obj.interactionCount || 0) / threshold) * 100))
                    : 0,
            };
        });

        return res.json({ posts: enriched, vendor, globalRule });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải forum quầy' });
    }
};

// [POST] Vendor tặng voucher thủ công khi đủ điều kiện
const giftVoucherManually = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        const vendor = await getMyVendor(req.user.id);
        if (!vendor) return res.status(404).json({ message: 'Không tìm thấy gian hàng' });

        const reward = await ForumPostReward.findOne({
            _id: req.params.rewardId,
            vendor: vendor._id,
        });
        if (!reward) return res.status(404).json({ message: 'Không tìm thấy cấu hình thưởng' });

        const post = await ForumPost.findById(reward.post);
        if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });
        if (post.interactionCount < reward.interactionThreshold) {
            return res.status(400).json({
                message: `Cần ${reward.interactionThreshold} tương tác, hiện có ${post.interactionCount}`,
            });
        }

        const voucher = await issueVoucherFromReward(req, reward, post);
        if (!voucher) {
            return res.status(400).json({ message: 'Voucher đã được tặng trước đó' });
        }

        return res.json({
            message: `Đã tặng voucher ${voucher.code} cho sinh viên!`,
            voucher,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tặng voucher' });
    }
};

// [GET] Vendor — tóm tắt forum (badge menu)
const getVendorForumSummary = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        const vendor = await getMyVendor(req.user.id);
        if (!vendor) return res.json({ postCount: 0, eligibleCount: 0, pendingRewardCount: 0 });

        const globalRule = await VendorForumRule.findOne({ vendor: vendor._id, isActive: true });
        const posts = await ForumPost.find({ vendor: vendor._id, isActive: true, ...APPROVED_QUERY })
            .select('interactionCount');
        const rewards = await ForumPostReward.find({ vendor: vendor._id });

        const threshold = globalRule?.interactionThreshold || 0;
        let eligibleCount = 0;

        posts.forEach((p) => {
            const r = rewards.find((x) => String(x.post) === String(p._id));
            if (r?.status === 'issued') return;
            if (threshold && (p.interactionCount || 0) >= threshold) eligibleCount += 1;
        });

        const pendingPosts = await ForumPost.countDocuments({
            vendor: vendor._id,
            isActive: true,
            status: 'pending',
        });

        return res.json({
            postCount: posts.length,
            eligibleCount,
            pendingRewardCount: globalRule ? 0 : 1,
            pendingModerationCount: pendingPosts,
            voucherIssuedCount: rewards.filter((r) => r.status === 'issued').length,
            hasGlobalRule: !!globalRule,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải tóm tắt forum' });
    }
};

// ========== ADMIN: duyệt / xóa bài forum ==========

const requireAdmin = (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403).json({ message: 'Chỉ Admin mới có quyền' });
        return false;
    }
    return true;
};

const listAdminPosts = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { status = 'pending', page = 1, limit = 30 } = req.query;
        const filter = { isActive: true };
        if (status !== 'all') {
            if (status === 'approved') {
                Object.assign(filter, APPROVED_QUERY);
            } else {
                filter.status = status;
            }
        }

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const [posts, total] = await Promise.all([
            ForumPost.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Math.min(50, Number(limit)))
                .populate(POST_POPULATE),
            ForumPost.countDocuments(filter),
        ]);

        const pendingCount = await ForumPost.countDocuments({ isActive: true, status: 'pending' });

        return res.json({ posts, total, pendingCount, page: Number(page) });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải bài forum' });
    }
};

const approveAdminPost = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const post = await ForumPost.findById(req.params.id);
        if (!post || !post.isActive) {
            return res.status(404).json({ message: 'Không tìm thấy bài' });
        }

        post.status = 'approved';
        post.moderatedBy = req.user.id;
        post.moderatedAt = new Date();
        post.rejectReason = '';
        await post.save();

        await ensurePostRewardFromGlobalRule(post.vendor, post._id, req.user.id);
        await checkForumRewardsForPost(req, post._id);

        await notifyStudent(req, {
            userId: post.author,
            title: 'Bài forum đã được duyệt',
            message: `Bài "${post.title}" đã hiển thị công khai. Mời bạn bè vote và nhận voucher từ quầy!`,
            type: 'SYSTEM',
        });

        return res.json({ message: 'Đã duyệt bài viết', post });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi duyệt bài' });
    }
};

const rejectAdminPost = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { reason } = req.body;
        const post = await ForumPost.findById(req.params.id);
        if (!post || !post.isActive) {
            return res.status(404).json({ message: 'Không tìm thấy bài' });
        }

        post.status = 'rejected';
        post.rejectReason = String(reason || 'Không phù hợp nội quy').slice(0, 500);
        post.moderatedBy = req.user.id;
        post.moderatedAt = new Date();
        await post.save();

        await notifyStudent(req, {
            userId: post.author,
            title: 'Bài forum không được duyệt',
            message: `Bài "${post.title}" bị từ chối. Lý do: ${post.rejectReason}`,
            type: 'SYSTEM',
        });

        return res.json({ message: 'Đã từ chối bài viết', post });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi từ chối bài' });
    }
};

const deleteAdminPost = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const post = await ForumPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });

        post.isActive = false;
        post.moderatedBy = req.user.id;
        post.moderatedAt = new Date();
        await post.save();

        return res.json({ message: 'Đã xóa bài viết khỏi diễn đàn' });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi xóa bài' });
    }
};

module.exports = {
    listPosts,
    getLeaderboard,
    getPost,
    createPost,
    toggleVote,
    addComment,
    getMyVouchers,
    getMyPosts,
    getVendorForumRule,
    setVendorForumRule,
    getVendorForumPosts,
    giftVoucherManually,
    getVendorForumSummary,
    listAdminPosts,
    approveAdminPost,
    rejectAdminPost,
    deleteAdminPost,
};