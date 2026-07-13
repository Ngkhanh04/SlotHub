const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Vendor = require('../models/Vendor');
const TimeSlot = require('../models/TimeSlot');
const crypto = require('crypto');
const { settleOrderPayment, reverseOrderPayment } = require('../utils/settleOrderPayment');
const { getVendorStatus } = require('../utils/vendorHours');
const { notifyVendorNewOrder } = require('../utils/vendorNotify');
const { validateVoucherForOrder, markVoucherUsed, lookupUserVoucher, normalizeVendorId } = require('../utils/forumHelpers');
const { sendPickupEmail } = require('../utils/pickupEmail');
const {
    issuePickupCode,
    isPickupCodeExpired,
    pickupCodeExpiredMessage
} = require('../utils/pickupCode');
const {
    logOrderStatus,
    logPickupVerification,
    logAudit,
    notifyStudent,
    logStudentWallet
} = require('../utils/persistence');
const {
    evaluateCancellation,
    getCancellationPolicy,
    formatPolicyForDisplay,
} = require('../utils/cancellationPolicy');
const {
    resolvePickupSchedule,
    validatePickupSchedule,
} = require('../utils/pickupSchedule');
const mongoose = require('mongoose');

const isVendorRole = (role) => ['vendor', 'vendor_owner'].includes(role);

const parseOrderIdFromQr = (raw) => {
    const text = String(raw || '').trim();
    if (mongoose.Types.ObjectId.isValid(text) && String(new mongoose.Types.ObjectId(text)) === text) {
        return text;
    }
    const match = text.match(/[a-fA-F0-9]{24}/);
    if (match && mongoose.Types.ObjectId.isValid(match[0])) {
        return match[0];
    }
    return null;
};

const applyOrderCompletion = async (order, meta = {}) => {
    if (order.status === 'Completed') {
        return { alreadyCompleted: true };
    }
    const prevStatus = order.status;
    for (const item of order.items) {
        await MenuItem.findByIdAndUpdate(item.menuItem, {
            $inc: { countInStock: -item.quantity, totalSold: item.quantity }
        });
    }
    order.status = 'Completed';
    await order.save();
    await logOrderStatus({
        orderId: order._id,
        fromStatus: prevStatus,
        toStatus: 'Completed',
        changedBy: meta.changedBy,
        changedByRole: meta.changedByRole || 'vendor',
        note: meta.note || 'Nhận món tại quầy'
    });
    if (meta.req && order.user) {
        await notifyStudent(meta.req, {
            userId: order.user,
            title: 'Đã nhận món',
            message: 'Đơn hàng của bạn đã được xác nhận nhận tại quầy.',
            type: 'ORDER_COMPLETED',
            orderId: order._id
        });
    }
    return { alreadyCompleted: false };
};

const CART_POPULATE = {
    path: 'items.menuItem',
    populate: { path: 'vendor', select: 'name openTime closeTime isActive isPaused pauseReason' }
};

const buildVendorGroups = (cartItems, selectedMenuItemIds) => {
    const selectedSet = Array.isArray(selectedMenuItemIds) && selectedMenuItemIds.length
        ? new Set(selectedMenuItemIds.map(String))
        : null;

    const itemsToProcess = cartItems.filter((ci) => {
        const id = ci.menuItem?._id?.toString() || ci.menuItem?.toString();
        return selectedSet ? selectedSet.has(id) : true;
    });

    const vendorGroups = new Map();
    for (const cartItem of itemsToProcess) {
        const vendorId = String(cartItem.menuItem?.vendor?._id || cartItem.menuItem?.vendor || '');
        if (!vendorId) continue;
        if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
        vendorGroups.get(vendorId).push(cartItem);
    }

    return { itemsToProcess, vendorGroups };
};

