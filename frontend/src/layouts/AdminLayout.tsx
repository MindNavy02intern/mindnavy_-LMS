import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldCheck, BookOpen, GraduationCap, User as UserIcon,
  Target, BarChart3, Wallet, Bell as BellIcon, Plug, Settings as SettingsIcon, Shield,
  ChevronRight, BookMarked, CheckCircle2, UsersRound, Award,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { getStoredToken } from '../api/adminAuth';
import { listNotifications, markAllNotificationsRead } from '../services/notificationsApi';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Helper ────────────────────────────────────────────────────────────────────

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Panel types ───────────────────────────────────────────────────────────────

interface NotifPanelItem {
  id:        string;
  title:     string;
  actorName: string;
  type:      string;
  createdAt: string;
}

interface MsgPanelItem {
  id:          string;
  subject:     string | null;
  body:        string;
  messageType: string;
  status:      string;
  createdAt:   string;
  readAt:      string | null;
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function PanelSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'mn-spin 0.65s linear infinite' }} />
    </div>
  );
}

// ── Notifications panel ───────────────────────────────────────────────────────

const NOTIF_ICON_BG: Record<string, string> = {
  user:         '#dbeafe',
  course:       '#dcfce7',
  certificate:  '#fef3c7',
  assignment:   '#f3e8ff',
  live_session: '#d1fae5',
  system:       '#f1f5f9',
};
const NOTIF_ICON_COLOR: Record<string, string> = {
  user:         '#2563eb',
  course:       '#16a34a',
  certificate:  '#f59e0b',
  assignment:   '#8b5cf6',
  live_session: '#059669',
  system:       '#64748b',
};

