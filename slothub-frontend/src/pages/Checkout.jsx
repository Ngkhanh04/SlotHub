import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import {
  ArrowLeft, Wallet, Receipt, Clock, FileText,
  CheckCircle2, AlertCircle, Loader2, Plus, Minus, Trash2, CreditCard,
  Sun, CloudSun, Sunset, Moon, Sparkles, QrCode, Store, CheckSquare, Square, Gift
} from 'lucide-react';
import { PICKUP_SLOT_STORAGE_KEY, PICKUP_DATE_STORAGE_KEY, pickDefaultSlotId, getVendorStatusForSlot, filterSlotsForPickupDate, formatPickupDayLabel, isSlotPastForToday, countTodayPickupSlots } from '../utils/vendorHours';
import { useLocale } from '../context/LocaleContext';
import { appAlert } from '../utils/appAlert';
import LanguageToggle from '../components/LanguageToggle';

/** Chuẩn hóa ID quầy — đồng bộ với backend */
const normalizeVendorId = (vendor) => {
  if (vendor == null) return '';
  if (typeof vendor === 'string') return vendor;
  if (typeof vendor === 'object') {
    const id = vendor._id ?? vendor.id;
    return id != null ? String(id) : '';
  }
  return String(vendor);
};

/** Lấy ID quầy từ món trong giỏ */
const getCartItemVendorId = (cartItem) => normalizeVendorId(cartItem?.menuItem?.vendor);

/** Lấy ID món trong giỏ — hỗ trợ cả populate object và ref string */
const getCartItemMenuId = (cartItem) => {
  const m = cartItem?.menuItem;
  if (!m) return '';
  if (typeof m === 'string') return m;
  const id = m._id ?? m.id;
  return id != null ? String(id) : '';
};

