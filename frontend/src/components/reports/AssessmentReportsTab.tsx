// Assessment Reports tab — summary cards, pass/fail donut, recent attempts
// table. Filter by course/date range. Hardest questions is an honest
// em-dash — QuizAttempt stores only the final score, no per-question log.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getAssessmentReports } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { AssessmentReports, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

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
function StatTile({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: value === null ? '#cbd5e1' : '#0f172a' }}>{value ?? '—'}</div>
      {value === null && reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

export default function AssessmentReportsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [courseId, setCourseId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AssessmentReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getAssessmentReports({ dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined, courseId: courseId || undefined, page, limit: 20 })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load assessment reports.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo, courseId, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('coursesUpdated', fetchData);
    return () => window.removeEventListener('coursesUpdated', fetchData);
  }, [fetchData]);

  const donutData = data && data.passRate.available ? [
    { name: 'Passed', value: data.passRate.value ?? 0, color: '#16a34a' },
    { name: 'Failed', value: data.failRate.value ?? 0, color: '#dc2626' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
          {DATE_RANGES.map(r => (
            <button key={r.key} type="button" onClick={() => { setDateRange(r.key); setPage(1); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: dateRange === r.key ? '#fff' : 'transparent', color: dateRange === r.key ? '#2563eb' : '#64748b', boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{r.label}</button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
          </div>
        )}
        <input value={courseId} onChange={e => { setCourseId(e.target.value); setPage(1); }} placeholder="Filter by Course ID" style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', width: 180 }} />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading || !data ? <Skeleton /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatTile label="Total Attempts" value={String(data.totalAttempts.value)} />
          <StatTile label="Avg Score" value={data.avgScore.available ? `${data.avgScore.value}%` : null} reason={data.avgScore.reason} />
          <StatTile label="Pass Rate" value={data.passRate.available ? `${data.passRate.value}%` : null} reason={data.passRate.reason} />
          <StatTile label="Fail Rate" value={data.failRate.available ? `${data.failRate.value}%` : null} reason={data.failRate.reason} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <ChartCard title="Pass / Fail">
          {loading || !data ? <Skeleton /> : donutData.length === 0 ? <EmptyChart label="No graded attempts yet" /> : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="#fff">
                    {donutData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Hardest Questions">
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{data?.hardestQuestions.reason ?? 'Not available yet'}</div>
        </ChartCard>
      </div>

      <ChartCard title="Recent Attempts">
        {loading || !data ? <Skeleton /> : data.recentAttempts.length === 0 ? <EmptyChart label="No attempts in this window" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['User', 'Quiz', 'Score', 'Status', 'Submitted'].map(h => (
                    <th key={h} style={{ textAlign: h === 'User' || h === 'Quiz' ? 'left' : 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', color: '#0f172a' }}>{a.userName ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{a.quizTitle ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{a.score ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{a.status}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer' }}>Prev</button>
            <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>{data.pagination.page} / {data.pagination.pages}</span>
            <button disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= data.pagination.pages ? 'default' : 'pointer' }}>Next</button>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
