const mongoose = require('mongoose');

const forumCommentSchema = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

forumCommentSchema.index({ post: 1, createdAt: 1 });

module.exports = mongoose.model('ForumComment', forumCommentSchema);