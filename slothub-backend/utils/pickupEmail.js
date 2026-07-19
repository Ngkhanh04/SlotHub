const sendEmail = require('./sendEmail');
const { getPickupCodeExpiresAt } = require('./pickupCode');

const formatPickupLine = (order) => {
  const slot = order.pickupSlot || '—';
  if (order.pickupSlotStartAt) {
    const d = new Date(order.pickupSlotStartAt);
    const dateStr = d.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    return `${dateStr} · ${slot}`;
  }
  return slot;
};

const buildOrderBlock = (order, vendorName) => {
  const orderId = String(order._id);
  const otp = order.otpCode || '----';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderId)}`;
  const expiresAt = getPickupCodeExpiresAt(order);
  const expiresText = expiresAt
    ? expiresAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '2 giờ kể từ khi thanh toán';

  const itemsHtml = (order.items || [])
    .map((item) => {
      const name = item.menuItem?.name || 'Món ăn';
      const qty = item.quantity || 1;
      const price = (item.price || 0) * qty;
      return `<tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${name}</td>
              <td style="padding:8px 4px;text-align:center;border-bottom:1px solid #f1f5f9;">x${qty}</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:700;">${price.toLocaleString('vi-VN')}đ</td>
            </tr>`;
    })
    .join('');

  const subtotal = (order.items || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const discount = order.discountAmount || 0;

  let billingHtml = '';
  if (discount > 0) {
    const voucherLabel = order.voucherCode ? `Voucher (${order.voucherCode})` : 'Giảm giá';
    billingHtml = `
      <tr>
        <td colspan="2" style="padding:6px 0;color:#64748b;">Tạm tính</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#334155;">${subtotal.toLocaleString('vi-VN')}đ</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:6px 0;color:#10b981;">${voucherLabel}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#10b981;">-${discount.toLocaleString('vi-VN')}đ</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 0 0;font-weight:700;border-top:1px solid #e2e8f0;">Tổng</td>
        <td style="padding:10px 0 0;text-align:right;font-weight:800;color:#F27124;font-size:16px;border-top:1px solid #e2e8f0;">${(order.totalPrice || 0).toLocaleString('vi-VN')}đ</td>
      </tr>
    `;
  } else {
    billingHtml = `
      <tr>
        <td colspan="2" style="padding-top:10px;font-weight:700;">Tổng</td>
        <td style="padding-top:10px;text-align:right;font-weight:800;color:#F27124;">${(order.totalPrice || 0).toLocaleString('vi-VN')}đ</td>
      </tr>
    `;
  }

  return `
      <div style="border:2px solid #f1f5f9;border-radius:16px;padding:20px;margin-bottom:20px;background:#fafafa;">
        <h3 style="margin:0 0 4px;color:#F27124;font-size:18px;">🏪 ${vendorName}</h3>
        <p style="margin:0 0 12px;color:#64748b;font-size:13px;">Mã đơn: #${orderId.slice(-6)} · Nhận món: ${formatPickupLine(order)}</p>
        <table style="width:100%;font-size:14px;color:#334155;margin-bottom:16px;">
          ${itemsHtml}
          ${billingHtml}
        </table>
        <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;background:#fff;border-radius:12px;padding:16px;border:1px dashed #fed7aa;">
          <img src="${qrUrl}" alt="QR nhận món" width="160" height="160" style="border-radius:8px;" />
          <div>
            <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Mã OTP nhận món</p>
            <p style="margin:0 0 10px;font-size:32px;font-weight:900;letter-spacing:6px;color:#0f172a;">${otp}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Hiện mã QR hoặc đọc OTP cho nhân viên quầy. Hết hạn: <strong>${expiresText}</strong></p>
          </div>
        </div>
      </div>
    `;
};

const sendPickupEmail = async ({ user, orders, vendorNames = {} }) => {
  if (!user?.email || !orders?.length) return;

  const orderBlocks = orders.map((order) => {
    const vid = String(order.vendor?._id || order.vendor || '');
    const vendorName = vendorNames[vid] || order.vendor?.name || 'Quầy căng tin';
    return buildOrderBlock(order, vendorName);
  }).join('');

  const isBatch = orders.length > 1;
  const subject = isBatch
    ? `🍱 [SlotHub] ${orders.length} mã nhận món — thanh toán thành công`
    : `🍱 [SlotHub] Mã nhận món — ${vendorNames[String(orders[0].vendor?._id || orders[0].vendor)] || orders[0].vendor?.name || 'Quầy căng tin'}`;

  const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
          <div style="background:linear-gradient(135deg,#F27124,#ff985e);border-radius:20px 20px 0 0;padding:28px 24px;color:#fff;">
            <h1 style="margin:0;font-size:22px;">SlotHub · Canteen</h1>
            <p style="margin:8px 0 0;opacity:0.95;font-size:14px;">Xin chào ${user.name || 'bạn'}, đơn hàng đã thanh toán thành công!</p>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 20px 20px;box-shadow:0 10px 40px rgba(0,0,0,0.06);">
            <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:0;">
              ${isBatch
      ? `Bạn có <strong>${orders.length} đơn</strong> tại các quầy khác nhau. Mỗi quầy có mã QR và OTP riêng — vui lòng xuất trình đúng mã tại từng quầy khi nhận món.`
      : 'Dưới đây là mã QR và OTP để nhận món tại quầy. Bạn cũng có thể xem lại trong app mục <strong>Đơn hàng</strong>.'}
            </p>
            ${orderBlocks}
            <p style="font-size:12px;color:#94a3b8;text-align:center;margin:24px 0 0;">Email tự động từ SlotHub — không trả lời email này.</p>
          </div>
        </div>
      </body>
      </html>
    `;

  await sendEmail({
    email: user.email,
    subject,
    html,
    message: `Đơn hàng SlotHub đã thanh toán. Mã OTP: ${orders.map((o) => o.otpCode).join(', ')}`,
  });
};

module.exports = { sendPickupEmail, buildOrderBlock };
