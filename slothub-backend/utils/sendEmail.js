// utils/sendEmail.js
const nodemailer = require('nodemailer');
const dns = require('dns');

// Ép Node.js ưu tiên phân giải IPv4 trước để tránh lỗi ENETUNREACH (không hỗ trợ IPv6 trên Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Khởi tạo transporter duy nhất 1 lần khi server khởi động + sử dụng connection pool
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Dùng cổng 587 với STARTTLS
  pool: true,    // Bật Connection Pooling để giữ kết nối SMTP luôn nóng (gửi mail siêu nhanh)
  maxConnections: 5,
  family: 4,     // Ép buộc chỉ dùng IPv4
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async (options) => {
  // Nội dung bức thư
  const mailOptions = {
    from: `SlotHub <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message, // Vẫn giữ lại để luồng Quên mật khẩu cũ chạy bình thường
    html: options.html,    // Thêm dòng này để hỗ trợ gửi giao diện hóa đơn đẹp
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;