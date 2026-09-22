import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, User as UserIcon, BookOpen, Video, Users, Star, Award,
  Target, Wallet, MessageSquare, BarChart3, Settings as SettingsIcon,
  ChevronRight, LogOut,
} from 'lucide-react';
import { useInstructorAuth } from '../../context/InstructorAuthContext';

// Reuses the exact mn-sidebar/mn-nav-*/mn-main/mn-topbar classes AdminLayout.tsx
// already relies on (globally loaded via brand.css, no extra import needed) —
// deliberately leaner than AdminLayout: no notifications panel, no messages
// panel, no quick actions dropdown. Those belong to the real Messages (2.10)
// and Reports (2.11) pages in a later phase, not this shell.

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  builtThisPhase: boolean;
}

// Order matches INSTRUCTOR_DASHBOARD_BLUEPRINT.docx Section 1.4. Only
// Dashboard and My Profile are real this phase — everything else routes to
// InstructorComingSoonPage until its own phase lands.
const NAV_ITEMS: NavItem[] = [
  { to: '/instructor/dashboard',     label: 'Dashboard',        Icon: LayoutDashboard, builtThisPhase: true },
  { to: '/instructor/profile',       label: 'My Profile',       Icon: UserIcon,        builtThisPhase: true },
  { to: '/instructor/courses',       label: 'My Courses',       Icon: BookOpen,        builtThisPhase: true },
  { to: '/instructor/live-sessions', label: 'My Live Sessions', Icon: Video,           builtThisPhase: true },
  { to: '/instructor/students',      label: 'My Students',      Icon: Users,           builtThisPhase: true },
  { to: '/instructor/reviews',       label: 'My Reviews',       Icon: Star,            builtThisPhase: true },
  { to: '/instructor/certifications',label: 'My Certifications',Icon: Award,           builtThisPhase: true },
  { to: '/instructor/competencies',  label: 'My Competencies',  Icon: Target,          builtThisPhase: true },
  { to: '/instructor/earnings',      label: 'My Earnings',      Icon: Wallet,          builtThisPhase: true },
  { to: '/instructor/messages',      label: 'Messages',         Icon: MessageSquare,   builtThisPhase: true },
  { to: '/instructor/reports',       label: 'My Reports',       Icon: BarChart3,       builtThisPhase: true },
  { to: '/instructor/settings',      label: 'Settings',         Icon: SettingsIcon,    builtThisPhase: true },
];

interface Props {
  children: React.ReactNode;
}

export default function InstructorLayout({ children }: Props) {
  const { instructor, signOut } = useInstructorAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/instructor/login', { replace: true });
  };

  return (
    <>
      <aside className={`mn-sidebar${open ? ' open' : ''}`}>
        <div className="mn-sidebar-logo-wrap">
          <img data-brand-logo src="/brand/logowhite.png" alt="MindNavy LMS" />
          <span className="mn-sidebar-tagline">Instructor Portal</span>
        </div>

        <nav className="mn-sidebar-nav">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `mn-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon className="mn-nav-icon" strokeWidth={2} />
              <span className="mn-nav-label">{label}</span>
              <ChevronRight className="mn-nav-chevron" strokeWidth={2} />
            </NavLink>
          ))}
        </nav>

        <div className="mn-sidebar-footer">
          {/* .mn-btn-ghost — same class the rest of the dark sidebar chrome
              would use for a small bordered action; sized/colored correctly
              for a dark background out of the box (unlike .mn-btn-primary/
              .mn-input, which assume a light .mn-main-light container and
              go invisible or oversized there — see InstructorDashboardPage/
              InstructorProfilePage for that fix). */}
          <button
            type="button"
            onClick={handleSignOut}
            className="mn-btn-ghost"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
          >
            <LogOut size={14} strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className={`mn-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      <div className="mn-main mn-main-light">
        <header className="mn-topbar">
          <div className="mn-topbar-left">
            <button className="mn-hamburger" style={{ display: 'flex' }} aria-label="Toggle sidebar" onClick={() => setOpen((o) => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mn-topbar-right">
            {/* Same scale as admin's .mn-topbar-email (0.8rem). */}
            <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600 }}>
              {instructor?.fullName}
            </span>
          </div>
        </header>

        <main className="mn-content">{children}</main>
      </div>
    </>
  );
}

export { NAV_ITEMS };
