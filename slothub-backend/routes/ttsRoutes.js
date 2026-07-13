const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { speakText } = require('../controllers/ttsController');

router.get(
    '/speak',
    protect,
    authorize('vendor', 'vendor_owner', 'admin'),
    speakText
);

module.exports = router;