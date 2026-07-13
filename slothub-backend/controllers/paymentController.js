const Order = require('../models/Order');

const { settleOrderPayment } = require('../utils/settleOrderPayment');

const { notifyVendorNewOrder } = require('../utils/vendorNotify');
const { markVoucherUsed } = require('../utils/forumHelpers');

const { issuePickupCode } = require('../utils/pickupCode');

const { sendPickupEmail } = require('../utils/pickupEmail');

const { logOrderStatus } = require('../utils/persistence');



// 🌟 KHỞI TẠO PAYOS 🌟

const { PayOS } = require('@payos/node');



const payos = new PayOS({

    clientId: process.env.PAYOS_CLIENT_ID,

    apiKey: process.env.PAYOS_API_KEY,

    checksumKey: process.env.PAYOS_CHECKSUM_KEY

});



const getBatchOrders = async (order) => {

    if (order.checkoutBatchId) {

        return Order.find({

            checkoutBatchId: order.checkoutBatchId,

            paymentStatus: { $ne: 'Paid' }

        }).populate('user').populate('vendor', 'name').populate('items.menuItem', 'name price');

    }

    return [order];

};



const finalizePaidOrders = async (req, orders, transactionId) => {

    const paidOrders = [];

    const vendorNames = {};



    for (const order of orders) {

        if (order.paymentStatus === 'Paid') continue;



        order.paymentStatus = 'Paid';

        order.status = 'Processing';

        if (transactionId) order.transactionId = transactionId;

        issuePickupCode(order);

        await order.save();



        await logOrderStatus({

            orderId: order._id,

            fromStatus: 'Pending',

            toStatus: 'Processing',

            changedBy: order.user._id || order.user,

            changedByRole: 'student',

            note: 'PayOS thanh toán thành công'

        });



        await settleOrderPayment({

            orderId: order._id,

            studentUserId: order.user._id || order.user,

            vendorDocId: order.vendor._id || order.vendor,

            totalAmount: order.totalPrice,

            paymentMethod: 'payos'

        });

        if (order.voucherId) {
            await markVoucherUsed(order.voucherId, order._id);
        }



        await notifyVendorNewOrder(req, order, order.user);



        const vid = String(order.vendor?._id || order.vendor);

        vendorNames[vid] = order.vendor?.name || 'Quầy căng tin';

        paidOrders.push(order);

    }



    if (paidOrders.length && orders[0]?.user?.email) {

        const populated = await Order.find({ _id: { $in: paidOrders.map((o) => o._id) } })

            .populate('vendor', 'name')

            .populate('items.menuItem', 'name price imageUrl');

        sendPickupEmail({ user: orders[0].user, orders: populated, vendorNames }).catch((err) =>

            console.log('❌ Lỗi gửi email mã nhận món:', err.message)

        );

    }



    return paidOrders;

};



// [POST] Tạo link thanh toán PayOS

const createPaymentLink = async (req, res) => {

    try {

        const { orderId, batchId } = req.body;



        let primaryOrder = await Order.findById(orderId);

        if (!primaryOrder) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });



        let batchOrders = [primaryOrder];

        if (batchId || primaryOrder.checkoutBatchId) {

            const bid = batchId || primaryOrder.checkoutBatchId;

            batchOrders = await Order.find({

                checkoutBatchId: bid,

                paymentStatus: 'Unpaid',

                status: { $ne: 'Cancelled' }

            });

            if (!batchOrders.length) batchOrders = [primaryOrder];

            primaryOrder = batchOrders[0];

        }



        const totalAmount = batchOrders.reduce((sum, o) => sum + o.totalPrice, 0);

        const generatedOrderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));



        primaryOrder.orderCode = generatedOrderCode;

        await primaryOrder.save();



        const requestData = {

            orderCode: generatedOrderCode,

            amount: totalAmount,

            description: `Thanh toan ${generatedOrderCode}`,

            returnUrl: `http://localhost:3000/payment-result?orderCode=${generatedOrderCode}`,

            cancelUrl: `http://localhost:3000/payment-result?cancel=true&orderCode=${generatedOrderCode}`

        };



        const paymentLink = await payos.paymentRequests.create(requestData);



        res.status(200).json({

            paymentUrl: paymentLink.checkoutUrl,

            orderCount: batchOrders.length,

            totalAmount

        });



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

            const order = await Order.findOne({ orderCode }).populate('user').populate('vendor', 'name');



            if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });



            const batchOrders = await getBatchOrders(order);

            await finalizePaidOrders(req, batchOrders, webhookData.data.reference);



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

        const { cancel, orderCode, vnp_ResponseCode } = req.query;



        const isCancelled = cancel === 'true' || vnp_ResponseCode === '24';



        if (isCancelled) {

            if (orderCode) {

                const primaryOrder = await Order.findOne({ orderCode: Number(orderCode) });

                if (primaryOrder?.checkoutBatchId) {

                    await Order.updateMany(

                        { checkoutBatchId: primaryOrder.checkoutBatchId, paymentStatus: 'Unpaid' },

                        { status: 'Cancelled', paymentStatus: 'Failed' }

                    );

                } else {

                    await Order.findOneAndUpdate(

                        { orderCode: Number(orderCode) },

                        { status: 'Cancelled', paymentStatus: 'Failed' },

                        { new: true }

                    );

                }

            }

            return res.status(400).json({ message: "Giao dịch đã bị hủy bởi người dùng." });

        }



        return res.status(200).json({ message: "Giao dịch thành công!" });



    } catch (error) {

        console.error("❌ LỖI CODE TRONG HÀM VERIFY RETURN:", error);

        res.status(500).json({ message: 'Lỗi xác minh thanh toán', error: error.message });

    }

};



module.exports = { createPaymentLink, payosWebhook, verifyPaymentReturn };
