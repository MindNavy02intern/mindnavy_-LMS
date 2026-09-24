import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, User as UserIcon, BookOpen, Video, Users, Star, Award,
  Target, Wallet, MessageSquare, BarChart3, Settings as SettingsIcon,
  ChevronRight, ChevronDown, LogOut, Bell,
} from 'lucide-react';
import { useInstructorAuth } from '../../context/InstructorAuthContext';
import {
  listMyNotifications, markMyNotificationRead, markAllMyNotificationsRead,
} from '../../api/instructorNotificationsApi';
import {
  listMyMessages, markAllMyMessagesRead,
} from '../../api/instructorMessagesApi';
import type { InstructorNotification } from '../../types/instructorNotifications';
import type { InstructorMessage } from '../../types/instructorMessages';
import InstructorMessageThreadModal from '../../components/messages/InstructorMessageThreadModal';
import InstructorComposeModal from '../../components/messages/InstructorComposeModal';
import { messageTypeBadgeStyle, priorityBadgeStyle } from './instructorUiKit';

// Reuses the exact mn-sidebar/mn-nav-*/mn-main/mn-topbar classes AdminLayout.tsx
// already relies on (globally loaded via brand.css, no extra import needed) —
// deliberately leaner than AdminLayout: no notifications panel, no messages
// panel, no quick actions dropdown. Those belong to the real Messages (2.10)
// and Reports (2.11) pages in a later phase, not this shell.

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PanelSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'mn-spin 0.65s linear infinite' }} />
    </div>
  );
}

// ── Notifications dropdown ───────────────────────────────────────────────────

