import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function IconMessage() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function IconChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Quick Actions (topbar dropdown) ──────────────────────────────────────────

const QA_TOPBAR_ACTIONS = [
  { label: 'Add User' },
  { label: 'Create Course' },
  { label: 'Assign Course' },
  { label: 'Generate Report' },
  { label: 'Send Notification' },
  { label: 'Manage Roles' },
];

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  Icon: () => React.ReactElement;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard',      Icon: IconGrid   },
      { to: '/courses',   label: 'Learning Mgmt',  Icon: IconBook,  badge: 3 },
      { to: '/users',     label: 'Users',            Icon: IconUsers  },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/trusted-devices', label: 'Audit & Security', Icon: IconShield },
      { to: '/settings',        label: 'System Settings',  Icon: IconSettings },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminLayout({ children, pageTitle: _pageTitle = 'Dashboard' }: Props) {
  const { user, profile, signOut, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const qaRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (qaRef.current && !qaRef.current.contains(e.target as Node)) setQaOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    if (qaOpen || profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [qaOpen, profileOpen]);

  const displayName = profile?.full_name ?? user?.name ?? 'Admin';
  const roleLabel   = profile?.role ?? user?.role ?? 'Administrator';

  const initials = displayName
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
      {/* ── Sidebar (dark) ── */}
      <aside className={`mn-sidebar${open ? ' open' : ''}`}>
        <div className="mn-sidebar-logo-wrap">
          <img src="/brand/logowhite.png" alt="MindNavy LMS" />
          <span className="mn-sidebar-tagline">Enterprise</span>
        </div>

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
                  {badge !== undefined && <span className="mn-nav-badge">{badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mn-sidebar-footer">
          {/* System status */}
          <div className="mn-sidebar-status">
            <span className="mn-sidebar-status-dot" />
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>System Status</div>
              <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.4)' }}>All Systems Operational</div>
            </div>
          </div>

          <div className="mn-user-pill" style={{ marginTop: 4 }}>
            <div className="mn-avatar" style={{ background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mn-user-name">{displayName}</div>
              <div className="mn-user-role">{roleLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      <div className={`mn-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      {/* ── Main (light) ── */}
      <main className="mn-main mn-main-light">

        {/* ── Topbar ── */}
        <header className="mn-topbar">
          <div className="mn-topbar-left">
            <button className="mn-hamburger" onClick={() => setOpen(!open)} aria-label="Toggle sidebar">
              <IconMenu />
            </button>

            {/* Search bar */}
            <div className="mn-topbar-search">
              <IconSearch />
              <span>Search users, courses, reports…</span>
              <kbd>Ctrl K</kbd>
            </div>
          </div>

          <div className="mn-topbar-right">
            {/* Quick Actions dropdown */}
            <div className="mn-dropdown-wrap" ref={qaRef}>
              <button className="mn-topbar-qa-btn" onClick={() => setQaOpen(o => !o)}>
                Quick Actions
                <IconChevronDown />
              </button>
              {qaOpen && (
                <div className="mn-dropdown-panel mn-qa-dropdown-panel">
                  {QA_TOPBAR_ACTIONS.map((a) => (
                    <button key={a.label} className="mn-qa-dropdown-item" onClick={() => setQaOpen(false)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification bell */}
            <button className="mn-topbar-icon-btn" aria-label="Notifications">
              <IconBell />
              {/* TODO: hide dot when there are no unread notifications */}
              <span className="mn-notif-dot" aria-hidden="true" />
            </button>

            {/* Messages */}
            <button className="mn-topbar-icon-btn" aria-label="Messages">
              <IconMessage />
            </button>

            {/* Profile dropdown */}
            <div className="mn-dropdown-wrap" ref={profileRef}>
              <button className="mn-topbar-profile" onClick={() => setProfileOpen(o => !o)}>
                <div className="mn-topbar-avatar">
                  {initials}
                </div>
                <div className="mn-topbar-profile-info">
                  <div className="mn-topbar-profile-name">{displayName}</div>
                  <div className="mn-topbar-profile-role">{roleLabel}</div>
                </div>
                <IconChevronDown />
              </button>
              {profileOpen && (
                <div className="mn-dropdown-panel">
                  <button className="mn-dropdown-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                  </button>
                  <button className="mn-dropdown-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Account Settings
                  </button>
                  <div className="mn-dropdown-divider" />
                  <button className="mn-dropdown-item danger" onClick={handleSignOut}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DEV-ONLY demo banner */}
        {import.meta.env.DEV && isDemoMode && (
          <div className="mn-demo-banner">
            ⚡ DEV MODE — Demo Admin session active. Not connected to the database.
          </div>
        )}

        {/* Page content */}
        <div className="mn-content">{children}</div>
      </main>
    </>
  );
}
