const express = require('express');
const router = express.Router();

// 🌟 Đã thêm verifyPaymentReturn vào import 🌟
const { createPaymentLink, payosWebhook, verifyPaymentReturn } = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');

// 1. Route tạo link thanh toán (Khách hàng gọi)
router.post('/create_payment_link', protect, createPaymentLink);

// 2. Route hứng Webhook từ PayOS (PayOS tự động gọi qua cổng POST)
// Lưu ý: Tuyệt đối KHÔNG BỎ hàm protect vào đây nhé, vì server PayOS gọi chứ không phải User
router.post('/payos_webhook', payosWebhook); 

// 3. 🌟 HÀM MỚI: Route hứng kết quả trả về từ Frontend để cập nhật Database (Hủy đơn/Thành công) 🌟
router.get('/vnpay_return', verifyPaymentReturn);

module.exports = router;