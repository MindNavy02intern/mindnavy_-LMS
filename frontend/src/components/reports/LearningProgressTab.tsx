// Learning Progress tab — a gap in the task's own spec: the master tab list
// (Part 3) names "Learning Progress" as its own tab, but Part 4's per-tab
// breakdown never details what goes in it (only Learner/Instructor/Course
// Analytics, Assessments, Certificates, Attendance, Engagement, Compliance,
// Audit, Export, Custom are spec'd). Judgment call, flagged not silently
// invented: rather than a dead 13th stub, this composes the progress-shaped
// datasets Part 1 already built — Learner Analytics' completion-rate trend/
// distribution/slow-learners/inactive-users/high-performers/learning-speed
// and Course Analytics' per-course completion table — into one cross-cutting
// progress view. No new endpoint, no new metric definition; same R4 reuse
// discipline as the Overview tab. (Slow Learners / Inactive Users / High
// Performers / Learning Speed were added to getLearnerAnalytics() itself,
// not forked into a separate query — same enrollmentWhere/userWhere every
// other field on that endpoint already shares.)

import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getLearnerAnalytics, getCourseAnalytics } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { LearnerAnalytics, CourseAnalytics, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];
const PROGRESS_COLORS: Record<string, string> = { excellent: '#16a34a', good: '#2563eb', average: '#f59e0b', poor: '#dc2626' };

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

export default function LearningProgressTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [learner, setLearner] = useState<LearnerAnalytics | null>(null);
  const [course, setCourse] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    const rangeParams = { dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined };
    Promise.all([getLearnerAnalytics(rangeParams), getCourseAnalytics(rangeParams)])
      .then(([l, c]) => { setLearner(l); setCourse(c); })
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load learning progress.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
  }, [fetchData]);

  const progressItems = learner ? Object.entries(learner.progressDistribution) : [];
  const maxCount = Math.max(1, ...progressItems.map(([, c]) => c));

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {loading || !learner ? <Skeleton /> : (
          <>
            <StatTile label="Completed Enrollments" value={String(learner.completedEnrollments)} />
            <StatTile
              label="Learning Speed (avg days to complete)"
              value={learner.learningSpeedDays.available ? String(learner.learningSpeedDays.value) : null}
              reason={learner.learningSpeedDays.reason}
            />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <ChartCard title={`Completion Rate Trend${learner ? ` — ${learner.completionRate.value}% overall` : ''}`}>
          {loading || !learner ? <Skeleton /> : learner.completionRate.trend.some(v => v > 0) ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={learner.activityTrend.labels.map((label, i) => ({ label, value: learner.completionRate.trend[i] ?? 0 }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Completion Rate']} />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="No completions in this window" />}
        </ChartCard>

        <ChartCard title="Progress Distribution">
          {loading || !learner ? <Skeleton /> : progressItems.every(([, c]) => c === 0) ? <EmptyChart label="No progress data yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {progressItems.map(([name, count]) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ textTransform: 'capitalize', color: '#374151' }}>{name}</span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${(count / maxCount) * 100}%`, background: PROGRESS_COLORS[name] ?? '#94a3b8' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Progress by Course">
        {loading || !course ? <Skeleton /> : course.completionRates.length === 0 ? <EmptyChart label="No courses yet" /> : (
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
                {course.completionRates.slice(0, 15).map(c => (
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <ChartCard title="Slow Learners (< 20% after 30+ days)">
          {loading || !learner ? <Skeleton /> : learner.slowLearners.length === 0 ? <EmptyChart label="No slow learners found" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {learner.slowLearners.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, borderBottom: '1px solid #f8fafc', paddingBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name ?? '—'}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.courseTitle ?? '—'} · {s.daysSinceEnrolled}d</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>{s.progress}%</div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Inactive Users (30+ days)">
          {loading || !learner ? <Skeleton /> : learner.inactiveUsers.length === 0 ? <EmptyChart label="No inactive users found" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {learner.inactiveUsers.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, borderBottom: '1px solid #f8fafc', paddingBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name ?? '—'}</span>
                  <span style={{ color: '#9ca3af', flexShrink: 0 }}>{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString() : 'never active'}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="High Performers (> 80%)">
          {loading || !learner ? <Skeleton /> : learner.highPerformers.length === 0 ? <EmptyChart label="No high performers found" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {learner.highPerformers.map(p => (
                <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, borderBottom: '1px solid #f8fafc', paddingBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name ?? '—'}</span>
                  <span style={{ fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>{p.avgProgress}%</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
