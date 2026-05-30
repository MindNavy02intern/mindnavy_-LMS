import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../AuthContext';
import { getDashboardCore } from '../api/dashboard';
import type {
  ActivityItem,
  ActivityType,
  DashboardCoreResponse,
  NotificationItem,
  NotificationSeverity,
  QuickActionItem,
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

// ── Mock chart data (TODO: replace with real chart API endpoint when ready) ────

const CHART_LABELS = ['May 13', 'May 20', 'May 27', 'Jun 3', 'Jun 10'];
const CHART_ENROLLED  = [1200, 1800, 2200, 2800, 2600];
const CHART_COMPLETED = [500,  900,  1200, 1500, 1650];

const ROLE_DATA = [
  { label: 'Learners',    value: 7842, pct: 62.3, color: '#2563eb' },
  { label: 'Instructors', value: 1253, pct: 9.9,  color: '#16a34a' },
  { label: 'Admins',      value: 562,  pct: 4.5,  color: '#f59e0b' },
  { label: 'Managers',    value: 1687, pct: 13.4, color: '#8b5cf6' },
  { label: 'Others',      value: 1240, pct: 9.9,  color: '#94a3b8' },
];

const COMPLETION_COURSES = [
  { name: 'Leadership',     pct: 85, color: '#2563eb' },
  { name: 'Data Science',   pct: 72, color: '#16a34a' },
  { name: 'Cyber Security', pct: 65, color: '#f59e0b' },
  { name: 'Marketing',      pct: 58, color: '#8b5cf6' },
  { name: 'Design Thinking',pct: 45, color: '#ef4444' },
];

const PERF_METRICS = [
  { label: 'Avg. Score',   value: '76.8%', spark: [68, 72, 74, 75, 76, 77, 76.8], color: '#2563eb' },
  { label: 'Pass Rate',    value: '82.3%', spark: [75, 78, 80, 81, 82, 83, 82.3], color: '#16a34a' },
  { label: 'Engagement',   value: '68.5%', spark: [62, 64, 66, 67, 68, 69, 68.5], color: '#8b5cf6' },
  { label: 'Satisfaction', value: '4.6/5', spark: [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.6], color: '#f59e0b' },
];

const DEPT_DATA = [
  { name: 'IT Department',        count: 2856, pct: 100 },
  { name: 'Sales Department',     count: 2124, pct: 74  },
  { name: 'HR Department',        count: 1856, pct: 65  },
  { name: 'Marketing Department', count: 1254, pct: 44  },
  { name: 'Finance Department',   count: 1023, pct: 36  },
];

// ── KPI icon map ──────────────────────────────────────────────────────────────

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
  return null;
}

// Quick action icons (SVG by icon id)
function QaIcon({ icon }: { icon: string }) {
  if (icon === 'user-plus') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  );
  if (icon === 'book-plus') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/>
    </svg>
  );
  if (icon === 'book-assign') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="9 11 11 13 15 9"/>
    </svg>
  );
  if (icon === 'chart-bar') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
  if (icon === 'bell') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
  if (icon === 'shield') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
  if (icon === 'upload') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
  if (icon === 'settings') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
  return <span>{icon}</span>;
}

