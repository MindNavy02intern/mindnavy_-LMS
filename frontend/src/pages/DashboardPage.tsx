import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import '../styles/dashboard.css';
import { useAuth } from '../AuthContext';
import { getDashboardCore, getDashboardAnalytics, getAdminWidgets } from '../api/dashboard';
import type {
  ActivityItem,
  ActivityType,
  AdminWidgetsResponse,
  AiInsightItem,
  CalendarEventItem,
  CourseCompletionCategory,
  DashboardAnalyticsResponse,
  DashboardCoreResponse,
  InstructorPerformance,
  LearningActivityItem,
  LiveSessions,
  NotificationItem,
  NotificationType,
  PendingApprovals,
  QuickActionItem,
  QuickActionKey,
  ReportsSnapshot,
  RevenueOverview,
  StudentEngagement,
  CourseAnalytics,
  UserAnalytics,
  UsersByRoleItem,
  TaskItem,
  TransactionItem,
} from '../types/dashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m} minutes ago`;
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? 's' : ''} ago`;
}

function formatDate(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(now)}`;
}

// ── KPI icon ──────────────────────────────────────────────────────────────────

function KpiIcon({ type }: { type: string }) {
  if (type === 'users') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
  if (type === 'learners') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  );
  if (type === 'courses') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
  if (type === 'completions') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
  if (type === 'revenue') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
  if (type === 'instructors') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
  if (type === 'approvals') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  if (type === 'subscriptions') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
    </svg>
  );
  if (type === 'sessions') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
  return null;
}

// ── Quick action icon ─────────────────────────────────────────────────────────

function QaIcon({ actionKey }: { actionKey: QuickActionKey }) {
  if (actionKey === 'add_user') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  );
  if (actionKey === 'create_course') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/>
    </svg>
  );
  if (actionKey === 'approve_instructor') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
  if (actionKey === 'generate_report') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
  if (actionKey === 'create_live_session') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
  if (actionKey === 'system_settings') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
  return <span style={{ fontSize: '0.75rem' }}>{actionKey}</span>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface LKpiCardProps { label: string; value: string | number; iconType: string; iconBg: string; iconColor: string; }
function LKpiCard({ label, value, iconType, iconBg, iconColor }: LKpiCardProps) {
  return (
    <div className="mn-lkpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div className="mn-lkpi-label" style={{ marginBottom: 0, paddingTop: 2 }}>{label}</div>
        <div className="mn-lkpi-icon" style={{ background: iconBg, color: iconColor }}>
          <KpiIcon type={iconType} />
        </div>
      </div>
      <div className="mn-lkpi-value">{value}</div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="mn-lkpi-card" style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div className="mn-skeleton" style={{ width: '55%', height: 12, borderRadius: 4 }} />
        <div className="mn-skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
      </div>
      <div className="mn-skeleton" style={{ width: '45%', height: 30, borderRadius: 4 }} />
    </div>
  );
}

// ── Reusable compact stat row ─────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '0.688rem', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
  );
}

// ── Analytics card skeleton ───────────────────────────────────────────────────

function AnalyticsSpin() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
      <div className="mn-spinner" style={{ borderTopColor: '#2563eb' }} />
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '10px 0', margin: 0 }}>{msg}</p>;
}

// Honest "not built yet" signal — distinct from EmptyMsg (which means "genuinely
// nothing here right now"). Used for widgets with no backend system behind them
// at all, so an admin never mistakes "no system exists" for "no data currently".
function ComingSoonBanner({ text }: { text: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', marginTop: 6 }}>
      <div style={{ fontSize: '1.1rem' }}>🚀</div>
      <div style={{ fontSize: '0.72rem', marginTop: 4 }}>{text}</div>
    </div>
  );
}

// ── Learning Activity Chart (wired to analytics API) ─────────────────────────

