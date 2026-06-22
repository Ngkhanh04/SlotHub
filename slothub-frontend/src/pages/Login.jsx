import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Store, UserRound, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios'; 
import { useGoogleLogin } from '@react-oauth/google';
import { useLocale } from '../context/LocaleContext';
import LanguageToggle from '../components/LanguageToggle';

const Login = () => {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  /** login | register | forgot | reset */
  const [partnerView, setPartnerView] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [regData, setRegData] = useState({
    ownerName: '',
    vendorName: '',
    regEmail: '',
    regPassword: '',
    confirmPassword: ''
  });

  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext); 

  const handleLoginSuccess = (data) => {
    const { token, user } = data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (setUser) setUser(user);

    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'vendor' || user.role === 'vendor_owner') navigate('/vendor');
    else navigate('/');
  };

  const handleTraditionalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      handleLoginSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không chính xác!');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);
        setError('');
        const res = await api.post('/auth/google', { access_token: tokenResponse.access_token });
        handleLoginSuccess(res.data);
      } catch (err) {
        setError(err.response?.data?.message || t('login.googleError'));
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => setError('Đăng nhập Google thất bại!')
  });

  const handleRegisterVendor = async (e) => {
    e.preventDefault();
    setError('');

    if (regData.regPassword !== regData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp!');
    }
    if (regData.regPassword.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự!');
    }

    setIsLoading(true);
    try {
      await api.post('/auth/register-vendor', {
        name: regData.ownerName,
        vendorName: regData.vendorName,
        email: regData.regEmail,
        password: regData.regPassword,
        role: 'vendor_owner' 
      });
      
      setSuccessMessage('🎉 Đăng ký mở quầy thành công! Yêu cầu của bạn đang chờ Admin phê duyệt.');
      setTimeout(() => {
        setPartnerView('login');
        setEmail(regData.regEmail);
        setRegData({ ownerName: '', vendorName: '', regEmail: '', regPassword: '', confirmPassword: '' });
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Email này đã được sử dụng hoặc có lỗi xảy ra!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegChange = (e) => {
    setRegData({ ...regData, [e.target.name]: e.target.value });
  };

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const switchPartnerView = (view) => {
    clearMessages();
    setPartnerView(view);
    if (view === 'login') {
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgotpassword', { email: email.trim() });
      setSuccessMessage(res.data.message || t('login.forgotSubtitle'));
      setPartnerView('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được mã. Kiểm tra email hoặc thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (newPassword !== confirmNewPassword) {
      return setError(t('login.passwordMismatch') || 'Mật khẩu xác nhận không khớp!');
    }
    if (newPassword.length < 6) {
      return setError(t('login.passwordMin') || 'Mật khẩu phải có ít nhất 6 ký tự!');
    }
    if (!/^\d{6}$/.test(resetToken.trim())) {
      return setError('Mã xác nhận phải đủ 6 chữ số.');
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/resetpassword', {
        resetToken: resetToken.trim(),
        newPassword
      });
      setSuccessMessage(res.data.message || t('login.resetSuccess'));
      setPassword('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => switchPartnerView('login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Không đổi được mật khẩu. Kiểm tra mã hoặc thử gửi lại mã.');
    } finally {
      setIsLoading(false);
    }
  };

  const partnerTitles = {
    login: { title: 'Chào mừng trở lại', subtitle: 'Đăng nhập để trải nghiệm hệ thống Canteen' },
    register: { title: 'Mở gian hàng mới', subtitle: 'Trở thành đối tác và tiếp cận hàng ngàn sinh viên' },
    forgot: { title: 'Khôi phục mật khẩu', subtitle: 'Nhập email để nhận mã xác nhận bảo mật' },
    reset: { title: 'Tạo mật khẩu mới', subtitle: 'Nhập mã gồm 6 chữ số được gửi tới email của bạn' }
  };
  const { title: pageTitle, subtitle: pageSubtitle } = partnerTitles[partnerView] || partnerTitles.login;

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#F27124] selection:text-white relative overflow-hidden">
      
      {/* Background Orbs xịn xò */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-[#F27124]/20 to-orange-400/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[35%] w-[600px] h-[600px] bg-gradient-to-tl from-blue-500/10 to-transparent blur-[150px] rounded-full pointer-events-none"></div>

      {/* Nửa Trái - Form Đăng Nhập */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 overflow-y-auto">
        
        {/* Toggle Ngôn Ngữ */}
        <div className="absolute top-6 right-6 z-20 bg-white/50 backdrop-blur-md rounded-full border border-gray-200/50 shadow-sm px-2 py-1 hover:bg-white transition-all cursor-pointer">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-8 duration-700 py-10">
          
          <Link to="/" className="inline-block mb-10 transform hover:scale-105 transition-transform">
            <BrandLogo size="lg" />
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
              {pageTitle}
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {pageSubtitle}
            </p>
          </div>
          
          {/* Thông báo Lỗi / Thành công (Style tối giản) */}
          {error && (
            <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 text-red-700 p-4 rounded-r-2xl mb-6 text-sm font-bold flex items-start shadow-sm animate-in shake">
               <ShieldCheck size={18} className="mr-3 shrink-0 mt-0.5 text-red-500" /> 
               <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50/80 backdrop-blur-sm border-l-4 border-emerald-500 text-emerald-700 p-4 rounded-r-2xl mb-6 text-sm font-bold flex items-start shadow-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={18} className="mr-3 shrink-0 mt-0.5 text-emerald-500" /> 
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* ================= VIEW: ĐĂNG NHẬP ================= */}
          {partnerView === 'login' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              
              {/* Nút Đăng nhập Google (Dành cho Sinh Viên) */}
              <div className="mb-8">
                <button 
                  type="button" 
                  onClick={() => loginWithGoogle()} 
                  disabled={isLoading} 
                  className="group relative w-full flex justify-center items-center py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-black text-gray-700 transition-all duration-300 disabled:opacity-50 hover:border-gray-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] overflow-hidden"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:translate-x-full duration-700 ease-in-out"></div>
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-5 w-5 mr-3 transition-transform group-hover:scale-110" alt="Google" /> 
                  Tiếp tục với Google
                </button>
                <p className="text-center text-[11px] text-gray-400 font-bold mt-3 uppercase tracking-wider">Đăng nhập bằng GmailGoogle</p>
              </div>

              <div className="flex items-center gap-4 mb-8 opacity-60">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Hoặc Đối tác</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300"></div>
              </div>

              {/* Form Đăng nhập Truyền thống (Dành cho Quầy) */}
              <form onSubmit={handleTraditionalLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Email quản trị</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors duration-300" />
                    </div>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:bg-white focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm text-gray-800 placeholder-gray-400 shadow-sm" 
                      placeholder="admin@vendor.com" 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[13px] font-bold text-gray-700">Mật khẩu</label>
                    <button type="button" onClick={() => switchPartnerView('forgot')} className="text-[12px] font-bold text-[#F27124] hover:text-[#D95F1B] transition-colors">
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors duration-300" />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-2xl focus:bg-white focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm text-gray-800 placeholder-gray-400 shadow-sm tracking-wide" 
                      placeholder="••••••••" 
                      required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:bg-black hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 active:scale-[0.98] mt-2">
                  {isLoading ? <Loader2 className="animate-spin" size={18}/> : <>Đăng nhập <ArrowRight size={16} className="ml-1 opacity-80"/></>}
                </button>
                
                <div className="text-center pt-8">
                  <p className="text-[13px] text-gray-500 font-medium">Bạn muốn mở quầy trên hệ thống?</p>
                  <button type="button" onClick={() => switchPartnerView('register')} className="text-gray-900 font-black hover:text-[#F27124] transition-colors mt-1">Đăng ký đối tác ngay</button>
                </div>
              </form>
            </div>
          )}

          {/* ================= VIEW: QUÊN MẬT KHẨU ================= */}
          {partnerView === 'forgot' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Email khôi phục</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:bg-white focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm"
                      placeholder="Nhập email của bạn..."
                      required
                    />
                  </div>
                </div>
                
                <button type="submit" disabled={isLoading} className="w-full bg-[#F27124] text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(242,113,36,0.25)] hover:shadow-[0_8px_25px_rgba(242,113,36,0.35)] hover:bg-[#D95F1B] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><KeyRound size={16} className="opacity-80" /> Gửi mã xác nhận</>}
                </button>
                
                <button type="button" onClick={() => switchPartnerView('login')} className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-gray-500 hover:text-gray-900 py-3 transition-colors mt-2">
                  <ArrowLeft size={16} /> Quay lại đăng nhập
                </button>
              </form>
            </div>
          )}

          {/* ================= VIEW: ĐỔI MẬT KHẨU MỚI ================= */}
          {partnerView === 'reset' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="bg-orange-50/50 border border-orange-100/50 rounded-2xl p-4 mb-6">
                  <p className="text-[12px] text-gray-600 font-medium text-center">
                    Mã xác nhận đã được gửi tới <br/><strong className="text-gray-900 font-black text-sm">{email}</strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Mã xác nhận (6 số)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors" />
                    </div>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-black text-lg tracking-[0.4em] text-center shadow-sm"
                      placeholder="------"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Mật khẩu mới</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors" />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm"
                      placeholder="Tối thiểu 6 ký tự"
                      required minLength={6}
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pb-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Xác nhận mật khẩu</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#F27124] transition-colors" />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm"
                      placeholder="Nhập lại mật khẩu"
                      required minLength={6}
                    />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:bg-black hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Lưu mật khẩu mới'}
                </button>

                <div className="flex items-center justify-between mt-4">
                  <button type="button" onClick={() => switchPartnerView('forgot')} className="text-[12px] font-bold text-[#F27124] hover:text-[#D95F1B]">Gửi lại mã</button>
                  <button type="button" onClick={() => switchPartnerView('login')} className="text-[12px] font-bold text-gray-500 hover:text-gray-900">Về đăng nhập</button>
                </div>
              </form>
            </div>
          )}

          {/* ================= VIEW: ĐĂNG KÝ QUẦY MỚI ================= */}
          {partnerView === 'register' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleRegisterVendor} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Họ và tên Quản lý</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><UserRound className="h-4 w-4 text-gray-400 group-focus-within:text-[#F27124] transition-colors" /></div>
                    <input type="text" name="ownerName" value={regData.ownerName} onChange={handleRegChange} className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm" placeholder="VD: Nguyễn Văn A" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Tên Thương hiệu / Quán</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Store className="h-4 w-4 text-gray-400 group-focus-within:text-[#F27124] transition-colors" /></div>
                    <input type="text" name="vendorName" value={regData.vendorName} onChange={handleRegChange} className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm" placeholder="VD: Cơm Tấm Chú Ba" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Email quản trị</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-gray-400 group-focus-within:text-[#F27124] transition-colors" /></div>
                    <input type="email" name="regEmail" value={regData.regEmail} onChange={handleRegChange} className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm" placeholder="contact@chuba.vn" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-2">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-gray-700 ml-1">Mật khẩu</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400 group-focus-within:text-[#F27124]" /></div>
                      <input type="password" name="regPassword" value={regData.regPassword} onChange={handleRegChange} className="w-full pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm tracking-widest" placeholder="••••••" required minLength={6} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-gray-700 ml-1">Xác nhận</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400 group-focus-within:text-[#F27124]" /></div>
                      <input type="password" name="confirmPassword" value={regData.confirmPassword} onChange={handleRegChange} className="w-full pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#F27124] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-sm shadow-sm tracking-widest" placeholder="••••••" required minLength={6} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-[#F27124] text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(242,113,36,0.25)] hover:shadow-[0_8px_25px_rgba(242,113,36,0.35)] hover:bg-[#D95F1B] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-[0.98] mt-4">
                  {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Gửi yêu cầu mở quầy'}
                </button>
                
                <div className="text-center pt-6">
                  <p className="text-[13px] text-gray-500 font-medium">Đã có tài khoản đối tác?</p>
                  <button type="button" onClick={() => switchPartnerView('login')} className="text-gray-900 font-black hover:text-[#F27124] transition-colors mt-1">Quay lại Đăng nhập</button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Nửa Phải - Banner Hình Ảnh (Chỉ hiện trên màn to) */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative bg-gray-900 p-6 items-center justify-center">
        <div className="absolute inset-0 m-6 rounded-[3rem] overflow-hidden shadow-2xl">
            <img src="https://images.unsplash.com/photo-1555126634-323283e090fa?w=1600&q=80" alt="Delicious food" className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-[20s] ease-out" />
            
            {/* Lớp phủ Gradient đen để text dễ đọc */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
            
            {/* Content Banner */}
            <div className="absolute bottom-16 left-12 right-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl">
                <div className="bg-white p-3 rounded-2xl w-fit mb-6 shadow-lg">
                  <img src={`${process.env.PUBLIC_URL}/logo-mark.svg`} alt="SlotHub" className="w-8 h-8" />
                </div>
                <h3 className="text-4xl font-black mb-4 leading-[1.1] tracking-tight">Hương vị đích thực,<br/>Giao tận tay bạn.</h3>
                <p className="text-gray-200 leading-relaxed font-medium text-sm md:text-base w-[90%]">
                  Nền tảng đặt đồ ăn và thanh toán không tiền mặt hàng đầu dành cho sinh viên. Tiết kiệm thời gian, tận hưởng trọn vẹn từng bữa ăn!
                </p>
                <div className="flex gap-3 mt-8">
                  <span className="bg-black/30 border border-white/10 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1.5"><ShieldCheck size={14} className="text-green-400"/> Bảo mật 100%</span>
                  <span className="bg-black/30 border border-white/10 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1.5"><Store size={14} className="text-[#F27124]"/> Đa dạng gian hàng</span>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;