// Engagement Analytics tab — daily/weekly active users, retention, low
// engagement users. Session duration/watch time are honest em-dashes.

import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getEngagementAnalytics } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { EngagementAnalytics, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
}
function Skeleton() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 10}%` }} />)}</div>;
}
function StatTile({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: value === null ? '#cbd5e1' : '#0f172a' }}>{value ?? '—'}</div>
      {value === null && reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

export default function EngagementAnalyticsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<EngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getEngagementAnalytics({ dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load engagement analytics.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
  }, [fetchData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {DATE_RANGES.map(r => (
          <button key={r.key} type="button" onClick={() => setDateRange(r.key)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: dateRange === r.key ? '#fff' : 'transparent', color: dateRange === r.key ? '#2563eb' : '#64748b', boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{r.label}</button>
        ))}
      </div>
      {dateRange === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {loading || !data ? <Skeleton /> : (
          <StatTile label="Retention Rate" value={data.retentionRate.available ? `${data.retentionRate.value}%` : null} reason={data.retentionRate.reason} />
        )}
        <div />
        <div />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Daily Active Users">
          {loading || !data ? <Skeleton /> : data.dailyActiveUsers.values.some(v => v > 0) ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailyActiveUsers.labels.map((label, i) => ({ label, value: data.dailyActiveUsers.values[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No activity recorded in this window" />}
        </ChartCard>

        <ChartCard title="Weekly Active Users">
          {loading || !data ? <Skeleton /> : data.weeklyActiveUsers.values.some(v => v > 0) ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weeklyActiveUsers.labels.map((label, i) => ({ label, value: data.weeklyActiveUsers.values[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No activity recorded in this window" />}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Avg Session Duration">
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{data?.avgSessionDuration.reason ?? 'Not available yet'}</div>
        </ChartCard>
        <ChartCard title="Video Watch Time">
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{data?.videoWatchTime.reason ?? 'Not available yet'}</div>
        </ChartCard>
      </div>

      <ChartCard title="Low Engagement Users">
        {loading || !data ? <Skeleton /> : data.lowEngagementUsers.length === 0 ? <EmptyChart label="No low-engagement users found" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Name', 'Role', 'Last Active'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Last Active' ? 'right' : 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lowEngagementUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a' }}>{u.name ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{u.role}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#9ca3af' }}>{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString() : 'Never active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
