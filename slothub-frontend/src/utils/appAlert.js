const TYPE_META = {
  success: { title: 'Thành công', accent: '#16a34a' },
  error: { title: 'Có lỗi xảy ra', accent: '#dc2626' },
  warning: { title: 'Lưu ý', accent: '#d97706' },
  info: { title: 'Thông báo', accent: '#F27124' },
};

let showAlertHandler = null;
let showConfirmHandler = null;

export function registerAppAlertHandlers({ show, showConfirm }) {
  showAlertHandler = show;
  showConfirmHandler = showConfirm;
}

function inferType(message) {
  const text = String(message || '').toLowerCase();
  if (/🎉|thành công|đã gửi|đã đặt|đã lưu|đã xuất|cảm ơn/.test(text)) return 'success';
  if (/⛔|cảnh báo/.test(text)) return 'warning';
  if (/lỗi|thất bại|failed|error/.test(text)) return 'error';
  if (/vui lòng|chưa |không đủ/.test(text)) return 'warning';
  return 'info';
}

function normalizeOptions(message, options = {}) {
  const payload = typeof message === 'object' && message !== null && !options.message
    ? { ...message }
    : { message: String(message ?? ''), ...options };

  const type = payload.type || inferType(payload.message);
  const meta = TYPE_META[type] || TYPE_META.info;

  return {
    type,
    title: payload.title || meta.title,
    message: payload.message || '',
    confirmText: payload.confirmText || 'Đồng ý',
    cancelText: payload.cancelText || 'Hủy',
  };
}

/** Hiển thị modal thông báo (thay cho window.alert). Trả về Promise khi người dùng bấm Đồng ý. */
export function appAlert(message, options = {}) {
  const payload = normalizeOptions(message, options);
  if (showAlertHandler) {
    return new Promise((resolve) => {
      showAlertHandler({ ...payload, onClose: resolve });
    });
  }
  console.warn('[appAlert]', payload.message);
  return Promise.resolve();
}

/** Modal xác nhận — trả về Promise<boolean> */
export function appConfirm(message, options = {}) {
  const payload = normalizeOptions(message, { type: 'warning', title: 'Xác nhận', ...options });
  if (!showConfirmHandler) {
    return Promise.resolve(window.confirm(payload.message));
  }
  return new Promise((resolve) => {
    showConfirmHandler({
      ...payload,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export { TYPE_META };