function NotifTypeIcon({ type }: { type: string }) {
  const color = NOTIF_ICON_COLOR[type] ?? '#64748b';
  if (type === 'user') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
  if (type === 'course') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
  if (type === 'certificate') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function NotificationsPanel({ items, loading, unreadCount, marking, onViewAll, onMarkAllRead }: {
  items: NotifPanelItem[]; loading: boolean; unreadCount: number; marking: boolean;
  onViewAll: () => void; onMarkAllRead: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: 44, right: 0, width: 360,
      background: '#fff', borderRadius: 12,
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0', zIndex: 1000,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Notifications</span>
        <button
          onClick={onMarkAllRead}
          disabled={marking || unreadCount === 0}
          style={{
            fontSize: '0.72rem', color: unreadCount === 0 ? '#94a3b8' : '#2563eb', background: 'none', border: 'none',
            cursor: marking || unreadCount === 0 ? 'default' : 'pointer', fontWeight: 500, padding: 0,
          }}
        >
          {marking ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? <PanelSpinner /> : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>No notifications yet</div>
        ) : items.map((item, i) => (
          <div key={item.id} style={{
            display: 'flex', gap: 10, padding: '10px 16px',
            borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none',
            alignItems: 'flex-start',
            cursor: 'default',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: NOTIF_ICON_BG[item.type] ?? '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <NotifTypeIcon type={item.type} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#0f172a', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.actorName && <strong>{item.actorName} </strong>}{item.title}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 3 }}>{formatAgo(item.createdAt)}</div>
            </div>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 5 }} />
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={onViewAll} style={{ fontSize: '0.78rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          View all notifications →
        </button>
      </div>
    </div>
  );
}

// ── Messages panel ────────────────────────────────────────────────────────────

const MSG_TYPE_LABEL: Record<string, string> = {
  DIRECT: 'Direct', WARNING: 'Warning', POLICY_UPDATE: 'Policy', ANNOUNCEMENT: 'Announcement', FEEDBACK: 'Feedback',
};

function MessageAvatar({ name }: { name: string }) {
  const initials = (name || 'A').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.65rem', fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  );
}

function MessagesPanel({ items, loading }: { items: MsgPanelItem[]; loading: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: 44, right: 0, width: 360,
      background: '#fff', borderRadius: 12,
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0', zIndex: 1000,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Messages</span>
        <button style={{ fontSize: '0.72rem', color: '#fff', background: '#2563eb', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px 10px', borderRadius: 6 }}>
          + Compose
        </button>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? <PanelSpinner /> : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No messages yet</div>
          </div>
        ) : items.map((msg, i) => (
          <div key={msg.id} style={{
            display: 'flex', gap: 10, padding: '10px 16px',
            borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none',
            alignItems: 'flex-start',
            background: msg.readAt ? '#fff' : '#fafbff',
          }}>
            <MessageAvatar name={MSG_TYPE_LABEL[msg.messageType] ?? 'System'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>
                  {msg.subject ?? MSG_TYPE_LABEL[msg.messageType] ?? 'Message'}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>{formatAgo(msg.createdAt)}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.body.slice(0, 60)}{msg.body.length > 60 ? '…' : ''}
              </div>
            </div>
            {!msg.readAt && (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 5 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button style={{ fontSize: '0.78rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          View all messages →
        </button>
      </div>
    </div>
  );
}

// ── Quick Actions (topbar dropdown) ──────────────────────────────────────────

const QA_TOPBAR_ACTIONS = [
  { label: 'Add User',          route: '/users?modal=addUser', message: null },
  { label: 'Create Course',     route: null, message: 'Course management coming in Learning Mgmt module' },
  { label: 'Generate Report',   route: '/reports-analytics?tab=export', message: null },
  { label: 'Send Notification', route: '/notifications?tab=inapp', message: null },
  { label: 'Manage Roles',      route: '/roles-permissions',  message: null },
  { label: 'System Settings',   route: '/settings',           message: null },
];

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  to:     string;
  label:  string;
  Icon:   typeof LayoutDashboard;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',          label: 'Dashboard Overview',  Icon: LayoutDashboard },
  { to: '/users',               label: 'User Management',     Icon: Users },
  { to: '/roles-permissions',   label: 'Roles & Permissions', Icon: ShieldCheck },
  { to: '/learning-management', label: 'Learning Management', Icon: BookOpen },
  { to: '/instructors',         label: 'Instructors',         Icon: GraduationCap },
  { to: '/learners',            label: 'Learners',             Icon: UserIcon },
  { to: '/competencies',        label: 'Competencies',        Icon: Target },
  { to: '/reports-analytics',   label: 'Reports & Analytics', Icon: BarChart3 },
  { to: '/finance',             label: 'Finance',             Icon: Wallet },
  { to: '/notifications',       label: 'Notifications',       Icon: BellIcon },
  { to: '/integrations',        label: 'Integrations',        Icon: Plug },
  { to: '/settings',            label: 'System Settings',     Icon: SettingsIcon },
  { to: '/trusted-devices',     label: 'Audit & Security',    Icon: Shield },
];

interface QuickStatItem {
  label: string;
  value: string;
  Icon:  typeof BookMarked;
  color: string;
}

const QUICK_STATS: QuickStatItem[] = [
  { label: 'Total Courses',     value: '256',    Icon: BookMarked,   color: '#60a5fa' },
  { label: 'Active Courses',    value: '198',    Icon: CheckCircle2, color: '#4ade80' },
  { label: 'Total Enrollments', value: '12,584', Icon: UsersRound,   color: '#a78bfa' },
  { label: 'Courses Completed', value: '3,256',  Icon: Award,        color: '#fbbf24' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

interface Props {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminLayout({ children, pageTitle: _pageTitle = 'Dashboard' }: Props) {
  const { user, profile, signOut, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const [open,             setOpen]             = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [qaOpen,           setQaOpen]           = useState(false);
  const [profileOpen,      setProfileOpen]      = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [messagesOpen,     setMessagesOpen]     = useState(false);
  const [qaToast,          setQaToast]          = useState<string | null>(null);

  const [notifications,   setNotifications]   = useState<NotifPanelItem[]>([]);
  const [notifsLoading,   setNotifsLoading]   = useState(false);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [messages,        setMessages]        = useState<MsgPanelItem[]>([]);
  const [msgsLoading,     setMsgsLoading]     = useState(false);

  const qaRef       = useRef<HTMLDivElement>(null);
  const profileRef  = useRef<HTMLDivElement>(null);
  const notifRef    = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const qaToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQaAction = (route: string | null, label: string, message?: string | null) => {
    setQaOpen(false);
    if (route) {
      navigate(route);
    } else {
      if (qaToastTimer.current) clearTimeout(qaToastTimer.current);
      setQaToast(message ?? `${label} — Coming Soon`);
      qaToastTimer.current = setTimeout(() => setQaToast(null), 3000);
    }
  };

  // Close all panels when clicking outside their refs
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (qaRef.current       && !qaRef.current.contains(e.target as Node))       setQaOpen(false);
      if (profileRef.current  && !profileRef.current.contains(e.target as Node))  setProfileOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setNotifOpen(false);
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node)) setMessagesOpen(false);
    }
    if (qaOpen || profileOpen || notifOpen || messagesOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [qaOpen, profileOpen, notifOpen, messagesOpen]);

  useEffect(() => {
    function handleOpenNotif() { setNotifOpen(true); }
    window.addEventListener('openNotificationsPanel', handleOpenNotif);
    return () => window.removeEventListener('openNotificationsPanel', handleOpenNotif);
  }, []);

  // Sidebar badge — real unread count from the in-app notifications feed
  // (Notifications module, channel=IN_APP). Refetches on every mutation via
  // the same 'analyticsUpdated' bridge every other stats panel listens to.
  useEffect(() => {
    function fetchUnread() {
      listNotifications({ read: false, limit: 1 }).then(res => setUnreadCount(res.total)).catch(() => {});
    }
    fetchUnread();
    window.addEventListener('analyticsUpdated', fetchUnread);
    return () => window.removeEventListener('analyticsUpdated', fetchUnread);
  }, []);

  // "Mark all read" — real PATCH /notifications/read-all (no userId = every
  // user's feed), same endpoint the In-App tab itself uses. This zeroes the
  // SAME NotificationLog{channel:IN_APP} unread count the badge above reads —
  // the panel's item LIST stays the pre-existing recentActivities feed
  // (contract decision #1: a different, intentionally-kept feature), so
  // marking read clears the badge without changing what's shown here.
  const [markingRead, setMarkingRead] = useState(false);
  async function handleMarkAllRead() {
    setMarkingRead(true);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
    } catch {
      // Leave unreadCount as-is — the next 'analyticsUpdated' tick will
      // reconcile it if the PATCH actually succeeded server-side.
    } finally {
      setMarkingRead(false);
    }
  }

  // Fetch real in-app notifications (NotificationLog{channel:IN_APP}) when
  // the panel opens — was reading GET /dashboard/core → recentActivities
  // (AuditLog-derived: admin actions like "logged in" / "created a user",
  // not actual notifications), so anything sent via automations/campaigns
  // never showed up here even though it was really being created. Same
  // table the unread badge above already reads (one sink, one owner).
  useEffect(() => {
    if (!notifOpen) return;
    setNotifsLoading(true);
    listNotifications({ limit: 10 })
      .then(res => setNotifications(res.items.map(n => ({
        id:        n.id,
        title:     n.subject ?? n.body,
        actorName: n.userName ?? 'System',
        // No category field on NotificationLog to bucket into user/course/
        // certificate — 'system' is the honest default (matches dashboard's
        // notificationsPreview mapping, same source table).
        type:      'system',
        createdAt: n.createdAt,
      }))))
      .catch(() => {})
      .finally(() => setNotifsLoading(false));
  }, [notifOpen]);

  // Fetch messages when panel opens
  useEffect(() => {
    if (!messagesOpen) return;
    const adminId = user?.id;
    if (!adminId) { (() => setMsgsLoading(false))(); return; }
    (() => setMsgsLoading(true))();
    const token = getStoredToken();
    fetch(`${BASE_URL}/messages?recipientId=${encodeURIComponent(adminId)}&limit=10`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    })
      .then(r => r.ok ? r.json() : Promise.resolve({ messages: [] }))
      .then(d => setMessages(d.messages ?? []))
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }, [messagesOpen, user?.id]);

  const displayName = profile?.full_name ?? user?.fullName ?? user?.name ?? 'Admin';
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
      <aside
        className={`mn-sidebar${open ? ' open' : ''}`}
        style={{
          width:      sidebarCollapsed ? 0      : undefined,
          overflow:   sidebarCollapsed ? 'hidden': undefined,
          transition: 'width 0.28s ease, transform 0.25s ease',
        }}
      >
        <div className="mn-sidebar-logo-wrap">
          <img src="/brand/logowhite.png" alt="MindNavy LMS" />
          <span className="mn-sidebar-tagline">Enterprise</span>
        </div>

        <nav className="mn-sidebar-nav">
          {NAV_ITEMS.map(({ to, label, Icon, badge }) => {
            const effectiveBadge = to === '/notifications' ? (unreadCount > 0 ? unreadCount : undefined) : badge;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `mn-nav-link${isActive ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <Icon className="mn-nav-icon" strokeWidth={2} />
                <span className="mn-nav-label">{label}</span>
                {effectiveBadge !== undefined ? (
                  <span className="mn-nav-badge">{effectiveBadge}</span>
                ) : (
                  <ChevronRight className="mn-nav-chevron" strokeWidth={2} />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mn-sidebar-footer">
          <div className="mn-quick-status-label">QUICK STATUS</div>
          <ul className="mn-quick-status-list">
            {QUICK_STATS.map(({ label, value, Icon, color }) => (
              <li key={label} className="mn-quick-status-item">
                <Icon className="mn-quick-status-icon" style={{ color }} strokeWidth={2} />
                <span className="mn-quick-status-text">{label}</span>
                <span className="mn-quick-status-value">{value}</span>
              </li>
            ))}
          </ul>
          <div className="mn-sidebar-version">Version 2.5.0</div>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      <div className={`mn-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      {/* ── Main (light) ──
          This wraps BOTH the topbar chrome and the actual page content, so
          it's a <div>, not a <main> — the topbar's global controls (search,
          notifications, profile) aren't page content and shouldn't be
          announced as part of the <main> landmark. The real <main> is below,
          around just .mn-content. */}
      <div
        className="mn-main mn-main-light"
        style={{
          marginLeft: sidebarCollapsed ? 0       : undefined,
          width:      sidebarCollapsed ? '100%'  : undefined,
          transition: 'margin-left 0.28s ease, width 0.28s ease',
        }}
      >

        {/* ── Topbar ── */}
        <header className="mn-topbar">
          <div className="mn-topbar-left">
            <button
              className="mn-hamburger"
              style={{ display: 'flex' }}
              aria-label="Toggle sidebar"
              onClick={() => {
                if (window.innerWidth <= 768) setOpen(o => !o);
                else setSidebarCollapsed(c => !c);
              }}
            >
              <IconMenu />
            </button>

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
                    <button key={a.label} className="mn-qa-dropdown-item" onClick={() => handleQaAction(a.route, a.label, a.message)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="mn-topbar-icon-btn"
                aria-label="Notifications"
                onClick={() => { setNotifOpen(o => !o); setMessagesOpen(false); setProfileOpen(false); }}
              >
                <IconBell />
                <span className="mn-notif-dot" aria-hidden="true" />
              </button>
              {notifOpen && (
                <NotificationsPanel
                  items={notifications}
                  loading={notifsLoading}
                  unreadCount={unreadCount}
                  marking={markingRead}
                  onViewAll={() => { setNotifOpen(false); navigate('/notifications?tab=inapp'); }}
                  onMarkAllRead={handleMarkAllRead}
                />
              )}
            </div>

            {/* Messages */}
            <div style={{ position: 'relative' }} ref={messagesRef}>
              <button
                className="mn-topbar-icon-btn"
                aria-label="Messages"
                onClick={() => { setMessagesOpen(o => !o); setNotifOpen(false); setProfileOpen(false); }}
              >
                <IconMessage />
              </button>
              {messagesOpen && (
                <MessagesPanel items={messages} loading={msgsLoading} />
              )}
            </div>

            {/* Profile dropdown */}
            <div className="mn-dropdown-wrap" ref={profileRef}>
              <button className="mn-topbar-profile" onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); setMessagesOpen(false); }}>
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
                  <button className="mn-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                  </button>
                  <button className="mn-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
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

        {/* Page content — the actual <main> landmark */}
        <main className="mn-content">{children}</main>

        {/* Quick Actions coming-soon toast */}
        {qaToast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
            background: '#1e293b', color: '#f1f5f9',
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {qaToast}
            <button onClick={() => setQaToast(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
      </div>
    </>
  );
}
