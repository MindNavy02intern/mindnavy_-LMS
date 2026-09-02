// Learner Analytics tab — activity trend, progress distribution, dropout
// risk, top performers, inactive users. Own dateRange/department/cohort
// filters (department reads real ['org','departments'] data per R2; cohort
// has no existing group-listing API on the frontend to reuse, so it's a
// free-text Group ID field, not a fabricated dropdown).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getLearnerAnalytics } from '../../services/reportsApi';
import { getDepartments } from '../../api/organization';
import { ReportsApiError } from '../../types/reports';
import type { LearnerAnalytics, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

const PROGRESS_COLORS: Record<string, string> = { excellent: '#16a34a', good: '#2563eb', average: '#f59e0b', poor: '#dc2626' };
const RISK_COLORS: Record<string, { bg: string; fg: string }> = {
  high: { bg: '#fee2e2', fg: '#b91c1c' }, medium: { bg: '#fef9c3', fg: '#a16207' }, low: { bg: '#dcfce7', fg: '#15803d' },
};

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

function RiskTable({ title, users }: { title: string; users: { id: string; name: string | null; riskScore: number | null }[] }) {
  const color = RISK_COLORS[title.toLowerCase()] ?? { bg: '#f1f5f9', fg: '#64748b' };
  return (
    <div>
      <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: color.bg, color: color.fg, marginBottom: 8 }}>{title} ({users.length})</div>
      {users.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>None</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.slice(0, 8).map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#374151' }}>{u.name ?? '—'}</span>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{u.riskScore ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearnerAnalyticsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [department, setDepartment] = useState('');
  const [cohort, setCohort] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [data, setData] = useState<LearnerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getDepartments({ limit: 100 }).then(res => setDepartments(res.data.map(d => d.name))).catch(err => console.error(err)); }, []);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getLearnerAnalytics({
      dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined,
      department: department || undefined, cohort: cohort || undefined,
    })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load learner analytics.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo, department, cohort]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Learner analytics depends on both learner rows and general user state
  // (department/cohort filters read off User) — two events, not the old
  // 'analyticsUpdated' catch-all.
  useEffect(() => {
    window.addEventListener('learnersUpdated', fetchData);
    window.addEventListener('userDataChanged', fetchData);
    return () => {
      window.removeEventListener('learnersUpdated', fetchData);
      window.removeEventListener('userDataChanged', fetchData);
    };
  }, [fetchData]);

  const progressItems = data ? Object.entries(data.progressDistribution).map(([name, count]) => ({ name, count })) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
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
        <select value={department} onChange={e => setDepartment(e.target.value)} style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151', background: '#fff' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input value={cohort} onChange={e => setCohort(e.target.value)} placeholder="Cohort (Group ID)" style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', width: 160 }} />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <ChartCard title="Activity Trend">
          {loading || !data ? <Skeleton /> : data.activityTrend.activeUsers.some(v => v > 0) ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.activityTrend.labels.map((label, i) => ({ label, active: data.activityTrend.activeUsers[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="active" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No activity recorded in this window" />}
        </ChartCard>

        <ChartCard title="Progress Distribution">
          {loading || !data ? <Skeleton /> : progressItems.every(i => i.count === 0) ? <EmptyChart label="No enrollment progress data yet" /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={progressItems} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="count" strokeWidth={2} stroke="#fff">
                      {progressItems.map(i => <Cell key={i.name} fill={PROGRESS_COLORS[i.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {progressItems.map(i => (
                  <div key={i.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: PROGRESS_COLORS[i.name] ?? '#94a3b8' }} />
                    <span style={{ fontSize: 12, color: '#374151', flex: 1, textTransform: 'capitalize' }}>{i.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{i.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title={`Dropout Risk${data ? ` — Completion Rate ${data.completionRate.value}%` : ''}`}>
        {loading || !data ? <Skeleton /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <RiskTable title="High" users={data.dropoutRisk.high} />
            <RiskTable title="Medium" users={data.dropoutRisk.medium} />
            <RiskTable title="Low" users={data.dropoutRisk.low} />
          </div>
        )}
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Top Performers">
          {loading || !data ? <Skeleton /> : data.topPerformers.length === 0 ? <EmptyChart label="No performance data yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.topPerformers.map((p, i) => (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#94a3b8', width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: '#374151' }}>{p.name ?? '—'}</span>
                  <span style={{ fontWeight: 600 }}>{p.avgProgress}%</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Inactive Users">
          {loading || !data ? <Skeleton /> : data.inactiveUsers.length === 0 ? <EmptyChart label="No inactive users" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.inactiveUsers.slice(0, 8).map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#374151' }}>{u.name ?? '—'}</span>
                  <span style={{ color: '#9ca3af' }}>{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString() : 'Never active'}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
