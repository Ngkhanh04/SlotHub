import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { downloadVendorExcel } from '../../utils/downloadVendorExcel';

const VendorExcelExportButton = ({
  months = 12,
  days = 30,
  label = 'Xuất Excel',
  className = '',
  variant = 'primary'
}) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadVendorExcel({ months, days });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Không xuất được file Excel');
    } finally {
      setExporting(false);
    }
  };

  const base =
    'inline-flex items-center justify-center gap-2 font-bold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-gradient-to-r from-[#16A34A] to-[#15803D] text-white px-5 py-2.5 shadow-lg shadow-green-900/20 hover:scale-[1.02] active:scale-95',
    outline:
      'border border-[var(--portal-border)] portal-text-secondary px-4 py-2 hover:bg-[var(--portal-surface-hover)]'
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
    >
      {exporting ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <FileSpreadsheet size={18} />
      )}
      {exporting ? 'Đang tạo file...' : label}
    </button>
  );
};

export default VendorExcelExportButton;