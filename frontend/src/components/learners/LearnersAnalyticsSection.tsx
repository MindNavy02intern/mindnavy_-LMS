// Bottom analytics section — GET /api/admin/learners/analytics (Part 1 backend,
// Part 9 frontend). Chart style mirrors InstructorsAnalyticsSection.tsx
// (140x140 donut, center label, legend renders `percentage` verbatim) plus
// UserActivityChart.tsx (area) / UsersByDepartmentChart.tsx (bar) for the two
// chart types Instructors doesn't have. recharts@2.10.0, already installed.
//
// ONE shared AvailabilityGate wrapper for all 7 sections (every section here
// uses it, unlike Instructors where only Earnings needed it) — task's literal
// ask. All 7 sections are real as of Part 1's backend; none render a fake zero.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { getLearnersAnalytics } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnersAnalytics } from '../../types/learners';

const PROGRAM_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#94a3b8'];
const ENGAGEMENT_COLORS = ['#16a34a', '#e2e8f0'];

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

// The ONE shared wrapper every section below routes through — renders
// `children` when available, otherwise the reason text. Nothing here fakes a
// zero when available is false.
function AvailabilityGate({ available, reason, children }: { available: boolean; reason?: string; children: ReactNode }) {
  if (available) return <>{children}</>;
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Not available yet</div>
      {reason && <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 340, margin: '0 auto' }}>{reason}</div>}
    </div>
  );
}

// ── Row 1 ──────────────────────────────────────────────────────────────────────

function ProgramDonut({ data }: { data: LearnersAnalytics['learnersByProgram'] }) {
  const { items } = data;
  if (items.length === 0) return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No program data</div>;
  const total = items.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 130, height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map((d, i) => <Cell key={d.name} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Learners']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Total</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {items.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: PROGRAM_COLORS[i % PROGRAM_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            {/* Server-computed, largest-remainder rounded — render verbatim, never recompute. */}
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 32, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressOverviewArea({ data }: { data: LearnersAnalytics['progressOverview'] }) {
  const chartData = data.labels.map((label, i) => ({ month: label, avgProgress: data.avgProgress[i] }));
  const hasData = chartData.some(d => d.avgProgress > 0);
  if (!hasData) return <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>No enrollment activity in the last 12 months</div>;
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip labelFormatter={formatMonth} formatter={(value) => [`${value}%`, 'Avg Progress']} />
        <Area type="monotone" dataKey="avgProgress" stroke="#3b82f6" strokeWidth={2} fill="url(#progressGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AtRiskList({ data }: { data: LearnersAnalytics['atRiskLearners'] }) {
  const { items } = data;
  if (items.length === 0) return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No at-risk learners</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {it.photo
            ? <img src={it.photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 9, flexShrink: 0 }}>{initials(it.name)}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{it.program ?? 'Unspecified'}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>{it.riskScore ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ── Row 2 ──────────────────────────────────────────────────────────────────────

function EnrollmentTrendBar({ data }: { data: LearnersAnalytics['enrollmentTrend'] }) {
  const chartData = data.labels.map((label, i) => ({ month: formatMonth(label), enrollments: data.enrollments[i] }));
  const hasData = chartData.some(d => d.enrollments > 0);
  if (!hasData) return <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>No enrollments in the last 12 months</div>;
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Enrollments']} cursor={{ fill: '#f3f4f6' }} />
        <Bar dataKey="enrollments" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopPerformersList({ data }: { data: LearnersAnalytics['topPerformingLearners'] }) {
  const { items } = data;
  if (items.length === 0) return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No learners yet</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 14, fontSize: 12, fontWeight: 700, color: '#94a3b8', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
          {it.photo
            ? <img src={it.photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 9, flexShrink: 0 }}>{initials(it.name)}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{it.avgProgress !== null ? `${it.avgProgress}% avg progress` : '—'}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{it.completedCoursesCount}</span>
        </div>
      ))}
    </div>
  );
}

function RecentCertificatesList({ data }: { data: LearnersAnalytics['recentCertificates'] }) {
  const { items } = data;
  if (items.length === 0) return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No certificates issued yet</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.learnerName ?? '—'}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.courseTitle ?? '—'}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: it.revoked ? '#dc2626' : '#94a3b8', flexShrink: 0 }}>
            {it.revoked ? 'Revoked' : new Date(it.issuedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  );
}

function EngagementDonut({ data }: { data: LearnersAnalytics['learnerEngagement'] }) {
  const { items, score } = data;
  if (items.every(i => i.count === 0)) return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No learners yet</div>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 130, height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map((d, i) => <Cell key={d.name} fill={ENGAGEMENT_COLORS[i % ENGAGEMENT_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Learners']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{score}%</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Engaged</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {items.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: ENGAGEMENT_COLORS[i % ENGAGEMENT_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{d.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 32, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LearnersAnalyticsSection() {
  const navigate = useNavigate();
  const [data, setData] = useState<LearnersAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getLearnersAnalytics()
      .then(setData)
      .catch(err => setError(err instanceof LearnerApiError ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetch);
    return () => window.removeEventListener('analyticsUpdated', fetch);
  }, [fetch]);

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
        <span>{error}</span>
        <button onClick={fetch} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <ChartCard title="Learners by Program">
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.learnersByProgram.available}>
              <ProgramDonut data={data.learnersByProgram} />
            </AvailabilityGate>
          )}
        </ChartCard>

        <ChartCard title="Progress Overview">
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.progressOverview.available}>
              <ProgressOverviewArea data={data.progressOverview} />
            </AvailabilityGate>
          )}
        </ChartCard>

        <ChartCard
          title="At Risk Learners"
          action={
            <button type="button" onClick={() => navigate('/learners?tab=at-risk')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              View All <ArrowRight size={12} strokeWidth={2} />
            </button>
          }
        >
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.atRiskLearners.available}>
              <AtRiskList data={data.atRiskLearners} />
            </AvailabilityGate>
          )}
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <ChartCard title="Enrollment Trend">
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.enrollmentTrend.available}>
              <EnrollmentTrendBar data={data.enrollmentTrend} />
            </AvailabilityGate>
          )}
        </ChartCard>

        <ChartCard
          title="Top Performing Learners"
          action={
            <button type="button" onClick={() => navigate('/learners?tab=completed&sort=courses')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              View All <ArrowRight size={12} strokeWidth={2} />
            </button>
          }
        >
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.topPerformingLearners.available}>
              <TopPerformersList data={data.topPerformingLearners} />
            </AvailabilityGate>
          )}
        </ChartCard>

        <ChartCard title="Recent Certificates">
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.recentCertificates.available}>
              <RecentCertificatesList data={data.recentCertificates} />
            </AvailabilityGate>
          )}
        </ChartCard>

        <ChartCard title="Learner Engagement">
          {loading || !data ? <ChartSkeleton /> : (
            <AvailabilityGate available={data.learnerEngagement.available}>
              <EngagementDonut data={data.learnerEngagement} />
            </AvailabilityGate>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