const processVendorGroup = async (cartItems, slotOpts) => {
    let totalAmount = 0;
    const processedItems = [];
    let vendorId = null;

    for (const cartItem of cartItems) {
        const itemDb = cartItem.menuItem;
        if (!itemDb || itemDb.isAvailable === false || itemDb.countInStock < cartItem.quantity) {
            return {
                error: `Món ${itemDb ? itemDb.name : 'không xác định'} đã hết hoặc không đủ số lượng!`
            };
        }
        vendorId = itemDb.vendor?._id || itemDb.vendor;
        totalAmount += itemDb.price * cartItem.quantity;
        processedItems.push({
            menuItem: itemDb._id,
            quantity: cartItem.quantity,
            price: itemDb.price
        });
    }

    const vendor = await Vendor.findById(vendorId);
    const vendorCheck = getVendorStatus(vendor, slotOpts);
    if (!vendorCheck.isOpen) {
        return { error: vendorCheck.message };
    }

    return { vendorId: normalizeVendorId(vendorId), vendor, totalAmount, processedItems };
};

const removeProcessedCartItems = async (cart, processedMenuItemIds) => {
    const processedSet = new Set(processedMenuItemIds.map(String));
    cart.items = cart.items.filter((ci) => {
        const id = ci.menuItem?._id?.toString() || ci.menuItem?.toString();
        return !processedSet.has(id);
    });
    await cart.save();
};

