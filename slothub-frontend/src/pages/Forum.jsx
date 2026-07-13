import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { appAlert } from '../utils/appAlert';
import BrandLogo from '../components/BrandLogo';
import LanguageToggle from '../components/LanguageToggle';
import {
  ArrowLeft, ThumbsUp, MessageCircle, Trophy, Plus, Star,
  Loader2, Gift, Store, Utensils, Send, X, ChevronDown,
  Sparkles, Crown, Medal, Clock, PenLine, Ticket, Flame
} from 'lucide-react';

const getRewardMeta = (post) => {
  const threshold = post?.reward?.interactionThreshold ?? post?.globalRule?.interactionThreshold;
  const amount = post?.reward?.discountAmount ?? post?.globalRule?.discountAmount;
  return { threshold: threshold || 0, amount: amount || 0 };
};

const getProgressPct = (current, threshold) => {
  if (!threshold) return 0;
  return Math.min(100, Math.round(((current || 0) / threshold) * 100));
};

const avatarUrl = (user, size = 40) =>
  user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=F27124&color=fff&size=${size}`;

const RankBadge = ({ rank }) => {
  if (rank === 1) {
    return (
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-200/60 shrink-0">
        <Crown size={20} className="text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-md shrink-0">
        <Medal size={20} className="text-white" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-md shrink-0">
        <Medal size={20} className="text-white" />
      </div>
    );
  }
  return (
    <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-gray-500 shrink-0">
      #{rank}
    </div>
  );
};

const RewardProgress = ({ current, threshold, amount, t, compact }) => {
  if (!threshold || !amount) return null;
  const pct = getProgressPct(current, threshold);
  const done = pct >= 100;

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Gift size={12} className="text-[#F27124]" />
          {t('forum.rewardProgress')}
        </span>
        <span className={`text-xs font-black ${done ? 'text-green-600' : 'text-[#F27124]'}`}>
          {current || 0}/{threshold}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-[#F27124] to-amber-400'
            }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[11px] mt-1.5 ${done ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
        {done
          ? t('forum.rewardUnlocked')
          : t('forum.rewardInfo', {
            threshold,
            amount: Number(amount).toLocaleString('vi-VN'),
          })}
      </p>
    </div>
  );
};

const Forum = () => {
  const { user } = useContext(AuthContext);
  const { t } = useLocale();
  const navigate = useNavigate();

  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [myPendingPosts, setMyPendingPosts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [form, setForm] = useState({ menuItemId: '', title: '', content: '', rating: 5 });

  const fetchPosts = useCallback(async () => {
    const res = await api.get('/forum/posts', { params: { sort: 'votes' } });
    setPosts(res.data.posts || []);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const res = await api.get('/forum/leaderboard');
    setLeaderboard(res.data || []);
  }, []);

  const fetchVouchers = useCallback(async () => {
    const res = await api.get('/forum/my-vouchers');
    setVouchers(res.data || []);
  }, []);

  const fetchMyPending = useCallback(async () => {
    const res = await api.get('/forum/my-posts', { params: { status: 'pending' } });
    setMyPendingPosts(res.data.posts || []);
  }, []);

  useEffect(() => {
    if (!user) return navigate('/login');
    if (user.role !== 'student') return navigate('/');
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchPosts(), fetchLeaderboard(), fetchVouchers(), fetchMyPending()]);
        const menuRes = await api.get('/menuitems');
        setMenuItems(Array.isArray(menuRes.data) ? menuRes.data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, fetchPosts, fetchLeaderboard, fetchVouchers, fetchMyPending]);

  const openPost = async (post) => {
    try {
      const res = await api.get(`/forum/posts/${post._id}`);
      setSelectedPost({
        ...res.data.post,
        hasVoted: res.data.hasVoted,
        reward: res.data.reward,
        globalRule: res.data.globalRule,
      });
      setComments(res.data.comments || []);
    } catch {
      appAlert(t('forum.loadError'), { type: 'error' });
    }
  };

  const closePost = () => {
    setSelectedPost(null);
    setComments([]);
    setCommentText('');
  };

  const handleVote = async (postId) => {
    try {
      const res = await api.post(`/forum/posts/${postId}/vote`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, hasVoted: res.data.hasVoted, voteCount: res.data.voteCount, interactionCount: res.data.interactionCount }
            : p
        )
      );
      if (selectedPost?._id === postId) {
        setSelectedPost((p) => ({
          ...p,
          hasVoted: res.data.hasVoted,
          voteCount: res.data.voteCount,
          interactionCount: res.data.interactionCount,
        }));
      }
    } catch {
      appAlert(t('forum.voteError'), { type: 'error' });
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    try {
      const res = await api.post(`/forum/posts/${selectedPost._id}/comments`, { content: commentText });
      setComments((c) => [...c, res.data.comment]);
      setCommentText('');
      setSelectedPost((p) => ({ ...p, interactionCount: res.data.interactionCount, commentCount: (p.commentCount || 0) + 1 }));
      fetchPosts();
    } catch {
      appAlert(t('forum.commentError'), { type: 'error' });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.menuItemId || !form.title.trim() || !form.content.trim()) {
      return appAlert(t('forum.fillAll'), { type: 'warning' });
    }
    try {
      const res = await api.post('/forum/posts', form);
      appAlert(res.data.message || t('forum.postSuccessPending'), { type: 'success' });
      setShowCreate(false);
      setForm({ menuItemId: '', title: '', content: '', rating: 5 });
      fetchMyPending();
      fetchLeaderboard();
    } catch (err) {
      appAlert(err.response?.data?.message || t('common.error'), { type: 'error' });
    }
  };

  const renderPostDetail = (isMobile = false) => {
    if (!selectedPost) return null;
    const { threshold, amount } = getRewardMeta(selectedPost);

    return (
      <div className={`flex flex-col ${isMobile ? 'h-full' : ''}`}>
        <div className="relative h-44 sm:h-48 rounded-2xl overflow-hidden -mx-1 mb-4 shrink-0">
          <img
            src={selectedPost.menuItem?.imageUrl || 'https://placehold.co/800x400?text=Food'}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-black text-amber-600">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {selectedPost.rating}/5
              </span>
              <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700">
                <Store size={11} className="text-[#F27124]" />
                {selectedPost.vendor?.name}
              </span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight">{selectedPost.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <img src={avatarUrl(selectedPost.author, 80)} alt="" className="w-10 h-10 rounded-full ring-2 ring-orange-100" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{selectedPost.author?.name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Utensils size={12} /> {selectedPost.menuItem?.name}
            </p>
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed whitespace-pre-line text-[15px]">{selectedPost.content}</p>

        {(selectedPost.reward || selectedPost.globalRule) && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4">
            <RewardProgress
              current={selectedPost.interactionCount}
              threshold={threshold}
              amount={amount}
              t={t}
            />
          </div>
        )}

        {selectedPost.status === 'pending' && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
            <Clock size={16} className="shrink-0 mt-0.5" />
            {t('forum.awaitingApproval')}
          </div>
        )}

        {selectedPost.status === 'rejected' && (
          <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {t('forum.rejected')}{selectedPost.rejectReason ? `: ${selectedPost.rejectReason}` : ''}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            onClick={() => handleVote(selectedPost._id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${selectedPost.hasVoted
                ? 'bg-[#F27124] text-white shadow-lg shadow-orange-200'
                : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-[#F27124]'
              }`}
          >
            <ThumbsUp size={16} className={selectedPost.hasVoted ? 'fill-current' : ''} />
            {selectedPost.hasVoted ? t('forum.voted') : t('forum.vote')}
            <span className="opacity-80">· {selectedPost.voteCount || 0}</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gray-50 text-gray-600 text-sm font-bold">
            <MessageCircle size={16} /> {selectedPost.commentCount || 0}
          </span>
          <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gray-50 text-gray-600 text-sm font-bold">
            <Flame size={16} className="text-orange-500" /> {selectedPost.interactionCount || 0}
          </span>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5 flex-1 flex flex-col min-h-0">
          <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2">
            <MessageCircle size={18} className="text-[#F27124]" />
            {t('forum.comments')} ({comments.length})
          </h4>
          <div className="space-y-3 flex-1 overflow-y-auto mb-4 max-h-56 lg:max-h-72 pr-1">
            {comments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-2xl">
                {t('forum.commentPlaceholder')}
              </p>
            )}
            {comments.map((c) => (
              <div key={c._id} className="flex gap-3">
                <img src={avatarUrl(c.author, 64)} alt="" className="w-9 h-9 rounded-full shrink-0" />
                <div className="bg-gray-50 rounded-2xl rounded-tl-md px-4 py-3 flex-1 border border-gray-100">
                  <p className="text-xs font-black text-gray-800">{c.author?.name}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('forum.commentPlaceholder')}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F27124]/30 focus:border-[#F27124]/40 outline-none bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            />
            <button
              type="button"
              onClick={handleComment}
              className="p-3 bg-[#F27124] text-white rounded-2xl shadow-lg shadow-orange-200/50 hover:bg-[#D95F1B] transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-orange-100 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#F27124]" size={32} />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-400">{t('forum.title')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] pb-20">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="p-2.5 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <BrandLogo size="sm" showTagline={false} />
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#F27124] to-[#FF8C42] text-white px-4 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-orange-200/60 hover:shadow-orange-300/60 transition-all hover:-translate-y-0.5"
            >
              <PenLine size={16} /> {t('forum.newPost')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-5 space-y-5">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F27124] via-[#FF8C42] to-amber-400 p-6 sm:p-8 text-white shadow-xl shadow-orange-200/40">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-8 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold mb-4">
              <Sparkles size={14} /> SlotHub · {t('nav.forum')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">{t('forum.title')}</h1>
            <p className="text-sm sm:text-base text-white/90 mt-2 max-w-xl leading-relaxed">{t('forum.subtitle')}</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 min-w-[100px]">
                <p className="text-2xl font-black">{posts.length}</p>
                <p className="text-xs font-bold text-white/80">{t('forum.statPosts')}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 min-w-[100px]">
                <p className="text-2xl font-black">{vouchers.length}</p>
                <p className="text-xs font-bold text-white/80">{t('forum.statVouchers')}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 min-w-[100px]">
                <p className="text-2xl font-black">{leaderboard.length}</p>
                <p className="text-xs font-bold text-white/80 flex items-center gap-1">
                  <Trophy size={12} /> BXH
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vouchers */}
        {vouchers.length > 0 && (
          <section className="rounded-[2rem] border border-green-200/80 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-green-900 font-black">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Ticket size={18} className="text-green-700" />
                </div>
                {t('forum.myVouchers')}
                <span className="text-xs font-bold bg-green-200/60 text-green-800 px-2 py-0.5 rounded-full">
                  {vouchers.length}
                </span>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              {vouchers.map((v) => (
                <div
                  key={v._id}
                  className="shrink-0 w-[220px] bg-white rounded-2xl border-2 border-dashed border-green-300 p-4 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                  <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-50" />
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-50" />
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1 truncate">
                    {v.vendor?.name}
                  </p>
                  <code className="block text-lg font-black text-green-900 tracking-wide">{v.code}</code>
                  <p className="text-xl font-black text-[#F27124] mt-1">
                    -{Number(v.discountAmount).toLocaleString('vi-VN')}đ
                  </p>
                  {v.expiresAt && (
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <Clock size={10} />
                      {t('forum.expiresOn')}: {new Date(v.expiresAt).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-green-700 mt-3 font-medium">{t('forum.voucherHint')}</p>
          </section>
        )}

        {/* Pending */}
        {myPendingPosts.length > 0 && (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5">
            <p className="text-sm font-black text-amber-900 mb-3 flex items-center gap-2">
              <Clock size={16} /> {t('forum.pendingPosts')}
            </p>
            <div className="space-y-2">
              {myPendingPosts.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between gap-3 bg-white rounded-2xl px-4 py-3.5 border border-amber-100 shadow-sm"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <img
                      src={p.menuItem?.imageUrl || 'https://placehold.co/48'}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{p.title}</p>
                      <p className="text-xs text-gray-500">{p.menuItem?.name} · {p.vendor?.name}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-black px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 uppercase tracking-wide">
                    {t('forum.statusPending')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-white rounded-[1.25rem] border border-gray-100 shadow-sm w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setTab('posts')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${tab === 'posts'
                ? 'bg-[#F27124] text-white shadow-md shadow-orange-200/50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
          >
            {t('forum.tabPosts')}
          </button>
          <button
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${tab === 'leaderboard'
                ? 'bg-[#F27124] text-white shadow-md shadow-orange-200/50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
          >
            <Trophy size={16} /> {t('forum.tabLeaderboard')}
          </button>
        </div>

        {/* Leaderboard */}
        {tab === 'leaderboard' && (
          <div className="space-y-3">
            {leaderboard.map((row) => (
              <div
                key={row.menuItem?._id || row.rank}
                className={`flex items-center gap-4 bg-white rounded-[1.5rem] p-4 border shadow-sm transition-all hover:shadow-md ${row.rank <= 3 ? 'border-amber-100 ring-1 ring-amber-50' : 'border-gray-100'
                  }`}
              >
                <RankBadge rank={row.rank} />
                <img
                  src={row.menuItem?.imageUrl || 'https://placehold.co/80x80?text=Food'}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 ring-2 ring-gray-50"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 truncate text-lg">{row.menuItem?.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-bold">
                    <Store size={12} className="text-[#F27124]" /> {row.menuItem?.vendor?.name}
                  </p>
                  {row.rank <= 3 && (
                    <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wide">
                      {t('forum.topRank', { rank: row.rank })}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-[#F27124] text-lg flex items-center justify-end gap-1">
                    <ThumbsUp size={14} /> {row.totalVotes}
                  </p>
                  <p className="text-xs text-gray-400 font-bold">{row.postCount} {t('forum.posts')}</p>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200">
                <Trophy size={48} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 font-bold">{t('forum.emptyLeaderboard')}</p>
              </div>
            )}
          </div>
        )}

        {/* Posts */}
        {tab === 'posts' && (
          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-4">
              {posts.map((post) => {
                const { threshold, amount } = getRewardMeta(post);
                const pct = getProgressPct(post.interactionCount, threshold);
                const isSelected = selectedPost?._id === post._id;

                return (
                  <article
                    key={post._id}
                    className={`group bg-white rounded-[1.75rem] border overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-orange-100/50 hover:-translate-y-0.5 ${isSelected
                        ? 'border-[#F27124] ring-2 ring-[#F27124]/25 shadow-lg shadow-orange-100/60'
                        : 'border-gray-100 shadow-sm'
                      }`}
                    onClick={() => openPost(post)}
                  >
                    <div className="relative h-36 sm:h-40 overflow-hidden bg-gray-100">
                      <img
                        src={post.menuItem?.imageUrl || 'https://placehold.co/400x200?text=Food'}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-xs font-black text-amber-600">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          {post.rating}
                        </span>
                        {amount > 0 && (
                          <span className="inline-flex items-center gap-1 bg-green-500/90 backdrop-blur text-white px-2 py-1 rounded-lg text-[10px] font-black">
                            <Gift size={10} /> -{Number(amount).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="font-black text-white text-lg leading-tight line-clamp-2 drop-shadow-sm">
                          {post.title}
                        </h3>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <img src={avatarUrl(post.author, 64)} alt="" className="w-8 h-8 rounded-full ring-2 ring-orange-50" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">{post.author?.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {post.menuItem?.name} · {post.vendor?.name}
                          </p>
                        </div>
                      </div>

                      {threshold > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                            <span>{t('forum.rewardProgress')}</span>
                            <span className="text-[#F27124]">{post.interactionCount || 0}/{threshold}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-[#F27124] to-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleVote(post._id); }}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-black transition-all ${post.hasVoted
                              ? 'bg-[#F27124] text-white shadow-md shadow-orange-200/50'
                              : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-[#F27124]'
                            }`}
                        >
                          <ThumbsUp size={14} className={post.hasVoted ? 'fill-current' : ''} />
                          {post.voteCount || 0}
                        </button>
                        <span className="flex items-center gap-1 text-sm font-bold text-gray-500">
                          <MessageCircle size={14} /> {post.commentCount || 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                          <Flame size={12} className="text-orange-400" />
                          {post.interactionCount || 0}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
              {posts.length === 0 && (
                <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200">
                  <PenLine size={48} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 font-bold mb-4">{t('forum.emptyPosts')}</p>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 bg-[#F27124] text-white px-5 py-2.5 rounded-2xl text-sm font-black"
                  >
                    <Plus size={16} /> {t('forum.writeReview')}
                  </button>
                </div>
              )}
            </div>

            {/* Desktop detail */}
            <div className="hidden lg:block lg:col-span-2">
              <div className="sticky top-24">
                {selectedPost ? (
                  <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm max-h-[calc(100vh-7rem)] overflow-y-auto">
                    {renderPostDetail()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200 p-12 text-gray-400 min-h-[320px]">
                    <div className="w-16 h-16 rounded-3xl bg-orange-50 flex items-center justify-center mb-4">
                      <MessageCircle size={32} className="text-[#F27124]/40" />
                    </div>
                    <p className="text-sm font-bold text-center max-w-[200px]">{t('forum.selectPost')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile post detail */}
      {selectedPost && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <button type="button" onClick={closePost} className="p-2 rounded-xl hover:bg-gray-100">
              <ArrowLeft size={20} />
            </button>
            <span className="font-black text-gray-900 text-sm">{t('forum.tabPosts')}</span>
            <button type="button" onClick={closePost} className="p-2 rounded-xl hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {renderPostDetail(true)}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-[2rem]">
              <div>
                <h2 className="text-lg font-black text-gray-900">{t('forum.newPost')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{t('forum.writeReview')}</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">{t('forum.pickDish')}</label>
                <div className="relative">
                  <select
                    required
                    value={form.menuItemId}
                    onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-sm appearance-none bg-gray-50 focus:bg-white focus:border-[#F27124]/40 focus:ring-2 focus:ring-[#F27124]/20 outline-none transition-all"
                  >
                    <option value="">{t('forum.pickDishPlaceholder')}</option>
                    {menuItems.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} — {m.vendor?.name || t('orders.vendor')} ({Number(m.price).toLocaleString('vi-VN')}đ)
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">{t('forum.postTitle')}</label>
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('forum.postTitlePlaceholder')}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-sm bg-gray-50 focus:bg-white focus:border-[#F27124]/40 focus:ring-2 focus:ring-[#F27124]/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">{t('forum.postContent')}</label>
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={t('forum.postContentPlaceholder')}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-sm resize-none bg-gray-50 focus:bg-white focus:border-[#F27124]/40 focus:ring-2 focus:ring-[#F27124]/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">{t('forum.rating')}</label>
                <div className="flex gap-1 p-3 bg-amber-50 rounded-2xl w-fit">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm({ ...form, rating: n })}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        size={32}
                        className={n <= form.rating ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-gray-200'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#F27124] to-[#FF8C42] text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-orange-200/60 hover:shadow-orange-300/60 transition-all"
              >
                {t('forum.publish')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Forum;
