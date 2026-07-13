const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
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
} = require('../controllers/forumController');

router.get('/posts', protect, listPosts);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/posts/:id', protect, getPost);
router.post('/posts', protect, createPost);
router.post('/posts/:id/vote', protect, toggleVote);
router.post('/posts/:id/comments', protect, addComment);
router.get('/my-vouchers', protect, getMyVouchers);
router.get('/my-posts', protect, getMyPosts);

router.get('/vendor/rule', protect, getVendorForumRule);
router.put('/vendor/rule', protect, setVendorForumRule);
router.get('/vendor/posts', protect, getVendorForumPosts);
router.get('/vendor/summary', protect, getVendorForumSummary);
router.post('/vendor/rewards/:rewardId/gift', protect, giftVoucherManually);

router.get('/admin/posts', protect, listAdminPosts);
router.put('/admin/posts/:id/approve', protect, approveAdminPost);
router.put('/admin/posts/:id/reject', protect, rejectAdminPost);
router.delete('/admin/posts/:id', protect, deleteAdminPost);

module.exports = router;