// 1. [POST] Sinh viên đặt đồ ăn (hỗ trợ chọn món + nhiều quầy)
const createOrder = async (req, res) => {
    try {
        const { paymentMethod, note, pickupSlot, pickupDate, selectedMenuItemIds, voucherCode } = req.body;
        const userId = req.user.id;

        if (!pickupSlot) return res.status(400).json({ message: 'Vui lòng chọn khung giờ nhận hàng!' });
        const slot = await TimeSlot.findById(pickupSlot);
        if (!slot) return res.status(400).json({ message: 'Khung giờ không hợp lệ!' });

        const scheduleCheck = validatePickupSchedule({
            startTime: slot.startTime,
            endTime: slot.endTime,
            pickupDate,
        });
        if (scheduleCheck.error) {
            return res.status(400).json({ message: scheduleCheck.error });
        }

        const pickupSchedule = resolvePickupSchedule({
            startTime: slot.startTime,
            endTime: slot.endTime,
            pickupDate,
        });
        const pickupSlotLabel = `${slot.startTime} - ${slot.endTime}`;
        const { pickupSlotStartAt, pickupSlotEndAt, pickupDay } = pickupSchedule;
        const slotOpts = { slotStart: slot.startTime, slotEnd: slot.endTime };

        const cart = await Cart.findOne({ user: userId }).populate(CART_POPULATE);
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Giỏ hàng đang trống!' });
        }

        const { itemsToProcess, vendorGroups } = buildVendorGroups(cart.items, selectedMenuItemIds);
        if (itemsToProcess.length === 0) {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một món để thanh toán!' });
        }

        const groupEntries = [];
        let grandTotal = 0;
        const processedMenuItemIds = [];

        for (const [_, groupItems] of vendorGroups.entries()) {
            const result = await processVendorGroup(groupItems, slotOpts);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }
            grandTotal += result.totalAmount;
            groupItems.forEach((ci) => {
                processedMenuItemIds.push(ci.menuItem._id.toString());
            });
            groupEntries.push(result);
        }

        const checkoutBatchId = vendorGroups.size > 1 ? crypto.randomUUID() : undefined;
        const createdOrders = [];
        const vendorNames = {};

        let voucherApplied = null;
        if (voucherCode?.trim()) {
            const code = voucherCode.trim();
            const voucher = await lookupUserVoucher({ code, userId });
            if (!voucher) {
                return res.status(400).json({
                    message: 'Mã voucher không hợp lệ hoặc bạn không sở hữu mã này.',
                });
            }

            const voucherVendorId = normalizeVendorId(voucher.vendor);
            const targetGroup = groupEntries.find(
                (g) => normalizeVendorId(g.vendorId) === voucherVendorId
            );

            if (!targetGroup) {
                const vendorDoc = await Vendor.findById(voucher.vendor).select('name');
                return res.status(400).json({
                    message: `Voucher chỉ dùng cho quầy "${vendorDoc?.name || 'này'}". Vui lòng chọn món của quầy đó trong giỏ.`,
                });
            }

            const vResult = await validateVoucherForOrder({
                code,
                userId,
                vendorId: voucherVendorId,
                orderTotal: targetGroup.totalAmount,
            });
            if (vResult.error) {
                return res.status(400).json({ message: vResult.error });
            }

            targetGroup.voucherDiscount = vResult.discount;
            targetGroup.totalAmount -= vResult.discount;
            grandTotal -= vResult.discount;
            voucherApplied = vResult.voucher;
        }

        // --- XỬ LÝ THANH TOÁN VÍ NỘI BỘ ---
        if (paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (user.walletBalance < grandTotal) {
                return res.status(400).json({ message: 'Số dư ví không đủ!' });
            }

            user.walletBalance -= grandTotal;
            await user.save();
            let runningBalance = user.walletBalance + grandTotal;

            for (const group of groupEntries) {
                const newOrder = new Order({
                    user: userId,
                    vendor: group.vendorId,
                    items: group.processedItems,
                    totalPrice: group.totalAmount,
                    discountAmount: group.voucherDiscount || 0,
                    voucherCode: group.voucherDiscount ? voucherApplied?.code : '',
                    voucherId: group.voucherDiscount ? voucherApplied?._id : null,
                    note,
                    pickupSlot: pickupSlotLabel,
                    pickupSlotId: slot._id,
                    pickupSlotStartAt,
                    pickupSlotEndAt,
                    pickupDay,
                    status: 'Processing',
                    paymentStatus: 'Paid',
                    paymentMethod: 'wallet',
                    checkoutBatchId
                });
                issuePickupCode(newOrder);
                await newOrder.save();
                if (group.voucherDiscount && voucherApplied) {
                    await markVoucherUsed(voucherApplied._id, newOrder._id);
                    voucherApplied = null;
                }
                vendorNames[String(group.vendorId)] = group.vendor?.name || 'Quầy căng tin';

                await logOrderStatus({
                    orderId: newOrder._id,
                    fromStatus: '',
                    toStatus: 'Processing',
                    changedBy: userId,
                    changedByRole: 'student',
                    note: 'Đặt đơn & thanh toán ví'
                });
                await settleOrderPayment({
                    orderId: newOrder._id,
                    studentUserId: userId,
                    vendorDocId: group.vendorId,
                    totalAmount: group.totalAmount,
                    paymentMethod: 'wallet'
                });
                await logStudentWallet({
                    userId,
                    amount: -group.totalAmount,
                    balanceAfter: (runningBalance -= group.totalAmount),
                    type: 'PAYMENT',
                    orderId: newOrder._id,
                    description: `Thanh toán đơn #${String(newOrder._id).slice(-6)}`
                });

                await notifyVendorNewOrder(req, newOrder, user);
                createdOrders.push(newOrder);
            }

            await removeProcessedCartItems(cart, processedMenuItemIds);

            const populatedOrders = await Order.find({ _id: { $in: createdOrders.map((o) => o._id) } })
                .populate('vendor', 'name')
                .populate('items.menuItem', 'name price imageUrl');

            sendPickupEmail({ user, orders: populatedOrders, vendorNames }).catch((err) =>
                console.log('❌ Lỗi gửi email mã nhận món:', err.message)
            );

            return res.status(201).json({
                message: createdOrders.length > 1
                    ? `Đặt ${createdOrders.length} đơn tại ${createdOrders.length} quầy thành công!`
                    : 'Đặt đơn thành công!',
                orders: populatedOrders,
                order: populatedOrders[0],
                checkoutBatchId
            });
        }

        // --- XỬ LÝ PAYOS ---
        if (paymentMethod === 'payos') {
            for (const group of groupEntries) {
                const newOrder = new Order({
                    user: userId,
                    vendor: group.vendorId,
                    items: group.processedItems,
                    totalPrice: group.totalAmount,
                    discountAmount: group.voucherDiscount || 0,
                    voucherCode: group.voucherDiscount ? voucherApplied?.code : '',
                    voucherId: group.voucherDiscount ? voucherApplied?._id : null,
                    note,
                    pickupSlot: pickupSlotLabel,
                    pickupSlotId: slot._id,
                    pickupSlotStartAt,
                    pickupSlotEndAt,
                    pickupDay,
                    status: 'Pending',
                    paymentStatus: 'Unpaid',
                    paymentMethod: 'payos',
                    checkoutBatchId
                });
                await newOrder.save();
                vendorNames[String(group.vendorId)] = group.vendor?.name || 'Quầy căng tin';
                await logOrderStatus({
                    orderId: newOrder._id,
                    fromStatus: '',
                    toStatus: 'Pending',
                    changedBy: userId,
                    changedByRole: 'student',
                    note: 'Khởi tạo đơn PayOS'
                });
                createdOrders.push(newOrder);
            }

            await removeProcessedCartItems(cart, processedMenuItemIds);

            const populatedOrders = await Order.find({ _id: { $in: createdOrders.map((o) => o._id) } })
                .populate('vendor', 'name')
                .populate('items.menuItem', 'name price imageUrl');

            return res.status(201).json({
                message: createdOrders.length > 1
                    ? `Khởi tạo ${createdOrders.length} đơn PayOS`
                    : 'Khởi tạo đơn PayOS',
                orders: populatedOrders,
                order: populatedOrders[0],
                checkoutBatchId,
                isPayOS: true
            });
        }

        // --- XỬ LÝ VNPay (Giữ lại dự phòng) ---
        if (paymentMethod === 'vnpay') {
            for (const group of groupEntries) {
                const newOrder = new Order({
                    user: userId,
                    vendor: group.vendorId,
                    items: group.processedItems,
                    totalPrice: group.totalAmount,
                    note,
                    pickupSlot: pickupSlotLabel,
                    pickupSlotId: slot._id,
                    pickupSlotStartAt,
                    pickupSlotEndAt,
                    pickupDay,
                    status: 'Pending',
                    paymentStatus: 'Unpaid',
                    paymentMethod: 'vnpay',
                    checkoutBatchId
                });
                await newOrder.save();
                await logOrderStatus({
                    orderId: newOrder._id,
                    fromStatus: '',
                    toStatus: 'Pending',
                    changedBy: userId,
                    changedByRole: 'student',
                    note: 'Khởi tạo đơn VNPay'
                });
                createdOrders.push(newOrder);
            }

            await removeProcessedCartItems(cart, processedMenuItemIds);

            const populatedOrders = await Order.find({ _id: { $in: createdOrders.map((o) => o._id) } })
                .populate('vendor', 'name')
                .populate('items.menuItem', 'name price imageUrl');

            return res.status(201).json({
                message: 'Khởi tạo đơn VNPay',
                orders: populatedOrders,
                order: populatedOrders[0],
                checkoutBatchId,
                isVNPay: true
            });
        }

        return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ!' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi tạo đơn', error: error.message });
    }
};

