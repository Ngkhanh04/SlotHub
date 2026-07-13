export const timeToMinutes = (timeStr) => {
  const [h, m] = String(timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const isVendorOpenNow = (openTime, closeTime, now = new Date()) => {
  const current = now.getHours() * 60 + now.getMinutes();
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  if (open === close) return true;
  if (open < close) return current >= open && current <= close;
  return current >= open || current <= close;
};

/** Khung nhận món có nằm trong giờ mở cửa quầy không */
export const isVendorOpenForTimeRange = (openTime, closeTime, rangeStart, rangeEnd) => {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  const s = timeToMinutes(rangeStart);
  const e = timeToMinutes(rangeEnd);

  const overlaps = (segStart, segEnd) => s < segEnd && e > segStart;

  if (open === close) return true;
  if (open < close) return overlaps(open, close);
  return overlaps(open, 24 * 60) || overlaps(0, close);
};

export const getVendorStatusForSlot = (vendor, slot) => {
  if (!vendor) return { isOpen: false, message: 'Quán không khả dụng.' };
  if (vendor.isActive === false) {
    return { isOpen: false, message: `Quầy "${vendor.name}" tạm ngưng nhận đơn.` };
  }
  if (!slot) {
    const open = isVendorOpenNow(vendor.openTime, vendor.closeTime);
    return {
      isOpen: open,
      message: open
        ? 'Đang mở cửa'
        : `Quầy "${vendor.name}" đã đóng cửa (${vendor.openTime} – ${vendor.closeTime}).`,
    };
  }
  const open = isVendorOpenForTimeRange(
    vendor.openTime,
    vendor.closeTime,
    slot.startTime,
    slot.endTime
  );
  const label = `${slot.startTime} – ${slot.endTime}`;
  return {
    isOpen: open,
    message: open
      ? `Mở cửa trong khung ${label}`
      : `Quầy không phục vụ khung ${label} (giờ quầy: ${vendor.openTime} – ${vendor.closeTime}).`,
  };
};

export const getVendorClosedMessage = (vendor) => {
  if (!vendor) return 'Quán không khả dụng.';
  if (vendor.isActive === false) return `Quầy "${vendor.name}" tạm ngưng nhận đơn.`;
  return `Quầy "${vendor.name}" đã đóng cửa (${vendor.openTime} – ${vendor.closeTime}).`;
};

/** Slot còn đặt được hôm nay nếu chưa hết giờ kết thúc khung */
export const isSlotAvailableToday = (slot, now = new Date()) => {
  if (!slot?.endTime && !slot?.startTime) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(slot.endTime || slot.startTime) > nowMin;
};

/** Ẩn khung giờ đã hết hạn khi đặt nhận hôm nay */
export const isSlotPastForToday = (slot, now = new Date()) => !isSlotAvailableToday(slot, now);

export const countTodayPickupSlots = (slots, now = new Date()) =>
  (slots || []).filter((s) => isSlotAvailableToday(s, now)).length;

/** Chọn slot mặc định: khung sắp tới hoặc khung đang diễn ra */
export const pickDefaultSlotId = (slots, pickupDate = 'today') => {
  if (!slots?.length) return '';
  const available = filterSlotsForPickupDate(slots, pickupDate);
  if (!available.length) return '';
  if (String(pickupDate).toLowerCase() === 'tomorrow') {
    return available[0]._id;
  }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const bookable = available.filter((s) => timeToMinutes(s.endTime || s.startTime) > nowMin);
  if (!bookable.length) return '';
  const upcoming = bookable.find((s) => timeToMinutes(s.startTime) > nowMin);
  return (upcoming || bookable[0])._id;
};

export const filterSlotsForPickupDate = (slots, pickupDate = 'today') => {
  if (!slots?.length) return [];
  if (String(pickupDate).toLowerCase() === 'tomorrow') return slots;
  return slots.filter((s) => !isSlotPastForToday(s));
};

export const formatPickupDayLabel = (pickupDate = 'today', now = new Date()) => {
  const d = new Date(now);
  if (String(pickupDate).toLowerCase() === 'tomorrow') {
    d.setDate(d.getDate() + 1);
  }
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

export const formatOrderPickupDisplay = (order, locale = 'vi-VN') => {
  if (!order) return '';
  const slot = order.pickupSlot || '';
  if (order.pickupSlotStartAt) {
    const d = new Date(order.pickupSlotStartAt);
    const dateStr = d.toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    return `${dateStr} · ${slot}`;
  }
  return slot;
};

/** Khung giờ nhận món thật — chỉ dùng ở Checkout */
export const PICKUP_SLOT_STORAGE_KEY = 'slothub_pickup_slot';
export const PICKUP_DATE_STORAGE_KEY = 'slothub_pickup_date';

/** Khung giờ xem menu / lọc quầy mở — chỉ dùng ở Home */
export const MENU_VIEW_SLOT_STORAGE_KEY = 'slothub_menu_view_slot';
