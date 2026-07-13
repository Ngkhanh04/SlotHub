import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import VendorExcelExportButton from './VendorExcelExportButton';
import {
  CalendarDays, Loader2, TrendingUp, TrendingDown, Users, ShoppingBag, BarChart3
} from 'lucide-react';

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN');

const ChangeBadge = ({ value }) => {
  if (value === 0 || value == null) {
    return <span className="text-xs font-bold portal-muted">—</span>;
  }
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{value}%
    </span>
  );
};

const PeriodTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="bg-[#0f172a] border border-[var(--portal-border)] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-bold mb-2">{label}</p>
      <p className="text-[#F27124]">Doanh thu: {fmt(row?.revenue)}đ</p>
      <p className="text-green-400">Ví quầy (95%): {fmt(row?.vendorShare)}đ</p>
      <p className="portal-muted">{row?.orders || 0} lượt mua · {row?.customers || 0} khách</p>
    </div>
  );
};

const TAB_OPTIONS = [
  { id: 'monthly', label: 'Theo tháng' },
  { id: 'yearly', label: 'Theo năm' }
];

const MONTH_OPTIONS = [
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
  { value: 24, label: '24 tháng' }
];

const VendorPeriodAnalytics = () => {
  const [tab, setTab] = useState('monthly');
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/vendor/analytics?months=${months}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Không tải được thống kê');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [months]);

  const overview = data?.overview;
  const comparisons = overview?.comparisons;

  const chartData = useMemo(() => {
    if (tab === 'yearly') {
      return (data?.yearly || []).map((r) => ({ ...r, name: r.label }));
    }
    return (data?.monthly || []).map((r) => ({
      ...r,
      name: r.label.replace('Tháng ', 'T')
    }));
  }, [data, tab]);

  const hasData = chartData.some((d) => d.revenue > 0 || d.orders > 0);

  const overviewCards = overview
    ? [
        {
          title: 'Khách tháng này',
          value: overview.thisMonth?.customers ?? 0,
          sub: `Tháng trước: ${overview.lastMonth?.customers ?? 0}`,
          change: comparisons?.customersMonthChange,
          icon: <Users size={20} />,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10'
        },
        {
          title: 'Lượt mua tháng này',
          value: overview.thisMonth?.orders ?? 0,
          sub: `Tháng trước: ${overview.lastMonth?.orders ?? 0}`,
          change: comparisons?.ordersMonthChange,
          icon: <ShoppingBag size={20} />,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10'
        },
        {
          title: 'Doanh thu tháng này',
          value: `${fmt(overview.thisMonth?.revenue)}đ`,
          sub: `Tháng trước: ${fmt(overview.lastMonth?.revenue)}đ`,
          change: comparisons?.revenueMonthChange,
          icon: <TrendingUp size={20} />,
          color: 'text-green-400',
          bg: 'bg-green-500/10'
        },
        {
          title: 'Doanh thu năm nay',
          value: `${fmt(overview.thisYear?.revenue)}đ`,
          sub: `Năm trước: ${fmt(overview.lastYear?.revenue)}đ`,
          change: comparisons?.revenueYearChange,
          icon: <BarChart3 size={20} />,
          color: 'text-[#F27124]',
          bg: 'bg-orange-500/10'
        }
      ]
    : [];

  return (
    <section className="portal-card border rounded-3xl border border-[var(--portal-border)] overflow-hidden">
      <div className="p-5 border-b border-[var(--portal-border)] flex flex-wrap justify-between items-start gap-3">
        <div>
          <h3 className="font-black flex items-center gap-2">
            <BarChart3 size={20} className="text-[#F27124]" />
            Thống kê khách hàng & doanh thu
          </h3>
          <p className="text-xs portal-muted mt-1">
            Lượng khách, lượt mua và doanh thu theo tháng / năm (đơn đã thanh toán)
          </p>
        </div>
        <VendorExcelExportButton months={months} days={30} variant="outline" label="Xuất Excel" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#F27124]" size={36} />
        </div>
      ) : error ? (
        <p className="p-8 text-center text-red-400 text-sm font-medium">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-5 border-b border-[var(--portal-border)]">
            {overviewCards.map((card) => (
              <div key={card.title} className="bg-[var(--portal-table-head)] rounded-2xl p-4 border border-[var(--portal-border)]">
                <div className={`w-9 h-9 rounded-xl ${card.bg} ${card.color} flex items-center justify-center mb-2`}>
                  {card.icon}
                </div>
                <p className="text-[10px] font-bold portal-muted uppercase">{card.title}</p>
                <p className="text-xl font-black mt-1">{card.value}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-[10px] portal-muted">{card.sub}</p>
                  <ChangeBadge value={card.change} />
                </div>
              </div>
            ))}
          </div>

          {overview?.allTime && (
            <div className="px-5 py-3 border-b border-[var(--portal-border)] flex flex-wrap gap-4 text-xs portal-muted">
              <span><strong className="text-[var(--portal-text)]">{overview.allTime.customers}</strong> khách từ trước đến nay</span>
              <span><strong className="text-[var(--portal-text)]">{overview.allTime.orders}</strong> lượt mua</span>
              <span><strong className="text-[#F27124]">{fmt(overview.allTime.revenue)}đ</strong> tổng doanh thu</span>
            </div>
          )}

          <div className="p-5 border-b border-[var(--portal-border)] flex flex-wrap justify-between items-center gap-3">
            <div className="flex gap-1 bg-[var(--portal-input-bg)]/80 p-1 rounded-xl border border-[var(--portal-border)]">
              {TAB_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTab(opt.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    tab === opt.id ? 'bg-[#F27124] text-white' : 'portal-muted hover:text-[var(--portal-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {tab === 'monthly' && (
              <div className="flex gap-1 bg-[var(--portal-input-bg)]/80 p-1 rounded-xl border border-[var(--portal-border)]">
                {MONTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMonths(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      months === opt.value ? 'bg-[var(--portal-surface)] text-[var(--portal-text)]' : 'portal-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-b border-[var(--portal-border)]">
            {hasData ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip content={<PeriodTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#F27124" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="Lượt mua" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="customers" name="Khách" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center portal-muted text-sm py-12">Chưa có dữ liệu trong khoảng thời gian này.</p>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 portal-card border z-10">
                <tr className="text-left text-[10px] font-bold portal-muted uppercase tracking-wider border-b border-[var(--portal-border)]">
                  <th className="p-4">{tab === 'yearly' ? 'Năm' : 'Tháng'}</th>
                  <th className="p-4 text-right">Khách</th>
                  <th className="p-4 text-right">Lượt mua</th>
                  <th className="p-4 text-right">Doanh thu</th>
                  <th className="p-4 text-right">Ví quầy (95%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--portal-border)]">
                {[...(chartData || [])].reverse().map((row) => (
                  <tr key={row.key || row.year || row.label} className="hover:bg-[var(--portal-surface-hover)]">
                    <td className="p-4 font-bold">
                      <span className="flex items-center gap-2">
                        <CalendarDays size={14} className="portal-muted shrink-0" />
                        {row.label}
                      </span>
                    </td>
                    <td className="p-4 text-right portal-text-secondary">{row.customers || 0}</td>
                    <td className="p-4 text-right portal-text-secondary">{row.orders || 0}</td>
                    <td className="p-4 text-right font-black">
                      {row.revenue > 0 ? `${fmt(row.revenue)}đ` : '—'}
                    </td>
                    <td className="p-4 text-right font-bold text-green-400">
                      {row.vendorShare > 0 ? `${fmt(row.vendorShare)}đ` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default VendorPeriodAnalytics;