// 2. [PUT] Cập nhật trạng thái (Dùng cho Vendor)
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

        if (isVendorRole(req.user.role)) {
            const vendor = await Vendor.findOne({ owner: req.user.id });
            if (!vendor || order.vendor.toString() !== vendor._id.toString()) {
                return res.status(403).json({ message: 'Bạn không có quyền sửa đơn của quầy khác!' });
            }
        }

        // Logic hủy đơn -> Hoàn tiền (vendor/admin: hoàn 100%)
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            if (req.user.role === 'student') {
                return res.status(400).json({
                    message: 'Vui lòng dùng nút "Hủy đơn" để áp dụng chính sách hoàn tiền theo thời gian.',
                    useCancelEndpoint: true,
                });
            }
            const prev = order.status;
            if (order.paymentStatus === 'Paid') {
                await reverseOrderPayment(order, {
                    description: `Hoàn 100% đơn #${String(order._id).slice(-6)} (hủy bởi quầy/hệ thống)`,
                });
                order.paymentStatus = 'Refunded';
                order.refundPercent = 100;
                order.refundAmount = order.totalPrice;
            }
            order.status = status;
            order.cancelledBy = isVendorRole(req.user.role) ? 'vendor' : (req.user.role === 'admin' ? 'admin' : 'system');
            order.cancelledAt = new Date();
            await order.save();
            await logOrderStatus({
                orderId: order._id,
                fromStatus: prev,
                toStatus: 'Cancelled',
                changedBy: req.user.id,
                changedByRole: req.user.role,
                note: 'Hủy đơn'
            });
            return res.status(200).json({ message: 'Cập nhật thành công', order });
        }

        if (status === 'Completed') {
            if (order.paymentStatus === 'Paid' && isPickupCodeExpired(order)) {
                return res.status(400).json({ message: pickupCodeExpiredMessage() });
            }
            await applyOrderCompletion(order, {
                req,
                changedBy: req.user.id,
                changedByRole: req.user.role,
                note: 'Hoàn thành thủ công'
            });
            const populated = await Order.findById(order._id)
                .populate('user', 'name')
                .populate('items.menuItem', 'name price imageUrl');
            return res.status(200).json({ message: 'Cập nhật thành công', order: populated });
        }

        const prev = order.status;
        order.status = status;
        await order.save();
        await logOrderStatus({
            orderId: order._id,
            fromStatus: prev,
            toStatus: status,
            changedBy: req.user.id,
            changedByRole: req.user.role
        });
        if (status === 'Ready' && order.user) {
            await notifyStudent(req, {
                userId: order.user,
                title: 'Đơn sẵn sàng',
                message: 'Quầy đã chuẩn bị xong — bạn có thể đến nhận món.',
                type: 'ORDER_READY',
                orderId: order._id
            });
        }
        res.status(200).json({ message: 'Cập nhật thành công', order });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi cập nhật', error: error.message });
    }
};

