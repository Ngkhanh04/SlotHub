const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

const readTwoDigits = (n) => {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    if (ten === 0) return DIGITS[one];
    if (ten === 1) {
        if (one === 0) return 'mười';
        if (one === 5) return 'mười lăm';
        return `mười ${DIGITS[one]}`;
    }
    let result = `${DIGITS[ten]} mươi`;
    if (one === 1) result += ' mốt';
    else if (one === 4) result += ' tư';
    else if (one === 5) result += ' lăm';
    else if (one > 0) result += ` ${DIGITS[one]}`;
    return result;
};

const readThreeDigits = (n) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    if (hundred === 0) return readTwoDigits(rest);
    let result = `${DIGITS[hundred]} trăm`;
    if (rest === 0) return result;
    if (rest < 10) return `${result} lẻ ${DIGITS[rest]}`;
    return `${result} ${readTwoDigits(rest)}`;
};

/** Đọc số tiền bằng chữ — tránh TTS đọc nhầm "40" thành "50" */
const numberToVietnameseSpeech = (amount) => {
    const n = Math.round(Number(amount) || 0);
    if (n <= 0) return 'không đồng';

    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    const parts = [];
    if (millions > 0) parts.push(`${readThreeDigits(millions)} triệu`);
    if (thousands > 0) parts.push(`${readThreeDigits(thousands)} nghìn`);
    if (remainder > 0) parts.push(readThreeDigits(remainder));
    if (parts.length === 0) parts.push('không');

    return `${parts.join(' ')} đồng`;
};

/** Số tiền thu — luôn tính từ giá món × số lượng, không tin totalPrice nếu lệch */
const resolveOrderPayable = (order) => {
    if (!order) return 0;
    const items = Array.isArray(order.items) ? order.items : [];
    const discount = Number(order.discountAmount) || 0;

    if (items.length > 0) {
        const subtotal = items.reduce(
            (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
            0
        );
        return Math.max(0, subtotal - discount);
    }

    return Math.max(0, Number(order.totalPrice) || 0);
};

const formatVndForSpeech = (amount) => numberToVietnameseSpeech(amount);

module.exports = {
    resolveOrderPayable,
    formatVndForSpeech,
    numberToVietnameseSpeech,
};
