const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    description: { type: String },
    imageUrl: { type: String }, 
    isActive: { type: Boolean, default: true },
    /** Chủ quầy tự tắt tạm (bận/vắng) — khác với isActive do Admin khóa */
    isPaused: { type: Boolean, default: false },
    pauseReason: { type: String, default: '', trim: true, maxlength: 200 },
    pausedAt: { type: Date, default: null },
    openTime: { type: String, default: '07:00' },
    closeTime: { type: String, default: '21:00' }, // Để 21:00 cho SV test dễ
    category: { type: String, default: 'Cơm' }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);