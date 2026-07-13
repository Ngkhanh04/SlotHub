const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },

    items: [{
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true }
    }],

    totalPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    voucherCode: { type: String, default: '' },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorVoucher', default: null },

    note: { type: String, default: '' },
    deliveryType: { type: String, default: 'pickup' }, // Mặc định là đến lấy

    // KHUNG GIỜ NHẬN MÓN
    pickupSlot: {
        type: String,
        required: [true, 'Vui lòng chọn khung giờ nhận cơm']
    },
    pickupSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot', default: null },
    pickupSlotStartAt: { type: Date, default: null },
    pickupSlotEndAt: { type: Date, default: null },
    pickupDay: { type: String, enum: ['today', 'tomorrow', ''], default: 'today' },

    cancelledBy: { type: String, enum: ['student', 'vendor', 'admin', 'system', ''], default: '' },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    refundPercent: { type: Number, default: 0, min: 0, max: 100 },
    refundAmount: { type: Number, default: 0, min: 0 },

    // 🌟 THÊM MỚI ĐỂ CHẠY PAYOS: Lưu mã đơn hàng dạng số
    orderCode: { type: Number },

    // Nhóm nhiều đơn (nhiều quầy) thanh toán cùng lúc
    checkoutBatchId: { type: String, index: true },

    otpCode: { type: String },
    pickupCodeIssuedAt: { type: Date },
    pickupCodeExpiresAt: { type: Date },

    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Ready', 'Completed', 'Cancelled'],
        default: 'Pending'
    },

    paymentStatus: {
        type: String,
        // 🌟 FIX LỖI TẠI ĐÂY: Đã thêm 'Failed' để Mongoose cho phép lưu trạng thái khi khách hủy đơn PayOS
        enum: ['Unpaid', 'Paid', 'Refunded', 'PartialRefunded', 'Failed'],
        default: 'Unpaid'
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'vnpay', 'payos'], // 🌟 ĐÃ MỞ CỬA CHO PAYOS
        default: 'wallet'
    },
    transactionId: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);