function LearningActivityChart({ data }: { data: LearningActivityItem[] }) {
  const navigate = useNavigate();
  if (data.length === 0) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '12px 0', gap: '8px', color: '#94a3b8',
    }}>
      <div style={{ fontSize: '26px' }}>📚</div>
      <p style={{ fontWeight: 600, color: '#475569', margin: 0, fontSize: '0.78rem' }}>Learning Activity Coming Soon</p>
      <p style={{ fontSize: '0.72rem', margin: 0, textAlign: 'center', color: '#94a3b8' }}>
        Appears once courses and enrollments are configured.
      </p>
      <button
        onClick={() => navigate('/courses')}
        style={{
          padding: '5px 12px', background: '#3b82f6', color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem',
        }}
      >
        Set up Learning Management →
      </button>
    </div>
  );

  const labels   = data.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });
  const enrolled = data.map(d => d.enrolled);
  const completed = data.map(d => d.completed);
  const rawMax = Math.max(...enrolled, ...completed, 1);
  const maxV = Math.ceil(rawMax / 1000) * 1000 || 1000;
  const yTicks = [0, Math.round(maxV / 3), Math.round((2 * maxV) / 3), maxV];
  const W = 500, H = 130, PAD_L = 34, PAD_B = 22, PAD_T = 8, PAD_R = 8;
  const cW = W - PAD_L - PAD_R, cH = H - PAD_B - PAD_T;
  const n = data.length;
  const toX = (i: number) => PAD_L + (i / (n - 1)) * cW;
  const toY = (v: number) => PAD_T + cH - (v / maxV) * cH;
  const ptE = enrolled.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const ptC = completed.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaE = `${toX(0)},${toY(0)} ${ptE} ${toX(n - 1)},${toY(0)}`;
  const areaC = `${toX(0)},${toY(0)} ${ptC} ${toX(n - 1)},${toY(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="grad-enroll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-compl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((v) => {
        const y = toY(v);
        const lbl = v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;
        return (
          <g key={v}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="Inter,sans-serif">{lbl}</text>
          </g>
        );
      })}
      <polygon points={areaE} fill="url(#grad-enroll)" />
      <polygon points={areaC} fill="url(#grad-compl)" />
      <polyline points={ptE} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={ptC} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(n - 1)} cy={toY(enrolled[n - 1])}  r="3" fill="#2563eb" />
      <circle cx={toX(n - 1)} cy={toY(completed[n - 1])} r="3" fill="#16a34a" />
      {labels.map((lbl, i) => (
        <text key={lbl} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="Inter,sans-serif">{lbl}</text>
      ))}
    </svg>
  );
}

// ── Users by Role Donut (wired to analytics API) ──────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  learners:        '#2563eb',
  instructors:     '#16a34a',
  admins:          '#f59e0b',
  managers:        '#8b5cf6',
  adminAssistants: '#ef4444',
  others:          '#94a3b8',
};
const ROLE_LABELS: Record<string, string> = {
  learners: 'Learners', instructors: 'Instructors', admins: 'Admins', managers: 'Managers',
  adminAssistants: 'Admin Assistants', others: 'Others',
};

function UsersRoleDonut({ data }: { data: UsersByRoleItem[] }) {
  if (data.length === 0) return <EmptyMsg msg="No role data available." />;
  const R = 36, cx = 50, cy = 50;
  const circ = 2 * Math.PI * R;
  const segments = data.reduce(
    (acc, d) => {
      const dashLen = (d.percentage / 100) * circ;
      acc.segs.push({ ...d, dashLen, offset: acc.offset });
      acc.offset += dashLen;
      return acc;
    },
    { segs: [] as (UsersByRoleItem & { dashLen: number; offset: number })[], offset: 0 }
  ).segs;
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {segments.map((s) => (
          <circle key={s.role} cx={cx} cy={cy} r={R} fill="none"
            stroke={ROLE_COLORS[s.role] ?? '#94a3b8'} strokeWidth="14"
            strokeDasharray={`${s.dashLen} ${circ - s.dashLen}`} strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="Inter,sans-serif">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5" fill="#64748b" fontFamily="Inter,sans-serif">Total Users</text>
      </svg>
      <div style={{ width: '100%' }}>
        {data.map((d) => (
          <div key={d.role} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[d.role] ?? '#94a3b8', flexShrink: 0 }} />
            <span style={{ fontSize: '0.625rem', color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ROLE_LABELS[d.role] ?? d.role}</span>
            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a', flexShrink: 0 }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: '0.575rem', color: '#94a3b8', flexShrink: 0, minWidth: 26, textAlign: 'right' }}>{d.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Completion Donut (wired to analytics API) ─────────────────────────────────

function CompletionDonut({ pct, categories }: { pct: number | null; categories: CourseCompletionCategory[] }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);
  const R = 36, circ = 2 * Math.PI * R;
  const hasData = pct != null;
  const dash = animated && hasData ? (pct / 100) * circ : 0;
  const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {hasData && (
            <circle cx="48" cy="48" r={R} fill="none" stroke="#2563eb" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 48 48)"
              style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
          )}
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: hasData ? '1.1rem' : '0.68rem', fontWeight: 800, color: hasData ? '#0f172a' : '#94a3b8', lineHeight: 1.2 }}>
            {hasData ? `${pct}%` : 'Not available yet'}
          </div>
          <div style={{ fontSize: '0.57rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average</div>
        </div>
      </div>
      <div style={{ width: '100%' }}>
        {categories.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>No category data.</p>
        ) : categories.map((c, i) => (
          <div key={c.name} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: '0.625rem', color: '#374151' }}>{c.name}</span>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a' }}>{c.completionRate}%</span>
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${c.completionRate}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 1s ease 0.4s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity / Notification helpers (TASK 5A — unchanged) ────────────────────

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

function ActivityAvatar({ name, index }: { name: string; index: number }) {
  const initials = (name ?? 'S').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      background: AVATAR_COLORS[index % AVATAR_COLORS.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6rem', fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  );
}

const ACTIVITY_ICON_BG: Record<ActivityType, string> = {
  course: '#dbeafe', user: '#dcfce7', certificate: '#fef3c7', assignment: '#f3e8ff', live_session: '#d1fae5', system: '#f1f5f9',
};
const ACTIVITY_ICON_COLOR: Record<ActivityType, string> = {
  course: '#2563eb', user: '#16a34a', certificate: '#f59e0b', assignment: '#8b5cf6', live_session: '#059669', system: '#64748b',
};
const NOTIF_BG: Record<NotificationType, string> = {
  security: '#fef2f2', approval: '#fffbeb', system: '#eff6ff', payment: '#f0fdf4', course: '#f5f3ff',
};
const NOTIF_ICON_COLOR: Record<NotificationType, string> = {
  security: '#ef4444', approval: '#f59e0b', system: '#2563eb', payment: '#16a34a', course: '#8b5cf6',
};

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === 'security') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
  if (type === 'approval') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  );
  if (type === 'payment') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  );
  if (type === 'course') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  );
}

// ── Analytics widgets ─────────────────────────────────────────────────────────

function RevenueCard({ data, loading }: { data: RevenueOverview | undefined; loading: boolean }) {
  const isPhase2 = !data || (data.annualRevenue === 0 && data.monthlyRevenue === 0 && data.dailyRevenue === 0);
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">Revenue Overview</div>
      </div>
      {loading ? <AnalyticsSpin /> : isPhase2 ? (
        <ComingSoonBanner text="Coming in Finance module" />
      ) : (
        <>
          <StatRow label="Daily Revenue"      value={`$${data!.dailyRevenue.toLocaleString()}`} />
          <StatRow label="Monthly Revenue"    value={`$${data!.monthlyRevenue.toLocaleString()}`} />
          <StatRow label="Annual Revenue"     value={`$${data!.annualRevenue.toLocaleString()}`} />
          <StatRow label="Subscriptions"      value={`$${data!.subscriptionRevenue.toLocaleString()}`} />
          <StatRow label="Refunds"            value={`$${data!.refundTotal.toLocaleString()}`} />
          <StatRow label="Instructor Payouts" value={`$${data!.instructorPayouts.toLocaleString()}`} />
        </>
      )}
    </div>
  );
}

function UserAnalyticsCard({ data, loading }: { data: UserAnalytics | undefined; loading: boolean }) {
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header"><div className="mn-db-card-title">User Analytics</div></div>
      {loading ? <AnalyticsSpin /> : data ? (
        <>
          <StatRow label="New Registrations" value={data.newRegistrations.toLocaleString()} />
          <StatRow label="Active Users"      value={data.activeUsers.toLocaleString()} />
          <StatRow label="Retention Rate"    value={data.retentionRate != null ? `${data.retentionRate.toFixed(1)}%` : 'Not available yet'} />
          <StatRow label="Verified Users"    value={data.verifiedUsers.toLocaleString()} />
          <StatRow label="Suspended Users"   value={data.suspendedUsers.toLocaleString()} />
        </>
      ) : <EmptyMsg msg="No user analytics." />}
    </div>
  );
}

function CourseAnalyticsCard({ data, loading }: { data: CourseAnalytics | undefined; loading: boolean }) {
  const isPhase2 = !data || data.totalCourses === 0;
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header"><div className="mn-db-card-title">Course Analytics</div></div>
      {loading ? <AnalyticsSpin /> : isPhase2 ? (
        <ComingSoonBanner text="Coming in Learning Management module" />
      ) : (
        <>
          <StatRow label="Total Courses"    value={data!.totalCourses.toLocaleString()} />
          <StatRow label="Active Courses"   value={data!.activeCourses.toLocaleString()} />
          <StatRow label="Pending Approval" value={data!.pendingApprovalCourses.toLocaleString()} />
          <StatRow label="Avg Completion"   value={data!.averageCompletionRate != null ? `${data!.averageCompletionRate.toFixed(1)}%` : 'Not available yet'} />
          <StatRow label="Avg Quiz Score"   value={data!.averageQuizScore != null ? `${data!.averageQuizScore.toFixed(1)}%` : 'Not available yet'} />
          {data!.mostPopularCourse && (
            <div style={{ marginTop: 6, padding: '5px 0', borderTop: '1px solid #f8fafc' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 2 }}>Most Popular</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data!.mostPopularCourse}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InstructorPerformanceCard({ data, loading }: { data: InstructorPerformance | undefined; loading: boolean }) {
  const isPhase2 = !data || (data.averageRating === 0 && data.averageCompletionRate === 0 && data.averageAttendanceRate === 0);
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header"><div className="mn-db-card-title">Instructor Performance</div></div>
      {loading ? <AnalyticsSpin /> : isPhase2 ? (
        <ComingSoonBanner text="Coming in Learning Management module" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {[
            { label: 'Avg Rating',   value: `${data!.averageRating.toFixed(1)}/5`,           color: '#f59e0b' },
            { label: 'Completion',   value: `${data!.averageCompletionRate.toFixed(1)}%`,     color: '#16a34a' },
            { label: 'Attendance',   value: `${data!.averageAttendanceRate.toFixed(1)}%`,     color: '#2563eb' },
            { label: 'Review Score', value: `${data!.averageReviewScore.toFixed(1)}/5`,       color: '#8b5cf6' },
          ].map(m => (
            <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.625rem', color: '#64748b', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentEngagementCard({ data, loading }: { data: StudentEngagement | undefined; loading: boolean }) {
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header"><div className="mn-db-card-title">Student Engagement</div></div>
      {loading ? <AnalyticsSpin /> : data ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {[
            { label: 'Daily Active',      value: data.dailyActiveStudents.toLocaleString(),                                                  color: '#2563eb' },
            { label: 'Quiz Participation',value: data.quizParticipationRate > 0 ? `${data.quizParticipationRate.toFixed(1)}%` : '—',         color: '#16a34a' },
            { label: 'Assignment Compl.', value: data.assignmentCompletionRate > 0 ? `${data.assignmentCompletionRate.toFixed(1)}%` : '—',   color: '#8b5cf6' },
            { label: 'Avg Learn Time',    value: data.averageLearningTimeMinutes > 0 ? `${data.averageLearningTimeMinutes}m` : '—',           color: '#f59e0b' },
          ].map(m => (
            <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.625rem', color: '#64748b', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      ) : <EmptyMsg msg="No engagement data." />}
    </div>
  );
}

// ── Admin widget helpers ──────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  low:    { bg: '#f1f5f9', color: '#64748b' },
  medium: { bg: '#dbeafe', color: '#2563eb' },
  high:   { bg: '#fed7aa', color: '#ea580c' },
  urgent: { bg: '#fee2e2', color: '#dc2626' },
};

const TX_STATUS_COLOR: Record<string, string> = {
  success: '#16a34a', pending: '#f59e0b', failed: '#dc2626', refunded: '#64748b',
};

const TX_TYPE_LABEL: Record<string, string> = {
  payment: 'Payment', refund: 'Refund', subscription: 'Subscription',
  payout: 'Instructor Payout', failed_payment: 'Failed Payment',
};

const CALENDAR_COLOR: Record<string, string> = {
  live_session: '#2563eb', deadline: '#dc2626', meeting: '#8b5cf6',
  maintenance: '#f59e0b', course_launch: '#16a34a',
};

const INSIGHT_STYLE: Record<string, { bg: string; color: string }> = {
  info:     { bg: '#eff6ff', color: '#2563eb' },
  warning:  { bg: '#fffbeb', color: '#f59e0b' },
  critical: { bg: '#fef2f2', color: '#dc2626' },
};

// ── Pending Approvals widget ───────────────────────────────────────────────────

function PendingApprovalsCard({ data, loading }: { data: PendingApprovals | undefined; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="mn-db-card-title">Pending Approvals</div>
          {data && data.total > 0 && (
            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
              {data.total}
            </span>
          )}
        </div>
        <button className="mn-db-view-all" onClick={() => navigate('/users?tab=pending-verification')}>View All</button>
      </div>
      {loading ? <AnalyticsSpin /> : !data || data.items.length === 0 ? (
        <EmptyMsg msg="No pending approvals." />
      ) : (
        <div>
          {data.items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: 2 }}>
                  {item.submittedBy} · {formatRelative(item.submittedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 6px', borderRadius: 10, ...PRIORITY_STYLE[item.priority] }}>
                  {item.priority}
                </span>
                <button
                  onClick={() => navigate('/users?tab=pending-verification')}
                  style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                >
                  Review →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Live Sessions widget ───────────────────────────────────────────────────────

function LiveSessionsCard({ data, loading }: { data: LiveSessions | undefined; loading: boolean }) {
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">Live Sessions</div>
      </div>
      {loading ? <AnalyticsSpin /> : !data ? <EmptyMsg msg="No session data." /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {([
              { label: 'Active',    value: data.activeCount,                                    color: '#16a34a', bg: '#dcfce7' },
              { label: 'Upcoming',  value: data.upcomingCount,                                   color: '#2563eb', bg: '#dbeafe' },
              { label: 'Issues',    value: data.technicalIssuesCount ?? '—' as number | string,  color: '#dc2626', bg: '#fee2e2' },
            ] as const).map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.58rem', color: s.color, opacity: 0.85 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {data.items.length === 0 ? <EmptyMsg msg="No sessions." /> : data.items.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: s.status === 'active' ? '#16a34a' : '#2563eb' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{s.instructorName} · {formatRelative(s.startsAt)}</div>
              </div>
              {s.status === 'active' && s.attendanceCount != null && (
                <span style={{ fontSize: '0.6rem', color: '#64748b', flexShrink: 0 }}>{s.attendanceCount} 👥</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Tasks & Reminders widget ───────────────────────────────────────────────────

function TasksRemindersCard({ data, loading }: { data: TaskItem[]; loading: boolean }) {
  const navigate = useNavigate();
  const totalPending = data.reduce((s, t) => s + t.count, 0);
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">Tasks & Reminders</div>
        {data.length > 0 && <span className="mn-db-pill">{totalPending} pending</span>}
      </div>
      {loading ? <AnalyticsSpin /> : data.length === 0 ? <EmptyMsg msg="No pending tasks. You're all caught up." /> : (
        <div>
          {data.map(t => (
            <button
              key={t.id}
              onClick={() => { if (t.link) navigate(t.link); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', borderBottom: '1px solid #f8fafc',
                width: '100%', background: 'none', border: 'none', borderBottomWidth: 1, cursor: t.link ? 'pointer' : 'default', textAlign: 'left',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{t.count}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 5px', borderRadius: 10, flexShrink: 0, ...(PRIORITY_STYLE[t.priority] ?? {}) }}>
                {t.priority}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recent Transactions widget ─────────────────────────────────────────────────

function RecentTransactionsCard({ data, loading }: { data: TransactionItem[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">Recent Transactions</div>
        <button className="mn-db-view-all" onClick={() => navigate('/finance?tab=transactions')}>View All</button>
      </div>
      {loading ? <AnalyticsSpin /> : data.length === 0 ? <EmptyMsg msg="No transactions yet." /> : (
        <div>
          {data.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a' }}>{TX_TYPE_LABEL[t.type] ?? t.type}</div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{formatRelative(t.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                  {t.type === 'refund' || t.type === 'payout' ? '-' : '+'}{t.currency} {t.amount.toFixed(2)}
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 600, color: TX_STATUS_COLOR[t.status] ?? '#64748b' }}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calendar & Events widget ───────────────────────────────────────────────────

function CalendarEventsCard({ data, loading }: { data: CalendarEventItem[]; loading: boolean }) {
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">Calendar & Events</div>
      </div>
      {loading ? <AnalyticsSpin /> : data.length === 0 ? <EmptyMsg msg="No upcoming events." /> : (
        <div>
          {data.map(ev => {
            const start = new Date(ev.startsAt);
            const color = CALENDAR_COLOR[ev.type] ?? '#64748b';
            return (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 28, flexShrink: 0, textAlign: 'center', background: '#f8fafc', borderRadius: 6, padding: '3px 4px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color, lineHeight: 1 }}>{start.getDate()}</div>
                  <div style={{ fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {start.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  <div style={{ fontSize: '0.6rem', color, marginTop: 1 }}>
                    {ev.type.replace(/_/g, ' ')} · {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reports Snapshot widget ────────────────────────────────────────────────────

function ReportsSnapshotCard({ data, loading }: { data: ReportsSnapshot | undefined; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="mn-db-card-title">Reports Snapshot</div>
          {data?.lastGeneratedAt ? (
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>last generated {formatRelative(data.lastGeneratedAt)}</span>
          ) : (
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>no scheduled report has run yet</span>
          )}
        </div>
        <button
          onClick={() => navigate('/reports-analytics?tab=export')}
          style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
        >
          Export
        </button>
      </div>
      {loading ? <AnalyticsSpin /> : !data || data.availableReports.length === 0 ? <EmptyMsg msg="No reports available." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {data.availableReports.map(r => (
            <button key={r.key} onClick={() => navigate(r.path ?? '/reports-analytics')}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 10px', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontSize: '0.6rem', color: '#2563eb' }}>View report →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Insights widget ─────────────────────────────────────────────────────────

function AiInsightsCard({ data, loading }: { data: AiInsightItem[]; loading: boolean }) {
  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header">
        <div className="mn-db-card-title">AI Insights</div>
      </div>
      {loading ? <AnalyticsSpin /> : data.length === 0 ? <ComingSoonBanner text="AI Insights are coming soon" /> : (
        <div>
          {data.map(ins => {
            const sev = INSIGHT_STYLE[ins.severity] ?? { bg: '#f8fafc', color: '#64748b' };
            return (
              <div key={ins.id} style={{ borderLeft: `3px solid ${sev.color}`, background: sev.bg, borderRadius: '0 6px 6px 0', padding: '7px 10px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: sev.color, textTransform: 'uppercase' }}>{ins.severity}</span>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{formatRelative(ins.createdAt)}</span>
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{ins.title}</div>
                <div style={{ fontSize: '0.68rem', color: '#374151', lineHeight: 1.5 }}>{ins.message}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core dashboard state (TASK 5A)
  const [data, setData]               = useState<DashboardCoreResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  // Admin widgets state (TASK 5C)
  const [adminWidgets, setAdminWidgets]               = useState<AdminWidgetsResponse | null>(null);
  const [widgetsLoading, setWidgetsLoading]           = useState(true);
  const [widgetsError, setWidgetsError]               = useState<string | null>(null);

  // Analytics state (TASK 5B.1)
  const [analytics, setAnalytics]               = useState<DashboardAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError]     = useState<string | null>(null);

  // Filter state
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [departmentId, setDeptId]   = useState('');
  const [courseId, setCourseId]     = useState('');
  const [appliedFilters, setApplied] = useState({ dateFrom: '', dateTo: '', departmentId: '', courseId: '' });

  const greeting  = getGreeting();
  const adminName = data?.welcome?.adminName ?? user?.name ?? 'Admin';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setError(null); }
    try {
      const d = await getDashboardCore();
      setData(d);
      setError(null);
    } catch {
      setError('Could not load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const d = await getDashboardAnalytics({
        dateFrom:     appliedFilters.dateFrom     || null,
        dateTo:       appliedFilters.dateTo       || null,
        departmentId: appliedFilters.departmentId || null,
      });
      setAnalytics(d);
    } catch {
      setAnalyticsError('Could not load analytics data.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [appliedFilters]);

  const fetchAdminWidgets = useCallback(async () => {
    setWidgetsLoading(true);
    setWidgetsError(null);
    try {
      const d = await getAdminWidgets({
        dateFrom:     appliedFilters.dateFrom     || null,
        dateTo:       appliedFilters.dateTo       || null,
        departmentId: appliedFilters.departmentId || null,
        courseId:     appliedFilters.courseId     || null,
      });
      setAdminWidgets(d);
    } catch {
      setWidgetsError('Could not load admin widgets.');
    } finally {
      setWidgetsLoading(false);
    }
  }, [appliedFilters]);

  // Fix 2: batch all 3 initial fetches so they fire in parallel
  useEffect(() => {
    (() => {
      Promise.all([fetchData(), fetchAnalytics(), fetchAdminWidgets()]);
    })();
  }, [fetchData, fetchAnalytics, fetchAdminWidgets]);

  // Fix 3+4: include fetchAdminWidgets in refresh handler; add groupsUpdated event
  useEffect(() => {
    const handler = () => { fetchData(true); fetchAnalytics(); fetchAdminWidgets(); };
    const events = [
      'userDataChanged',
      'analyticsUpdated',
      'rolesUpdated',
      'permissionsUpdated',
      'organizationUpdated',
      'groupsUpdated',
    ];
    events.forEach(e => window.addEventListener(e, handler));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, [fetchData, fetchAnalytics, fetchAdminWidgets]);

  function applyFilters() { setApplied({ dateFrom, dateTo, departmentId, courseId }); }
  function clearFilters()  {
    setDateFrom(''); setDateTo(''); setDeptId(''); setCourseId('');
    setApplied({ dateFrom: '', dateTo: '', departmentId: '', courseId: '' });
  }

  const kpis        = data?.kpis;
  const depts       = analytics?.usersByDepartment ?? [];
  const maxDept     = depts.length > 0 ? Math.max(...depts.map(d => d.count)) : 1;
  const perfOverview = analytics?.performanceOverview;
  const completion  = analytics?.courseCompletion;
  const activity    = analytics?.learningActivity ?? [];
  const roles       = analytics?.usersByRole ?? [];

  const fi: React.CSSProperties = { padding: '3px 7px', fontSize: '0.72rem', border: '1px solid #e2e8f0', borderRadius: 5, color: '#374151', background: '#fff' };

  return (
    <AdminLayout pageTitle="Dashboard Overview">

      {/* ── Welcome row ── */}
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">{greeting}, {adminName} 👋</h1>
          <p className="mn-db-welcome-sub">Here's what's happening with your LMS platform today.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="mn-db-date-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formatDate()}
          </div>
          <button className="mn-db-refresh-btn" onClick={() => { fetchData(true); fetchAnalytics(); fetchAdminWidgets(); }}
            disabled={loading || refreshing} title="Refresh dashboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: refreshing ? 'mn-spin 0.65s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Core error banner ── */}
      {error && !loading && (
        <div className="mn-alert-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button className="mn-btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => fetchData()}>Retry</button>
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="mn-lkpi-grid">
        {loading ? (
          Array.from({ length: 9 }, (_, i) => <KpiSkeleton key={i} />)
        ) : kpis ? (
          <>
            <LKpiCard label="Total Users"          value={kpis.totalUsers.toLocaleString()}                                                         iconType="users"          iconBg="#f3e8ff" iconColor="#9333ea" />
            <LKpiCard label="Active Learners"      value={kpis.activeStudents.toLocaleString()}                                                      iconType="learners"       iconBg="#dcfce7" iconColor="#16a34a" />
            <LKpiCard label="Courses"              value={kpis.publishedCourses > 0 ? kpis.publishedCourses.toLocaleString() : '—'}                  iconType="courses"        iconBg="#dbeafe" iconColor="#2563eb" />
            <LKpiCard label="Completions"          value={kpis.certificatesIssued > 0 ? kpis.certificatesIssued.toLocaleString() : '—'}              iconType="completions"    iconBg="#fed7aa" iconColor="#ea580c" />
            <LKpiCard label="Revenue"              value={kpis.totalRevenue > 0 ? `$${kpis.totalRevenue.toLocaleString()}` : '—'}                    iconType="revenue"        iconBg="#d1fae5" iconColor="#059669" />
            <LKpiCard label="Active Instructors"   value={kpis.activeInstructors.toLocaleString()}                                                    iconType="instructors"    iconBg="#e0e7ff" iconColor="#4338ca" />
            <LKpiCard label="Pending Approvals"    value={kpis.pendingApprovals.toLocaleString()}                                                     iconType="approvals"      iconBg="#fef9c3" iconColor="#ca8a04" />
            {/* Active Subscriptions: Phase 2 stub — backend returns 0 until Subscription table is built (confirm with Hassan) */}
            <LKpiCard label="Active Subscriptions" value={kpis.activeSubscriptions > 0 ? kpis.activeSubscriptions.toLocaleString() : '—'}            iconType="subscriptions"  iconBg="#ccfbf1" iconColor="#0f766e" />
            <LKpiCard label="Live Sessions"        value={kpis.liveSessionsRunning.toLocaleString()}                                                  iconType="sessions"       iconBg="#fce7f3" iconColor="#be185d" />
          </>
        ) : null}
      </div>

      {/* ── Analytics section header + compact filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        {/* Left: label + demo badge + error */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Analytics</span>
          {analyticsLoading && <div className="mn-spinner" style={{ borderTopColor: '#2563eb', width: 12, height: 12, borderWidth: 2 }} />}
          {analyticsError && !analyticsLoading && (
            <span style={{ fontSize: '0.68rem', color: '#ef4444' }}>
              {analyticsError}
              <button onClick={fetchAnalytics} style={{ marginLeft: 5, fontSize: '0.68rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
            </span>
          )}
        </div>
        {/* Right: compact date / dept filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={fi} />
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={fi} />
          <input type="text" placeholder="Dept. ID" value={departmentId}
            onChange={e => setDeptId(e.target.value)} style={{ ...fi, width: 74 }} />
          <input type="text" placeholder="Course ID" value={courseId}
            onChange={e => setCourseId(e.target.value)} style={{ ...fi, width: 74 }} />
          <button onClick={applyFilters}
            style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
            Filter
          </button>
          {(appliedFilters.dateFrom || appliedFilters.dateTo || appliedFilters.departmentId || appliedFilters.courseId) && (
            <button onClick={clearFilters}
              style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Charts row: Activity | Roles | Recent Activity ── */}
      <div className="mn-db-charts-row">

        {/* Learning Activity Overview */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div>
              <div className="mn-db-card-title">Learning Activity Overview</div>
              <div className="mn-db-card-sub">Enrolled vs Completed learners over time</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="mn-db-legend-dot" style={{ '--dot-color': '#2563eb' } as React.CSSProperties}>Enrolled</span>
              <span className="mn-db-legend-dot" style={{ '--dot-color': '#16a34a' } as React.CSSProperties}>Completed</span>
            </div>
          </div>
          {analyticsLoading ? (
            <div className="mn-skeleton" style={{ height: 80, borderRadius: 8 }} />
          ) : (
            <LearningActivityChart data={activity} />
          )}
        </div>

        {/* Users by Role */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Users by Role</div>
          </div>
          {analyticsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
              <div className="mn-skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
            </div>
          ) : (
            <UsersRoleDonut data={roles} />
          )}
        </div>

        {/* Recent Activity */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Recent Activity</div>
            <button className="mn-db-view-all" onClick={() => navigate('/users')}>View All</button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}><div className="mn-spinner" style={{ borderTopColor: '#2563eb' }} /></div>
          ) : (data?.recentActivities ?? []).length === 0 ? (
            <EmptyMsg msg="No recent activity." />
          ) : (
            <div>
              {(data?.recentActivities ?? []).slice(0, 4).map((item: ActivityItem, i: number) => (
                <div key={item.id} className="mn-db-activity-row">
                  <ActivityAvatar name={item.actorName} index={i} />
                  <div className="mn-db-activity-icon-badge" style={{ background: ACTIVITY_ICON_BG[item.type], color: ACTIVITY_ICON_COLOR[item.type] }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mn-db-activity-text"><strong>{item.actorName}</strong> {item.title}</div>
                    <div className="mn-db-activity-time">{formatRelative(item.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Analytics row: Completion | Performance | Departments | Notifications ── */}
      <div className="mn-db-analytics-row">

        {/* Course Completion Rate */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Course Completion Rate</div>
          </div>
          {analyticsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
              <div className="mn-skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
            </div>
          ) : (
            <CompletionDonut
              pct={completion?.averageCompletion ?? null}
              categories={completion?.categories ?? []}
            />
          )}
        </div>

        {/* Performance Overview */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Performance Overview</div>
            <span className="mn-db-pill">This Period</span>
          </div>
          {analyticsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="mn-skeleton" style={{ height: 56, borderRadius: 8 }} />)}
            </div>
          ) : perfOverview ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Avg. Score',   value: `${perfOverview.averageScore.toFixed(1)}%`,    color: '#2563eb' },
                { label: 'Pass Rate',    value: `${perfOverview.passRate.toFixed(1)}%`,         color: '#16a34a' },
                { label: 'Engagement',   value: `${perfOverview.engagement.toFixed(1)}%`,       color: '#8b5cf6' },
                { label: 'Satisfaction', value: `${perfOverview.satisfaction.toFixed(1)}/5`,    color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.625rem', color: '#64748b', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          ) : <EmptyMsg msg="No performance data." />}
        </div>

        {/* Top Departments */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Top Departments</div>
          </div>
          {analyticsLoading ? (
            <div>{Array.from({ length: 4 }, (_, i) => <div key={i} className="mn-skeleton" style={{ height: 24, borderRadius: 4, marginBottom: 8 }} />)}</div>
          ) : depts.length === 0 ? (
            <EmptyMsg msg="No department data." />
          ) : depts.map((d, i) => (
            <div key={d.department} style={{ marginBottom: i < depts.length - 1 ? 8 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.625rem', color: '#374151', fontWeight: 500 }}>{d.department}</span>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0f172a' }}>{d.count.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(d.count / maxDept) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #2563eb, #60a5fa)', transition: 'width 1s ease 0.3s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Notifications */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="mn-db-card-title">Notifications</div>
              {(data?.unreadNotificationsCount ?? 0) > 0 && (
                <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                  {data!.unreadNotificationsCount}
                </span>
              )}
            </div>
            <button className="mn-db-view-all" onClick={() => window.dispatchEvent(new CustomEvent('openNotificationsPanel'))}>View All</button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}><div className="mn-spinner" style={{ borderTopColor: '#2563eb' }} /></div>
          ) : (data?.notificationsPreview ?? []).length === 0 ? (
            <EmptyMsg msg="No notifications." />
          ) : (
            <div>
              {(data?.notificationsPreview ?? []).map((n: NotificationItem) => (
                <div key={n.id} className="mn-db-notif-row" style={{ opacity: n.isRead ? 0.65 : 1 }}>
                  <div className="mn-db-notif-icon" style={{ background: NOTIF_BG[n.type], color: NOTIF_ICON_COLOR[n.type] }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mn-db-notif-title">{n.title}</div>
                    <div className="mn-db-notif-msg">{n.message}</div>
                    <div className="mn-db-notif-time">{formatRelative(n.createdAt)}</div>
                  </div>
                  {!n.isRead && <div className="mn-db-unread-dot" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Extended analytics row 1: Revenue | User Analytics | Course Analytics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6, marginBottom: 6, alignItems: 'start' }}>
        <RevenueCard        data={analytics?.revenueOverview}  loading={analyticsLoading} />
        <UserAnalyticsCard  data={analytics?.userAnalytics}    loading={analyticsLoading} />
        <CourseAnalyticsCard data={analytics?.courseAnalytics} loading={analyticsLoading} />
      </div>

      {/* ── Extended analytics row 2: Instructor Performance | Student Engagement ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 6, marginBottom: 6, alignItems: 'start' }}>
        <InstructorPerformanceCard data={analytics?.instructorPerformance} loading={analyticsLoading} />
        <StudentEngagementCard     data={analytics?.studentEngagement}     loading={analyticsLoading} />
      </div>

      {/* ── Quick Actions ── */}
      <div className="mn-db-card" style={{ marginBottom: 6 }}>
        <div className="mn-db-card-header" style={{ marginBottom: 8 }}>
          <div className="mn-db-card-title">Quick Actions</div>
        </div>
        <div className="mn-db-qa-grid">
          {(data?.quickActions ?? []).length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', gridColumn: '1 / -1', textAlign: 'center', padding: '16px 0' }}>No actions available.</p>
          ) : (
            (data?.quickActions ?? []).map((qa: QuickActionItem) => (
              <button key={qa.key} className="mn-db-qa-btn" disabled={!qa.enabled}
                onClick={() => { if (qa.path) navigate(qa.path); }}
                style={{ opacity: qa.enabled ? 1 : 0.45, cursor: qa.enabled ? 'pointer' : 'not-allowed' }}>
                <div className="mn-db-qa-icon"><QaIcon actionKey={qa.key} /></div>
                <span className="mn-db-qa-label">{qa.label}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Admin Widgets section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Admin Widgets</span>
          {widgetsLoading && <div className="mn-spinner" style={{ borderTopColor: '#2563eb', width: 12, height: 12, borderWidth: 2 }} />}
          {widgetsError && !widgetsLoading && (
            <span style={{ fontSize: '0.68rem', color: '#ef4444' }}>
              {widgetsError}
              <button onClick={fetchAdminWidgets} style={{ marginLeft: 5, fontSize: '0.68rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
            </span>
          )}
        </div>
        {/* No whole-dashboard export endpoint exists — routes to the real
            Export Center instead of faking a dashboard-only export. */}
        <button onClick={() => navigate('/reports-analytics?tab=export')} title="Open Export Center"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Dashboard
        </button>
      </div>

      {/* ── Admin widgets row 1: Pending Approvals | Live Sessions | Tasks & Reminders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6, marginBottom: 6, alignItems: 'start' }}>
        <PendingApprovalsCard data={adminWidgets?.pendingApprovals}        loading={widgetsLoading} />
        <LiveSessionsCard     data={adminWidgets?.liveSessions}            loading={widgetsLoading} />
        <TasksRemindersCard   data={adminWidgets?.tasksAndReminders ?? []} loading={widgetsLoading} />
      </div>

      {/* ── Admin widgets row 2: Recent Transactions | Calendar Events | AI Insights ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6, marginBottom: 6, alignItems: 'start' }}>
        <RecentTransactionsCard data={adminWidgets?.recentTransactions ?? []} loading={widgetsLoading} />
        <CalendarEventsCard     data={adminWidgets?.calendarEvents    ?? []} loading={widgetsLoading} />
        <AiInsightsCard         data={adminWidgets?.aiInsights         ?? []} loading={widgetsLoading} />
      </div>

      {/* ── Reports Snapshot (full-width) ── */}
      <ReportsSnapshotCard data={adminWidgets?.reportsSnapshot} loading={widgetsLoading} />

    </AdminLayout>
  );
}
