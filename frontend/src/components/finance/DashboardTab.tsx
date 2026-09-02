// Financial Dashboard tab (?tab=dashboard) — blueprint 09 §1. Reuses the same
// GET /finance/analytics the Revenue Analytics tab uses (R4 — one endpoint,
// one set of numbers) with a coarser date-range picker instead of the full
// period switcher.

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getFinanceAnalytics } from '../../services/financeApi';
import type { FinanceAnalytics, AnalyticsPeriod } from '../../types/finance';
import { ChartCard, ChartSkeleton, EmptyChart, ErrorBanner, money } from './_shared';
import FinanceStatsCards from './FinanceStatsCards';

const RANGES: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'daily',     label: 'Last 30 Days' },
  { key: 'weekly',    label: 'Last 12 Weeks' },
  { key: 'monthly',   label: 'Last 12 Months' },
  { key: 'quarterly', label: 'Last 8 Quarters' },
];

const DONUT_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899'];

export default function DashboardTab({ refreshSignal }: { refreshSignal: number }) {
  const [range, setRange] = useState<AnalyticsPeriod>('daily');
  const [data, setData] = useState<FinanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchData() {
    setLoading(true);
    setError(null);
    getFinanceAnalytics(range)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load financial dashboard.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range, refreshSignal]);
  useEffect(() => {
    window.addEventListener('financeUpdated', fetchData);
    return () => window.removeEventListener('financeUpdated', fetchData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const revenueLine = data?.revenueTrend.labels.map((l, i) => ({ label: l, value: data.revenueTrend.values[i] })) ?? [];
  const refundLine   = data?.refundTrend.labels.map((l, i) => ({ label: l, value: data.refundTrend.values[i] })) ?? [];
  const hasRevenue = revenueLine.some(d => d.value > 0);
  const hasRefunds = refundLine.some(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FinanceStatsCards refreshSignal={refreshSignal} />

      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {RANGES.map(r => (
          <button
            key={r.key} type="button" onClick={() => setRange(r.key)}
            style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: range === r.key ? '#fff' : 'transparent', color: range === r.key ? '#2563eb' : '#64748b',
              boxShadow: range === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <ChartCard title="Revenue Trend">
          {loading || !data ? <ChartSkeleton /> : hasRevenue ? (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueLine} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => money(v)} />
                  <Tooltip formatter={(v: number) => [money(v), 'Revenue']} />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No revenue recorded yet — real payments arrive once the gateway is connected." />}
        </ChartCard>

        <ChartCard title="Subscription Breakdown">
          {loading || !data ? <ChartSkeleton /> : data.subscriptionBreakdown.items.length === 0 ? (
            <EmptyChart label="No active subscriptions yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.subscriptionBreakdown.items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} strokeWidth={2} stroke="#fff">
                      {data.subscriptionBreakdown.items.map((d, i) => <Cell key={d.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.subscriptionBreakdown.items.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#64748b' }}>{d.name}</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Refund Trend">
          {loading || !data ? <ChartSkeleton /> : hasRefunds ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={refundLine} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => money(v)} />
                  <Tooltip formatter={(v: number) => [money(v), 'Refunded']} />
                  <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No refunds processed yet." />}
        </ChartCard>

        <ChartCard title="Top Courses by Revenue">
          {loading || !data ? <ChartSkeleton /> : data.topCoursesByRevenue.items.length === 0 ? (
            <EmptyChart label="No course revenue recorded yet." />
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCoursesByRevenue.items.map(c => ({ ...c, shortTitle: (c.title ?? 'Untitled').length > 16 ? `${(c.title ?? '').slice(0, 15)}…` : (c.title ?? 'Untitled') }))} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="shortTitle" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => money(v)} />
                  <Tooltip formatter={(v: number) => [money(v), 'Revenue']} labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''} />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
