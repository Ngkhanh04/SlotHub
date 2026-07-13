import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { appAlert, appConfirm } from '../../../utils/appAlert';
import { Gift, ThumbsUp, MessageCircle, Loader2, Store, Utensils, Save } from 'lucide-react';

const VendorForum = () => {
  const [posts, setPosts] = useState([]);
  const [globalRule, setGlobalRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    interactionThreshold: 10,
    discountAmount: 20000,
    minOrder: 50000,
    validDays: 14,
    isActive: true,
  });

  const fetchData = async () => {
    try {
      const [postsRes, ruleRes] = await Promise.all([
        api.get('/forum/vendor/posts'),
        api.get('/forum/vendor/rule'),
      ]);
      setPosts(postsRes.data.posts || []);
      const rule = ruleRes.data.rule;
      setGlobalRule(rule);
      if (rule) {
        setForm({
          interactionThreshold: rule.interactionThreshold,
          discountAmount: rule.discountAmount,
          minOrder: rule.minOrder || 0,
          validDays: rule.validDays || 14,
          isActive: rule.isActive !== false,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/forum/vendor/rule', form);
      appAlert(res.data.message, { type: 'success' });
      fetchData();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Lỗi lưu quy tắc', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleGift = async (post) => {
    if (!post.reward?._id) {
      return appAlert('Chưa có cấu hình thưởng cho bài này. Hãy lưu quy tắc voucher chung trước.', { type: 'warning' });
    }
    if (!(await appConfirm(`Tặng voucher cho tác giả bài "${post.title}"?`))) return;
    try {
      const res = await api.post(`/forum/vendor/rewards/${post.reward._id}/gift`);
      appAlert(res.data.message, { type: 'success' });
      fetchData();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Chưa đủ tương tác hoặc đã tặng', { type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-[#F27124]" size={40} />
      </div>
    );
  }

  const threshold = form.interactionThreshold;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveRule} className="portal-card rounded-2xl p-6 border space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2" style={{ color: 'var(--portal-text)' }}>
          <Gift className="text-[#F27124]" /> Quy tắc voucher chung (mọi bài về quầy)
        </h3>
        <p className="text-sm portal-muted">
          Một lần cài đặt — áp dụng cho <strong>tất cả bài đã duyệt</strong> về quầy bạn. Khi bài đạt đủ vote + bình luận, hệ thống tự tặng mã giảm giá cho tác giả.
        </p>
        <div className="grid sm:grid-cols-4 gap-3">
          <label className="text-xs font-bold portal-muted">
            Ngưỡng tương tác
            <input
              type="number"
              min={1}
              value={form.interactionThreshold}
              onChange={(e) => setForm({ ...form, interactionThreshold: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm portal-input"
            />
          </label>
          <label className="text-xs font-bold portal-muted">
            Giảm giá (đ)
            <input
              type="number"
              min={1000}
              step={1000}
              value={form.discountAmount}
              onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm portal-input"
            />
          </label>
          <label className="text-xs font-bold portal-muted">
            Đơn tối thiểu (đ)
            <input
              type="number"
              min={0}
              step={5000}
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm portal-input"
            />
          </label>
          <label className="text-xs font-bold portal-muted">
            HSD (ngày)
            <input
              type="number"
              min={1}
              max={90}
              value={form.validDays}
              onChange={(e) => setForm({ ...form, validDays: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm portal-input"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold portal-muted cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="accent-[#F27124] w-4 h-4"
          />
          Bật tự động tặng voucher
        </label>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F27124] text-white text-sm font-black disabled:opacity-50"
        >
          <Save size={16} /> {globalRule ? 'Cập nhật quy tắc chung' : 'Lưu quy tắc chung'}
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="text-center portal-muted py-12">Chưa có bài đã duyệt nào về quầy của bạn.</p>
      ) : (
        posts.map((post) => {
          const issued = post.reward?.status === 'issued';
          const eligible = (post.interactionCount || 0) >= threshold;
          const progress = post.progress ?? 0;

          return (
            <div key={post._id} className="portal-card rounded-2xl border p-5 space-y-3">
              <div className="flex gap-4">
                <img
                  src={post.menuItem?.imageUrl || 'https://placehold.co/80'}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-lg" style={{ color: 'var(--portal-text)' }}>{post.title}</h4>
                  <p className="text-sm portal-muted flex items-center gap-2 mt-1">
                    <Utensils size={14} /> {post.menuItem?.name}
                    <span>·</span>
                    <Store size={14} /> {post.author?.name}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm font-bold">
                    <span className="flex items-center gap-1 text-[#F27124]">
                      <ThumbsUp size={14} /> {post.voteCount || 0}
                    </span>
                    <span className="flex items-center gap-1 portal-muted">
                      <MessageCircle size={14} /> {post.commentCount || 0}
                    </span>
                    <span className="portal-muted">{post.interactionCount || 0} / {threshold} tương tác</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden max-w-xs">
                    <div
                      className="h-full bg-[#F27124] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {issued && (
                  <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-600 text-sm font-bold">
                    ✓ Đã tặng voucher
                  </span>
                )}
                {eligible && !issued && globalRule?.isActive !== false && (
                  <button
                    type="button"
                    onClick={() => handleGift(post)}
                    className="px-4 py-2 rounded-xl border-2 border-green-500 text-green-600 text-sm font-black"
                  >
                    Tặng voucher ngay
                  </button>
                )}
                {!eligible && !issued && (
                  <span className="text-sm portal-muted self-center">
                    Cần thêm {threshold - (post.interactionCount || 0)} tương tác
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default VendorForum;