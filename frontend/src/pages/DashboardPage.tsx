import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../AuthContext';

// ── Inline SVG icons for stat cards ──────────────────────────

function IconBook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconAward() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

// ── Stat card component ───────────────────────────────────────

interface StatProps {
  label: string;
  value: string;
  accent: 'blue' | 'teal' | 'purple' | 'green';
  icon: React.ReactNode;
}

function StatCard({ label, value, accent, icon }: StatProps) {
  return (
    <div className={`mn-stat ${accent}`}>
      <div className={`mn-stat-icon ${accent}`}>{icon}</div>
      <div className="mn-stat-value">{value}</div>
      <div className="mn-stat-label">{label}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile } = useAuth();

  const firstName = profile?.full_name?.split(' ')[0] ?? null;
  const greeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';
  const roleClass = profile?.role ?? 'student';

  const initials = (profile?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AdminLayout pageTitle="Dashboard">

      {/* ── Greeting ── */}
      <div className="mn-greeting">
        <div className="mn-greeting-title">{greeting}</div>
        <div className="mn-greeting-sub">
          Here's an overview of your learning activity.
        </div>
      </div>

      {/* ── Stat widgets ── */}
      <div className="mn-stats-grid">
        <StatCard label="Enrolled Courses" value="—"  accent="blue"   icon={<IconBook />}  />
        <StatCard label="Completed"         value="—"  accent="teal"   icon={<IconCheck />} />
        <StatCard label="Achievements"      value="—"  accent="purple" icon={<IconStar />}  />
        <StatCard label="Certificates"      value="—"  accent="green"  icon={<IconAward />} />
      </div>

      {/* ── Profile card ── */}
      <div className="mn-card">
        {/* Card header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div className="mn-avatar-lg">{initials}</div>
          <div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--mn-text-100)',
                marginBottom: '0.3rem',
              }}
            >
              {profile?.full_name ?? 'Learner'}
            </div>
            <span className={`mn-badge ${roleClass}`}>{roleClass}</span>
          </div>
        </div>

        <hr className="mn-hr" />

        {/* Detail rows */}
        <div className="mn-row">
          <span className="mn-row-key">Email</span>
          <span className="mn-row-val">{user?.email ?? '—'}</span>
        </div>
        <div className="mn-row">
          <span className="mn-row-key">Full name</span>
          <span className="mn-row-val">{profile?.full_name ?? '—'}</span>
        </div>
        <div className="mn-row">
          <span className="mn-row-key">Role</span>
          <span className={`mn-badge ${roleClass}`}>{roleClass}</span>
        </div>
        <div className="mn-row">
          <span className="mn-row-key">User ID</span>
          <span
            className="mn-row-val"
            style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--mn-text-600)' }}
          >
            {user?.id?.slice(0, 8)}…
          </span>
        </div>
      </div>
    </AdminLayout>
  );
}
