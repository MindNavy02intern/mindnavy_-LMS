// Revenue Analytics tab (?tab=analytics) — blueprint 09 §8. Same
// GET /finance/analytics as the Dashboard tab (R4), with the full
// Daily/Weekly/Monthly/Quarterly period switcher.

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getFinanceAnalytics } from '../../services/financeApi';
import type { FinanceAnalytics, AnalyticsPeriod } from '../../types/finance';
import { ChartCard, ChartSkeleton, EmptyChart, ErrorBanner, money } from './_shared';

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' }, { key: 'quarterly', label: 'Quarterly' },
];
const CAT_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#0ea5e9'];

export default function RevenueAnalyticsTab({ refreshSignal }: { refreshSignal: number }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [data, setData] = useState<FinanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchData() {
    setLoading(true);
    setError(null);
    getFinanceAnalytics(period)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load revenue analytics.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, refreshSignal]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const revenueLine = data?.revenueTrend.labels.map((l, i) => ({ label: l, value: data.revenueTrend.values[i] })) ?? [];
  const hasRevenue = revenueLine.some(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {PERIODS.map(p => (
          <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: period === p.key ? '#fff' : 'transparent', color: period === p.key ? '#2563eb' : '#64748b', boxShadow: period === p.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
            {p.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      <ChartCard title={`Revenue Trend — ${PERIODS.find(p => p.key === period)?.label}`}>
        {loading || !data ? <ChartSkeleton /> : hasRevenue ? (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueLine} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => money(v)} />
                <Tooltip formatter={(v: number) => [money(v), 'Revenue']} />
                <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart label="No revenue recorded for this period yet." />}
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Revenue by Category">
          {loading || !data ? <ChartSkeleton /> : data.revenueByCategory.items.length === 0 ? <EmptyChart label="No category revenue yet." /> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.revenueByCategory.items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={0} outerRadius={80} label={(e: { name?: string }) => e.name ?? ''}>
                    {data.revenueByCategory.items.map((d, i) => <Cell key={d.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [money(v), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Courses by Revenue">
          {loading || !data ? <ChartSkeleton /> : data.topCoursesByRevenue.items.length === 0 ? <EmptyChart label="No course revenue yet." /> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCoursesByRevenue.items} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => money(v)} />
                  <YAxis type="category" dataKey="title" width={110} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [money(v), 'Revenue']} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Instructor Payout Summary">
        {loading || !data ? <ChartSkeleton /> : data.payoutSummary.items.length === 0 ? <EmptyChart label="No payouts calculated yet." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {data.payoutSummary.items.map(i => (
              <div key={i.status} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{i.status}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{money(i.amount)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{i.count} payout{i.count === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
