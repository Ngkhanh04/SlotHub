const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildChatKnowledgeContext } = require('../utils/chatContextBuilder');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;

        // Đổi 'message' thành 'reply' để Frontend hiển thị được trong khung chat
        if (!message) {
            return res.status(400).json({ reply: 'Bạn muốn ăn gì trưa nay? Cứ hỏi mình nhé! 🍱' });
        }

        const { contextText, stats } = await buildChatKnowledgeContext();

        // 🌟 Chuyển sang 1.5-flash để trâu bò hơn, ít dính lỗi Limit
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 800,
            }
        });

        const systemPrompt = `
Bạn là "SlotAI", trợ lý ẩm thực của SlotHub — nền tảng đặt món đa quầy tại doanh nghiệp (giống ShopeeFood nhưng trong campus).
Sinh viên đặt món trước, chọn khung giờ nhận (slot), lấy bằng OTP — không xếp hàng.

DỮ LIỆU THỰC TẾ TỪ DATABASE (cập nhật mỗi lần hỏi):
${contextText}

QUY TẮC BẮT BUỘC:
1. CHỈ gợi ý món/quầy có trong dữ liệu trên. Không bịa món hoặc quầy không tồn tại.
2. Luôn nêu TÊN QUẦY khi gợi ý món (VD: "Cơm sườn @ Quán ABC").
3. Khi hỏi món ngon / nên ăn gì: ưu tiên mục "MÓN ĐƯỢC ĐÁNH GIÁ CAO" và trích review sinh viên (sao + comment).
4. Khi hỏi ít calo / healthy / giảm cân / ăn kiêng:
   - Ưu tiên món có calories thấp trong mục "MÓN ÍT CALO".
   - Nếu món chưa có calories, ƯỚC LƯỢNG hợp lý theo tên, mô tả, danh mục và GHI RÕ "ước lượng khoảng X kcal".
   - So sánh vài lựa chọn (VD: món A ~320 kcal vs món B ~580 kcal).
5. Khi hỏi calo một món cụ thể: dùng số calories trong data; nếu không có thì ước lượng + giải thích ngắn.
6. Khi hỏi quán nào đang mở: dựa "Trạng thái ĐANG MỞ / ĐÓNG CỬA" và giờ mở–đóng.
7. Không gợi ý món [HẾT/TẠM NGƯNG] trừ khi user hỏi cố ý.
8. Trả lời tiếng Việt, ngắn gọn, thân thiện, vibe sinh viên, emoji đồ ăn vừa phải (🍱🥗⭐).
9. Từ chối khéo câu ngoài đề (code, toán, chính trị...) và quay lại đồ ăn SlotHub.

Câu hỏi sinh viên: "${message}"
`;

        const result = await model.generateContent(systemPrompt);
        const aiResponse = result.response.text();

        res.status(200).json({
            reply: aiResponse,
            meta: { vendors: stats.vendors, menuItems: stats.items },
        });
    } catch (error) {
        console.error('❌ Lỗi khi gọi Gemini AI:', error.message);

        // 🛡️ BẮT LỖI 429: Hết lượt gọi (Rate Limit)
        if (error.status === 429 || error.message.includes('429')) {
            return res.status(429).json({
                reply: 'SlotAI vừa trả lời liên tục nên hơi hụt hơi. Sếp đợi khoảng 20 giây rồi chat tiếp nha! ⏳'
            });
        }

        // 🛡️ BẮT LỖI 503: Server Google quá tải
        if (error.status === 503 || error.message.includes('503')) {
            return res.status(503).json({
                reply: 'SlotAI hiện đang có đông người truy cập nên nghẽn mạng. Sếp đợi 10 giây rồi hỏi lại nhé! 🚦'
            });
        }

        // Đổi 'message' thành 'reply' để Frontend đọc được báo lỗi
        res.status(500).json({
            reply: 'Đường truyền đến não SlotAI đang gặp sự cố, vui lòng thử lại sau ít phút nha sếp! 🛠️',
            error: error.message,
        });
    }
};

module.exports = { chatWithAI };