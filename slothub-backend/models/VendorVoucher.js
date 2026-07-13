const mongoose = require('mongoose');

const vendorVoucherSchema = new mongoose.Schema({
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    discountAmount: { type: Number, required: true, min: 1000 },
    minOrder: { type: Number, default: 0 },
    issuedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    forumPost: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', default: null },
    forumReward: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPostReward', default: null },
    status: {
        type: String,
        enum: ['active', 'used', 'expired'],
        default: 'active',
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedOnOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });

vendorVoucherSchema.index({ issuedTo: 1, status: 1 });
vendorVoucherSchema.index({ vendor: 1, code: 1 });

module.exports = mongoose.model('VendorVoucher', vendorVoucherSchema);