const express = require('express');
const router = express.Router();
const { createPaymentLink, payosWebhook } = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');

// 1. Route tạo link thanh toán (Khách hàng gọi)
router.post('/create_payment_link', protect, createPaymentLink);

// 2. Route hứng Webhook từ PayOS (PayOS tự động gọi qua cổng POST)
// Lưu ý: Tuyệt đối KHÔNG BỎ hàm protect vào đây nhé, vì server PayOS gọi chứ không phải User
router.post('/payos_webhook', payosWebhook);

module.exports = router;