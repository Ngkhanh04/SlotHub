const { timeToMinutes } = require('./vendorHours');

const PICKUP_CODE_AFTER_SLOT_MS = 30 * 60 * 1000;

const parsePickupDate = (pickupDate) => {
    const v = String(pickupDate || 'today').toLowerCase().trim();
    if (['tomorrow', 'ngay_mai', 'mai', '1'].includes(v)) return 1;
    return 0;
};

const computeSlotDateTime = (timeStr, dayOffset = 0, referenceDate = new Date()) => {
    const [h, m] = String(timeStr || '00:00').split(':').map(Number);
    const d = new Date(referenceDate);
    d.setSeconds(0, 0);
    d.setMilliseconds(0);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
};

const resolvePickupSchedule = ({ startTime, endTime, pickupDate, referenceDate = new Date() }) => {
    const dayOffset = parsePickupDate(pickupDate);
    const pickupSlotStartAt = computeSlotDateTime(startTime, dayOffset, referenceDate);
    const pickupSlotEndAt = computeSlotDateTime(endTime, dayOffset, referenceDate);
    return {
        dayOffset,
        pickupDay: dayOffset === 1 ? 'tomorrow' : 'today',
        pickupSlotStartAt,
        pickupSlotEndAt,
    };
};

const validatePickupSchedule = ({ startTime, endTime, pickupDate, referenceDate = new Date() }) => {
    const dayOffset = parsePickupDate(pickupDate);
    if (dayOffset === 0) {
        const endAt = computeSlotDateTime(endTime || startTime, 0, referenceDate);
        if (endAt.getTime() <= referenceDate.getTime()) {
            return {
                error: 'Khung giờ này đã hết. Vui lòng chọn khung khác hoặc đặt nhận vào ngày mai.',
            };
        }
    }
    return { ok: true };
};

const isSlotPastForToday = (slot, now = new Date()) => {
    if (!slot?.startTime) return true;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return timeToMinutes(slot.startTime) <= nowMin;
};

const computePickupCodeExpiresAt = (order, issuedAt = new Date()) => {
    const pickupEndAt = order.pickupSlotEndAt ? new Date(order.pickupSlotEndAt) : null;
    if (pickupEndAt) {
        const fromEnd = new Date(pickupEndAt.getTime() + PICKUP_CODE_AFTER_SLOT_MS);
        const startAt = order.pickupSlotStartAt ? new Date(order.pickupSlotStartAt) : null;
        if (startAt && fromEnd.getTime() < startAt.getTime()) {
            return new Date(startAt.getTime() + PICKUP_CODE_AFTER_SLOT_MS);
        }
        return fromEnd;
    }
    return new Date(issuedAt.getTime() + 2 * 60 * 60 * 1000);
};

module.exports = {
    PICKUP_CODE_AFTER_SLOT_MS,
    parsePickupDate,
    computeSlotDateTime,
    resolvePickupSchedule,
    validatePickupSchedule,
    isSlotPastForToday,
    computePickupCodeExpiresAt,
};
