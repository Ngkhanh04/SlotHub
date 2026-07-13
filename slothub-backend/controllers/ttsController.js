const { Communicate } = require('edge-tts-universal');

const VOICE = 'vi-VN-HoaiMyNeural';
const MAX_CHARS = 400;

/**
 * GET /api/tts/speak?text=...
 * Giọng Việt Microsoft Edge TTS (Hoài My).
 */
const speakText = async (req, res) => {
    const text = String(req.query.text || '').trim().slice(0, MAX_CHARS);
    if (!text) {
        return res.status(400).json({ message: 'Thiếu nội dung cần đọc' });
    }

    try {
        const communicate = new Communicate(text, { voice: VOICE });
        const buffers = [];

        for await (const chunk of communicate.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
                buffers.push(Buffer.from(chunk.data));
            }
        }

        if (!buffers.length) {
            return res.status(503).json({ message: 'Không nhận được audio từ dịch vụ TTS' });
        }

        const audio = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(audio);
    } catch (err) {
        console.error('[TTS]', err.message);
        return res.status(500).json({ message: 'Lỗi dịch vụ đọc thông báo' });
    }
};

module.exports = { speakText };