// 2b. [POST] Vendor quét QR xác nhận sinh viên nhận món
const verifyVendorPickup = async (req, res) => {
    try {
        if (!isVendorRole(req.user.role)) {
            return res.status(403).json({ message: 'Chỉ chủ quầy mới quét mã nhận đơn!' });
        }

        const vendor = await Vendor.findOne({ owner: req.user.id });
        if (!vendor) {
            return res.status(404).json({ message: 'Bạn chưa có gian hàng!' });
        }

        const { qrData, orderId, otpCode } = req.body;
        let parsedId = parseOrderIdFromQr(orderId || qrData);

        let order;
        if (parsedId) {
            order = await Order.findById(parsedId);
        } else if (otpCode && String(otpCode).trim()) {
            order = await Order.findOne({
                vendor: vendor._id,
                otpCode: String(otpCode).trim(),
                paymentStatus: 'Paid',
                status: { $nin: ['Cancelled'] }
            }).sort({ createdAt: -1 });
        }

        if (!parsedId && !order) {
            return res.status(400).json({
                message: 'Mã không hợp lệ. Quét QR trên app sinh viên hoặc nhập mã OTP 4 số.'
            });
        }

        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
        }

        if (order.vendor.toString() !== vendor._id.toString()) {
            return res.status(403).json({ message: 'Đơn hàng không thuộc quầy của bạn!' });
        }

        if (order.paymentStatus !== 'Paid') {
            return res.status(400).json({ message: 'Đơn chưa thanh toán, không thể giao món.' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: 'Đơn đã bị hủy.' });
        }

        if (order.status === 'Completed') {
            const populatedDone = await Order.findById(order._id)
                .populate('user', 'name phone')
                .populate('items.menuItem', 'name price imageUrl');
            return res.status(200).json({
                success: true,
                alreadyCompleted: true,
                message: 'Đơn đã được xác nhận nhận món trước đó.',
                order: populatedDone
            });
        }

        const pickupAllowed = ['Pending', 'Processing', 'Ready'];
        if (!pickupAllowed.includes(order.status)) {
            return res.status(400).json({ message: `Trạng thái đơn không hợp lệ: ${order.status}` });
        }

        if (otpCode && order.otpCode && String(otpCode).trim() !== order.otpCode) {
            return res.status(400).json({ message: 'Mã OTP không khớp với đơn hàng.' });
        }

        if (isPickupCodeExpired(order)) {
            return res.status(400).json({ message: pickupCodeExpiredMessage(), expired: true });
        }

        const method = parsedId ? 'QR' : (otpCode ? 'OTP' : 'MANUAL_STATUS');
        const { alreadyCompleted } = await applyOrderCompletion(order, {
            req,
            changedBy: req.user.id,
            changedByRole: req.user.role,
            note: `Xác nhận nhận món (${method})`
        });

        await logPickupVerification({
            order: order._id,
            vendor: vendor._id,
            student: order.user,
            verifiedBy: req.user.id,
            method,
            success: true,
            alreadyCompleted,
            otpMatched: otpCode ? String(otpCode).trim() === order.otpCode : undefined,
            note: alreadyCompleted ? 'Đơn đã hoàn thành trước đó' : 'Xác nhận thành công'
        });
        await logAudit({
            actor: req.user.id,
            actorRole: req.user.role,
            action: 'ORDER_PICKUP_VERIFIED',
            entityType: 'Order',
            entityId: order._id,
            metadata: { method, alreadyCompleted }
        });

        const populated = await Order.findById(order._id)
            .populate('user', 'name phone')
            .populate('items.menuItem', 'name price imageUrl');

        res.status(200).json({
            success: true,
            alreadyCompleted,
            message: alreadyCompleted
                ? 'Đơn đã được xác nhận nhận món trước đó.'
                : 'Xác nhận nhận món thành công!',
            order: populated
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi xác nhận nhận món', error: error.message });
    }
};

// 3. [GET] Lấy danh sách đơn hàng cho VENDOR
const getVendorOrders = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ owner: req.user.id });
        if (!vendor) return res.status(404).json({ message: 'Bạn chưa có gian hàng!' });

        const orders = await Order.find({ vendor: vendor._id })
            .populate('user', 'name')
            .populate('items.menuItem', 'name price imageUrl')
            .sort({ createdAt: -1 });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi lấy đơn', error: error.message });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate('vendor', 'name')
            .populate('items.menuItem', 'name price imageUrl')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi lấy đơn hàng', error: error.message });
    }
};

