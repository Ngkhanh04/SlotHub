const Order = require('../models/Order');
const { settleOrderPayment } = require('../utils/settleOrderPayment');
const { notifyVendorNewOrder } = require('../utils/vendorNotify');
const { issuePickupCode } = require('../utils/pickupCode');
const { logOrderStatus } = require('../utils/persistence');
const sendEmail = require('../utils/sendEmail');

// 🌟 FIX TRIỆT ĐỂ: GỌI CHUẨN API PAYOS PHIÊN BẢN MỚI NHẤT 🌟
const { PayOS } = require('@payos/node');

// 1. Bản mới bắt buộc truyền vào một Object
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

        const requestData = {
            orderCode: generatedOrderCode,
            amount: order.totalPrice,
            description: `Thanh toan ${generatedOrderCode}`, // Giữ ngắn dưới 25 ký tự
            returnUrl: "http://localhost:3000/order/success",
            cancelUrl: "http://localhost:3000/order/cancel"
        };

        // 2. 🌟 HÀM TẠO LINK ĐÃ BỊ ĐỔI TÊN THÀNH paymentRequests.create()
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
        // 3. 🌟 HÀM CHECK WEBHOOK CŨNG BỊ ĐỔI TÊN THÀNH webhooks.verify()
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
                    const emailHtml = `...`;
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

module.exports = { createPaymentLink, payosWebhook };