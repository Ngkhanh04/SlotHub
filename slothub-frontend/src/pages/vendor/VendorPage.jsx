import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { PortalThemeProvider, usePortalTheme } from '../../context/PortalThemeContext';
import api from '../../api/axios';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet,
  Settings, LogOut, Bell, ExternalLink, Zap, MessageSquare, ScanLine, Volume2, VolumeX, Gift, Menu, X
} from 'lucide-react';

import VendorMenu from './subpages/VendorMenu';
import VendorDashboard from './subpages/VendorDashboard';
import VendorOrders from './subpages/VendorOrders';
import VendorWallet from './subpages/VendorWallet';
import VendorSettings from './subpages/VendorSettings';
import VendorNotifications from './subpages/VendorNotifications';
import VendorQrPickup from './subpages/VendorQrPickup';
import VendorForum from './subpages/VendorForum';
import BrandLogo from '../../components/BrandLogo';
import MessagingCenter from '../../components/messaging/MessagingCenter';
import PortalThemeToggle from '../../components/PortalThemeToggle';
import { connectUserSocket } from '../../utils/socket';
import { playNewOrderBell, unlockNotificationAudio } from '../../utils/notificationSound';
import {
  isVoiceAlertEnabled,
  setVoiceAlertEnabled,
  speakNewOrderAlert,
  speakVoicePreview,
  unlockNotificationVoice,
  isVoiceUnlocked,
} from '../../utils/notificationVoice';

const unlockAllNotificationMedia = () => {
  unlockNotificationAudio();
  unlockNotificationVoice();
};

