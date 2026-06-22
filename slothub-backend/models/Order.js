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
    
    note: { type: String, default: '' }, 
    deliveryType: { type: String, default: 'pickup' }, // Mặc định là đến lấy
    
    // KHUNG GIỜ NHẬN MÓN
    pickupSlot: { 
        type: String, 
        required: [true, 'Vui lòng chọn khung giờ nhận cơm'] 
    }, 
    
    // 🌟 THÊM MỚI ĐỂ CHẠY PAYOS: Lưu mã đơn hàng dạng số
    orderCode: { type: Number },
    
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
        enum: ['Unpaid', 'Paid', 'Refunded', 'Failed'], 
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