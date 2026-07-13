const mongoose = require('mongoose');

const forumVoteSchema = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

forumVoteSchema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ForumVote', forumVoteSchema);