import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// ── Inline SVG icons (no extra library needed) ───────────────

function IconGrid() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ── Nav items config ─────────────────────────────────────────

const NAV = [
  { to: '/dashboard',       label: 'Dashboard',       Icon: IconGrid    },
  { to: '/courses',         label: 'Courses',         Icon: IconBook    },
  { to: '/students',        label: 'Students',        Icon: IconUsers   },
  { to: '/trusted-devices', label: 'Security',        Icon: IconShield  },
  { to: '/settings',        label: 'Settings',        Icon: IconSettings },
];

// ── Component ────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminLayout({ children, pageTitle = 'Dashboard' }: Props) {
  const { user, profile, signOut, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = (profile?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* ── Sidebar ── */}
      <aside className={`mn-sidebar${open ? ' open' : ''}`}>
        <div className="mn-sidebar-logo-wrap">
          <img src="/brand/logowhite.png" alt="MindNavy LMS" />
        </div>

        <nav className="mn-sidebar-nav">
          <div className="mn-nav-section">Menu</div>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `mn-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mn-sidebar-footer">
          <div className="mn-user-pill">
            <div className="mn-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="mn-user-name">{profile?.full_name ?? 'Learner'}</div>
              <div className="mn-user-role">{profile?.role ?? 'member'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      <div
        className={`mn-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* ── Main ── */}
      <main className="mn-main">
        {/* Topbar */}
        <header className="mn-topbar">
          <div className="mn-topbar-left">
            <button
              className="mn-hamburger"
              onClick={() => setOpen(!open)}
              aria-label="Toggle sidebar"
            >
              <IconMenu />
            </button>
            <span className="mn-topbar-title">{pageTitle}</span>
          </div>

          <div className="mn-topbar-right">
            <span className="mn-topbar-email">{user?.email}</span>
            <button className="mn-btn-ghost" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/*
         * DEV-ONLY: Show a prominent amber banner whenever the demo session is active.
         * isDemoMode is always false in production, so this never renders in production builds.
         */}
        {import.meta.env.DEV && isDemoMode && (
          <div className="mn-demo-banner">
            ⚡ DEV MODE — Demo Admin session active. Not connected to Supabase or the database.
          </div>
        )}

        {/* Page content */}
        <div className="mn-content">{children}</div>
      </main>
    </>
  );
}