const VendorPageContent = () => {
  const { user, logout } = useContext(AuthContext);
  const { theme, isDark } = usePortalTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [forumEligible, setForumEligible] = useState(0);
  const [time, setTime] = useState(new Date());
  const [bellRinging, setBellRinging] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => isVoiceAlertEnabled());
  const [voiceReady, setVoiceReady] = useState(() => isVoiceUnlocked());
  const [orderToast, setOrderToast] = useState(null);
  const [payoutUnread, setPayoutUnread] = useState(0);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const announcedOrders = useRef(new Set());
  const myVendorIdRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (user && user.role !== 'vendor' && user.role !== 'vendor_owner') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const onFirstInteraction = async () => {
      await unlockAllNotificationMedia();
      setVoiceReady(isVoiceUnlocked());
    };
    document.addEventListener('click', onFirstInteraction, { once: true });
    document.addEventListener('keydown', onFirstInteraction, { once: true });
    return () => {
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        if (user?.role === 'vendor' || user?.role === 'vendor_owner') {
          const res = await api.get('/vendor/notifications');
          setUnreadCount(res.data.unreadCount || 0);
          setPayoutUnread(res.data.payoutUnreadCount || 0);
        }
      } catch (e) {
        console.error('Lỗi check thông báo quầy:', e);
      }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, [user, activeTab]);

  useEffect(() => {
    const fetchForumSummary = async () => {
      try {
        if (user?.role === 'vendor' || user?.role === 'vendor_owner') {
          const res = await api.get('/forum/vendor/summary');
          setForumEligible(res.data.eligibleCount || 0);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchForumSummary();
    const t = setInterval(fetchForumSummary, 30000);
    return () => clearInterval(t);
  }, [user, activeTab]);

  useEffect(() => {
    const fetchMsgUnread = async () => {
      try {
        if (user?.role === 'vendor' || user?.role === 'vendor_owner') {
          const res = await api.get('/messages/conversations');
          setMsgUnread(res.data.totalUnread || 0);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMsgUnread();
    const t = setInterval(fetchMsgUnread, 30000);
    return () => clearInterval(t);
  }, [user, activeTab]);

  // Realtime: tiếng chuông + cập nhật badge khi có đơn mới
  useEffect(() => {
    const isVendor = user?.role === 'vendor' || user?.role === 'vendor_owner';
    if (!isVendor || !user?._id) return undefined;

    const userId = String(user._id || user.id);
    const socket = connectUserSocket(userId);
    let vendorChannel = null;

    const announceNewOrder = (payload = {}) => {
      const orderKey = String(payload.orderId || '');
      if (!orderKey) return;

      const payloadVendorId = String(payload.vendorId || '');
      const myVendorId = myVendorIdRef.current ? String(myVendorIdRef.current) : '';
      if (myVendorId && payloadVendorId && payloadVendorId !== myVendorId) {
        setOrdersRefreshKey((k) => k + 1);
        return;
      }

      if (announcedOrders.current.has(orderKey)) {
        setOrdersRefreshKey((k) => k + 1);
        return;
      }
      announcedOrders.current.add(orderKey);
      window.setTimeout(() => announcedOrders.current.delete(orderKey), 20000);

      playNewOrderBell();
      speakNewOrderAlert(payload);
      setBellRinging(true);
      window.setTimeout(() => setBellRinging(false), 900);

      const stall = payload.vendorName ? ` · ${payload.vendorName}` : '';
      const totalLine = payload.orderTotal != null
        ? ` · ${Number(payload.orderTotal).toLocaleString('vi-VN')}đ`
        : '';
      setOrderToast({
        title: payload.title || `Có đơn hàng mới${stall}`,
        message: (payload.message || 'Vừa có sinh viên đặt món!') + totalLine,
        orderTotal: payload.orderTotal,
      });
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setOrderToast(null), 9000);
    };

    const onVendorNotification = (noti) => {
      if (noti?.type === 'NEW_ORDER') {
        announceNewOrder(noti);
        setUnreadCount((c) => c + 1);
        setOrdersRefreshKey((k) => k + 1);
      } else if (noti?.type === 'NEW_REVIEW' || noti?.type === 'PAYOUT_CONFIRMED') {
        setUnreadCount((c) => c + 1);
        if (noti?.type === 'PAYOUT_CONFIRMED') {
          setPayoutUnread((c) => c + 1);
          setWalletRefreshKey((k) => k + 1);
          setOrderToast({
            type: 'PAYOUT_CONFIRMED',
            title: noti.title || 'Admin đã chuyển khoản',
            message: noti.message || 'Tiền rút doanh thu đã được chuyển — kiểm tra sao kê ngân hàng.',
          });
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setOrderToast(null), 15000);
        }
      }
    };

    const onNewOrderEvent = () => {
      setOrdersRefreshKey((k) => k + 1);
    };

    socket.on(`vendor_notification_${userId}`, onVendorNotification);

    api.get('/vendor/my-store')
      .then((res) => {
        const vendorId = res.data?.vendor?._id;
        if (!vendorId) return;
        myVendorIdRef.current = vendorId;
        vendorChannel = `new_order_${vendorId}`;
        socket.on(vendorChannel, onNewOrderEvent);
      })
      .catch(() => {});

    return () => {
      socket.off(`vendor_notification_${userId}`, onVendorNotification);
      if (vendorChannel) socket.off(vendorChannel, onNewOrderEvent);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [user?._id, user?.id, user?.role]);

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan Quầy', icon: <LayoutDashboard size={20} /> },
    { id: 'orders', label: 'Quản lý Đơn hàng', icon: <ShoppingBag size={20} /> },
    { id: 'pickup', label: 'Quét nhận món', icon: <ScanLine size={20} /> },
    { id: 'menu', label: 'Quản lý Thực đơn', icon: <UtensilsCrossed size={20} /> },
    { id: 'forum', label: 'Diễn đàn & Voucher', icon: <Gift size={20} /> },
    { id: 'wallet', label: 'Ví & Doanh thu', icon: <Wallet size={20} /> },
    { id: 'messages', label: 'Tin nhắn', icon: <MessageSquare size={20} /> },
    { id: 'notifications', label: 'Thông báo đơn', icon: <Bell size={20} /> },
    { id: 'settings', label: 'Cài đặt Gian hàng', icon: <Settings size={20} /> },
  ];

  return (
    <div
      className="portal-app flex h-screen font-sans overflow-hidden selection:bg-[#F27124] selection:text-white"
      data-portal-theme={theme}
    >
      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`portal-sidebar w-72 border-r flex flex-col shrink-0 z-50 shadow-2xl fixed inset-y-0 left-0 lg:static transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-[#F27124]/10 to-transparent pointer-events-none" />

        <div className="p-7 border-b border-[var(--portal-border-soft)] relative z-10 flex items-center justify-between">
          <div>
            <BrandLogo size="md" variant={isDark ? 'dark' : 'light'} showTagline={false} />
            <p className="text-[#F27124] text-[10px] font-black tracking-widest uppercase mt-2 flex items-center gap-1">
              <Zap size={10} className="fill-[#F27124]" /> Kênh Người Bán
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg border portal-icon-btn hover:text-red-500 transition-all"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 py-6 space-y-1.5 overflow-y-auto custom-scrollbar relative z-10 px-3">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const showBadge =
              (item.id === 'notifications' && unreadCount > 0) ||
              (item.id === 'messages' && msgUnread > 0) ||
              (item.id === 'forum' && forumEligible > 0) ||
              (item.id === 'wallet' && payoutUnread > 0);
            const badgeCount =
              item.id === 'messages' ? msgUnread
                : item.id === 'forum' ? forumEligible
                  : item.id === 'wallet' ? payoutUnread
                    : unreadCount;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  unlockAllNotificationMedia();
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`portal-menu-btn w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all duration-300 relative group overflow-hidden border-l-4 ${
                  isActive ? 'portal-menu-btn-active' : ''
                }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <span className={`transition-transform duration-300 ${isActive ? 'scale-110 text-[#F27124]' : ''}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {showBadge && (
                  <span className="bg-red-500 text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 border-t border-[var(--portal-border-soft)] relative z-10">
          <button
            type="button"
            onClick={() => {
              logout();
              setIsSidebarOpen(false);
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-black transition-all active:scale-95 border border-red-500/20"
          >
            <LogOut size={18} strokeWidth={2.5} /> ĐĂNG XUẤT
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="portal-header px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border portal-icon-btn hover:text-[#F27124] transition-all"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--portal-text)' }}>
                <span className="shrink-0">{menuItems.find((m) => m.id === activeTab)?.icon}</span>
                <span className="truncate">{menuItems.find((m) => m.id === activeTab)?.label}</span>
              </h2>
              <p className="text-xs portal-muted font-medium mt-1 hidden sm:block">
                {time.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PortalThemeToggle />
            <button
              type="button"
              onClick={async () => {
                await unlockAllNotificationMedia();
                const next = !voiceOn;
                setVoiceOn(next);
                setVoiceAlertEnabled(next);
                if (next) {
                  await speakVoicePreview();
                }
                setVoiceReady(isVoiceUnlocked());
              }}
              title={voiceOn ? 'Tắt đọc thông báo đơn (bấm để nghe thử)' : 'Bật đọc thông báo đơn'}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                voiceOn ? 'portal-icon-btn-active text-[#F27124]' : 'portal-icon-btn opacity-60'
              }`}
            >
              {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              type="button"
              onClick={() => {
                unlockAllNotificationMedia();
                setActiveTab('notifications');
              }}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all relative ${
                activeTab === 'notifications' ? 'portal-icon-btn-active' : 'portal-icon-btn'
              } ${bellRinging ? 'animate-bell-ring' : ''}`}
            >
              <Bell size={18} className={bellRinging ? 'text-[#F27124]' : ''} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                  style={{ borderColor: 'var(--portal-badge-border)' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="portal-external-btn flex items-center gap-2 text-sm font-black px-5 py-2.5 rounded-full transition-all duration-300 shadow-sm hover:scale-105 border"
            >
              VỀ TRANG CHỦ <ExternalLink size={16} />
            </button>
          </div>
        </header>

        <div className="portal-main-scroll flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
          {voiceOn && !voiceReady && (
            <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Bật giọng đọc:</strong> Nhấn nút loa 🔊 hoặc click bất kỳ đâu trên trang để kích hoạt âm thanh đọc đơn.
            </div>
          )}
          {orderToast && (
            <div
              role="status"
              className={`fixed top-6 right-8 z-50 max-w-md animate-[scaleIn_0.25s_ease-out] rounded-2xl border shadow-2xl ring-1 ${
                orderToast.type === 'PAYOUT_CONFIRMED'
                  ? 'border-green-500/30 bg-white ring-green-500/10'
                  : 'border-[#F27124]/30 bg-white ring-[#F27124]/10'
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  orderToast.type === 'PAYOUT_CONFIRMED'
                    ? 'bg-green-500/15 text-green-600'
                    : 'bg-[#F27124]/15 text-[#F27124]'
                }`}>
                  {orderToast.type === 'PAYOUT_CONFIRMED' ? <Wallet size={20} /> : <Bell size={20} className={bellRinging ? 'animate-bell-ring' : ''} />}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-black text-slate-900">{orderToast.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{orderToast.message}</p>
                  {voiceOn && orderToast.type !== 'PAYOUT_CONFIRMED' && (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#F27124]">
                      Đang đọc thông báo...
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOrderToast(null)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  Đóng
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderToast(null);
                  setActiveTab(orderToast.type === 'PAYOUT_CONFIRMED' ? 'wallet' : 'orders');
                }}
                className={`w-full border-t py-2.5 text-sm font-black transition ${
                  orderToast.type === 'PAYOUT_CONFIRMED'
                    ? 'border-green-500/15 bg-green-500/5 text-green-700 hover:bg-green-500/10'
                    : 'border-[#F27124]/15 bg-[#F27124]/5 text-[#F27124] hover:bg-[#F27124]/10'
                }`}
              >
                {orderToast.type === 'PAYOUT_CONFIRMED' ? 'Xem ví & mã GD →' : 'Xem đơn ngay →'}
              </button>
            </div>
          )}
          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both h-full">
            {activeTab === 'dashboard' && (
              <VendorDashboard
                onGoSettings={() => setActiveTab('settings')}
                onGoOrders={() => setActiveTab('orders')}
                onGoNotifications={() => setActiveTab('notifications')}
              />
            )}
            {activeTab === 'orders' && (
              <VendorOrders refreshKey={ordersRefreshKey} onGoPickup={() => setActiveTab('pickup')} />
            )}
            {activeTab === 'pickup' && <VendorQrPickup onOrdersRefresh={() => setOrdersRefreshKey((k) => k + 1)} />}
            {activeTab === 'menu' && <VendorMenu />}
            {activeTab === 'forum' && <VendorForum />}
            {activeTab === 'wallet' && <VendorWallet refreshKey={walletRefreshKey} />}
            {activeTab === 'settings' && <VendorSettings />}
            {activeTab === 'messages' && <MessagingCenter mode="vendor" theme={theme} />}
            {activeTab === 'notifications' && (
              <VendorNotifications
                onGoOrders={() => setActiveTab('orders')}
                onGoMenu={() => setActiveTab('menu')}
                onGoWallet={() => setActiveTab('wallet')}
              />
            )}
          </div>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          75% { transform: rotate(3deg); }
        }
        .animate-bell-ring {
          animation: bell-ring 0.85s ease-in-out;
          box-shadow: 0 0 0 3px rgba(242, 113, 36, 0.35);
        }
      `,
        }}
      />
    </div>
  );
};

const VendorPage = () => (
  <PortalThemeProvider>
    <VendorPageContent />
  </PortalThemeProvider>
);

export default VendorPage;