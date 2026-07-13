const Notification = require('../models/Notification');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const { resolveOrderPayable, formatVndForSpeech } = require('./orderSpeech');

/** Văn bản TTS — mỗi quầy một số tiền, đọc bằng chữ (bốn mươi nghìn đồng) */
const buildNewOrderSpeakText = (order, student, vendor) => {
    const who = student?.name || student?.email || 'Sinh viên';
    const stallName = vendor?.name || 'quầy';
    const slot = order.pickupSlot || 'chưa chọn giờ';
    const itemCount = Array.isArray(order.items)
        ? order.items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)
        : 0;
    const discount = Number(order.discountAmount) || 0;
    const payable = resolveOrderPayable(order);
    const itemLine = itemCount > 0 ? `${itemCount} món, ` : '';

    let amountLine = `thanh toán ${formatVndForSpeech(payable)}`;
    if (discount > 0) {
        amountLine += `, đã giảm ${formatVndForSpeech(discount)}`;
    }

    return `Chú ý! Quầy ${stallName} có đơn mới từ ${who}. ${itemLine}${amountLine}. Nhận lúc ${slot}.`;
};

const notifyVendorNewOrder = async (req, order, student) => {
    try {
        const freshOrder = order?._id
            ? await Order.findById(order._id)
                .select('items totalPrice discountAmount pickupSlot vendor')
                .lean()
            : null;
        const orderData = freshOrder || (typeof order?.toObject === 'function' ? order.toObject() : order);

        const vendor = await Vendor.findById(orderData.vendor || order.vendor);
        if (!vendor?.owner) return null;

        const ref = String(orderData._id || order._id).slice(-6);
        const who = student?.name || student?.email || 'Sinh viên';
        const payable = resolveOrderPayable(orderData);
        const amount = payable.toLocaleString('vi-VN');
        const slot = orderData.pickupSlot || 'Chưa chọn giờ';
        const speakText = buildNewOrderSpeakText(orderData, student, vendor);

        const noti = await Notification.create({
            audience: 'vendor',
            recipientId: vendor.owner,
            orderId: orderData._id || order._id,
            title: `Đơn mới · ${vendor.name}`,
            message: `${who} vừa đặt đơn #${ref} · ${amount}đ · Nhận: ${slot}`,
            type: 'NEW_ORDER',
            actionLink: 'orders',
            isRead: false,
        });

        const io = req?.app?.get('socketio');
        if (io) {
            const payload = {
                ...(typeof noti.toObject === 'function' ? noti.toObject() : noti),
                speakText,
                orderId: String(orderData._id || order._id),
                vendorId: String(vendor._id),
                vendorName: vendor.name,
                orderTotal: payable,
            };
            io.emit(`vendor_notification_${String(vendor.owner)}`, payload);
            io.emit(`new_order_${String(vendor._id)}`, {
                orderId: String(orderData._id || order._id),
                vendorId: String(vendor._id),
                type: 'NEW_ORDER',
                message: 'Có đơn hàng mới!',
                speakText,
                orderTotal: payable,
                vendorName: vendor.name,
            });
        }
        return noti;
    } catch (err) {
        console.error('[notifyVendorNewOrder]', err.message);
        return null;
    }
};

const notifyVendorNewReview = async (req, menuItem, review, student) => {
    try {
        const vendor = await Vendor.findById(menuItem.vendor);
        if (!vendor?.owner) return null;

        const who = student?.name || 'Sinh viên';
        const stars = '⭐'.repeat(Math.min(5, Math.max(1, Number(review.rating) || 5)));
        const snippet = (review.comment || '').slice(0, 120);

        const noti = await Notification.create({
            audience: 'vendor',
            recipientId: vendor.owner,
            title: 'Đánh giá món mới',
            message: `${who} ${stars} · "${menuItem.name}": ${snippet}`,
            type: 'NEW_REVIEW',
            actionLink: 'menu',
            isRead: false,
        });

        const io = req?.app?.get('socketio');
        if (io) {
            io.emit(`vendor_notification_${vendor.owner}`, noti);
        }
        return noti;
    } catch (err) {
        console.error('[notifyVendorNewReview]', err.message);
        return null;
    }
};

const notifyVendorPayoutConfirmed = async (req, transaction, vendorUser) => {
    try {
        if (!vendorUser?._id && !vendorUser?.id) return null;
        const ownerId = vendorUser._id || vendorUser.id;

        const amount = Number(transaction.amount || 0).toLocaleString('vi-VN');
        const bank = transaction.bankInfo;
        const bankLine = bank?.accountNumber
            ? `${bank.bankName || 'NH'} · ${bank.accountNumber}${bank.accountName ? ` (${bank.accountName})` : ''}`
            : 'tài khoản ngân hàng của bạn';
        const refLine = transaction.transferRef ? ` Mã GD: ${transaction.transferRef}.` : '';
        const noteLine = transaction.adminNote ? ` Ghi chú: ${transaction.adminNote}` : '';

        const noti = await Notification.create({
            audience: 'vendor',
            recipientId: ownerId,
            transactionId: transaction._id,
            title: 'Admin đã chuyển khoản rút doanh thu',
            message: `Đã chuyển ${amount}đ vào ${bankLine}.${refLine}${noteLine} Hãy kiểm tra sao kê ngân hàng.`,
            type: 'PAYOUT_CONFIRMED',
            actionLink: 'wallet',
            isRead: false,
        });

        const io = req?.app?.get('socketio');
        if (io) {
            const payload = typeof noti.toObject === 'function' ? noti.toObject() : noti;
            io.emit(`vendor_notification_${String(ownerId)}`, payload);
        }
        return noti;
    } catch (err) {
        console.error('[notifyVendorPayoutConfirmed]', err.message);
        return null;
    }
};

module.exports = { notifyVendorNewOrder, notifyVendorNewReview, buildNewOrderSpeakText, notifyVendorPayoutConfirmed };
