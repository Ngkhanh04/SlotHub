import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { Save, Building, CreditCard, UserSquare2, Loader2, Settings, Ban, Plus, Trash2 } from 'lucide-react';

const AdminSettings = () => {
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [noRefundWithinMinutes, setNoRefundWithinMinutes] = useState(60);
  const [tiers, setTiers] = useState([
    { minMinutesBefore: 240, refundPercent: 100 },
    { minMinutesBefore: 120, refundPercent: 75 },
    { minMinutesBefore: 60, refundPercent: 50 },
  ]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [bankRes, policyRes] = await Promise.all([
          api.get('/admin/bank-info'),
          api.get('/admin/cancellation-policy'),
        ]);
        setBankName(bankRes.data.bankName || '');
        setAccountNumber(bankRes.data.accountNumber || '');
        setAccountName(bankRes.data.accountName || '');
        if (policyRes.data?.policy) {
          setNoRefundWithinMinutes(policyRes.data.policy.noRefundWithinMinutes ?? 60);
          setTiers(policyRes.data.policy.tiers || []);
        }
      } catch (error) {
        console.error('Lỗi lấy thông tin:', error);
      } finally {
        setLoadingInit(false);
      }
    };
    fetchAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 🌟 GỌI API RIÊNG CỦA ADMIN ĐỂ LƯU
      const res = await api.put('/admin/bank-info', {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.toUpperCase().trim()
      });
      alert(res.data.message || 'Cập nhật Ngân hàng Admin thành công!');
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi cập nhật!');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const res = await api.put('/admin/cancellation-policy', {
        noRefundWithinMinutes: Number(noRefundWithinMinutes),
        tiers: tiers.map((t) => ({
          minMinutesBefore: Number(t.minMinutesBefore),
          refundPercent: Number(t.refundPercent),
        })),
      });
      alert(res.data.message || 'Đã lưu chính sách hủy đơn');
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi lưu chính sách');
    } finally {
      setSavingPolicy(false);
    }
  };

  const updateTier = (index, field, value) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const addTier = () => {
    setTiers((prev) => [...prev, { minMinutesBefore: 90, refundPercent: 25 }]);
  };

  const removeTier = (index) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  if (loadingInit) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-[#F27124]" size={40}/></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="portal-card border p-8 rounded-[2rem] border border-[var(--portal-border)] shadow-sm max-w-3xl">
        <h3 className="text-xl font-black mb-2 flex items-center gap-2">
          <Settings className="text-[#F27124]" /> Cấu hình Ngân hàng Nhận tiền (Quỹ SlotHub)
        </h3>
        <p className="portal-muted text-sm mb-6">Đây là số tài khoản sẽ được gen thành Mã QR hiển thị cho tất cả Sinh viên khi họ nạp tiền vào hệ thống.</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold portal-muted flex items-center gap-2"><Building size={16}/> Tên Ngân Hàng (Mã viết tắt, VD: MB, TPB, VCB)</label>
            <input type="text" required value={bankName} onChange={e=>setBankName(e.target.value)} className="bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-4 py-3 outline-none text-[var(--portal-text)] focus:border-[#F27124] uppercase transition-all" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold portal-muted flex items-center gap-2"><CreditCard size={16}/> Số Tài Khoản Quỹ</label>
            <input type="text" required value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} className="bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-4 py-3 outline-none text-[var(--portal-text)] focus:border-[#F27124] transition-all" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold portal-muted flex items-center gap-2"><UserSquare2 size={16}/> Tên Chủ Tài Khoản (Viết hoa không dấu)</label>
            <input type="text" required value={accountName} onChange={e=>setAccountName(e.target.value)} className="bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-4 py-3 outline-none text-[var(--portal-text)] focus:border-[#F27124] uppercase transition-all" />
          </div>

          <button type="submit" disabled={saving} className="mt-4 bg-[#F27124] hover:bg-[#D95F1B] font-black px-8 py-3.5 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin inline mr-2" size={20} /> : <Save className="inline mr-2" size={20} />}
            LƯU CẤU HÌNH NGÂN HÀNG
          </button>
        </form>
      </div>

      <div className="portal-card border p-8 rounded-[2rem] border border-[var(--portal-border)] shadow-sm max-w-3xl">
        <h3 className="text-xl font-black mb-2 flex items-center gap-2">
          <Ban className="text-[#F27124]" /> Chính sách hủy đơn (Sinh viên)
        </h3>
        <p className="portal-muted text-sm mb-6">
          Hoàn tiền vào ví SlotHub theo thời gian còn lại trước <strong>giờ bắt đầu khung nhận món</strong>.
          Dưới ngưỡng không hoàn tiền, sinh viên mất toàn bộ số tiền đã thanh toán.
        </p>
        <form onSubmit={handleSavePolicy} className="space-y-5">
          <div className="flex flex-col gap-2 max-w-xs">
            <label className="text-sm font-bold portal-muted">Không hoàn tiền nếu còn dưới (phút)</label>
            <input
              type="number"
              min={0}
              required
              value={noRefundWithinMinutes}
              onChange={(e) => setNoRefundWithinMinutes(e.target.value)}
              className="bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-4 py-3 outline-none text-[var(--portal-text)] focus:border-[#F27124]"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold portal-muted">Bậc hoàn tiền (hủy sớm hơn)</p>
              <button type="button" onClick={addTier} className="text-xs font-bold text-[#F27124] flex items-center gap-1">
                <Plus size={14} /> Thêm bậc
              </button>
            </div>
            {tiers.map((tier, index) => (
              <div key={index} className="flex flex-wrap gap-3 items-end">
                <label className="text-xs font-bold portal-muted">
                  Trước ≥ (phút)
                  <input
                    type="number"
                    min={1}
                    value={tier.minMinutesBefore}
                    onChange={(e) => updateTier(index, 'minMinutesBefore', e.target.value)}
                    className="mt-1 block w-28 bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-bold portal-muted">
                  Hoàn (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.refundPercent}
                    onChange={(e) => updateTier(index, 'refundPercent', e.target.value)}
                    className="mt-1 block w-24 bg-[var(--portal-input-bg)] border border-[var(--portal-border)] rounded-xl px-3 py-2 text-sm"
                  />
                </label>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(index)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={savingPolicy} className="bg-[#F27124] hover:bg-[#D95F1B] font-black px-8 py-3.5 rounded-xl transition-all disabled:opacity-50">
            {savingPolicy ? <Loader2 className="animate-spin inline mr-2" size={20} /> : <Save className="inline mr-2" size={20} />}
            LƯU CHÍNH SÁCH HỦY ĐƠN
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminSettings;