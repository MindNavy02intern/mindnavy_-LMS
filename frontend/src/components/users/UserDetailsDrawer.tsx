import { useEffect, useState } from 'react';
import { getUserDetails, reactivateUser, resetPassword } from '../../api/users';
import { getStoredToken } from '../../api/adminAuth';
import type {
  UserDetailsResponse,
  UserStatus,
  RoleType,
  RiskScore,
  CourseStatus,
} from '../../types/users';
import type { ToastType } from './Toast';
import EditUserModal, { type EditInitialData } from './EditUserModal';
import SuspendUserDialog from './SuspendUserDialog';
import AssignRoleModal  from './AssignRoleModal';
import ConfirmDialog    from './ConfirmDialog';
import SendMessageModal from './SendMessageModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<UserStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: '#f0fdf4', color: '#16a34a', label: 'Active'    },
  suspended: { bg: '#fff7ed', color: '#ea580c', label: 'Suspended' },
  pending:   { bg: '#fefce8', color: '#a16207', label: 'Pending'   },
  archived:  { bg: '#f9fafb', color: '#6b7280', label: 'Archived'  },
  invited:   { bg: '#eff6ff', color: '#2563eb', label: 'Invited'   },
};

const AVATAR_PALETTES = [
  { bg: '#e0e7ff', color: '#3730a3' },
  { bg: '#fae8ff', color: '#7e22ce' },
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#fee2e2', color: '#b91c1c' },
  { bg: '#ccfbf1', color: '#0f766e' },
  { bg: '#fef9c3', color: '#a16207' },
];

function avatarPalette(name: string): { bg: string; color: string } {
  const n = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function roleTypeBadge(type: RoleType): { bg: string; color: string; label: string } {
  if (type === 'primary')   return { bg: '#eff6ff', color: '#1d4ed8', label: 'Primary'   };
  if (type === 'secondary') return { bg: '#faf5ff', color: '#6d28d9', label: 'Secondary' };
  return                           { bg: '#fff7ed', color: '#c2410c', label: 'Temporary' };
}

function riskBadge(risk: RiskScore): { bg: string; color: string; label: string } {
  if (risk === 'low')    return { bg: '#f0fdf4', color: '#16a34a', label: 'Low Risk'    };
  if (risk === 'medium') return { bg: '#fefce8', color: '#a16207', label: 'Medium Risk' };
  if (risk === 'high')   return { bg: '#fff7ed', color: '#c2410c', label: 'High Risk'   };
  return                        { bg: '#fef2f2', color: '#b91c1c', label: 'Critical'    };
}

function courseStatusStyle(status: CourseStatus): { color: string; label: string; bar: string } {
  if (status === 'completed') return { color: '#16a34a', label: 'Completed', bar: '#16a34a' };
  if (status === 'dropped')   return { color: '#dc2626', label: 'Dropped',   bar: '#dc2626' };
  return                              { color: '#2563eb', label: 'Active',    bar: '#2563eb' };
}

const ROLE_DISPLAY: Record<string, string> = {
  learner:         'Learner',
  instructor:      'Instructor',
  manager:         'Manager',
  admin_assistant: 'Admin Assistant',
};

// ── Inline SVG icons ───────────────────────────────────────────────────────────

function IcoBack()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }
function IcoClose()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IcoMail()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function IcoPhone()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IcoAlert()   { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }

function IcoPencil()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IcoKey()     { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>; }
function IcoLogout()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function IcoShield()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IcoChat()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }


// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.5px', color: '#9ca3af', marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

// ── Tabs config ────────────────────────────────────────────────────────────────

type DrawerTab = 'overview' | 'roles' | 'activity' | 'courses' | 'more';

const DRAWER_TABS: { key: DrawerTab; label: string }[] = [
  { key: 'overview',  label: 'Overview'       },
  { key: 'roles',     label: 'Roles & Access' },
  { key: 'activity',  label: 'Activity'       },
  { key: 'courses',   label: 'Courses'        },
  { key: 'more',      label: 'More'           },
];

// ── ActionBtn sub-component ────────────────────────────────────────────────────

function ActionBtn({ label, Icon, onClick, disabled, danger, color }: {
  label:     string;
  Icon:      () => React.ReactElement;
  onClick?:  () => void;
  disabled?: boolean;
  danger?:   boolean;
  color?:    string;
}) {
  const ic = color ?? (danger ? '#ef4444' : '#6b7280');
  const tc = color ?? (danger ? '#ef4444' : '#374151');
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={disabled ? `${label} — coming soon` : label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        padding: '10px 6px',
        background: '#f9fafb', border: '1px solid #e5e7eb',
        borderRadius: 8, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f0f9ff'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#f9fafb'; }}
    >
      <span style={{ color: ic }}><Icon /></span>
      <span style={{ fontSize: 11, color: tc, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function IcoBan()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>; }
function IcoCheck() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  userId:        string;
  onClose:       () => void;
  showToast:     (type: ToastType, message: string) => void;
  onUserUpdated: () => void;
}

export default function UserDetailsDrawer({ userId, onClose, showToast, onUserUpdated }: Props) {
  const [data,      setData]      = useState<UserDetailsResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [visible,   setVisible]   = useState(false);

  // Dialog/modal open state
  const [editOpen,         setEditOpen]         = useState(false);
  const [suspendOpen,      setSuspendOpen]      = useState(false);
  const [reactivateOpen,   setReactivateOpen]   = useState(false);
  const [resetPwOpen,      setResetPwOpen]      = useState(false);
  const [assignRoleOpen,   setAssignRoleOpen]   = useState(false);
  const [sendMessageOpen,      setSendMessageOpen]      = useState(false);
  const [actionBusy,           setActionBusy]           = useState(false);
  const [forceLogoutLoading,   setForceLogoutLoading]   = useState(false);

  // Reset password form state
  const [newPassword,  setNewPassword]  = useState('');
  const [showNewPw,    setShowNewPw]    = useState(false);
  const [pwError,      setPwError]      = useState<string | null>(null);

  // Slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Fetch user details
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getUserDetails(userId)
      .then(d  => { if (!cancelled) { setData(d);  setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [userId]);

  // Silent re-fetch: updates data in background without showing the loading spinner
  const refetch = () => {
    getUserDetails(userId)
      .then(d => setData(d))
      .catch(() => {});
  };

  const handleSuccess = () => { onUserUpdated(); refetch(); };

  // Inline action handlers (for simple confirm dialogs)
  const handleReactivate = async () => {
    setActionBusy(true);
    try {
      const res = await reactivateUser(userId);
      showToast('success', res.message || 'User reactivated successfully');
      setReactivateOpen(false);
      handleSuccess();
    } catch {
      showToast('error', 'Failed to reactivate user');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetPw = async () => {
    setPwError(null);
    if (newPassword.length < 12) {
      setPwError('Password must be at least 12 characters.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) { setPwError('Password must contain an uppercase letter.'); return; }
    if (!/[a-z]/.test(newPassword)) { setPwError('Password must contain a lowercase letter.'); return; }
    if (!/[0-9]/.test(newPassword)) { setPwError('Password must contain a number.'); return; }
    if (!/[@$!%*?&]/.test(newPassword)) { setPwError('Password must contain a special character (@$!%*?&).'); return; }

    setActionBusy(true);
    try {
      const res = await resetPassword(userId, newPassword);
      showToast('success', res.message || 'Password has been updated');
      setResetPwOpen(false);
      setNewPassword('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setActionBusy(false);
    }
  };

  const handleForceLogout = async () => {
    const user = data?.user;
    if (!user) return;
    const confirmed = window.confirm(
      `Force logout ${user.fullName}? They will be immediately signed out of all active sessions.`
    );
    if (!confirmed) return;
    setForceLogoutLoading(true);
    try {
      const token = getStoredToken();
      const base  = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';
      const res   = await fetch(`${base}/users/${userId}/force-logout`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as { message?: string })?.message ?? 'Failed to force logout');
      }
      showToast('success', 'User logged out of all sessions successfully');
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      refetch();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to force logout user');
    } finally {
      setForceLogoutLoading(false);
    }
  };

  // Slide-out then unmount
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const u    = data?.user;
  const av   = u ? avatarPalette(u.fullName) : AVATAR_PALETTES[0];
  const stl  = u ? STATUS_STYLE[u.status]    : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* Overlay */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 420,
          background: '#ffffff',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.13)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Close bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: 13, fontFamily: 'inherit', padding: '3px 0',
            }}
          >
            <IcoBack /> Back
          </button>
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >
            <IcoClose />
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: 12, color: '#9ca3af',
          }}>
            <style>{`@keyframes mn-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #e5e7eb', borderTopColor: '#2563eb',
              animation: 'mn-spin 0.75s linear infinite',
            }} />
            <span style={{ fontSize: 13 }}>Loading user details…</span>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: 10, padding: 24,
          }}>
            <IcoAlert />
            <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 600, textAlign: 'center' }}>{error}</p>
            <button
              onClick={handleClose}
              style={{
                padding: '6px 14px', fontSize: 12,
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* ── Content (user loaded) ── */}
        {!loading && !error && u && (
          <>
            {/* ── User header ── */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                  background: av.bg, color: av.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px',
                  overflow: 'hidden',
                }}>
                  {u.avatar
                    ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(u.fullName)
                  }
                </div>

                {/* Name + status + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                      {u.fullName}
                    </span>
                    {stl && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: stl.bg, color: stl.color,
                        borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                        {stl.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{ROLE_DISPLAY[u.role] ?? u.role}</div>
                </div>
              </div>

              {/* Email + Phone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151' }}>
                  <IcoMail /> {u.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: u.phone ? '#374151' : '#9ca3af' }}>
                  <IcoPhone /> {u.phone ?? '—'}
                </div>
              </div>
            </div>

            {/* ── Tabs bar ── */}
            <div style={{
              display: 'flex', overflowX: 'auto',
              borderBottom: '1px solid #e5e7eb',
              background: '#ffffff', flexShrink: 0,
              padding: '0 4px',
            }}>
              {DRAWER_TABS.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '9px 12px', fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? '#2563eb' : '#6b7280',
                      background: 'transparent', border: 'none',
                      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                      cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap', transition: 'color 0.12s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Scrollable tab content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* ══ OVERVIEW ══ */}
              {activeTab === 'overview' && (
                <>
                  <Section title="User Information">
                    <InfoRow label="User ID"        value={`USR-${u.id.slice(-6).toUpperCase()}`} />
                    <InfoRow label="Joined"          value={formatDate(u.createdAt)} />
                    <InfoRow label="Department"      value={u.department ?? '—'} />
                    <InfoRow label="Branch"          value={u.branch     ?? '—'} />
                    <InfoRow label="Last Login"      value={formatRelative(u.lastActivityAt)} />
                    <InfoRow label="Status"          value={
                      stl && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: stl.bg, color: stl.color,
                          borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        }}>
                          {stl.label}
                        </span>
                      )
                    } />
                    <InfoRow label="Email Verified"  value={
                      u.emailVerified
                        ? <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✓ Verified</span>
                        : <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>✗ Not verified</span>
                    } />
                    <InfoRow label="Phone Verified"  value={
                      u.phoneVerified
                        ? <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✓ Verified</span>
                        : <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>✗ Not verified</span>
                    } />
                  </Section>

                  <Section title="Roles">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* System role — always shown from user.role field */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', background: '#f9fafb',
                        borderRadius: 6, border: '1px solid #f0f0f0',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ROLE_DISPLAY[u.role] ?? u.role}</span>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 7px', flexShrink: 0 }}>System</span>
                      </div>
                      {/* Custom role table assignments */}
                      {(data!.roles ?? []).map(r => {
                        const t = roleTypeBadge(r.type);
                        return (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 10px', background: '#f9fafb',
                            borderRadius: 6, border: '1px solid #f0f0f0',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {r.expiresAt && (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>Exp {formatDate(r.expiresAt)}</span>
                              )}
                              <span style={{
                                background: t.bg, color: t.color,
                                borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 7px',
                              }}>
                                {t.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section>

                  <Section title="Quick Actions">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                      <ActionBtn Icon={IcoPencil} label="Edit User"      onClick={() => setEditOpen(true)} />
                      <ActionBtn Icon={IcoKey}    label="Reset Password" onClick={() => setResetPwOpen(true)} />
                      {u.status === 'suspended'
                        ? <ActionBtn Icon={IcoCheck} label="Reactivate"   onClick={() => setReactivateOpen(true)} color="#16a34a" />
                        : <ActionBtn Icon={IcoBan}   label="Suspend User" onClick={() => setSuspendOpen(true)} danger />
                      }
                      <ActionBtn Icon={IcoShield} label="Assign Role"   onClick={() => setAssignRoleOpen(true)} />
                      <ActionBtn Icon={IcoLogout} label={forceLogoutLoading ? 'Logging out…' : 'Force Logout'} onClick={handleForceLogout} disabled={forceLogoutLoading} danger />
                      <ActionBtn Icon={IcoChat}   label="Send Message"  onClick={() => setSendMessageOpen(true)} />
                    </div>
                  </Section>

                  {data!.securityOverview && (() => {
                    const so   = data!.securityOverview;
                    const risk = riskBadge(so.riskScore);
                    return (
                      <Section title="Security Overview">
                        <InfoRow label="MFA Status"       value={
                          so.mfaEnabled
                            ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Enabled</span>
                            : <span style={{ background: '#f9fafb', color: '#9ca3af', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Not configured</span>
                        } />
                        <InfoRow label="Active Sessions"  value={String(so.activeSessions)} />
                        <InfoRow label="Last IP Address"  value={so.lastIpAddress ?? '—'} />
                        <InfoRow label="Location"         value={so.lastLocation  ?? '—'} />
                        <InfoRow label="Risk Score"       value={
                          <span style={{ background: risk.bg, color: risk.color, borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>
                            {risk.label}
                          </span>
                        } />
                      </Section>
                    );
                  })()}
                </>
              )}

              {/* ══ ROLES & ACCESS ══ */}
              {activeTab === 'roles' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {/* System role — always shown */}
                  <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ROLE_DISPLAY[u.role] ?? u.role}</span>
                      <span style={{ background: '#1d4ed8', color: '#fff', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 9px' }}>System Role</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Assigned at registration · No expiry</div>
                  </div>
                  {/* Custom role assignments */}
                  {(data!.roles ?? []).length > 0 ? (
                    (data!.roles ?? []).map(r => {
                      const t = roleTypeBadge(r.type);
                      return (
                        <div key={r.id} style={{
                          padding: '12px 14px', background: '#ffffff',
                          border: '1px solid #e5e7eb', borderRadius: 8,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.name}</span>
                            <span style={{ background: t.bg, color: t.color, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 9px' }}>
                              {t.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>
                            {r.expiresAt ? `Expires: ${formatDate(r.expiresAt)}` : 'No expiry'}
                          </div>
                          <div style={{ fontSize: 11, color: '#c4b5fd', marginTop: 4, fontStyle: 'italic' }}>
                            Permissions management coming soon
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0', background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb' }}>
                      No custom roles assigned
                    </div>
                  )}
                </div>
              )}

              {/* ══ ACTIVITY ══ */}
              {activeTab === 'activity' && (
                (data!.recentActivity ?? []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(data!.recentActivity ?? []).map((item, i) => (
                      <div key={item.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                        {/* Timeline spine */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', marginTop: 3 }} />
                          {i < (data!.recentActivity ?? []).length - 1 && (
                            <div style={{ width: 1, flex: 1, background: '#e5e7eb', marginTop: 4 }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginBottom: 3 }}>{item.action}</div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af' }}>
                            <span>{formatRelative(item.timestamp)}</span>
                            {item.ipAddress && <><span>·</span><span>{item.ipAddress}</span></>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon="📋" text="No recent activity" />
              )}

              {/* ══ COURSES ══ */}
              {activeTab === 'courses' && (
                (data!.enrolledCourses ?? []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(data!.enrolledCourses ?? []).map(course => {
                      const cs = courseStatusStyle(course.status);
                      return (
                        <div key={course.id} style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, marginRight: 10 }}>{course.title}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: cs.color, flexShrink: 0 }}>{cs.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${course.progress}%`,
                                background: cs.bar, borderRadius: 3,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, minWidth: 34, textAlign: 'right' }}>
                              {course.progress}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No courses enrolled</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                      Course assignments will be available<br />when Learning Management is set up.
                    </div>
                    <button disabled style={{
                      padding: '8px 18px', fontSize: 13, fontFamily: 'inherit',
                      fontWeight: 600, background: '#e5e7eb', color: '#9ca3af',
                      border: 'none', borderRadius: 7, cursor: 'not-allowed',
                    }}>
                      Assign Course — Coming Soon
                    </button>
                  </div>
                )
              )}

              {/* ══ MORE ══ */}
              {activeTab === 'more' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {[
                    { label: 'Competencies',      icon: '🎯' },
                    { label: 'Security Logs',      icon: '🔒' },
                    { label: 'Devices & Sessions', icon: '💻' },
                    { label: 'Notes',              icon: '📝' },
                    { label: 'Preferences',        icon: '⚙️' },
                    { label: 'Consent & Privacy',  icon: '🛡️' },
                  ].map(({ label, icon }) => (
                    <div
                      key={label}
                      style={{
                        padding: '18px 14px', background: '#f9fafb',
                        border: '1px solid #e5e7eb', borderRadius: 8,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                        cursor: 'not-allowed', opacity: 0.72, userSelect: 'none',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
                      <span style={{
                        background: '#e0f2fe', color: '#0369a1',
                        borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 9px',
                      }}>
                        Coming Soon
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* ── Modals rendered above drawer ── */}
      {editOpen && u && (
        <EditUserModal
          userId={u.id}
          initialData={{ fullName: u.fullName, phone: u.phone, role: u.role ?? null, department: u.department, branch: u.branch, groupId: null, accessLevel: null, managerId: null, skills: null }}
          onClose={() => setEditOpen(false)}
          onSuccess={(updated: EditInitialData) => {
            // 1. Immediately apply what the user submitted so the drawer reflects it at once
            setData(prev => prev ? {
              ...prev,
              user: {
                ...prev.user,
                fullName:   updated.fullName,
                phone:      updated.phone,
                department: updated.department,
                branch:     updated.branch,
              }
            } : prev);
            setEditOpen(false);
            // 2. Refresh the parent users list + dashboard KPIs
            onUserUpdated();
            // 3. Background re-fetch: merge backend result, keeping submitted values
            //    for fields the backend may return as null (not yet in schema)
            getUserDetails(userId)
              .then(d => setData({
                ...d,
                user: {
                  ...d.user,
                  phone:      d.user.phone      ?? updated.phone,
                  department: d.user.department ?? updated.department,
                  branch:     d.user.branch     ?? updated.branch,
                }
              }))
              .catch(() => { showToast('error', 'User was saved but the drawer could not refresh. Please close and reopen.'); });
          }}
          showToast={showToast}
        />
      )}
      {suspendOpen && u && (
        <SuspendUserDialog
          userId={u.id}
          fullName={u.fullName}
          onClose={() => setSuspendOpen(false)}
          onSuccess={() => { setSuspendOpen(false); handleSuccess(); }}
          showToast={showToast}
        />
      )}
      {reactivateOpen && u && (
        <ConfirmDialog
          title="Reactivate User"
          body={`Are you sure you want to reactivate ${u.fullName}? They will regain system access.`}
          confirmLabel="Confirm Reactivate"
          confirmColor="#16a34a"
          onConfirm={handleReactivate}
          onCancel={() => setReactivateOpen(false)}
          loading={actionBusy}
        />
      )}
      {resetPwOpen && u && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => { setResetPwOpen(false); setNewPassword(''); setPwError(null); }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Set New Password</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              Set a new password for <strong>{u.fullName}</strong>. Must be at least 12 characters with uppercase, lowercase, number and special character.
            </p>
            {pwError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#b91c1c' }}>
                {pwError}
              </div>
            )}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(null); }}
                placeholder="New password (12+ chars)"
                autoComplete="new-password"
                style={{ width: '100%', padding: '8px 36px 8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(v => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showNewPw
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setResetPwOpen(false); setNewPassword(''); setPwError(null); }} disabled={actionBusy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button
                onClick={handleResetPw}
                disabled={actionBusy || !newPassword}
                style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: actionBusy || !newPassword ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: actionBusy || !newPassword ? 'not-allowed' : 'pointer', color: '#fff' }}
              >
                {actionBusy ? 'Setting…' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
      {assignRoleOpen && u && (
        <AssignRoleModal
          userId={u.id}
          onClose={() => setAssignRoleOpen(false)}
          onSuccess={() => { setAssignRoleOpen(false); handleSuccess(); }}
          showToast={showToast}
        />
      )}
      {sendMessageOpen && u && (
        <SendMessageModal
          userId={u.id}
          userName={u.fullName}
          onClose={() => setSendMessageOpen(false)}
          onSuccess={() => {
            setSendMessageOpen(false);
            window.dispatchEvent(new CustomEvent('messageSent'));
            window.dispatchEvent(new CustomEvent('analyticsUpdated'));
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
