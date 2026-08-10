// Overview tab — 10 KPI cards + date range/department filters + 5 charts.
// Per REPORTS_CONTRACT.md, the KPI set is its own real endpoint
// (GET /reports/overview), but the 5 charts deliberately REUSE the other
// report endpoints' already-built fields (R4) rather than inventing parallel
// definitions: Learning Activity trend + Top Active Learners <- Learner
// Analytics' activityTrend/topPerformers; Course Completion by Category <-
// Course Analytics' bestCategories; Recent Certificates <- Certificate
// Reports' recentCertificates; System Activity feed <- Audit Reports' logs.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  Users, GraduationCap, Presentation, CheckCircle2, TrendingUp,
  Radio, DollarSign, Award, Activity, History,
} from 'lucide-react';
import {
  getReportsOverview, getLearnerAnalytics, getCourseAnalytics, getCertificateReports, getAuditReports,
} from '../../services/reportsApi';
import { getDepartments } from '../../api/organization';
import { ReportsApiError } from '../../types/reports';
import type {
  ReportsOverview, LearnerAnalytics, CourseAnalytics, CertificateReports, AuditReports, DateRangeKey, Metric,
} from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'custom',  label: 'Custom' },
];

// ── Shared local primitives (same visual vocabulary as CompetenciesOverviewTab) ──

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
}

// ── KPI cards ────────────────────────────────────────────────────────────

interface KpiDef {
  key: keyof ReportsOverview;
  label: string;
  Icon: typeof Users;
  iconBg: string;
  iconColor: string;
  format: (v: number) => string;
}

const KPI_DEFS: KpiDef[] = [
  { key: 'totalUsers',         label: 'Total Users',         Icon: Users,         iconBg: '#eff6ff', iconColor: '#2563eb', format: v => v.toLocaleString() },
  { key: 'activeLearners',      label: 'Active Learners',     Icon: GraduationCap, iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => v.toLocaleString() },
  { key: 'activeInstructors',   label: 'Active Instructors',  Icon: Presentation,  iconBg: '#fef3c7', iconColor: '#d97706', format: v => v.toLocaleString() },
  { key: 'coursesCompleted',    label: 'Courses Completed',   Icon: CheckCircle2,  iconBg: '#ecfdf5', iconColor: '#059669', format: v => v.toLocaleString() },
  { key: 'avgLearningProgress', label: 'Avg Learning Progress', Icon: TrendingUp,  iconBg: '#eef2ff', iconColor: '#4f46e5', format: v => `${v}%` },
  { key: 'liveSessionsToday',   label: 'Live Sessions Today', Icon: Radio,         iconBg: '#fdf2f8', iconColor: '#db2777', format: v => v.toLocaleString() },
  { key: 'totalRevenue',        label: 'Total Revenue',       Icon: DollarSign,    iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => `$${v.toLocaleString()}` },
  { key: 'certificatesIssued',  label: 'Certificates Issued', Icon: Award,         iconBg: '#fffbeb', iconColor: '#d97706', format: v => v.toLocaleString() },
  { key: 'engagementScore',     label: 'Engagement Score',    Icon: Activity,      iconBg: '#f5f3ff', iconColor: '#7c3aed', format: v => `${v}%` },
  { key: 'systemActivity',      label: 'System Activity',     Icon: History,       iconBg: '#f1f5f9', iconColor: '#475569', format: v => v.toLocaleString() },
];

function KpiCard({ def, metric }: { def: KpiDef; metric: Metric | undefined }) {
  const { Icon, iconBg, iconColor, label, format } = def;
  const available = metric?.available ?? false;
  const value = metric?.value ?? null;
  const change = metric?.changePercent ?? null;

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        {available && value !== null ? format(value) : '—'}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: change === null ? '#9ca3af' : change >= 0 ? '#16a34a' : '#dc2626' }}>
        {available
          ? (change !== null ? `${change >= 0 ? '+' : ''}${change}% vs prior period` : 'No comparison available')
          : (metric?.reason ?? 'Not available yet')}
      </div>
    </div>
  );
}

export default function ReportsOverviewTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [learnerAnalytics, setLearnerAnalytics] = useState<LearnerAnalytics | null>(null);
  const [courseAnalytics, setCourseAnalytics] = useState<CourseAnalytics | null>(null);
  const [certificates, setCertificates] = useState<CertificateReports | null>(null);
  const [audit, setAudit] = useState<AuditReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDepartments({ limit: 100 }).then(res => setDepartments(res.departments.map(d => d.name))).catch(() => {});
  }, []);

  const rangeParams = { dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined };
  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchAll = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getReportsOverview({ ...rangeParams, department: department || undefined }),
      getLearnerAnalytics({ ...rangeParams, department: department || undefined }),
      getCourseAnalytics(rangeParams),
      getCertificateReports({ ...rangeParams, limit: 5 }),
      getAuditReports({ ...rangeParams, limit: 5 }),
    ])
      .then(([o, l, c, cert, a]) => {
        setOverview(o);
        setLearnerAnalytics(l);
        setCourseAnalytics(c);
        setCertificates(cert);
        setAudit(a);
      })
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load reports overview.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo, department]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Reports Overview aggregates data owned by nearly every other module
  // (users/learners/instructors/courses/certificates/live-sessions/audit) —
  // there's no single mutation ID that could list them all, so it listens to
  // the same catch-all bridge event every other surface's mutations already
  // dispatch (see invalidation.ts's dispatchBridgeEvents default branch),
  // rather than going stale until the tab is manually revisited.
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchAll);
    return () => window.removeEventListener('analyticsUpdated', fetchAll);
  }, [fetchAll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
          {DATE_RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setDateRange(r.key)}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: dateRange === r.key ? '#fff' : 'transparent',
                color: dateRange === r.key ? '#2563eb' : '#64748b',
                boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
          </div>
        )}

        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151', background: '#fff' }}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchAll(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      )}

      {/* KPI grid — 2 rows of 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {KPI_DEFS.map(def => (
          loading || !overview
            ? <div key={def.key} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', height: 92 }}><ChartSkeleton /></div>
            : <KpiCard key={def.key} def={def} metric={overview[def.key]} />
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <ChartCard title="Learning Activity (last 30 days)">
          {loading || !learnerAnalytics ? <ChartSkeleton /> : (
            learnerAnalytics.activityTrend.activeUsers.some(v => v > 0) ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={learnerAnalytics.activityTrend.labels.map((label, i) => ({ label, active: learnerAnalytics.activityTrend.activeUsers[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="active" name="Active Learners" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No learner activity recorded in this window" />
          )}
        </ChartCard>

        <ChartCard title="Course Completion by Category">
          {loading || !courseAnalytics ? <ChartSkeleton /> : (
            courseAnalytics.bestCategories.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courseAnalytics.bestCategories.map(c => ({ ...c, shortName: c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="shortName" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Progress']} labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''} />
                    <Bar dataKey="avgProgress" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No category data yet" />
          )}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <ChartCard title="Top Active Learners">
          {loading || !learnerAnalytics ? <ChartSkeleton /> : (
            learnerAnalytics.topPerformers.length === 0 ? <EmptyChart label="No learner activity yet" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {learnerAnalytics.topPerformers.slice(0, 5).map((p, i) => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name ?? '—'}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{p.avgProgress}%</div>
                  </div>
                ))}
              </div>
            )
          )}
        </ChartCard>

        <ChartCard title="Recent Certificates">
          {loading || !certificates ? <ChartSkeleton /> : (
            certificates.recentCertificates.length === 0 ? <EmptyChart label="No certificates issued in this window" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {certificates.recentCertificates.slice(0, 5).map(c => (
                  <div key={c.id} style={{ fontSize: 12 }}>
                    <div style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseTitle ?? 'Unknown course'}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{c.userName ?? 'Unknown learner'} · {new Date(c.issuedAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </ChartCard>

        <ChartCard title="System Activity">
          {loading || !audit ? <ChartSkeleton /> : (
            audit.logs.length === 0 ? <EmptyChart label="No activity in this window" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {audit.logs.slice(0, 5).map(l => (
                  <div key={l.id} style={{ fontSize: 12 }}>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>{l.action.replace(/_/g, ' ')}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{l.userName ?? 'System'} · {new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </ChartCard>
      </div>
    </div>
  );
}
