import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { appAlert } from '../../utils/appAlert';
import { Power, Loader2, Store } from 'lucide-react';

/**
 * Nút tạm tắt / bật lại nhận đơn cho chủ quầy.
 */
const VendorStorePauseToggle = ({
  vendor,
  onUpdated,
  compact = false,
}) => {
  const [isPaused, setIsPaused] = useState(!!vendor?.isPaused);
  const [pauseReason, setPauseReason] = useState(vendor?.pauseReason || '');
  const [saving, setSaving] = useState(false);
  const [showReason, setShowReason] = useState(!!vendor?.isPaused);

  useEffect(() => {
    setIsPaused(!!vendor?.isPaused);
    setPauseReason(vendor?.pauseReason || '');
    setShowReason(!!vendor?.isPaused);
  }, [vendor?.isPaused, vendor?.pauseReason]);

  const handleToggle = async (nextPaused) => {
    if (nextPaused && !pauseReason.trim()) {
      setShowReason(true);
      return appAlert('Nhập lý do tạm tắt (VD: đi việc, hết nguyên liệu...)', { type: 'warning' });
    }

    setSaving(true);
    try {
      const res = await api.put('/vendor/my-store/pause', {
        isPaused: nextPaused,
        pauseReason: nextPaused ? pauseReason.trim() : '',
      });
      setIsPaused(nextPaused);
      setShowReason(nextPaused);
      appAlert(res.data.message, { type: 'success' });
      onUpdated?.(res.data.vendor);
    } catch (err) {
      appAlert(err.response?.data?.message || 'Không cập nhật được trạng thái quầy', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!vendor) return null;

  if (compact) {
    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => handleToggle(!isPaused)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all disabled:opacity-50 ${
          isPaused
            ? 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25'
            : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
        }`}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
        {isPaused ? 'Bật lại nhận đơn' : 'Tạm tắt quầy'}
      </button>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 md:p-6 ${
      isPaused
        ? 'bg-red-500/10 border-red-500/30'
        : 'bg-green-500/5 border-green-500/20'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isPaused ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          }`}>
            <Store size={24} />
          </div>
          <div>
            <h3 className="font-black text-lg">Trạng thái hoạt động quầy</h3>
            <p className="text-sm portal-muted mt-1">
              {isPaused
                ? 'Quầy đang TẮT — sinh viên không đặt món được.'
                : 'Quầy đang BẬT — nhận đơn trong khung giờ mở cửa.'}
            </p>
            {vendor.statusMessage && (
              <p className="text-xs mt-2 font-medium text-[var(--portal-muted)]">{vendor.statusMessage}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleToggle(!isPaused)}
          className={`shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 ${
            isPaused
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
          {isPaused ? 'Bật lại nhận đơn' : 'Tạm tắt quầy'}
        </button>
      </div>

      {!isPaused && (
        <button
          type="button"
          onClick={() => setShowReason((v) => !v)}
          className="text-xs font-bold text-[#F27124] mt-3 hover:underline"
        >
          {showReason ? 'Ẩn lý do' : 'Thêm lý do khi tắt (tuỳ chọn)'}
        </button>
      )}

      {(showReason || isPaused) && (
        <div className="mt-4">
          <label className="text-xs font-bold portal-muted uppercase tracking-wider">
            Lý do tạm tắt (hiển thị cho sinh viên)
          </label>
          <input
            type="text"
            maxLength={200}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            disabled={isPaused}
            placeholder="VD: Đi việc đột xuất, hết nguyên liệu..."
            className="mt-1.5 w-full bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-4 py-3 text-sm focus:border-[#F27124] outline-none disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
};

export default VendorStorePauseToggle;