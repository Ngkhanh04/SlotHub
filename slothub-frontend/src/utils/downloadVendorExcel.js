import api from '../api/axios';

/**
 * Tải báo cáo Excel thống kê quầy (file .xlsx có định dạng đẹp, nhiều sheet).
 */
export async function downloadVendorExcel({ months = 12, days = 30 } = {}) {
  let res;
  try {
    res = await api.get(`/vendor/export-excel?months=${months}&days=${days}`, {
      responseType: 'blob'
    });
  } catch (err) {
    const blob = err.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const json = JSON.parse(text);
        throw new Error(json.message || 'Lỗi xuất Excel');
      } catch (parseErr) {
        if (parseErr.message && parseErr.message !== 'Unexpected token') throw parseErr;
      }
    }
    throw err;
  }

  let filename = `SlotHub_ThongKe_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const disposition = res.headers['content-disposition'];
  if (disposition) {
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="?([^";\n]+)"?/i);
    if (utfMatch) {
      filename = decodeURIComponent(utfMatch[1]);
    } else if (plainMatch) {
      filename = plainMatch[1];
    }
  }

  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}