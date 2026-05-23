import { useEffect, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Mock data (replace with real API calls when backend is ready) ─────────────

const MONTHLY_DATA = [
  { month: 'Jan', enrolled: 42, completed: 28 },
  { month: 'Feb', enrolled: 58, completed: 35 },
  { month: 'Mar', enrolled: 51, completed: 42 },
  { month: 'Apr', enrolled: 76, completed: 55 },
  { month: 'May', enrolled: 68, completed: 58 },
  { month: 'Jun', enrolled: 84, completed: 63 },
  { month: 'Jul', enrolled: 91, completed: 71 },
];

const SPARKLINES = {
  courses:    [3, 5, 4, 7, 6, 8, 8],
  students:   [210, 340, 420, 580, 650, 780, 892],
  completion: [55, 60, 58, 64, 68, 72, 74],
  satisfaction:[4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8],
};

// ── Internal UI components ────────────────────────────────────────────────────

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`mn-kpi-trend ${up ? 'up' : 'down'}`} aria-label={`${up ? 'up' : 'down'} ${Math.abs(value)}%`}>
      {up ? '▲' : '▼'} {Math.abs(value)}% vs last month
    </span>
  );
}

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 68, H = 30;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(' ');
  const areaBottom = `${W},${H} 0,${H}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Gradient fill under line */}
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pts} ${areaBottom}`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const x = W;
        const y = H - ((last - min) / range) * (H - 4) - 2;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  trend: number;
  accent: 'blue' | 'teal' | 'purple' | 'green';
  icon: React.ReactNode;
  sparkData: number[];
  delay?: number;
}