const Checkout = () => {
  const { balance, fetchBalance, user } = useContext(AuthContext);
  const { t } = useLocale();
  const navigate = useNavigate();

  const [cart, setCart] = useState({ items: [], totalPrice: 0, vendorOpen: true, vendorStatusMessage: '' });
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [pickupSlot, setPickupSlot] = useState('');
  const [pickupDate, setPickupDate] = useState('today');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [myVouchers, setMyVouchers] = useState([]);
  const [cancelPolicy, setCancelPolicy] = useState(null);
  const cartInitialized = React.useRef(false);

  const slotIcons = [<Sun size={20} />, <CloudSun size={20} />, <Sunset size={20} />, <Moon size={20} />];
  const slotLabelsRaw = t('pickup.slotLabels');
  const slotLabels = Array.isArray(slotLabelsRaw) ? slotLabelsRaw : ['Bữa sáng', 'Giờ cao điểm', 'Nạp năng lượng', 'Giờ giải lao'];

  useEffect(() => {
    if (!user) return navigate('/login');

    const loadData = async () => {
      try {
        const [cartRes, slotsRes, vouchersRes, policyRes] = await Promise.all([
          api.get('/cart'),
          api.get('/timeslots'),
          api.get('/forum/my-vouchers').catch(() => ({ data: [] })),
          api.get('/orders/cancellation-policy').catch(() => ({ data: null })),
        ]);
        if (cartRes.data?.items) setCart(cartRes.data);
        else if (cartRes.data?.cart) setCart(cartRes.data.cart);
        const cartData = cartRes.data?.items ? cartRes.data : cartRes.data?.cart;
        if (cartData?.items?.length && !cartInitialized.current) {
          const ids = cartData.items.map(getCartItemMenuId).filter(Boolean);
          setSelectedIds(ids);
          cartInitialized.current = true;
        }
        const slots = slotsRes.data || [];
        setTimeSlots(slots);
        const savedDate = localStorage.getItem(PICKUP_DATE_STORAGE_KEY);
        const initialDate = savedDate === 'tomorrow' ? 'tomorrow' : 'today';
        const todaySlotCount = countTodayPickupSlots(slots);
        const resolvedDate = initialDate === 'today' && todaySlotCount === 0 ? 'tomorrow' : initialDate;
        setPickupDate(resolvedDate);
        if (resolvedDate !== initialDate) {
          localStorage.setItem(PICKUP_DATE_STORAGE_KEY, resolvedDate);
        }
        const saved = localStorage.getItem(PICKUP_SLOT_STORAGE_KEY);
        const available = filterSlotsForPickupDate(slots, resolvedDate);
        let initial = '';
        if (saved && available.some((s) => s._id === saved)) {
          initial = saved;
        } else if (available.length) {
          initial = pickDefaultSlotId(slots, resolvedDate);
        }
        if (initial) setPickupSlot(initial);
        setMyVouchers(vouchersRes.data || []);
        setCancelPolicy(policyRes.data || null);
      } catch (err) {
        console.error("Lỗi tải dữ liệu checkout:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ load cart khi đổi user
  }, [user, navigate]);

  const handleUpdateQuantity = async (menuItemId, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity === 0) {
      try {
        const res = await api.delete(`/cart/remove/${menuItemId}`);
        setCart(res.data?.cart || res.data);
        setSelectedIds((prev) => prev.filter((id) => id !== String(menuItemId)));
      } catch (err) {
        console.error("Lỗi xóa món:", err);
      }
      return;
    }
    try {
      const res = await api.post('/cart/add', { menuItemId, quantity: change });
      setCart(res.data?.cart || res.data);
    } catch (err) {
      appAlert(err.response?.data?.message || "Lỗi cập nhật số lượng", { type: 'error' });
    }
  };

  const handleRemoveItem = async (menuItemId) => {
    try {
      const res = await api.delete(`/cart/remove/${menuItemId}`);
      setCart(res.data?.cart || res.data);
      const sid = String(menuItemId);
      setSelectedIds((prev) => prev.filter((id) => id !== sid));
    } catch (err) {
      console.error("Lỗi xóa món:", err);
    }
  };

  const isItemSelected = (cartItemOrId) => {
    const id = typeof cartItemOrId === 'string' ? cartItemOrId : getCartItemMenuId(cartItemOrId);
    return id ? selectedIds.includes(id) : false;
  };

  const availableSlots = useMemo(
    () => filterSlotsForPickupDate(timeSlots, pickupDate),
    [timeSlots, pickupDate]
  );

  const selectedSlot = availableSlots.find((s) => s._id === pickupSlot) || timeSlots.find((s) => s._id === pickupSlot);

  const todaySlotCount = useMemo(() => countTodayPickupSlots(timeSlots), [timeSlots]);

  const handlePickupDateChange = (nextDate) => {
    if (nextDate === 'today' && todaySlotCount === 0) {
      appAlert(t('checkout.pickupNoSlotsToday'), { type: 'warning' });
      return;
    }
    setPickupDate(nextDate);
    localStorage.setItem(PICKUP_DATE_STORAGE_KEY, nextDate);
    const nextId = pickDefaultSlotId(timeSlots, nextDate);
    setPickupSlot(nextId);
    if (nextId) localStorage.setItem(PICKUP_SLOT_STORAGE_KEY, nextId);
    else setPickupSlot('');
  };

  const groupedCart = useMemo(() => {
    const groups = {};
    (cart.items || []).forEach((item) => {
      const vendor = item.menuItem?.vendor;
      const vendorId = normalizeVendorId(vendor) || 'unknown';
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendorId,
          vendorName: vendor?.name || 'Quầy căng tin',
          vendor,
          items: [],
        };
      }
      groups[vendorId].items.push(item);
    });
    return Object.values(groups);
  }, [cart.items]);

  const selectedItems = useMemo(
    () =>
      (cart.items || []).filter((i) => {
        const id = getCartItemMenuId(i);
        return id ? selectedIds.includes(id) : false;
      }),
    [cart.items, selectedIds]
  );

  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + (i.menuItem?.price || 0) * i.quantity, 0),
    [selectedItems]
  );

  const selectedVendorCount = useMemo(() => {
    const ids = new Set(selectedItems.map(getCartItemVendorId).filter(Boolean));
    return ids.size;
  }, [selectedItems]);

  const selectedVendorIds = useMemo(() => {
    return new Set(selectedItems.map(getCartItemVendorId).filter(Boolean));
  }, [selectedItems]);

  const selectedVoucher = useMemo(() => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return null;
    return myVouchers.find((v) => v.code === code) || null;
  }, [myVouchers, voucherCode]);

  const getVoucherVendorId = useCallback((v) => normalizeVendorId(v?.vendor), []);

  const vendorSubtotal = useCallback((vendorId) => {
    const vid = normalizeVendorId(vendorId);
    return selectedItems
      .filter((i) => getCartItemVendorId(i) === vid)
      .reduce((sum, i) => sum + (i.menuItem?.price || 0) * i.quantity, 0);
  }, [selectedItems]);

  const voucherDiscount = useMemo(() => {
    if (!voucherCode.trim()) return 0;
    const v = myVouchers.find((x) => x.code === voucherCode.trim().toUpperCase());
    if (!v) return 0;
    const vid = getVoucherVendorId(v);
    if (!vid || !selectedVendorIds.has(vid)) return 0;
    const sub = vendorSubtotal(vid);
    if (sub < (v.minOrder || 0)) return 0;
    return Math.min(v.discountAmount, sub);
  }, [voucherCode, myVouchers, selectedVendorIds, vendorSubtotal, getVoucherVendorId]);

  const payableTotal = useMemo(
    () => Math.max(0, selectedTotal - voucherDiscount),
    [selectedTotal, voucherDiscount]
  );

  const voucherWarning = useMemo(() => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return null;
    const v = myVouchers.find((x) => x.code === code);
    if (!v) return null;
    const vid = getVoucherVendorId(v);
    const vendorName = v.vendor?.name || 'quầy này';
    if (!selectedVendorIds.has(vid)) {
      return t('checkout.voucherNotInCart', { vendor: vendorName });
    }
    const sub = vendorSubtotal(vid);
    if (sub < (v.minOrder || 0)) {
      return t('checkout.voucherMinOrder', {
        vendor: vendorName,
        amount: Number(v.minOrder).toLocaleString('vi-VN'),
      });
    }
    return null;
  }, [voucherCode, myVouchers, selectedVendorIds, vendorSubtotal, getVoucherVendorId, t]);

  const closedSelectedVendor = useMemo(() => {
    if (!selectedSlot) return null;
    for (const group of groupedCart) {
      const hasSelected = group.items.some((i) => {
        const id = getCartItemMenuId(i);
        return id ? selectedIds.includes(id) : false;
      });
      if (!hasSelected) continue;
      const status = getVendorStatusForSlot(group.vendor, selectedSlot);
      if (!status.isOpen) return status.message;
    }
    return null;
  }, [groupedCart, selectedIds, selectedSlot]);

  const toggleItemSelection = (menuItemId) => {
    const id = String(menuItemId);
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleVendorSelection = (group) => {
    const ids = group.items.map(getCartItemMenuId).filter(Boolean);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      if (allSelected) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const selectAllItems = () => {
    setSelectedIds((cart.items || []).map(getCartItemMenuId).filter(Boolean));
  };

  const isEnoughBalance = balance >= payableTotal;

  const handlePlaceOrder = async () => {
    if (selectedItems.length === 0) {
      return appAlert('Vui lòng chọn ít nhất một món để thanh toán!', { type: 'warning' });
    }
    if (closedSelectedVendor) {
      return appAlert(closedSelectedVendor, { type: 'warning' });
    }
    if (!pickupSlot || !selectedSlot) return appAlert(t('checkout.selectSlot'), { type: 'warning' });
    if (pickupDate === 'today' && isSlotPastForToday(selectedSlot)) {
      return appAlert(t('checkout.pickupNoSlotsToday'), { type: 'warning' });
    }
    if (paymentMethod === 'wallet' && !isEnoughBalance) return;
    if (voucherWarning) {
      return appAlert(voucherWarning, { type: 'warning' });
    }

    setIsProcessing(true);
    try {
      const selectedMenuItemIds = selectedItems.map((i) => getCartItemMenuId(i)).filter(Boolean);
      const res = await api.post('/orders', {
        paymentMethod,
        deliveryType: 'pickup',
        pickupSlot,
        pickupDate,
        note,
        selectedMenuItemIds,
        voucherCode: voucherCode.trim() || undefined,
      });

      const orderCount = res.data.orders?.length || 1;

      if (paymentMethod === 'payos') {
        const frontendOrigin = (window.location.origin + window.location.pathname.replace(/\/checkout\/?$/, '')).replace(/\/$/, '');
        const paymentRes = await api.post('/payment/create_payment_link', {
          orderId: res.data.order?._id || res.data.orders?.[0]?._id,
          batchId: res.data.checkoutBatchId,
          origin: frontendOrigin,
        });
        window.location.href = paymentRes.data.paymentUrl;
        return;
      }

      await appAlert(
        orderCount > 1
          ? `Đã đặt ${orderCount} đơn tại ${orderCount} quầy! Mã QR/OTP đã gửi về email và có trong mục Đơn hàng.`
          : 'Đặt hàng thành công! Mã QR/OTP đã gửi về email và có trong mục Đơn hàng.',
        { type: 'success', title: 'Đặt hàng thành công' }
      );
      await fetchBalance();
      navigate('/orders');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Lỗi khi đặt hàng!';
      appAlert(msg, { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F9FAFB]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={44} className="text-[#F27124] animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">Đang tải dữ liệu thanh toán...</p>
      </div>
    </div>
  );

  if (!cart.items?.length) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#F9FAFB]">
      <Receipt size={64} className="text-gray-300 mb-4" />
      <h2 className="text-2xl font-black text-gray-800 mb-2">Giỏ hàng trống</h2>
      <p className="text-gray-500 font-medium mb-6">Bạn chưa chọn món nào để thanh toán cả.</p>
      <button
        onClick={() => navigate('/')}
        className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
      >
        Quay lại Menu Canteen
      </button>
    </div>
  );

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-24 font-sans text-gray-800 relative">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#F27124]/10 to-transparent pointer-events-none"></div>

      {/* HEADER */}
      <header className="bg-white/70 backdrop-blur-xl px-4 sm:px-8 py-4 shadow-sm sticky top-0 z-50 flex items-center gap-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-white shadow-sm border border-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">{t('checkout.titlePage')}</h1>
          <p className="text-xs text-[#F27124] font-bold mt-1 uppercase tracking-widest flex items-center gap-1">
            <Sparkles size={12} /> Canteen
          </p>
        </div>
        <LanguageToggle className="ml-auto shrink-0" />
      </header>

      <div className="max-w-[1100px] mx-auto mt-8 flex flex-col lg:flex-row gap-8 px-4 relative z-10">

        {/* ================= CỘT TRÁI: THÔNG TIN GIAO HÀNG ================= */}
        <div className="flex-1 space-y-6">

          {/* KHUNG GIỜ */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[100px] pointer-events-none"></div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-2 relative z-10">
              <Clock className="text-[#F27124]" size={24} /> {t('checkout.pickupTitle')}
            </h2>
            <p className="text-xs text-gray-500 font-medium mb-4 relative z-10">{t('checkout.pickupHint')}</p>

            <p className="text-sm font-black text-gray-800 mb-3 relative z-10">{t('checkout.pickupDateTitle')}</p>
            <div className="grid grid-cols-2 gap-3 mb-5 relative z-20">
              {['today', 'tomorrow'].map((day) => {
                const isDaySelected = pickupDate === day;
                const isTodayUnavailable = day === 'today' && todaySlotCount === 0;
                const dayLabel = day === 'today' ? t('checkout.pickupToday') : t('checkout.pickupTomorrow');
                const dayDate = formatPickupDayLabel(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handlePickupDateChange(day)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${isDaySelected
                      ? 'border-[#F27124] bg-orange-50 shadow-md'
                      : isTodayUnavailable
                        ? 'border-gray-100 bg-gray-50 opacity-60'
                        : 'border-gray-100 bg-gray-50 hover:border-orange-200'
                      }`}
                  >
                    <p className={`font-black text-base ${isDaySelected ? 'text-[#F27124]' : 'text-gray-900'}`}>{dayLabel}</p>
                    <p className="text-xs font-bold text-gray-500 mt-1">{dayDate}</p>
                    {isTodayUnavailable && (
                      <p className="text-[10px] font-bold text-amber-700 mt-1">{t('checkout.pickupTodayClosed')}</p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {availableSlots.length === 0 ? (
                <p className="text-amber-700 font-medium col-span-2 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  {t('checkout.pickupNoSlotsToday')}
                </p>
              ) : availableSlots.map((slot, index) => {
                const slotTime = `${slot.startTime} - ${slot.endTime}`;
                const isSelected = pickupSlot === slot._id;
                return (
                  <button
                    key={slot._id}
                    onClick={() => {
                      setPickupSlot(slot._id);
                      localStorage.setItem(PICKUP_SLOT_STORAGE_KEY, slot._id);
                    }}
                    className={`group flex items-center p-4 rounded-2xl border-2 transition-all text-left overflow-hidden relative ${isSelected
                      ? 'border-[#F27124] bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-md scale-[1.02]'
                      : 'border-gray-100 bg-gray-50 hover:border-orange-200 hover:bg-orange-50/30'
                      }`}
                  >
                    <div className={`p-3 rounded-xl mr-4 transition-colors ${isSelected ? 'bg-[#F27124] text-white shadow-lg shadow-orange-500/30' : 'bg-white text-gray-400 border border-gray-200 group-hover:text-[#F27124]'}`}>
                      {slotIcons[index % slotIcons.length]}
                    </div>
                    <div className="flex-1">
                      <p className={`font-black text-lg ${isSelected ? 'text-[#F27124]' : 'text-gray-900'}`}>{slotTime}</p>
                      <p className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-orange-600' : 'text-gray-500'}`}>{slotLabels[index % slotLabels.length]}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-4 text-[#F27124] animate-in zoom-in duration-300">
                        <CheckCircle2 size={24} className="fill-orange-100" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {cancelPolicy && (
              <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-100 relative z-10">
                <p className="text-sm font-black text-amber-900 mb-2">{t('cancellation.title')}</p>
                <p className="text-xs text-amber-800 mb-2">{t('cancellation.hint')}</p>
                <ul className="text-xs text-amber-900 space-y-1 font-medium">
                  {cancelPolicy.tiers?.map((tier) => (
                    <li key={tier.minMinutesBefore}>• {tier.label}</li>
                  ))}
                  <li className="text-red-700 font-bold">• {cancelPolicy.noRefundLabel}</li>
                </ul>
              </div>
            )}
          </div>

          {/* LỜI NHẮN */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-5">
              <FileText className="text-[#F27124]" size={24} /> Ghi chú cho quán <span className="text-sm font-medium text-gray-400 ml-2">(Tùy chọn)</span>
            </h2>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="VD: Cô ơi cho con nhiều tương ớt, không hành..."
              rows="3"
              className="w-full bg-gray-50/50 border border-gray-200 rounded-2xl py-4 px-5 focus:bg-white focus:border-[#F27124] focus:ring-4 focus:ring-orange-50 outline-none transition-all font-medium resize-none text-gray-700"
            ></textarea>
          </div>

          {/* PHƯƠNG THỨC THANH TOÁN */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6">
              <CreditCard className="text-[#F27124]" size={24} /> Phương thức thanh toán
            </h2>

            <div className="flex flex-col sm:flex-row gap-5">

              {/* === VÍ SLOTHUB === */}
              <div
                onClick={() => setPaymentMethod('wallet')}
                className={`group flex-1 p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-center relative overflow-hidden ${paymentMethod === 'wallet'
                  ? 'border-[#F27124] bg-gradient-to-br from-orange-50 to-orange-100/40 shadow-lg shadow-orange-500/10 scale-[1.02]'
                  : 'border-gray-100 bg-gray-50 hover:border-orange-200 hover:bg-orange-50/50'
                  }`}
              >
                <div className="flex items-start gap-4 mb-3 relative z-10">
                  <div className={`p-3.5 rounded-2xl transition-all duration-300 ${paymentMethod === 'wallet'
                    ? 'bg-gradient-to-br from-[#F27124] to-[#D95F1B] text-white shadow-md shadow-orange-500/30'
                    : 'bg-white text-gray-400 border border-gray-200 group-hover:text-[#F27124] group-hover:shadow-sm'
                    }`}>
                    <Wallet size={24} />
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className={`font-black text-lg tracking-tight leading-none mb-1.5 transition-colors ${paymentMethod === 'wallet' ? 'text-[#F27124]' : 'text-gray-900'}`}>
                      Ví SlotHub
                    </span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg w-fit transition-colors ${isEnoughBalance
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                      }`}>
                      Số dư: {balance?.toLocaleString()}đ
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium relative z-10">Thanh toán 1 chạm, không cần chờ đợi</p>
              </div>

              {/* === VIETQR / PAYOS === */}
              <div
                onClick={() => setPaymentMethod('payos')}
                className={`group flex-1 p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-center relative overflow-hidden ${paymentMethod === 'payos'
                  ? 'border-[#00B14F] bg-gradient-to-br from-green-50 to-emerald-100/40 shadow-lg shadow-green-500/10 scale-[1.02]'
                  : 'border-gray-100 bg-gray-50 hover:border-green-200 hover:bg-green-50/50'
                  }`}
              >
                {/* Ánh sáng lấp lánh trang trí góc cho PayOS */}
                {paymentMethod === 'payos' && (
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-[#00B14F]/20 to-transparent rounded-full blur-2xl"></div>
                )}

                <div className="flex items-start gap-4 mb-3 relative z-10">
                  <div className={`p-3.5 rounded-2xl transition-all duration-300 ${paymentMethod === 'payos'
                    ? 'bg-gradient-to-br from-[#00B14F] to-[#008039] text-white shadow-md shadow-green-500/30'
                    : 'bg-white text-gray-400 border border-gray-200 group-hover:text-[#00B14F] group-hover:shadow-sm'
                    }`}>
                    <QrCode size={24} />
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className={`font-black text-lg tracking-tight leading-none mb-1.5 transition-colors ${paymentMethod === 'payos' ? 'text-[#00B14F]' : 'text-gray-900'}`}>
                      Mã VietQR
                    </span>
                    {paymentMethod === 'payos' ? (
                      <span className="text-[10px] uppercase font-black text-[#00B14F] bg-[#00B14F]/15 px-2.5 py-1 rounded-lg w-fit flex items-center gap-1.5">
                        <Sparkles size={12} className="fill-[#00B14F]/50" /> Tự động duyệt
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-black text-gray-400 bg-gray-200/50 px-2.5 py-1 rounded-lg w-fit">
                        Mọi ngân hàng
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium relative z-10">Quét mã QR qua app ngân hàng, MoMo...</p>
              </div>

            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: TÓM TẮT ĐƠN HÀNG ================= */}
        <aside className="w-full lg:w-[420px] shrink-0 h-fit">
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 sticky top-28">
            <h2 className="text-xl font-black mb-2 border-b border-dashed border-gray-200 pb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><Receipt className="text-[#F27124]" size={24} /> Chọn món thanh toán</span>
              <button type="button" onClick={selectAllItems} className="text-xs font-bold text-[#F27124] hover:underline">
                Chọn tất cả
              </button>
            </h2>
            {selectedVendorCount > 1 && (
              <p className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
                {selectedVendorCount} quầy — sẽ tạo {selectedVendorCount} đơn, mỗi quầy một mã QR/OTP riêng
              </p>
            )}

            <div className="space-y-5 mb-6 max-h-[380px] overflow-y-auto custom-scrollbar pr-2">
              {groupedCart.map((group) => {
                const groupIds = group.items.map(getCartItemMenuId).filter(Boolean);
                const groupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.includes(id));
                const groupPartial = groupIds.some((id) => selectedIds.includes(id)) && !groupSelected;
                return (
                  <div key={group.vendorId} className="rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleVendorSelection(group)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 text-left hover:bg-orange-50/50 transition-colors cursor-pointer"
                    >
                      {groupSelected ? <CheckSquare size={18} className="text-[#F27124] shrink-0" /> : groupPartial ? <CheckSquare size={18} className="text-orange-300 shrink-0" /> : <Square size={18} className="text-gray-400 shrink-0" />}
                      <Store size={16} className="text-[#F27124] shrink-0" />
                      <span className="font-black text-sm text-gray-900 flex-1">{group.vendorName}</span>
                    </button>
                    {group.items.map((i) => {
                      const itemId = getCartItemMenuId(i);
                      const checked = isItemSelected(itemId);
                      return (
                        <div key={itemId || i.menuItem?.name} className={`flex flex-col py-3 px-3 border-b border-gray-50 last:border-0 gap-2 ${checked ? '' : 'opacity-60'}`}>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItemSelection(itemId)}
                              className="w-5 h-5 shrink-0 accent-[#F27124] cursor-pointer rounded border-gray-300"
                            />
                            <img src={i.menuItem?.imageUrl || 'https://via.placeholder.com/100'} alt={i.menuItem?.name} className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0 pointer-events-none" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{i.menuItem?.name}</p>
                              <p className="text-[#F27124] font-black text-sm">{i.menuItem?.price?.toLocaleString()}đ</p>
                            </div>
                          </label>
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100 ml-8">
                            <div className="flex items-center">
                              <button type="button" onClick={() => handleUpdateQuantity(itemId, i.quantity, -1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm hover:bg-orange-50 hover:text-[#F27124] transition-colors">
                                {i.quantity === 1 ? <Trash2 size={14} className="text-red-500" /> : <Minus size={14} />}
                              </button>
                              <span className="w-10 text-center font-black text-gray-900">{i.quantity}</span>
                              <button type="button" onClick={() => handleUpdateQuantity(itemId, i.quantity, 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F27124] text-white shadow-sm hover:bg-[#D95F1B] transition-colors">
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-gray-900">{(i.menuItem?.price * i.quantity).toLocaleString()}đ</span>
                              <button type="button" onClick={() => handleRemoveItem(itemId)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/50 p-4">
              <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                <Gift size={16} className="text-green-600" /> {t('checkout.voucher')}
              </label>
              <input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder={t('checkout.voucherPlaceholder')}
                className="w-full border border-green-200 bg-white rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-[#F27124]/30 outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">{t('checkout.voucherHint')}</p>
              {voucherWarning && (
                <p className="text-xs text-amber-700 mt-2 font-bold bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  {voucherWarning}
                </p>
              )}
              {selectedVoucher?.vendor && !voucherWarning && voucherDiscount > 0 && (
                <p className="text-xs text-green-700 mt-2 font-bold">
                  {t('checkout.voucherAppliesTo', { vendor: selectedVoucher.vendor?.name || '' })}
                  {' '}(−{voucherDiscount.toLocaleString('vi-VN')}đ)
                </p>
              )}
              <div className="mt-3">
                <p className="text-xs font-bold text-gray-600 mb-2">{t('checkout.voucherQuickPick')}</p>
                {myVouchers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {myVouchers.slice(0, 8).map((v) => {
                      const vid = getVoucherVendorId(v);
                      const applicable = selectedVendorIds.has(vid);
                      const sub = vendorSubtotal(vid);
                      const meetsMin = sub >= (v.minOrder || 0);
                      const isSelected = voucherCode.trim().toUpperCase() === v.code;
                      const isReady = applicable && meetsMin && sub > 0;

                      return (
                        <button
                          key={v._id}
                          type="button"
                          onClick={() => setVoucherCode(v.code)}
                          className={`text-xs font-bold px-3 py-2 rounded-xl border-2 transition ${isSelected
                            ? 'bg-green-100 border-green-500 text-green-900 shadow-sm'
                            : isReady
                              ? 'bg-white border-green-300 text-gray-800 hover:bg-green-50 hover:border-green-400'
                              : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                            }`}
                        >
                          <span className="font-mono">{v.code}</span>
                          <span className="text-[#F27124] ml-1">−{Number(v.discountAmount).toLocaleString('vi-VN')}đ</span>
                          <span className="block text-[10px] font-semibold mt-0.5 opacity-80">
                            @ {v.vendor?.name}
                            {!applicable && ' · chưa chọn món quầy này'}
                            {applicable && !meetsMin && ` · tối thiểu ${Number(v.minOrder).toLocaleString('vi-VN')}đ`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 font-medium">{t('checkout.voucherEmpty')}</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 font-bold text-sm">Đã chọn ({selectedItems.length} món)</span>
                <span className="font-black text-gray-700">{selectedTotal?.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-500 font-bold text-sm">Phí dịch vụ</span>
                <span className="font-black text-green-500 text-sm">Miễn phí</span>
              </div>
              {voucherDiscount > 0 && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-500 font-bold text-sm">{t('checkout.voucherDiscount')}</span>
                  <span className="font-black text-green-600 text-sm">−{voucherDiscount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-3 border-t border-dashed border-gray-200 mt-2">
                <span className="font-bold text-gray-900">Tổng thanh toán</span>
                <span className="text-3xl font-black text-[#F27124]">{payableTotal?.toLocaleString()}<span className="text-lg text-[#F27124] ml-1">đ</span></span>
              </div>
            </div>

            {closedSelectedVendor && (
              <div className="p-4 rounded-xl mb-6 bg-red-50 border border-red-100 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-600 mb-0.5">Quầy đã chọn không phục vụ</p>
                  <p className="text-xs text-red-500 font-medium">{closedSelectedVendor}</p>
                </div>
              </div>
            )}

            {paymentMethod === 'wallet' && selectedItems.length > 0 && !isEnoughBalance && (
              <div className="p-4 rounded-xl mb-6 bg-red-50 border border-red-100 flex items-start gap-3 animate-in shake">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-600 mb-0.5">Số dư không đủ!</p>
                  <p className="text-xs text-red-500 font-medium">Bạn cần nạp thêm <span className="font-black">{(payableTotal - balance).toLocaleString()}đ</span> vào Ví.</p>
                </div>
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={isProcessing || selectedItems.length === 0 || !!closedSelectedVendor || availableSlots.length === 0 || !pickupSlot || (paymentMethod === 'wallet' && !isEnoughBalance)}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all shadow-xl ${selectedItems.length === 0 || closedSelectedVendor || (paymentMethod === 'wallet' && !isEnoughBalance)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                : paymentMethod === 'payos'
                  ? 'bg-gradient-to-r from-[#00B14F] to-[#009140] text-white shadow-green-500/30 hover:scale-[1.02] active:scale-95'
                  : 'bg-gradient-to-r from-[#F27124] to-[#ff985e] text-white shadow-orange-500/30 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  {selectedItems.length === 0 ? 'CHỌN MÓN ĐỂ THANH TOÁN' : closedSelectedVendor ? 'QUẦY KHÔNG PHỤC VỤ' : paymentMethod === 'payos' ? (
                    <><QrCode size={24} /> QUÉT MÃ THANH TOÁN{selectedVendorCount > 1 ? ` (${selectedVendorCount} ĐƠN)` : ''}</>
                  ) : (
                    isEnoughBalance ? <><CheckCircle2 size={24} /> THANH TOÁN{selectedVendorCount > 1 ? ` ${selectedVendorCount} ĐƠN` : ''}</> : <><Wallet size={24} /> NẠP THÊM TIỀN</>
                  )}
                </>
              )}
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default Checkout;