const getCancellationPolicyPublic = async (req, res) => {
    try {
        const policy = await getCancellationPolicy();
        return res.json(formatPolicyForDisplay(policy));
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi tải chính sách hủy đơn' });
    }
};

const previewCancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        if (String(order.user) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: 'Đơn đã được hủy' });
        }
        if (order.status === 'Completed') {
            return res.status(400).json({ message: 'Đơn đã hoàn thành, không thể hủy' });
        }
        if (!['Pending', 'Processing', 'Ready'].includes(order.status)) {
            return res.status(400).json({ message: 'Đơn không thể hủy ở trạng thái hiện tại' });
        }

        if (order.paymentStatus !== 'Paid') {
            return res.json({
                unpaid: true,
                refundPercent: 100,
                refundAmount: 0,
                forfeitAmount: 0,
                message: 'Đơn chưa thanh toán — hủy miễn phí, không bị trừ tiền.',
                canCancel: true,
            });
        }

        const evaluation = await evaluateCancellation(order);
        return res.json({
            unpaid: false,
            pickupSlot: order.pickupSlot,
            pickupStartAt: evaluation.pickupStartAt,
            minutesUntilPickup: evaluation.minutesUntilPickup,
            refundPercent: evaluation.refundPercent,
            refundAmount: evaluation.refundAmount,
            forfeitAmount: evaluation.forfeitAmount,
            totalPrice: order.totalPrice,
            message: evaluation.message,
            canCancel: evaluation.canCancel,
            policy: formatPolicyForDisplay(evaluation.policy),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi xem trước hủy đơn', error: error.message });
    }
};

