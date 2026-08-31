import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import InstructorLayout from './InstructorLayout';
import { ERROR_BANNER, TH, TD } from './instructorUiKit';
import { getMyReportsOverview, getMyCourseBreakdown, InstructorReportsApiError } from '../../api/instructorReportsApi';
import type { MyReportsOverview, MyCourseBreakdownRow } from '../../types/instructorReports';

// Self-scoped mirror of admin's Reports & Analytics -> Instructor Analytics
// tab (blueprint 2.11). Trend window is a fixed trailing 12 months, matching
// every other trend chart already built in this instructor portal — not
// admin Reports' selectable week/month/quarter dateRange.

function StatTile({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div className="mn-db-card">
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: value === null ? '#cbd5e1' : '#0f172a' }}>{value ?? '—'}</div>
      {value === null && reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'short' });
}

export default function InstructorReportsPage() {
  const [overview, setOverview] = useState<MyReportsOverview | null>(null);
  const [courses, setCourses] = useState<MyCourseBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMyReportsOverview(), getMyCourseBreakdown()])
      .then(([o, c]) => { setOverview(o); setCourses(c); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorReportsApiError ? err.message : 'Failed to load reports.'))
      .finally(() => setLoading(false));
  }, []);

  const trendData = overview?.performanceTrend.labels.map((label, i) => ({
    month: monthLabel(label),
    completionRate: overview.performanceTrend.completionRate[i],
  })) ?? [];
  const hasTrendData = trendData.some((d) => d.completionRate > 0);

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Reports</h1>
          <p className="mn-db-welcome-sub">Performance across your courses and live sessions</p>
        </div>
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <StatTile
              label="Course Completion Rate"
              value={overview?.courseCompletionRate.available ? `${overview.courseCompletionRate.value}%` : null}
              reason={overview?.courseCompletionRate.reason}
            />
            <StatTile
              label="Avg. Rating"
              value={overview?.avgRating.available ? String(overview.avgRating.value) : null}
              reason={overview?.avgRating.reason}
            />
            <StatTile
              label="Live Session Attendance"
              value={overview?.liveSessionAttendance.available ? `${overview.liveSessionAttendance.value}%` : null}
              reason={overview?.liveSessionAttendance.reason}
            />
          </div>

          <div className="mn-db-card" style={{ marginBottom: 14 }}>
            <div className="mn-db-card-header"><div className="mn-db-card-title">Performance Trend — Completion Rate (Last 12 Months)</div></div>
            {!hasTrendData ? (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>No enrollment activity in this window yet.</p>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Completion Rate']} />
                    <Line type="monotone" dataKey="completionRate" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mn-db-card">
            <div className="mn-db-card-header"><div className="mn-db-card-title">Per-Course Breakdown</div></div>
            {courses.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No courses yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={TH}>Course</th>
                    <th style={TH}>Enrolled</th>
                    <th style={TH}>Completed</th>
                    <th style={TH}>Completion %</th>
                    <th style={TH}>Avg. Quiz Score</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.courseId}>
                      <td style={TD}>{c.courseTitle}</td>
                      <td style={TD}>{c.enrolled}</td>
                      <td style={TD}>{c.completed}</td>
                      <td style={TD}>{c.completionRate != null ? `${c.completionRate}%` : '—'}</td>
                      <td style={TD}>{c.avgQuizScore != null ? c.avgQuizScore : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </InstructorLayout>
  );
}
