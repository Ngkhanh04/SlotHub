import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { PortalThemeProvider, usePortalTheme } from '../../context/PortalThemeContext';
import api from '../../api/axios';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet,
  Settings, LogOut, Bell, ExternalLink, Zap, MessageSquare, ScanLine, Menu, X
} from 'lucide-react';

import VendorMenu from './subpages/VendorMenu';
import VendorDashboard from './subpages/VendorDashboard';
import VendorOrders from './subpages/VendorOrders';
import VendorWallet from './subpages/VendorWallet';
import VendorSettings from './subpages/VendorSettings';
import VendorNotifications from './subpages/VendorNotifications';
import VendorQrPickup from './subpages/VendorQrPickup';
import BrandLogo from '../../components/BrandLogo';
import MessagingCenter from '../../components/messaging/MessagingCenter';
import PortalThemeToggle from '../../components/PortalThemeToggle';

const VendorPageContent = () => {
  const { user, logout } = useContext(AuthContext);
  const { theme, isDark } = usePortalTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (user && user.role !== 'vendor' && user.role !== 'vendor_owner') {
      navigate('/');
    }
  }, [user, navigate]);

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

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan Quầy', icon: <LayoutDashboard size={20} /> },
    { id: 'orders', label: 'Quản lý Đơn hàng', icon: <ShoppingBag size={20} /> },
    { id: 'pickup', label: 'Quét nhận món', icon: <ScanLine size={20} /> },
    { id: 'menu', label: 'Quản lý Thực đơn', icon: <UtensilsCrossed size={20} /> },
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
              (item.id === 'messages' && msgUnread > 0);
            const badgeCount = item.id === 'messages' ? msgUnread : unreadCount;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
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
              <p className="text-xs portal-muted font-medium mt-1 hidden md:block">
                {time.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PortalThemeToggle />
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all relative ${
                activeTab === 'notifications' ? 'portal-icon-btn-active' : 'portal-icon-btn'
              }`}
            >
              <Bell size={18} />
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
              className="portal-external-btn flex items-center gap-2 text-sm font-black px-3.5 sm:px-5 py-2.5 rounded-full transition-all duration-300 shadow-sm hover:scale-105 border"
            >
              <span className="hidden sm:inline">VỀ TRANG CHỦ</span>
              <ExternalLink size={16} />
            </button>
          </div>
        </header>

        <div className="portal-main-scroll flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
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
            {activeTab === 'wallet' && <VendorWallet />}
            {activeTab === 'settings' && <VendorSettings />}
            {activeTab === 'messages' && <MessagingCenter mode="vendor" theme={theme} />}
            {activeTab === 'notifications' && (
              <VendorNotifications onGoOrders={() => setActiveTab('orders')} onGoMenu={() => setActiveTab('menu')} />
            )}
          </div>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
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