function NotificationsPanel({ items, loading, onMarkAllRead, onOpen, onViewAll }: {
  items: InstructorNotification[]; loading: boolean;
  onMarkAllRead: () => void; onOpen: (n: InstructorNotification) => void; onViewAll: () => void;
}) {
  const unreadCount = items.filter((n) => !n.read).length;
  return (
    <div style={{ position: 'absolute', top: 44, right: 0, width: 340, background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Notifications</span>
        <button
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          style={{ fontSize: '0.72rem', color: unreadCount === 0 ? '#94a3b8' : 'var(--color-primary)', background: 'none', border: 'none', cursor: unreadCount === 0 ? 'default' : 'pointer', fontWeight: 500, padding: 0 }}
        >
          Mark all read
        </button>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? <PanelSpinner /> : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>No notifications yet</div>
        ) : items.map((n, i) => (
          <div
            key={n.id}
            onClick={() => onOpen(n)}
            style={{
              display: 'flex', gap: 10, padding: '10px 16px', cursor: n.read ? 'default' : 'pointer',
              borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none',
              alignItems: 'flex-start', background: n.read ? '#fff' : '#fafbff',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: n.read ? 500 : 700, color: '#0f172a' }}>{n.subject ?? '(No subject)'}</span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>{formatAgo(n.createdAt)}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
            </div>
            {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />}
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={onViewAll} style={{ fontSize: '0.78rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          View all notifications →
        </button>
      </div>
    </div>
  );
}

// ── Messages dropdown ─────────────────────────────────────────────────────────

function MessagesPanel({ items, loading, onCompose, onOpen, onMarkAllRead, onViewAll }: {
  items: InstructorMessage[]; loading: boolean;
  onCompose: () => void; onOpen: (m: InstructorMessage) => void; onMarkAllRead: () => void; onViewAll: () => void;
}) {
  const unreadCount = items.filter((m) => m.status !== 'read').length;
  return (
    <div style={{ position: 'absolute', top: 44, right: 0, width: 340, background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Messages</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} style={{ fontSize: '0.72rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
              Mark all read
            </button>
          )}
          <button onClick={onCompose} style={{ fontSize: '0.72rem', color: '#fff', background: 'var(--color-primary)', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px 10px', borderRadius: 6 }}>
            + Compose
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? <PanelSpinner /> : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>No messages yet</div>
        ) : items.map((m, i) => {
          const lastReply = m.replies[m.replies.length - 1];
          return (
            <div
              key={m.id}
              onClick={() => onOpen(m)}
              style={{
                display: 'flex', gap: 10, padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none',
                alignItems: 'flex-start', background: m.status === 'read' ? '#fff' : '#fafbff',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>{m.subject ?? '(No subject)'}</span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>{formatAgo(m.createdAt)}</span>
                </div>
                {m.senderName && <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginBottom: 2 }}>From: {m.senderName}</div>}
                {(m.messageType !== 'DIRECT' || m.priority !== 'NORMAL') && (
                  <div style={{ display: 'flex', gap: 5, marginBottom: 2 }}>
                    {m.messageType !== 'DIRECT' && <span style={messageTypeBadgeStyle(m.messageType)}>{m.messageType.replace('_', ' ')}</span>}
                    {m.priority !== 'NORMAL' && <span style={priorityBadgeStyle(m.priority)}>{m.priority}</span>}
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body}</div>
                {lastReply && (
                  <div style={{ fontSize: '0.68rem', color: '#2563eb', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    You replied · {lastReply.body.slice(0, 40)}{lastReply.body.length > 40 ? '…' : ''}
                  </div>
                )}
              </div>
              {m.status !== 'read' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={onViewAll} style={{ fontSize: '0.78rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          View all messages →
        </button>
      </div>
    </div>
  );
}

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

  const [notifOpen,     setNotifOpen]     = useState(false);
  const [messagesOpen,  setMessagesOpen]  = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [notifications, setNotifications] = useState<InstructorNotification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [messages,       setMessages]       = useState<InstructorMessage[]>([]);
  const [msgsLoading,    setMsgsLoading]    = useState(false);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [composeOpen,     setComposeOpen]     = useState(false);

  const notifRef    = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const profileRef  = useRef<HTMLDivElement>(null);

  // Sequence guards — fetchMessages/fetchUnreadNotifCount are each called
  // from multiple uncoordinated sites (mount, panel-open, mark-all-read, and
  // the thread modal's onChanged after marking something read server-side).
  // Without this, an older in-flight response can resolve AFTER a newer one
  // and clobber the just-corrected read state, leaving the topbar badge
  // stuck — same race AdminLayout.tsx's own fetchMessages had earlier this
  // session (msgsFetchIdRef fix), just not carried over when this file was
  // built after that fix already existed.
  const msgsFetchIdRef      = useRef(0);
  const notifCountFetchIdRef = useRef(0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setNotifOpen(false);
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node)) setMessagesOpen(false);
      if (profileRef.current  && !profileRef.current.contains(e.target as Node))  setProfileOpen(false);
    }
    if (notifOpen || messagesOpen || profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen, messagesOpen, profileOpen]);

  // Accurate unread count on mount (not just the loaded dropdown page) —
  // same "?read=false&limit=1, read res.total" shape AdminLayout's own bell
  // badge uses.
  function fetchUnreadNotifCount() {
    const fetchId = ++notifCountFetchIdRef.current;
    listMyNotifications({ read: false, limit: 1 })
      .then((res) => { if (fetchId === notifCountFetchIdRef.current) setUnreadNotifCount(res.total); })
      .catch(() => {});
  }
  useEffect(() => { fetchUnreadNotifCount(); }, []);

  function fetchNotifications() {
    setNotifsLoading(true);
    listMyNotifications({ limit: 10 })
      .then((res) => setNotifications(res.items))
      .catch(() => {})
      .finally(() => setNotifsLoading(false));
  }

  function fetchMessages() {
    const fetchId = ++msgsFetchIdRef.current;
    setMsgsLoading(true);
    listMyMessages()
      .then((res) => { if (fetchId === msgsFetchIdRef.current) setMessages(res.data); })
      .catch(() => {})
      .finally(() => { if (fetchId === msgsFetchIdRef.current) setMsgsLoading(false); });
  }
  useEffect(() => { fetchMessages(); }, []);

  async function handleOpenNotification(n: InstructorNotification) {
    if (n.read) return;
    try {
      await markMyNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      fetchUnreadNotifCount();
    } catch {
      // Leave state as-is — next panel open re-fetches the real state anyway.
    }
  }

  async function handleMarkAllNotifRead() {
    try {
      await markAllMyNotificationsRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnreadNotifCount(0);
    } catch {
      // no-op — see handleOpenNotification
    }
  }

  async function handleMarkAllMessagesRead() {
    try {
      await markAllMyMessagesRead();
      fetchMessages();
    } catch {
      // no-op
    }
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/instructor/login', { replace: true });
  };

  const initials = (instructor?.fullName ?? 'I')
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
            {/* Notification bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="mn-topbar-icon-btn"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((o) => {
                    const next = !o;
                    if (next) { fetchNotifications(); fetchUnreadNotifCount(); }
                    return next;
                  });
                  setMessagesOpen(false);
                  setProfileOpen(false);
                }}
              >
                <Bell size={17} strokeWidth={2} />
                {unreadNotifCount > 0 && <span className="mn-notif-dot" aria-hidden="true" />}
              </button>
              {notifOpen && (
                <NotificationsPanel
                  items={notifications}
                  loading={notifsLoading}
                  onMarkAllRead={handleMarkAllNotifRead}
                  onOpen={handleOpenNotification}
                  onViewAll={() => { setNotifOpen(false); navigate('/instructor/messages'); }}
                />
              )}
            </div>

            {/* Messages */}
            <div style={{ position: 'relative' }} ref={messagesRef}>
              <button
                className="mn-topbar-icon-btn"
                aria-label="Messages"
                onClick={() => {
                  setMessagesOpen((o) => {
                    const next = !o;
                    if (next) fetchMessages();
                    return next;
                  });
                  setNotifOpen(false);
                  setProfileOpen(false);
                }}
              >
                <MessageSquare size={17} strokeWidth={2} />
                {messages.some((m) => m.status !== 'read') && <span className="mn-notif-dot" aria-hidden="true" style={{ background: '#dc2626' }} />}
              </button>
              {messagesOpen && (
                <MessagesPanel
                  items={messages}
                  loading={msgsLoading}
                  onCompose={() => { setMessagesOpen(false); setComposeOpen(true); }}
                  onOpen={(m) => { setMessagesOpen(false); setThreadMessageId(m.id); }}
                  onMarkAllRead={handleMarkAllMessagesRead}
                  onViewAll={() => { setMessagesOpen(false); navigate('/instructor/messages'); }}
                />
              )}
            </div>

            {/* Profile dropdown — same mn-topbar-profile/mn-dropdown-panel
                classes and layout as AdminLayout.tsx's own profile menu. */}
            <div className="mn-dropdown-wrap" ref={profileRef}>
              <button
                className="mn-topbar-profile"
                onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); setMessagesOpen(false); }}
              >
                <div className="mn-topbar-avatar">{initials}</div>
                <div className="mn-topbar-profile-info">
                  <div className="mn-topbar-profile-name">{instructor?.fullName}</div>
                  <div className="mn-topbar-profile-role">Instructor</div>
                </div>
                <ChevronDown size={13} strokeWidth={2.5} />
              </button>
              {profileOpen && (
                <div className="mn-dropdown-panel">
                  <button className="mn-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/instructor/profile'); }}>
                    <UserIcon size={14} strokeWidth={2} />
                    My Profile
                  </button>
                  <button className="mn-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/instructor/settings'); }}>
                    <SettingsIcon size={14} strokeWidth={2} />
                    Settings
                  </button>
                  <div className="mn-dropdown-divider" />
                  <button className="mn-dropdown-item danger" onClick={handleSignOut}>
                    <LogOut size={14} strokeWidth={2} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mn-content">{children}</main>
      </div>

      {threadMessageId && (
        <InstructorMessageThreadModal
          messageId={threadMessageId}
          onClose={() => setThreadMessageId(null)}
          onChanged={fetchMessages}
        />
      )}
      {composeOpen && (
        <InstructorComposeModal
          onClose={() => setComposeOpen(false)}
          onSuccess={() => { setComposeOpen(false); fetchMessages(); }}
        />
      )}
    </>
  );
}

export { NAV_ITEMS };
