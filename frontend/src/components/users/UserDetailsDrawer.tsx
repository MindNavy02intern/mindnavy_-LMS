import { useEffect, useState } from 'react';
import { getUserDetails } from '../../api/users';
import type {
  UserDetailsResponse,
  UserStatus,
  RoleType,
  RiskScore,
  CourseStatus,
} from '../../types/users';

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
function IcoDots()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>; }

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

// ── Quick Actions ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS: { label: string; Icon: () => React.ReactElement; danger?: boolean }[] = [
  { label: 'Edit User',      Icon: IcoPencil },
  { label: 'Reset Password', Icon: IcoKey    },
  { label: 'Force Logout',   Icon: IcoLogout, danger: true },
  { label: 'Assign Role',    Icon: IcoShield },
  { label: 'Send Message',   Icon: IcoChat   },
  { label: 'More Actions',   Icon: IcoDots   },
];

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  userId:  string;
  onClose: () => void;
}

export default function UserDetailsDrawer({ userId, onClose }: Props) {
  const [data,      setData]      = useState<UserDetailsResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [visible,   setVisible]   = useState(false);

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
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{u.role}</div>
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
                        ? <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✓ Yes</span>
                        : <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>✗ No</span>
                    } />
                    <InfoRow label="Phone Verified"  value={
                      u.phoneVerified
                        ? <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✓ Yes</span>
                        : <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>✗ No</span>
                    } />
                  </Section>

                  <Section title="Roles">
                    {(data!.roles ?? []).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    ) : (
                      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: '8px 0' }}>No roles assigned</p>
                    )}
                  </Section>

                  <Section title="Quick Actions">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                      {QUICK_ACTIONS.map(({ label, Icon, danger }) => (
                        <button
                          key={label}
                          disabled
                          title={`${label} — coming soon`}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                            padding: '10px 6px',
                            background: '#f9fafb', border: '1px solid #e5e7eb',
                            borderRadius: 8, cursor: 'not-allowed', opacity: 0.65,
                            fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ color: danger ? '#ef4444' : '#6b7280' }}><Icon /></span>
                          <span style={{ fontSize: 11, color: danger ? '#ef4444' : '#374151', fontWeight: 500 }}>{label}</span>
                        </button>
                      ))}
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
                            : <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Disabled</span>
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
                (data!.roles ?? []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {(data!.roles ?? []).map(r => {
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
                    })}
                  </div>
                ) : <EmptyState icon="🔑" text="No roles assigned" />
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
                ) : <EmptyState icon="📚" text="No courses enrolled" />
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
    </div>
  );
}
