import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../api/axios';
import { appAlert, appConfirm } from '../../../utils/appAlert';
import {
  CheckCircle, XCircle, Trash2, Loader2, MessageSquare, Store, User, Clock
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'rejected', label: 'Từ chối' },
  { id: 'all', label: 'Tất cả' },
];

const AdminForum = () => {
  const [tab, setTab] = useState('pending');
  const [posts, setPosts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/forum/admin/posts', { params: { status: tab } });
      setPosts(res.data.posts || []);
      setPendingCount(res.data.pendingCount || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleApprove = async (id) => {
    try {
      const res = await api.put(`/forum/admin/posts/${id}/approve`);
      appAlert(res.data.message, { type: 'success' });
      fetchPosts();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Lỗi duyệt', { type: 'error' });
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try {
      const res = await api.put(`/forum/admin/posts/${rejectId}/reject`, { reason: rejectReason });
      appAlert(res.data.message, { type: 'success' });
      setRejectId(null);
      setRejectReason('');
      fetchPosts();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Lỗi từ chối', { type: 'error' });
    }
  };

  const handleDelete = async (id, title) => {
    if (!(await appConfirm(`Xóa vĩnh viễn bài "${title}" khỏi diễn đàn?`, { type: 'warning', confirmText: 'Xóa' }))) return;
    try {
      const res = await api.delete(`/forum/admin/posts/${id}`);
      appAlert(res.data.message, { type: 'success' });
      fetchPosts();
    } catch (err) {
      appAlert(err.response?.data?.message || 'Lỗi xóa', { type: 'error' });
    }
  };

  const statusBadge = (status) => {
    if (status === 'approved' || !status) {
      return <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-500/10 text-green-600">Đã duyệt</span>;
    }
    if (status === 'rejected') {
      return <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500/10 text-red-600">Từ chối</span>;
    }
    return <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600">Chờ duyệt</span>;
  };

  return (
    <div className="space-y-6">
      <div className="portal-card rounded-2xl p-6 border">
        <h3 className="text-lg font-black flex items-center gap-2" style={{ color: 'var(--portal-text)' }}>
          <MessageSquare className="text-[#F27124]" /> Kiểm duyệt Diễn đàn
        </h3>
        <p className="text-sm portal-muted mt-2">
          Sinh viên đăng bài → Admin duyệt → mới hiển thị công khai và được vote/bình luận.
          {pendingCount > 0 && (
            <span className="ml-2 text-amber-600 font-bold">({pendingCount} bài chờ duyệt)</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              tab === t.id ? 'bg-[#F27124] text-white' : 'portal-card border'
            }`}
          >
            {t.label}
            {t.id === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-[#F27124]" size={36} />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center portal-muted py-16">Không có bài nào.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post._id} className="portal-card rounded-2xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-lg" style={{ color: 'var(--portal-text)' }}>{post.title}</h4>
                    {statusBadge(post.status)}
                  </div>
                  <p className="text-sm portal-muted mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><User size={14} /> {post.author?.name}</span>
                    <span className="flex items-center gap-1"><Store size={14} /> {post.vendor?.name}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {new Date(post.createdAt).toLocaleString('vi-VN')}</span>
                  </p>
                </div>
                <img
                  src={post.menuItem?.imageUrl || 'https://placehold.co/64'}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
              </div>
              <p className="text-sm portal-muted mb-1">Món: <strong>{post.menuItem?.name}</strong> · {post.rating}⭐</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--portal-text)' }}>{post.content}</p>
              {post.rejectReason && (
                <p className="text-sm text-red-500 mb-3">Lý do từ chối: {post.rejectReason}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {post.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(post._id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold"
                    >
                      <CheckCircle size={16} /> Duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectId(post._id); setRejectReason(''); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-500 text-red-600 text-sm font-bold"
                    >
                      <XCircle size={16} /> Từ chối
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(post._id, post.title)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 text-sm font-bold"
                >
                  <Trash2 size={16} /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-black text-lg mb-3">Lý do từ chối</h3>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nội dung không phù hợp, spam..."
              className="w-full border rounded-xl p-3 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejectId(null)} className="flex-1 py-2.5 rounded-xl border font-bold">
                Hủy
              </button>
              <button type="button" onClick={handleReject} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold">
                Từ chối bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminForum;