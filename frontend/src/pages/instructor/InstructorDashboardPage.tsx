import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InstructorLayout from './InstructorLayout';
import { useInstructorAuth } from '../../context/InstructorAuthContext';
import { getMyDashboardStats, getMyEnrollmentTrend, getMyActivity } from '../../api/instructorSelfApi';
import type { InstructorDashboardStats, InstructorEnrollmentTrend, InstructorSelfActivityItem } from '../../types/instructorSelf';
import type { Metric } from '../../types/instructors';
import '../../styles/dashboard.css';

// Mirrors DashboardPage.tsx's LKpiCard/KpiSkeleton pattern (same mn-lkpi-*
// classes, same "available:false -> '—' never 0, changePercent:null -> no
// arrow" rule) — simplified: no icon-color theming per card, one consistent
// look, since this is a single-owner dashboard, not a 9-card admin grid.
//
// Buttons below deliberately do NOT use .mn-btn-primary — that class is
// `display:block; width:100%`, meant for a full-width auth-page submit
// button, not an inline card action; using it here made every button stretch
// to its container's full width. Sized/styled to match
// components/instructors/InstructorDocumentsTab.tsx's own small inline
// action-button convention instead (the actual admin precedent for a
// card-level action button), same reasoning as InstructorProfilePage.tsx.
const BTN_PRIMARY: React.CSSProperties = { padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' };
const BTN_SECONDARY: React.CSSProperties = { padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer' };
const ERROR_BANNER: React.CSSProperties = { padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' };

function formatMetricValue(m: Metric): string {
  if (!m.available || m.value === null) return '—';
  return String(m.value);
}

function KpiCard({ label, metric, suffix }: { label: string; metric: Metric; suffix?: string }) {
  const showArrow = metric.available && metric.changePercent !== null;
  return (
    <div className="mn-lkpi-card">
      <div className="mn-lkpi-label">{label}</div>
      <div className="mn-lkpi-value">
        {formatMetricValue(metric)}{metric.available && metric.value !== null ? suffix : ''}
      </div>
      {showArrow && (
        <div style={{ fontSize: '0.72rem', color: (metric.changePercent ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
          {(metric.changePercent ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(metric.changePercent ?? 0)}% vs last month
        </div>
      )}
      {!metric.available && metric.reason && (
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>{metric.reason}</div>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="mn-lkpi-card" style={{ pointerEvents: 'none' }}>
      <div className="mn-skeleton" style={{ width: '55%', height: 12, borderRadius: 4, marginBottom: 14 }} />
      <div className="mn-skeleton" style={{ width: '45%', height: 30, borderRadius: 4 }} />
    </div>
  );
}

function EnrollmentTrendChart({ trend }: { trend: InstructorEnrollmentTrend }) {
  const max = Math.max(1, ...trend.enrollments);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '8px 4px' }}>
      {trend.labels.map((label, i) => {
        const value = trend.enrollments[i] ?? 0;
        const heightPct = Math.round((value / max) * 100);
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{value > 0 ? value : ''}</div>
            <div
              title={`${label}: ${value} enrollment${value === 1 ? '' : 's'}`}
              style={{
                width: '100%', height: `${Math.max(heightPct, 2)}%`, minHeight: 2,
                background: value > 0 ? '#2563eb' : '#e2e8f0', borderRadius: '3px 3px 0 0',
              }}
            />
            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{label.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

const ACTIVITY_ICON: Record<InstructorSelfActivityItem['type'], string> = {
  course_created: '📘',
  session_scheduled: '🎥',
  certificate_issued: '🎓',
  admin_action: '🛡️',
  review_received: '⭐',
  document_verified: '✅',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InstructorDashboardPage() {
  const { instructor } = useInstructorAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<InstructorDashboardStats | null>(null);
  const [trend, setTrend] = useState<InstructorEnrollmentTrend | null>(null);
  const [activity, setActivity] = useState<InstructorSelfActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Wrapped in an IIFE, same as AuthContext.tsx's pattern — a direct
    // setState call at the top level of an effect body trips
    // react-hooks/set-state-in-effect.
    (() => { setLoading(true); setError(null); })();

    Promise.all([getMyDashboardStats(), getMyEnrollmentTrend(), getMyActivity()])
      .then(([statsRes, trendRes, activityRes]) => {
        if (cancelled) return;
        setStats(statsRes);
        setTrend(trendRes);
        setActivity(activityRes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <InstructorLayout>
      {/* Same .mn-db-welcome-* classes/scale as admin's DashboardPage.tsx
          welcome row (1.125rem title, not the 1.4rem this used to be). */}
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">Welcome back, {instructor?.fullName}</h1>
          <p className="mn-db-welcome-sub">Instructor Dashboard</p>
        </div>
        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca', fontSize: 10, fontWeight: 700 }}>
          INSTRUCTOR
        </span>
      </div>

      {error && (
        <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>
      )}

      {/* KPI cards — same .mn-lkpi-grid class (and its responsive
          breakpoints) admin's DashboardPage.tsx uses, not an ad-hoc grid. */}
      <div className="mn-lkpi-grid" style={{ marginBottom: 20 }}>
        {loading || !stats ? (
          Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="My Published Courses" metric={stats.myPublishedCourses} />
            <KpiCard label="My Draft Courses" metric={stats.myDraftCourses} />
            <KpiCard label="Pending Course Approvals" metric={stats.myPendingApprovalCourses} />
            <KpiCard label="My Total Students" metric={stats.myTotalStudents} />
            <KpiCard label="Upcoming Live Sessions" metric={stats.myUpcomingSessions} />
            <KpiCard label="My Avg. Rating" metric={stats.myAvgRating} suffix=" ★" />
            <KpiCard label="Certificates Issued" metric={stats.myCertificatesIssued} />
            <KpiCard label="My Earnings (this period)" metric={stats.myTotalEarnings} />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Enrollment trend */}
          <div className="mn-db-card">
            <div className="mn-db-card-header">
              <div className="mn-db-card-title">My Enrollments — Last 12 Months</div>
            </div>
            {loading || !trend ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
            ) : (
              <EnrollmentTrendChart trend={trend} />
            )}
          </div>

          {/* Courses by status */}
          {stats && stats.coursesByStatus.items.length > 0 && (
            <div className="mn-db-card">
              <div className="mn-db-card-header">
                <div className="mn-db-card-title">My Courses by Status</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.coursesByStatus.items.map((item) => (
                  <div key={item.status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>{item.status}</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.count} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="mn-db-card">
            <div className="mn-db-card-header">
              <div className="mn-db-card-title">Quick Links</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={BTN_PRIMARY} onClick={() => navigate('/instructor/courses')}>
                Create Course
              </button>
              <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/instructor/live-sessions')}>
                Schedule Session
              </button>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Recent Activity</div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
          ) : activity.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span>{ACTIVITY_ICON[item.type] ?? '•'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#334155' }}>{item.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{formatRelative(item.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InstructorLayout>
  );
}
