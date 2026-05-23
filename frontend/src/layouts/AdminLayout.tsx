import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// ── SVG Icons ────────────────────────────────────────────────────────────────

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

function IconShield() {
  return (
    <svg className="mn-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  Icon: () => React.ReactElement;
  badge?: number; // TODO: Replace with real notification count from API
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconGrid  },
      { to: '/courses',   label: 'Courses',   Icon: IconBook,  badge: 3 },
      { to: '/students',  label: 'Students',  Icon: IconUsers },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/trusted-devices', label: 'Security', Icon: IconShield },
      { to: '/settings',        label: 'Settings', Icon: IconSettings },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

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
        {/* Logo */}
        <div className="mn-sidebar-logo-wrap">
          <img src="/brand/logowhite.png" alt="MindNavy LMS" />
        </div>

        {/* Section-based nav */}
        <nav className="mn-sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="mn-nav-section">{section.label}</div>
              {section.items.map(({ to, label, Icon, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `mn-nav-link${isActive ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge !== undefined && (
                    <span className="mn-nav-badge">{badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User pill */}
        <div className="mn-sidebar-footer">
          <div className="mn-user-pill">
            <div
              className="mn-avatar"
              style={{
                background: 'linear-gradient(135deg, var(--mn-blue-600), var(--mn-purple-500))',
                boxShadow: '0 0 12px rgba(14,165,233,0.3)',
              }}
            >
              {initials}
            </div>
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
            {/* Search — decorative, wired to real search when backend is ready */}
            <div
              className="mn-topbar-search"
              role="button"
              aria-label="Search"
              style={{ display: 'none' }} // TODO: Show when search is implemented
            >
              <IconSearch />
              <span>Search…</span>
              <kbd>⌘K</kbd>
            </div>

            {/* Notification bell — badge always visible; count from real API later */}
            <button
              className="mn-topbar-icon-btn"
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell />
              {/* TODO: Hide dot when there are no unread notifications */}
              <span className="mn-notif-dot" aria-hidden="true" />
            </button>

            <span className="mn-topbar-email">{user?.email}</span>

            <button className="mn-btn-ghost" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/* DEV-ONLY: Demo session banner */}
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
