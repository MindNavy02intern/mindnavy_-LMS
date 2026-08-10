// Course Analytics tab — enrollment trend, per-course completion rates
// table, most popular ranking, best categories donut. Drop-off/watch-time
// are honest em-dashes (no per-lesson checkpoint / no watch-time model).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getCourseAnalytics } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { CourseAnalytics, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];
const CATEGORY_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#94a3b8', '#0891b2', '#dc2626'];

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
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

export default function CourseAnalyticsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getCourseAnalytics({ dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined, limit: 20 })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load course analytics.'))
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <ChartCard title="Enrollment Trend">
          {loading || !data ? <Skeleton /> : data.enrollmentTrend.values.some(v => v > 0) ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.enrollmentTrend.labels.map((label, i) => ({ label, value: data.enrollmentTrend.values[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No enrollments in this window" />}
        </ChartCard>

        <ChartCard title="Best Categories (avg progress)">
          {loading || !data ? <Skeleton /> : data.bestCategories.length === 0 ? <EmptyChart label="No category data yet" /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.bestCategories} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="avgProgress" nameKey="name" strokeWidth={2} stroke="#fff">
                      {data.bestCategories.map((c, i) => <Cell key={c.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Progress']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                {data.bestCategories.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.avgProgress}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Most Popular Courses">
          {loading || !data ? <Skeleton /> : data.mostPopular.length === 0 ? <EmptyChart label="No enrollments yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.mostPopular.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#94a3b8', width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  <span style={{ fontWeight: 600 }}>{c.enrollments}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ChartCard title="Drop-off Points">
            {loading || !data ? <Skeleton /> : <div style={{ fontSize: 12, color: '#9ca3af' }}>{data.dropOffPoints.reason ?? 'Not available yet'}</div>}
          </ChartCard>
          <ChartCard title="Watch Time">
            {loading || !data ? <Skeleton /> : <div style={{ fontSize: 12, color: '#9ca3af' }}>{data.watchTime.reason ?? 'Not available yet'}</div>}
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Completion Rates per Course">
        {loading || !data ? <Skeleton /> : data.completionRates.length === 0 ? <EmptyChart label="No courses yet" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Course', 'Enrollments', 'Completed', 'Completion Rate'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Course' ? 'left' : 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.completionRates.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a' }}>{c.title}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{c.enrollments}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{c.completed}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{c.completionRate}%</td>
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