function KpiCard({ label, value, trend, accent, icon, sparkData, delay = 0 }: KpiCardProps) {
  const colors = {
    blue:   'var(--mn-blue-400)',
    teal:   'var(--mn-teal-400)',
    purple: 'var(--mn-purple-400)',
    green:  'var(--mn-green-400)',
  } as const;

  return (
    <div
      className={`mn-kpi-card ${accent}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="mn-kpi-top">
        <div className={`mn-stat-icon ${accent}`}>{icon}</div>
        <SparkLine data={sparkData} color={colors[accent]} />
      </div>
      <div className="mn-kpi-value">{value}</div>
      <div className="mn-kpi-label">{label}</div>
      <TrendBadge value={trend} />
    </div>
  );
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function EnrollmentBarChart({ data }: { data: typeof MONTHLY_DATA }) {
  const max = Math.max(...data.flatMap((d) => [d.enrolled, d.completed]));
  const W = 420;
  const H = 160;
  const PAD_B = 26;
  const PAD_T = 8;
  const chartH = H - PAD_B - PAD_T;
  const colW = W / data.length;
  const barW = colW * 0.32;
  const gap = colW * 0.05;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      aria-label="Enrollment and completion bar chart"
    >
      {/* Horizontal grid lines */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const y = PAD_T + chartH - (pct / 100) * chartH;
        return (
          <line
            key={pct}
            x1="0" y1={y} x2={W} y2={y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        );
      })}

      {/* Bar groups */}
      {data.map((d, i) => {
        const baseX = i * colW + colW * 0.12;
        const eH = (d.enrolled / max) * chartH;
        const cH = (d.completed / max) * chartH;
        const delay1 = `${i * 0.06}s`;
        const delay2 = `${i * 0.06 + 0.04}s`;
        const midX = baseX + barW + gap / 2;

        return (
          <g key={d.month}>
            {/* Enrolled */}
            <rect
              x={baseX}
              y={PAD_T + chartH - eH}
              width={barW}
              height={eH}
              rx="3"
              fill="rgba(14, 165, 233, 0.55)"
              className="mn-chart-bar"
              style={{ animationDelay: delay1 }}
            />
            {/* Completed */}
            <rect
              x={baseX + barW + gap}
              y={PAD_T + chartH - cH}
              width={barW}
              height={cH}
              rx="3"
              fill="rgba(6, 182, 212, 0.7)"
              className="mn-chart-bar"
              style={{ animationDelay: delay2 }}
            />
            {/* Month label */}
            <text
              x={midX}
              y={H - 8}
              textAnchor="middle"
              fill="rgba(148,163,184,0.65)"
              fontSize="9.5"
              fontFamily="inherit"
            >
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Animated Donut Chart ──────────────────────────────────────────────────────

function DonutChart({ percentage, color = 'var(--mn-teal-500)', label = 'Complete' }: {
  percentage: number;
  color?: string;
  label?: string;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const R = 56;
  const circ = 2 * Math.PI * R;
  const dash = animated ? (percentage / 100) * circ : 0;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      aria-label={`${percentage}% ${label}`}
    >
      <svg width="144" height="144" viewBox="0 0 144 144">
        {/* Outer glow ring */}
        <circle cx="72" cy="72" r={R + 10} fill="none" stroke="rgba(6,182,212,0.05)" strokeWidth="1" />
        {/* Track */}
        <circle cx="72" cy="72" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {/* Coloured progress arc */}
        <circle
          cx="72" cy="72" r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 72 72)"
          style={{
            transition: 'stroke-dasharray 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: `drop-shadow(0 0 8px ${color}55)`,
          }}
        />
      </svg>
      {/* Centre label */}
      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--mn-text-100)', lineHeight: 1 }}>
          {percentage}%
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--mn-text-600)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Icons for KPI cards ───────────────────────────────────────────────────────

function IconCourses() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconStudents() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCompletion() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'week' | 'month' | 'quarter'>('month');

  const firstName = profile?.full_name?.split(' ')[0] ?? null;
  const roleClass = (profile?.role ?? 'student') as 'student' | 'teacher' | 'admin' | 'super_admin';

  const initials = (profile?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AdminLayout pageTitle="Dashboard">

      {/* ── Welcome / greeting ── */}
      <div className="mn-welcome">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div className="mn-welcome-title">
              {getGreeting()}, {firstName ?? 'Admin'} 👋
            </div>
            <div className="mn-welcome-sub">{formatDate()}</div>
          </div>

          {/* Time period filter */}
          <div className="mn-filter-bar">
            {(['week', 'month', 'quarter'] as const).map((f) => (
              <button
                key={f}
                className={`mn-filter-btn${activeFilter === f ? ' active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'This Quarter'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI grid (4 cards) ── */}
      <div className="mn-kpi-grid mn-stagger">
        <KpiCard
          label="Active Courses"
          value="8"
          trend={12}
          accent="blue"
          icon={<IconCourses />}
          sparkData={SPARKLINES.courses}
          delay={0.04}
        />
        <KpiCard
          label="Total Students"
          value="892"
          trend={18}
          accent="teal"
          icon={<IconStudents />}
          sparkData={SPARKLINES.students}
          delay={0.09}
        />
        <KpiCard
          label="Completion Rate"
          value="74%"
          trend={6}
          accent="purple"
          icon={<IconCompletion />}
          sparkData={SPARKLINES.completion}
          delay={0.14}
        />
        <KpiCard
          label="Satisfaction"
          value="4.8 / 5"
          trend={4}
          accent="green"
          icon={<IconStar />}
          sparkData={SPARKLINES.satisfaction}
          delay={0.19}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="mn-chart-row">

        {/* Bar chart — Enrollment Trend */}
        <div className="mn-chart-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div>
              <div className="mn-chart-title">Enrollment Trend</div>
              <div className="mn-chart-subtitle">Monthly new enrolments vs completions</div>
            </div>
            <div className="mn-legend">
              <span className="mn-legend-item">
                <span className="mn-legend-dot" style={{ background: 'rgba(14,165,233,0.7)' }} />
                Enrolled
              </span>
              <span className="mn-legend-item">
                <span className="mn-legend-dot" style={{ background: 'rgba(6,182,212,0.85)' }} />
                Completed
              </span>
            </div>
          </div>

          {/* TODO: Replace with real enrollment data from API */}
          <EnrollmentBarChart data={MONTHLY_DATA} />
        </div>

        {/* Donut chart — Completion Rate */}
        <div className="mn-chart-card">
          <div className="mn-chart-title">Completion Rate</div>
          <div className="mn-chart-subtitle">Overall course completion this {activeFilter}</div>

          <div className="mn-donut-wrap">
            {/* TODO: Replace 74 with real completion percentage from API */}
            <DonutChart percentage={74} color="var(--mn-teal-500)" label="Complete" />

            {/* Breakdown legend */}
            <div style={{ width: '100%' }}>
              {[
                { label: 'Completed', pct: 74, color: 'var(--mn-teal-500)' },
                { label: 'In Progress', pct: 18, color: 'var(--mn-blue-500)' },
                { label: 'Not Started', pct: 8, color: 'rgba(255,255,255,0.12)' },
              ].map(({ label, pct, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--mn-text-400)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Progress bar */}
                    <div style={{ width: 64, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1s ease 0.5s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--mn-text-200)', minWidth: '2.5rem', textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Profile + Activity ── */}
      <div className="mn-bottom-row">

        {/* Profile card */}
        <div
          className="mn-card"
          style={{ animation: 'mn-slide-up 0.45s cubic-bezier(0.22,1,0.36,1) 0.28s both' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div
              className="mn-avatar-lg"
              style={{
                background: 'linear-gradient(135deg, var(--mn-blue-500), var(--mn-purple-500))',
                boxShadow: '0 0 20px rgba(14,165,233,0.3)',
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--mn-text-100)', marginBottom: '0.3rem' }}>
                {profile?.full_name ?? 'Learner'}
              </div>
              <span className={`mn-badge ${roleClass}`}>{roleClass.replace('_', ' ')}</span>
            </div>
          </div>

          <hr className="mn-hr" />

          {[
            { key: 'Email', val: user?.email ?? '—' },
            { key: 'Full name', val: profile?.full_name ?? '—' },
            { key: 'Role', val: <span className={`mn-badge ${roleClass}`}>{roleClass.replace('_', ' ')}</span> },
            { key: 'User ID', val: <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: 'var(--mn-text-600)' }}>{user?.id?.slice(0, 8)}…</span> },
          ].map(({ key, val }) => (
            <div className="mn-row" key={key}>
              <span className="mn-row-key">{key}</span>
              <span className="mn-row-val">{val}</span>
            </div>
          ))}
        </div>

        {/* Quick stats card */}
        <div
          className="mn-card"
          style={{ animation: 'mn-slide-up 0.45s cubic-bezier(0.22,1,0.36,1) 0.33s both' }}
        >
          <div className="mn-chart-title" style={{ marginBottom: '0.25rem' }}>Learning Highlights</div>
          <div className="mn-chart-subtitle" style={{ marginBottom: '1.25rem' }}>
            {/* TODO: Replace with real data from API */}
            Quick overview of platform activity
          </div>

          {[
            { label: 'New Enrolments Today',  value: '12',   color: 'var(--mn-blue-400)',   trend: '+3' },
            { label: 'Lessons Completed',     value: '87',   color: 'var(--mn-teal-400)',   trend: '+14' },
            { label: 'Certificates Issued',   value: '5',    color: 'var(--mn-purple-400)', trend: '+2' },
            { label: 'Active Right Now',       value: '34',   color: 'var(--mn-green-400)',  trend: '+8' },
            { label: 'Avg. Session Length',   value: '24 min', color: 'var(--mn-blue-400)', trend: '+2 min' },
          ].map(({ label, value, color, trend }, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.7rem 0',
                borderBottom: i < 4 ? '1px solid var(--mn-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--mn-text-400)' }}>{label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--mn-text-100)' }}>{value}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#22c55e' }}>{trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </AdminLayout>
  );
}
