const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Transaction = require('../models/Transaction');
const { logStudentWallet } = require('./persistence');

const PLATFORM_FEE_RATE = 0.05;

/**
 * Phân bổ tiền sau khi đơn đã thanh toán:
 * - 95% → ví chủ quầy (có thể rút qua lệnh admin duyệt)
 * - 5%  → ví admin (quỹ nền tảng / tiền thực tế hệ thống giữ)
 */
const settleOrderPayment = async ({ orderId, studentUserId, vendorDocId, totalAmount, paymentMethod = 'wallet' }) => {
    const vendorShare = Math.round(totalAmount * (1 - PLATFORM_FEE_RATE));
    const platformShare = totalAmount - vendorShare;

    const vendor = await Vendor.findById(vendorDocId);
    if (vendor?.owner) {
        await User.findByIdAndUpdate(vendor.owner, {
            $inc: { walletBalance: vendorShare }
        });
    }

    const admin = await User.findOne({ role: 'admin' });
    if (admin && platformShare > 0) {
        await User.findByIdAndUpdate(admin._id, {
            $inc: { walletBalance: platformShare }
        });
    }

    const orderRef = String(orderId).slice(-6);

    const paymentTx = await Transaction.create({
        orderId,
        userId: studentUserId,
        vendorId: vendorDocId,
        amount: totalAmount,
        type: 'PAYMENT',
        status: 'SUCCESS',
        paymentMethod: paymentMethod === 'vnpay' ? 'VNPAY' : 'WALLET',
        description: `Thanh toán đơn hàng #${orderRef}`
    });
    if (admin && platformShare > 0) {
        await Transaction.create({
            orderId,
            userId: admin._id,
            vendorId: vendorDocId,
            amount: platformShare,
            type: 'PLATFORM_FEE',
            status: 'SUCCESS',
            description: `Phí sàn 5% đơn #${orderRef}`
        });
    }
};

/**
 * Hoàn tiền khi hủy đơn đã thanh toán (toàn bộ hoặc một phần)
 */
const reverseOrderPayment = async (order, options = {}) => {
    const refundAmount = options.refundAmount != null
        ? Math.min(order.totalPrice, Math.max(0, Math.round(options.refundAmount)))
        : order.totalPrice;

    if (refundAmount <= 0) return { refundAmount: 0 };

    const vendorShare = Math.round(order.totalPrice * (1 - PLATFORM_FEE_RATE));
    const platformShare = order.totalPrice - vendorShare;
    const ratio = refundAmount / order.totalPrice;
    const refundVendor = Math.round(vendorShare * ratio);
    const refundPlatform = refundAmount - refundVendor;

    const student = await User.findById(order.user);
    if (student) {
        student.walletBalance += refundAmount;
        await student.save();
        await logStudentWallet({
            userId: order.user,
            amount: refundAmount,
            balanceAfter: student.walletBalance,
            type: 'REFUND',
            orderId: order._id,
            description: options.description
                || `Hoàn tiền đơn #${String(order._id).slice(-6)}`
        });
    }

    const vendor = await Vendor.findById(order.vendor);
    if (vendor?.owner && refundVendor > 0) {
        await User.findByIdAndUpdate(vendor.owner, {
            $inc: { walletBalance: -refundVendor }
        });
    }

    const admin = await User.findOne({ role: 'admin' });
    if (admin && refundPlatform > 0) {
        await User.findByIdAndUpdate(admin._id, {
            $inc: { walletBalance: -refundPlatform }
        });
    }

    await Transaction.create({
        orderId: order._id,
        userId: order.user,
        vendorId: order.vendor,
        amount: refundAmount,
        type: 'REFUND',
        status: 'SUCCESS',
        description: options.description
            || `Hoàn tiền đơn #${String(order._id).slice(-6)}`
    });

    return { refundAmount, refundVendor, refundPlatform };
};

module.exports = { settleOrderPayment, reverseOrderPayment, PLATFORM_FEE_RATE };
