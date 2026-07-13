const mongoose = require('mongoose');

/** Quy tắc voucher chung của quầy — áp dụng mọi bài forum về quầy đó */
const vendorForumRuleSchema = new mongoose.Schema({
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    interactionThreshold: { type: Number, required: true, min: 1, default: 10 },
    discountAmount: { type: Number, required: true, min: 1000, default: 20000 },
    minOrder: { type: Number, default: 0 },
    validDays: { type: Number, default: 14, min: 1, max: 90 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('VendorForumRule', vendorForumRuleSchema);