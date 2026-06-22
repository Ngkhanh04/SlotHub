import React from 'react';
import { Link } from 'react-router-dom';
import { Utensils, Mail, Phone, MapPin } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const Footer = () => {
  const { t } = useLocale();

  return (
    <footer className="bg-[#111827] text-white pt-16 pb-8 border-t border-gray-800 relative overflow-hidden">
      
      {/* Vòng sáng trang trí nền */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F27124] opacity-[0.05] blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-[1440px] mx-auto px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* CỘT 1: BRANDING */}
          <div className="flex flex-col">
            <Link to="/" className="flex items-center gap-2 mb-6 group w-fit">
              <div className="bg-gradient-to-br from-[#F27124] to-[#ff985e] p-2.5 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Utensils size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">SlotHub</h1>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/profile.php?id=61590577986935" // Thay link Facebook của bạn vào đây
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook SlotHub"
                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#F27124] hover:text-white transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>

              <a
                href="https://www.instagram.com/slothub.vn/" // Thay link Instagram của bạn vào đây
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram SlotHub"
                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#F27124] hover:text-white transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>

              <a
                href="https://www.tiktok.com/@slothub2026?lang=vi-VN" // Thay link TikTok của bạn vào đây
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok SlotHub"
                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#F27124] hover:text-white transition-all"
              >
                {/* Đã đổi thành SVG TikTok chuẩn */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                >
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.03 1.6 4.17.93 1.05 2.27 1.7 3.69 1.84v3.82c-1.7-.15-3.32-.83-4.57-1.99-.11-.1-.23-.2-.32-.31v5.6c-.02 3.82-2.73 7.22-6.51 7.82-3.83.67-7.61-1.58-8.59-5.35-.99-3.8 1.15-7.79 4.93-8.61.94-.21 1.91-.21 2.85-.02v3.74c-.7-.25-1.47-.27-2.19-.06-1.63.42-2.65 2.1-2.28 3.75.36 1.66 2 2.7 3.67 2.41 1.48-.22 2.54-1.51 2.53-3v-13.8c0-.02.01-.04.01-.06z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* CỘT 2: KHÁM PHÁ */}
          <div>
            <h4 className="text-lg font-black mb-6 text-white uppercase tracking-wider">{t('footer.explore')}</h4>
            <ul className="space-y-4">
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">{t('footer.home')}</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">{t('footer.menuToday')}</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Gian hàng nổi bật</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Khuyến mãi & Ưu đãi</Link></li>
            </ul>
          </div>

          {/* CỘT 3: HỖ TRỢ */}
          <div>
            <h4 className="text-lg font-black mb-6 text-white uppercase tracking-wider">Hỗ trợ</h4>
            <ul className="space-y-4">
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Hướng dẫn đặt món</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Chính sách bảo mật</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Điều khoản dịch vụ</Link></li>
              <li><Link to="/" className="text-gray-400 hover:text-[#F27124] font-medium transition-colors">Câu hỏi thường gặp (FAQ)</Link></li>
            </ul>
          </div>

          {/* CỘT 4: LIÊN HỆ */}
          <div>
            <h4 className="text-lg font-black mb-6 text-white uppercase tracking-wider">Liên hệ</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-[#F27124] shrink-0 mt-1" />
                <span className="text-gray-400 text-sm font-medium leading-relaxed">Khu đô thị FPT City, Ngũ Hành Sơn, Đà Nẵng, Việt Nam</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-[#F27124] shrink-0" />
                <span className="text-gray-400 text-sm font-medium">0866.388.514</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-[#F27124] shrink-0" />
                <span className="text-gray-400 text-sm font-medium">slothub.vn@gmail.com</span>
              </li>
            </ul>
          </div>

        </div>

        {/* COPYRIGHT */}
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm font-medium">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500 font-bold">
            {t('footer.madeWith')} <span className="text-red-500 animate-pulse">❤</span> {t('footer.byTeam')}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;