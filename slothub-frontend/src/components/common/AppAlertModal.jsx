import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { TYPE_META } from '../../utils/appAlert';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const RING = {
  success: 'bg-green-50 text-green-600 ring-green-100',
  error: 'bg-red-50 text-red-600 ring-red-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  info: 'bg-orange-50 text-[#F27124] ring-orange-100',
};

export default function AppAlertModal({
  type = 'info',
  title,
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  mode = 'alert',
  onClose,
  onConfirm,
  onCancel,
}) {
  const Icon = ICONS[type] || Info;
  const accent = TYPE_META[type]?.accent || TYPE_META.info.accent;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (mode === 'confirm') onCancel?.();
        else onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mode, onClose, onCancel]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-alert-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease-out]"
        aria-label="Đóng"
        onClick={mode === 'confirm' ? onCancel : onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-[scaleIn_0.22s_ease-out]">
        <button
          type="button"
          onClick={mode === 'confirm' ? onCancel : onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="px-6 pb-6 pt-8 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-8 ${RING[type] || RING.info}`}
          >
            <Icon size={28} strokeWidth={2.2} />
          </div>

          <h2 id="app-alert-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {message}
          </p>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          {mode === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                style={{ backgroundColor: accent }}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              style={{ backgroundColor: accent }}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}