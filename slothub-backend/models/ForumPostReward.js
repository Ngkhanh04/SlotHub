const mongoose = require('mongoose');

const forumPostRewardSchema = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    interactionThreshold: { type: Number, required: true, min: 1 },
    discountAmount: { type: Number, required: true, min: 1000 },
    minOrder: { type: Number, default: 0 },
    validDays: { type: Number, default: 14 },
    status: {
        type: String,
        enum: ['pending', 'eligible', 'issued', 'cancelled'],
        default: 'pending',
    },
    voucherIssued: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorVoucher', default: null },
    issuedAt: { type: Date, default: null },
}, { timestamps: true });

forumPostRewardSchema.index({ post: 1, vendor: 1 }, { unique: true });

module.exports = mongoose.model('ForumPostReward', forumPostRewardSchema);