const cancelMyOrder = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Chỉ sinh viên mới hủy đơn qua chức năng này' });
        }

        const order = await Order.findById(req.params.id).populate('vendor', 'name');
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        if (String(order.user) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Không có quyền hủy đơn này' });
        }
        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: 'Đơn đã được hủy' });
        }
        if (order.status === 'Completed') {
            return res.status(400).json({ message: 'Đơn đã hoàn thành, không thể hủy' });
        }
        if (!['Pending', 'Processing', 'Ready'].includes(order.status)) {
            return res.status(400).json({ message: 'Đơn không thể hủy ở trạng thái hiện tại' });
        }

        const { reason } = req.body || {};
        const prev = order.status;
        let refundPercent = 0;
        let refundAmount = 0;
        let message = 'Đã hủy đơn thành công.';

        if (order.paymentStatus === 'Paid') {
            const evaluation = await evaluateCancellation(order);
            if (!evaluation.canCancel) {
                return res.status(400).json({ message: evaluation.message });
            }
            refundPercent = evaluation.refundPercent;
            refundAmount = evaluation.refundAmount;

            if (refundAmount > 0) {
                await reverseOrderPayment(order, {
                    refundAmount,
                    description: `Hoàn ${refundPercent}% (${refundAmount.toLocaleString('vi-VN')}đ) đơn #${String(order._id).slice(-6)}`,
                });
                order.paymentStatus = refundPercent >= 100 ? 'Refunded' : (refundAmount > 0 ? 'PartialRefunded' : 'Paid');
            }
            message = evaluation.message;
        } else {
            message = 'Đã hủy đơn chưa thanh toán.';
        }

        order.status = 'Cancelled';
        order.cancelledBy = 'student';
        order.cancelledAt = new Date();
        order.cancelReason = reason?.trim() || '';
        order.refundPercent = refundPercent;
        order.refundAmount = refundAmount;
        await order.save();

        await logOrderStatus({
            orderId: order._id,
            fromStatus: prev,
            toStatus: 'Cancelled',
            changedBy: req.user.id,
            changedByRole: 'student',
            note: `Sinh viên hủy — hoàn ${refundPercent}%`,
        });

        const vendor = await Vendor.findById(order.vendor);
        if (vendor?.owner) {
            const io = req.app.get('socketio');
            if (io) {
                io.emit(`notification_${vendor.owner}`, {
                    title: 'Khách hủy đơn',
                    message: `Đơn #${String(order._id).slice(-6)} đã bị hủy${refundAmount ? ` — hoàn ${refundPercent}%` : ' — không hoàn tiền'}.`,
                    type: 'ORDER_CANCELLED',
                    orderId: order._id,
                });
            }
        }

        const populated = await Order.findById(order._id)
            .populate('vendor', 'name')
            .populate('items.menuItem', 'name price imageUrl');

        return res.json({
            message,
            refundPercent,
            refundAmount,
            forfeitAmount: order.totalPrice - refundAmount,
            order: populated,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi hủy đơn', error: error.message });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    updateOrderStatus,
    getVendorOrders,
    verifyVendorPickup,
    getCancellationPolicyPublic,
    previewCancelOrder,
    cancelMyOrder,
};