const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 3000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    voteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    interactionCount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    rejectReason: { type: String, default: '' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

forumPostSchema.index({ vendor: 1, createdAt: -1 });
forumPostSchema.index({ voteCount: -1 });
forumPostSchema.index({ interactionCount: -1 });
forumPostSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ForumPost', forumPostSchema);