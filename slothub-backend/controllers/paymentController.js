const Order = require('../models/Order');
const { settleOrderPayment } = require('../utils/settleOrderPayment');
const { notifyVendorNewOrder } = require('../utils/vendorNotify');
const { issuePickupCode } = require('../utils/pickupCode');
const { logOrderStatus } = require('../utils/persistence');
const sendEmail = require('../utils/sendEmail');

// 🌟 KHỞI TẠO PAYOS 🌟
const { PayOS } = require('@payos/node');

const payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// [POST] Tạo link thanh toán PayOS
const createPaymentLink = async (req, res) => {
    try {
        const { orderId } = req.body; 
        
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        
        const generatedOrderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
        order.orderCode = generatedOrderCode; 
        await order.save();

        const CLIENT_URL =
        process.env.NODE_ENV === 'production'
            ? 'https://ngkhanh04.github.io/SlotHub-Toivoa'
            : 'http://localhost:3000';

        const requestData = {
            orderCode: generatedOrderCode,
            amount: order.totalPrice, 
            description: `Thanh toan ${generatedOrderCode}`, // Giữ ngắn dưới 25 ký tự
            
            // 🌟 ĐÃ FIX CHUẨN: Trỏ đúng về route /payment-result của FE và đính kèm orderCode
            returnUrl: `${CLIENT_URL}/#/payment-result?orderCode=${generatedOrderCode}`, 
            cancelUrl: `${CLIENT_URL}/#/payment-result?cancel=true&orderCode=${generatedOrderCode}`
        };

        const paymentLink = await payos.paymentRequests.create(requestData);

        res.status(200).json({ paymentUrl: paymentLink.checkoutUrl });

    } catch (error) {
        console.error("❌ LỖI TẠO LINK PAYOS:", error);
        res.status(500).json({ message: 'Lỗi tạo thanh toán', error: error.message });
    }
};

// [POST] Xử lý Webhook (Nơi PayOS báo tiền nổ)
const payosWebhook = async (req, res) => {
    try {
        const webhookData = payos.webhooks.verify(req.body);

        if (webhookData.code === "00") {
            const orderCode = webhookData.data.orderCode;
            const order = await Order.findOne({ orderCode: orderCode }).populate('user');
            
            if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

            if (order.paymentStatus !== 'Paid') {
                order.paymentStatus = 'Paid';
                order.status = 'Processing'; 
                order.transactionId = webhookData.data.reference; 
                issuePickupCode(order);
                await order.save();

                await logOrderStatus({
                    orderId: order._id,
                    fromStatus: 'Pending',
                    toStatus: 'Processing',
                    changedBy: order.user._id,
                    changedByRole: 'student',
                    note: 'PayOS thanh toán thành công'
                });

                await settleOrderPayment({
                    orderId: order._id,
                    studentUserId: order.user._id,
                    vendorDocId: order.vendor,
                    totalAmount: order.totalPrice,
                    paymentMethod: 'payos' 
                });

                await notifyVendorNewOrder(req, order, order.user);

                if (order.user && order.user.email) {
                    const emailHtml = `<h2>Thanh toán thành công đơn hàng #${orderCode}</h2><p>Cảm ơn bạn đã đặt món tại SlotHub!</p>`; 
                    sendEmail({
                        email: order.user.email,
                        subject: `🍱 [SlotHub] Hóa đơn đặt món thành công`,
                        html: emailHtml
                    }).catch(err => console.log('❌ Lỗi gửi email:', err));
                }

                const io = req.app.get('socketio'); 
                if (io) {
                    io.emit(`new_order_${order.vendor.toString()}`, {
                        orderId: order._id, 
                        message: 'Ting Ting! Có sinh viên vừa quét VietQR thanh toán!',
                    });
                }
            }

            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Giao dịch bị lỗi hoặc hủy' });
        }
    } catch (error) {
        console.error("Lỗi xử lý Webhook:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 🌟 Xử lý Return URL từ Frontend để chặn đứng lỗi Pending 🌟
const verifyPaymentReturn = async (req, res) => {
    try {
        console.log("=========================================");
        console.log("👉 ĐÃ VÀO API KIỂM TRA ĐƠN HÀNG!");
        console.log("👉 DỮ LIỆU NHẬN TỪ URL:", req.query);
        
        const { cancel, orderCode, vnp_ResponseCode } = req.query;
        
        // Nhận diện nếu khách bấm Hủy bên PayOS (cancel=true) hoặc hủy VNPay
        const isCancelled = cancel === 'true' || vnp_ResponseCode === '24';

        if (isCancelled) {
            if (orderCode) {
                console.log(`🔥 ĐANG TIẾN HÀNH HỦY ĐƠN PAYOS CODE: ${orderCode}`);
                
                // Đập thẳng vào Database: Đổi từ Pending -> Cancelled
            const updatedOrder = await Order.findOneAndUpdate(
            { orderCode: Number(orderCode) },
            { status: 'Cancelled', paymentStatus: 'Failed' },
            { returnDocument: 'after' }
            );
                if (updatedOrder) {
                    console.log("✅ HỦY THÀNH CÔNG TRONG DATABASE!");
                } else {
                    console.log("❌ KHÔNG TÌM THẤY ĐƠN HÀNG CÓ MÃ:", orderCode);
                }
            } else {
                 console.log("❌ URL TRẢ VỀ TỪ FRONTEND KHÔNG ĐÍNH KÈM ORDER CODE!");
            }
            return res.status(400).json({ message: "Giao dịch đã bị hủy bởi người dùng." });
        }

        // Nếu khách thanh toán thành công, PayOS Webhook sẽ lo việc cộng tiền.
        // Return URL chỉ mang tính chất trả về thông báo cho FE.
        return res.status(200).json({ message: "Giao dịch thành công!" });

    } catch (error) {
        console.error("❌ LỖI CODE TRONG HÀM VERIFY RETURN:", error);
        res.status(500).json({ message: 'Lỗi xác minh thanh toán', error: error.message });
    }
};

module.exports = { createPaymentLink, payosWebhook, verifyPaymentReturn };