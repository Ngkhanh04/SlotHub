const SystemConfig = require('../models/SystemConfig');
const { timeToMinutes } = require('./vendorHours');

const CONFIG_KEY = 'cancellation_policy';

const DEFAULT_POLICY = {
    noRefundWithinMinutes: 60,
    tiers: [
        { minMinutesBefore: 240, refundPercent: 100 },
        { minMinutesBefore: 120, refundPercent: 75 },
        { minMinutesBefore: 60, refundPercent: 50 },
    ],
};

const normalizePolicy = (raw) => {
    const policy = { ...DEFAULT_POLICY, ...(raw || {}) };
    policy.noRefundWithinMinutes = Math.max(0, Number(policy.noRefundWithinMinutes) || 60);
    policy.tiers = (Array.isArray(policy.tiers) ? policy.tiers : DEFAULT_POLICY.tiers)
        .map((t) => ({
            minMinutesBefore: Math.max(0, Number(t.minMinutesBefore) || 0),
            refundPercent: Math.min(100, Math.max(0, Number(t.refundPercent) || 0)),
        }))
        .filter((t) => t.minMinutesBefore > 0)
        .sort((a, b) => b.minMinutesBefore - a.minMinutesBefore);
    if (!policy.tiers.length) policy.tiers = [...DEFAULT_POLICY.tiers];
    return policy;
};

const getCancellationPolicy = async () => {
    const doc = await SystemConfig.findOne({ key: CONFIG_KEY }).lean();
    return normalizePolicy(doc?.value);
};

const saveCancellationPolicy = async (value) => {
    const policy = normalizePolicy(value);
    await SystemConfig.findOneAndUpdate(
        { key: CONFIG_KEY },
        { key: CONFIG_KEY, value: policy },
        { upsert: true, new: true }
    );
    return policy;
};

const { computeSlotDateTime } = require('./pickupSchedule');

const computePickupStartAt = (startTime, referenceDate = new Date(), dayOffset = 0) => {
    if (dayOffset > 0) {
        return computeSlotDateTime(startTime, dayOffset, referenceDate);
    }
    const d = computeSlotDateTime(startTime, 0, referenceDate);
    if (d.getTime() < referenceDate.getTime()) {
        const diffMin = (referenceDate.getTime() - d.getTime()) / 60000;
        if (diffMin > 12 * 60) d.setDate(d.getDate() + 1);
    }
    return d;
};

const parsePickupSlotFromLabel = (label, referenceDate = new Date()) => {
    const match = String(label || '').match(/(\d{1,2}:\d{2})/);
    if (!match) return computePickupStartAt('12:00', referenceDate);
    return computePickupStartAt(match[1], referenceDate);
};

const getPickupStartAt = (order) => {
    if (order.pickupSlotStartAt) return new Date(order.pickupSlotStartAt);
    return parsePickupSlotFromLabel(order.pickupSlot, order.createdAt || new Date());
};

const getMinutesUntilPickup = (order, now = new Date()) => {
    const startAt = getPickupStartAt(order);
    return Math.floor((startAt.getTime() - now.getTime()) / 60000);
};

const getRefundPercent = (minutesUntilPickup, policy) => {
    const p = normalizePolicy(policy);
    if (minutesUntilPickup < p.noRefundWithinMinutes) return 0;
    for (const tier of p.tiers) {
        if (minutesUntilPickup >= tier.minMinutesBefore) {
            return tier.refundPercent;
        }
    }
    return 0;
};

const evaluateCancellation = async (order, now = new Date()) => {
    const policy = await getCancellationPolicy();
    const pickupStartAt = getPickupStartAt(order);
    const minutesUntilPickup = getMinutesUntilPickup(order, now);
    const refundPercent = getRefundPercent(minutesUntilPickup, policy);
    const refundAmount = Math.round((order.totalPrice || 0) * refundPercent / 100);

    let message;
    if (minutesUntilPickup < 0) {
        message = 'Đã qua giờ nhận món — không thể hủy hoặc không được hoàn tiền.';
    } else if (refundPercent === 0) {
        message = `Còn ${minutesUntilPickup} phút đến giờ nhận món (< ${policy.noRefundWithinMinutes} phút) — hủy sẽ không được hoàn tiền.`;
    } else if (refundPercent === 100) {
        message = `Hủy sớm — hoàn 100% (${refundAmount.toLocaleString('vi-VN')}đ) vào ví SlotHub.`;
    } else {
        message = `Hoàn ${refundPercent}% (${refundAmount.toLocaleString('vi-VN')}đ) vào ví SlotHub. Phần còn lại không được hoàn do hủy gần giờ nhận món.`;
    }

    return {
        policy,
        pickupStartAt,
        minutesUntilPickup,
        refundPercent,
        refundAmount,
        forfeitAmount: (order.totalPrice || 0) - refundAmount,
        canCancel: minutesUntilPickup >= 0,
        message,
    };
};

const formatPolicyForDisplay = (policy) => {
    const p = normalizePolicy(policy);
    const tierLines = p.tiers.map((t) => ({
        minMinutesBefore: t.minMinutesBefore,
        refundPercent: t.refundPercent,
        label: t.refundPercent === 100
            ? `Trước ≥ ${Math.round(t.minMinutesBefore / 60)} giờ: hoàn 100%`
            : `Trước ≥ ${t.minMinutesBefore} phút: hoàn ${t.refundPercent}%`,
    }));
    return {
        noRefundWithinMinutes: p.noRefundWithinMinutes,
        noRefundLabel: `Dưới ${p.noRefundWithinMinutes} phút trước giờ nhận món: không hoàn tiền`,
        tiers: tierLines,
    };
};

module.exports = {
    CONFIG_KEY,
    DEFAULT_POLICY,
    normalizePolicy,
    getCancellationPolicy,
    saveCancellationPolicy,
    computePickupStartAt,
    getPickupStartAt,
    getMinutesUntilPickup,
    getRefundPercent,
    evaluateCancellation,
    formatPolicyForDisplay,
    timeToMinutes,
};