// ── Sparkline (mini chart inside KPI cards) ───────────────────────────────────

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 52, H = 20;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 3) - 2}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${W},${H} 0,${H}`} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Light KPI Card ────────────────────────────────────────────────────────────

interface LKpiCardProps {
  label: string;
  value: string | number;
  trend: number;
  iconType: string;
  iconBg: string;
  iconColor: string;
  sparkline: number[];
  sparkColor: string;
}

function LKpiCard({ label, value, trend, iconType, iconBg, iconColor, sparkline, sparkColor }: LKpiCardProps) {
  const up = trend > 0;
  const neutral = trend === 0;
  return (
    <div className="mn-lkpi-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="mn-lkpi-icon" style={{ background: iconBg, color: iconColor }}>
          <KpiIcon type={iconType} />
        </div>
        <SparkLine data={sparkline} color={sparkColor} />
      </div>
      <div className="mn-lkpi-label">{label}</div>
      <div className="mn-lkpi-value">{value}</div>
      {!neutral && (
        <div className={`mn-lkpi-trend ${up ? 'up' : 'down'}`}>
          {up ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

// ── KPI Skeleton ──────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="mn-lkpi-card" style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="mn-skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
        <div className="mn-skeleton" style={{ width: 52, height: 20, borderRadius: 3 }} />
      </div>
      <div className="mn-skeleton" style={{ width: '55%', height: 10, marginBottom: 4, borderRadius: 3 }} />
      <div className="mn-skeleton" style={{ width: '40%', height: 20, marginBottom: 4, borderRadius: 3 }} />
      <div className="mn-skeleton" style={{ width: '60%', height: 9, borderRadius: 3 }} />
    </div>
  );
}

// ── Learning Activity Area Chart ──────────────────────────────────────────────

function LearningActivityChart() {
  const W = 500, H = 130, PAD_L = 32, PAD_B = 22, PAD_T = 8, PAD_R = 8;
  const cW = W - PAD_L - PAD_R;
  const cH = H - PAD_B - PAD_T;
  const maxV = 3000;
  const yTicks = [0, 1000, 2000, 3000];
  const xCount = CHART_LABELS.length;

  function toX(i: number) { return PAD_L + (i / (xCount - 1)) * cW; }
  function toY(v: number) { return PAD_T + cH - (v / maxV) * cH; }

  const ptE = CHART_ENROLLED.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const ptC = CHART_COMPLETED.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaE = `${toX(0)},${toY(0)} ${ptE} ${toX(xCount - 1)},${toY(0)}`;
  const areaC = `${toX(0)},${toY(0)} ${ptC} ${toX(xCount - 1)},${toY(0)}`;

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

      {/* Y grid lines + labels */}
      {yTicks.map((v) => {
        const y = toY(v);
        const label = v === 0 ? '0' : v >= 1000 ? `${v / 1000}K` : `${v}`;
        return (
          <g key={v}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="Inter,sans-serif">{label}</text>
          </g>
        );
      })}

      {/* Area fills */}
      <polygon points={areaE} fill="url(#grad-enroll)" />
      <polygon points={areaC} fill="url(#grad-compl)" />

      {/* Lines */}
      <polyline points={ptE} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={ptC} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots on last point */}
      <circle cx={toX(xCount - 1)} cy={toY(CHART_ENROLLED[xCount - 1])}  r="3" fill="#2563eb" />
      <circle cx={toX(xCount - 1)} cy={toY(CHART_COMPLETED[xCount - 1])} r="3" fill="#16a34a" />

      {/* X axis labels */}
      {CHART_LABELS.map((lbl, i) => (
        <text key={lbl} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="Inter,sans-serif">{lbl}</text>
      ))}
    </svg>
  );
}

// ── Users by Role Donut ───────────────────────────────────────────────────────

function UsersRoleDonut() {
  const R = 36, cx = 50, cy = 50;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const segments = ROLE_DATA.map((d) => {
    const dashLen = (d.pct / 100) * circ;
    const seg = { ...d, dashLen, offset };
    offset += dashLen;
    return seg;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.dashLen} ${circ - s.dashLen}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="Inter,sans-serif">
          {(ROLE_DATA.reduce((a, b) => a + b.value, 0) / 1000).toFixed(1)}K
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5" fill="#64748b" fontFamily="Inter,sans-serif">Total Users</text>
      </svg>
      <div style={{ width: '100%' }}>
        {ROLE_DATA.map((d) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.625rem', color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a', flexShrink: 0 }}>{d.value.toLocaleString()}</span>
            <span style={{ fontSize: '0.575rem', color: '#94a3b8', flexShrink: 0, minWidth: 26, textAlign: 'right' }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Completion Rate Donut ─────────────────────────────────────────────────────

function CompletionDonut({ pct }: { pct: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);
  const R = 36, circ = 2 * Math.PI * R;
  const dash = animated ? (pct / 100) * circ : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          <circle cx="48" cy="48" r={R} fill="none" stroke="#2563eb" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: '0.57rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average</div>
        </div>
      </div>
      <div style={{ width: '100%' }}>
        {COMPLETION_COURSES.map((c) => (
          <div key={c.name} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: '0.625rem', color: '#374151' }}>{c.name}</span>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a' }}>{c.pct}%</span>
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: 3, transition: 'width 1s ease 0.4s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity item avatar (initials) ───────────────────────────────────────────

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

function ActivityAvatar({ name, index }: { name: string; index: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
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
  completion: '#dcfce7', enrollment: '#dbeafe', login: '#f3e8ff',
  payment: '#d1fae5', approval: '#fef3c7', revocation: '#fee2e2', other: '#f1f5f9',
};
const ACTIVITY_ICON_COLOR: Record<ActivityType, string> = {
  completion: '#16a34a', enrollment: '#2563eb', login: '#8b5cf6',
  payment: '#059669', approval: '#f59e0b', revocation: '#ef4444', other: '#64748b',
};

// ── Notification severity styles ──────────────────────────────────────────────

const NOTIF_BG: Record<NotificationSeverity, string> = {
  info: '#eff6ff', warning: '#fffbeb', error: '#fef2f2', success: '#f0fdf4',
};
const NOTIF_ICON_COLOR: Record<NotificationSeverity, string> = {
  info: '#2563eb', warning: '#f59e0b', error: '#ef4444', success: '#16a34a',
};

function NotifIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === 'info') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  );
  if (severity === 'warning') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
  if (severity === 'success') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<DashboardCoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = getGreeting();
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;

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
          <button
            className="mn-db-refresh-btn"
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            title="Refresh dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: refreshing ? 'mn-spin 0.65s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !loading && (
        <div className="mn-alert-error" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button className="mn-btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => fetchData()}>Retry</button>
        </div>
      )}

      {/* ── KPI row — 5 columns ── */}
      <div className="mn-lkpi-grid">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => <KpiSkeleton key={i} />)
        ) : kpis ? (
          <>
            <LKpiCard label="Total Users"      value={kpis.totalUsers.value}     trend={kpis.totalUsers.trend}     iconType="users"       iconBg="#f3e8ff" iconColor="#9333ea" sparkline={kpis.totalUsers.sparkline}     sparkColor="#9333ea" />
            <LKpiCard label="Active Learners"  value={kpis.activeStudents.value} trend={kpis.activeStudents.trend} iconType="learners"    iconBg="#dcfce7" iconColor="#16a34a" sparkline={kpis.activeStudents.sparkline} sparkColor="#16a34a" />
            <LKpiCard label="Courses"          value={kpis.publishedCourses.value}trend={kpis.publishedCourses.trend}iconType="courses"   iconBg="#dbeafe" iconColor="#2563eb" sparkline={kpis.publishedCourses.sparkline}sparkColor="#2563eb" />
            <LKpiCard label="Completions"      value={kpis.certificatesIssued.value}trend={kpis.certificatesIssued.trend}iconType="completions"iconBg="#fed7aa" iconColor="#ea580c" sparkline={kpis.certificatesIssued.sparkline}sparkColor="#ea580c" />
            <LKpiCard label="Revenue"          value={kpis.totalRevenue.value}   trend={kpis.totalRevenue.trend}   iconType="revenue"     iconBg="#d1fae5" iconColor="#059669" sparkline={kpis.totalRevenue.sparkline}   sparkColor="#059669" />
          </>
        ) : null}
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
              <span className="mn-db-pill">This Month</span>
            </div>
          </div>
          {/* TODO: replace with real enrollment chart data from backend */}
          <LearningActivityChart />
        </div>

        {/* Users by Role */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Users by Role</div>
          </div>
          {/* TODO: replace with real role distribution from backend */}
          <UsersRoleDonut />
        </div>

        {/* Recent Activity */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Recent Activity</div>
            <button className="mn-db-view-all">View All</button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="mn-spinner" style={{ borderTopColor: '#2563eb' }} /></div>
          ) : (data?.recentActivities ?? []).length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>No recent activity.</p>
          ) : (
            <div>
              {(data?.recentActivities ?? []).map((item: ActivityItem, i: number) => (
                <div key={item.id} className="mn-db-activity-row">
                  <ActivityAvatar name={item.actor} index={i} />
                  <div className="mn-db-activity-icon-badge" style={{ background: ACTIVITY_ICON_BG[item.type], color: ACTIVITY_ICON_COLOR[item.type] }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mn-db-activity-text">
                      <strong>{item.actor}</strong> {item.description}
                    </div>
                    <div className="mn-db-activity-time">{formatRelative(item.timestamp)}</div>
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
          {/* TODO: replace with real completion data from backend */}
          <CompletionDonut pct={68} />
        </div>

        {/* Performance Overview */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Performance Overview</div>
            <span className="mn-db-pill">This Month</span>
          </div>
          {/* TODO: replace with real performance metrics from backend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PERF_METRICS.map((m) => (
              <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{m.value}</div>
                <SparkLine data={m.spark} color={m.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Top Departments */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Top Departments</div>
          </div>
          {/* TODO: replace with real department data from backend */}
          <div>
            {DEPT_DATA.map((d, i) => (
              <div key={d.name} style={{ marginBottom: i < DEPT_DATA.length - 1 ? 8 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.625rem', color: '#374151', fontWeight: 500 }}>{d.name}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0f172a' }}>{d.count.toLocaleString()}</span>
                </div>
                <div style={{ height: 4, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${d.pct}%`, height: '100%', borderRadius: 3,
                    background: `linear-gradient(90deg, #2563eb, #60a5fa)`,
                    transition: 'width 1s ease 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="mn-db-card">
          <div className="mn-db-card-header">
            <div className="mn-db-card-title">Notifications</div>
            <button className="mn-db-view-all">View All</button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="mn-spinner" style={{ borderTopColor: '#2563eb' }} /></div>
          ) : (data?.notificationsPreview ?? []).length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>No notifications.</p>
          ) : (
            <div>
              {(data?.notificationsPreview ?? []).map((n: NotificationItem) => (
                <div key={n.id} className="mn-db-notif-row" style={{ opacity: n.read ? 0.65 : 1 }}>
                  <div className="mn-db-notif-icon" style={{ background: NOTIF_BG[n.severity], color: NOTIF_ICON_COLOR[n.severity] }}>
                    <NotifIcon severity={n.severity} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mn-db-notif-title">{n.title}</div>
                    <div className="mn-db-notif-msg">{n.message}</div>
                    <div className="mn-db-notif-time">{formatRelative(n.timestamp)}</div>
                  </div>
                  {!n.read && <div className="mn-db-unread-dot" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="mn-db-card" style={{ marginBottom: 0 }}>
        <div className="mn-db-card-header" style={{ marginBottom: 8 }}>
          <div className="mn-db-card-title">Quick Actions</div>
        </div>
        <div className="mn-db-qa-grid">
          {(data?.quickActions ?? []).map((qa: QuickActionItem) => (
            <a key={qa.id} href={qa.href} className="mn-db-qa-btn" onClick={(e) => e.preventDefault()}>
              <div className="mn-db-qa-icon">
                <QaIcon icon={qa.icon} />
              </div>
              <span className="mn-db-qa-label">{qa.label}</span>
            </a>
          ))}
        </div>
      </div>

    </AdminLayout>
  );
}
