const crypto = require('crypto');
const ForumPost = require('../models/ForumPost');
const ForumPostReward = require('../models/ForumPostReward');
const VendorForumRule = require('../models/VendorForumRule');
const VendorVoucher = require('../models/VendorVoucher');
const Vendor = require('../models/Vendor');
const { notifyStudent } = require('./persistence');

/**
 * Checks if a post is approved.
 * @param {Object} post 
 * @returns {Boolean}
 */
const isPostApproved = (post) => {
    return post && post.status === 'approved';
};

/**
 * Normalizes vendor id to string.
 * @param {Object|String} vendor 
 * @returns {String|Null}
 */
const normalizeVendorId = (vendor) => {
    if (!vendor) return null;
    if (typeof vendor === 'object' && vendor._id) {
        return String(vendor._id);
    }
    return String(vendor);
};

/**
 * Looks up an active, unexpired voucher for a user.
 * @param {Object} query 
 * @returns {Promise<Object|Null>}
 */
const lookupUserVoucher = async ({ code, userId }) => {
    if (!code) return null;
    return await VendorVoucher.findOne({
        code: code.toUpperCase(),
        issuedTo: userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    });
};

/**
 * Validates a voucher for a specific order.
 * @param {Object} params 
 * @returns {Promise<Object>}
 */
const validateVoucherForOrder = async ({ code, userId, vendorId, orderTotal }) => {
    const voucher = await lookupUserVoucher({ code, userId });
    if (!voucher) {
        return { error: 'Mã voucher không hợp lệ hoặc đã hết hạn.' };
    }

    if (normalizeVendorId(voucher.vendor) !== normalizeVendorId(vendorId)) {
        return { error: 'Voucher không áp dụng cho quầy này.' };
    }

    if (orderTotal < (voucher.minOrder || 0)) {
        return { error: `Đơn hàng tối thiểu để áp dụng voucher này là ${voucher.minOrder.toLocaleString('vi-VN')}đ.` };
    }

    const discount = Math.min(voucher.discountAmount, orderTotal);
    return { voucher, discount };
};

/**
 * Marks a voucher as used.
 * @param {String} voucherId 
 * @param {String} orderId 
 * @returns {Promise<void>}
 */
const markVoucherUsed = async (voucherId, orderId) => {
    if (!voucherId) return;
    await VendorVoucher.findByIdAndUpdate(voucherId, {
        status: 'used',
        usedAt: new Date(),
        usedOnOrder: orderId
    });
};

/**
 * Ensures a ForumPostReward is configured based on Vendor's active rules.
 * @param {String} vendorId 
 * @param {String} postId 
 * @param {String} userId 
 * @returns {Promise<Object|Null>}
 */
const ensurePostRewardFromGlobalRule = async (vendorId, postId, userId) => {
    const rule = await VendorForumRule.findOne({ vendor: vendorId, isActive: true });
    if (!rule) return null;

    let reward = await ForumPostReward.findOne({ post: postId, vendor: vendorId });
    if (!reward) {
        reward = new ForumPostReward({
            post: postId,
            vendor: vendorId,
            createdBy: userId,
            interactionThreshold: rule.interactionThreshold,
            discountAmount: rule.discountAmount,
            minOrder: rule.minOrder,
            validDays: rule.validDays,
            status: 'pending'
        });
        await reward.save();
    } else if (reward.status === 'pending' || reward.status === 'eligible') {
        reward.interactionThreshold = rule.interactionThreshold;
        reward.discountAmount = rule.discountAmount;
        reward.minOrder = rule.minOrder;
        reward.validDays = rule.validDays;
        await reward.save();
    }
    return reward;
};

/**
 * Syncs all post rewards for a vendor.
 * @param {String} vendorId 
 * @param {String} userId 
 * @returns {Promise<void>}
 */
const syncAllPostRewardsForVendor = async (vendorId, userId) => {
    const rule = await VendorForumRule.findOne({ vendor: vendorId, isActive: true });
    if (!rule) return;

    const posts = await ForumPost.find({
        vendor: vendorId,
        isActive: true,
        status: 'approved'
    });

    for (const post of posts) {
        await ensurePostRewardFromGlobalRule(vendorId, post._id, userId);
    }
};

/**
 * Issues a voucher from a post reward.
 * @param {Object} req 
 * @param {Object} reward 
 * @param {Object} post 
 * @returns {Promise<Object|Null>}
 */
const issueVoucherFromReward = async (req, reward, post) => {
    if (!reward || reward.status === 'issued') {
        return null;
    }

    let code;
    let codeExists = true;
    while (codeExists) {
        code = 'VH' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const existing = await VendorVoucher.findOne({ code });
        if (!existing) {
            codeExists = false;
        }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (reward.validDays || 14));

    const voucher = new VendorVoucher({
        vendor: reward.vendor,
        code,
        discountAmount: reward.discountAmount,
        minOrder: reward.minOrder,
        issuedTo: post.author,
        forumPost: post._id,
        forumReward: reward._id,
        status: 'active',
        expiresAt
    });
    await voucher.save();

    reward.status = 'issued';
    reward.voucherIssued = voucher._id;
    reward.issuedAt = new Date();
    await reward.save();

    try {
        const vendorDoc = await Vendor.findById(reward.vendor).select('name');
        await notifyStudent(req, {
            userId: post.author,
            title: 'Nhận voucher diễn đàn!',
            message: `Bài viết "${post.title}" đã đạt mốc tương tác. Bạn được tặng voucher ${code} giảm ${reward.discountAmount.toLocaleString('vi-VN')}đ tại ${vendorDoc?.name || 'gian hàng'}.`,
            type: 'SYSTEM',
        });
    } catch (err) {
        console.error('Error notifying student about issued voucher:', err.message);
    }

    return voucher;
};

/**
 * Checks and updates forum rewards eligibility when interaction count changes.
 * @param {Object} req 
 * @param {String} postId 
 * @returns {Promise<void>}
 */
const checkForumRewardsForPost = async (req, postId) => {
    const post = await ForumPost.findById(postId);
    if (!post || !post.isActive || post.status !== 'approved') return;

    post.interactionCount = (post.voteCount || 0) + (post.commentCount || 0);
    await post.save();

    let reward = await ForumPostReward.findOne({ post: postId, vendor: post.vendor });
    if (!reward) {
        reward = await ensurePostRewardFromGlobalRule(post.vendor, post._id, post.author);
    }

    if (reward) {
        if (post.interactionCount >= reward.interactionThreshold) {
            if (reward.status === 'pending') {
                reward.status = 'eligible';
                await reward.save();
            }
        } else {
            if (reward.status === 'eligible') {
                reward.status = 'pending';
                await reward.save();
            }
        }
    }
};

module.exports = {
    isPostApproved,
    normalizeVendorId,
    lookupUserVoucher,
    validateVoucherForOrder,
    markVoucherUsed,
    ensurePostRewardFromGlobalRule,
    syncAllPostRewardsForVendor,
    issueVoucherFromReward,
    checkForumRewardsForPost
};
