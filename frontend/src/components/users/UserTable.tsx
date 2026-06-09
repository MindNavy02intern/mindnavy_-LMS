import type { User, UserStatus } from '../../types/users';

// ── Column definitions (exported so parent can manage state) ──────────────────

export type ColKey = 'email' | 'role' | 'department' | 'status' | 'lastActivity' | 'phone' | 'verificationState' | 'createdAt';

export const COLUMNS: { key: ColKey; label: string; defaultVisible: boolean }[] = [
  { key: 'email',             label: 'Email',              defaultVisible: true  },
  { key: 'role',              label: 'Role',               defaultVisible: true  },
  { key: 'department',        label: 'Department',         defaultVisible: true  },
  { key: 'status',            label: 'Status',             defaultVisible: true  },
  { key: 'lastActivity',      label: 'Last Activity',      defaultVisible: true  },
  { key: 'phone',             label: 'Phone',              defaultVisible: false },
  { key: 'verificationState', label: 'Verification State', defaultVisible: false },
  { key: 'createdAt',         label: 'Created Date',       defaultVisible: false },
];

export const COL_LS_KEY = 'userTableColumns';

export function loadVisibleCols(): Set<ColKey> {
  try {
    const raw = localStorage.getItem(COL_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ColKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  users:           User[];
  loading:         boolean;
  visibleCols:     Set<ColKey>;
  onViewUser?:     (userId: string) => void;
  onEditUser?:     (user: User) => void;
  onDeleteUser?:   (user: User) => void;
  selectedIds?:    string[];
  onSelectChange?: (ids: string[]) => void;
}

// ── Role badge colours ─────────────────────────────────────────────────────────

function getRoleStyle(role: string): { bg: string; color: string } {
  const r = role.toLowerCase();
  if (r === 'administrator' || r === 'admin')    return { bg: '#E8F0FE', color: '#1A73E8' };
  if (r === 'instructor')                        return { bg: '#F3E8FF', color: '#7C3AED' };
  if (r === 'student' || r === 'learner')        return { bg: '#E8F8E8', color: '#16A34A' };
  if (r === 'hr manager')                        return { bg: '#FFF3E0', color: '#E65100' };
  if (r === 'finance manager')                   return { bg: '#FFE8E8', color: '#DC2626' };
  if (r === 'branch manager' || r === 'manager') return { bg: '#E0F7FA', color: '#0097A7' };
  return { bg: '#f3f4f6', color: '#374151' };
}

// ── Status map ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<UserStatus, { dot: string; color: string; label: string }> = {
  active:    { dot: '#22C55E', color: '#16a34a', label: 'Active'    },
  suspended: { dot: '#F97316', color: '#ea580c', label: 'Suspended' },
  pending:   { dot: '#EAB308', color: '#a16207', label: 'Pending'   },
  archived:  { dot: '#9ca3af', color: '#6b7280', label: 'Archived'  },
  invited:   { dot: '#3b82f6', color: '#2563eb', label: 'Invited'   },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: '#E8F0FE', color: '#1A73E8' },
  { bg: '#F3E8FF', color: '#7C3AED' },
  { bg: '#E8F8E8', color: '#16A34A' },
  { bg: '#FFF3E0', color: '#E65100' },
  { bg: '#FFE8E8', color: '#DC2626' },
  { bg: '#E0F7FA', color: '#0097A7' },
  { bg: '#fefce8', color: '#a16207' },
];

function avatarPalette(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function sk(w: number | string, h: number, r = 4): React.CSSProperties {
  return {
    width: w, height: h, borderRadius: r, flexShrink: 0,
    background: 'linear-gradient(90deg,#f0f3f7 25%,#e8ecf2 50%,#f0f3f7 75%)',
    backgroundSize: '600px 100%',
    animation: 'mn-shimmer 1.3s ease-in-out infinite',
    display: 'block',
  };
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '9px 12px', textAlign: 'center' }}><div style={sk(14, 14, 3)} /></td>
      <td style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...sk(30, 30, 15), flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={sk(100, 11)} /><div style={sk(60, 9)} />
          </div>
        </div>
      </td>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} style={{ padding: '9px 12px' }}><div style={sk(80, 11)} /></td>
      ))}
      <td style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {[22, 22, 22].map((s, i) => <div key={i} style={sk(s, s, 5)} />)}
        </div>
      </td>
    </tr>
  );
}

// ── Action icons ───────────────────────────────────────────────────────────────

function IconEye() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IconPencil() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconDots() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;
}

// ── Cell styles ────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase' as const, color: '#9ca3af', background: '#FAFAFA',
  borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const, textAlign: 'left' as const,
};

const TD: React.CSSProperties = {
  padding: '9px 12px', borderBottom: '1px solid #F0F0F0',
  fontSize: 13, color: '#374151', verticalAlign: 'middle' as const,
};

// ── Component ──────────────────────────────────────────────────────────────────

import { useState } from 'react';

export default function UserTable({ users, loading, visibleCols, onViewUser, onEditUser, onDeleteUser, selectedIds = [], onSelectChange }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const allChecked  = users.length > 0 && users.every(u => selectedIds.includes(u.id));
  const someChecked = users.some(u => selectedIds.includes(u.id)) && !allChecked;
  const activeCols  = COLUMNS.filter(c => visibleCols.has(c.key));

  function toggleAll() {
    if (!onSelectChange) return;
    onSelectChange(allChecked ? selectedIds.filter(id => !users.some(u => u.id === id)) : [...new Set([...selectedIds, ...users.map(u => u.id)])]);
  }

  function toggleOne(id: string) {
    if (!onSelectChange) return;
    onSelectChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }

  const totalColSpan = 2 + activeCols.length + 1;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px', overflow: 'auto', position: 'relative' }}>

      {openDropdown && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setOpenDropdown(null)} />
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 40, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleAll}
                disabled={loading || !onSelectChange}
                style={{ cursor: loading || !onSelectChange ? 'not-allowed' : 'pointer', opacity: !onSelectChange ? 0.35 : 1, accentColor: '#2563eb' }}
              />
            </th>
            <th style={TH}>User</th>
            {activeCols.map(col => (
              <th key={col.key} style={TH}>{col.label}</th>
            ))}
            <th style={{ ...TH, textAlign: 'right' as const }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} colCount={activeCols.length} />)
            : users.length === 0
              ? (
                <tr>
                  <td colSpan={totalColSpan} style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>No users found</span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Try adjusting your search or filters</span>
                    </div>
                  </td>
                </tr>
              )
              : users.map(user => {
                  const roleStyle = getRoleStyle(user.role);
                  const status    = STATUS_MAP[user.status] ?? STATUS_MAP.pending;
                  const av        = avatarPalette(user.id);

                  return (
                    <tr
                      key={user.id}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...TD, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => toggleOne(user.id)}
                          style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                      </td>

                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                            {user.avatar
                              ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              : initials(user.fullName)
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.fullName}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                              ID: USR-{user.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {activeCols.map(col => {
                        if (col.key === 'email') return (
                          <td key="email" style={{ ...TD, color: '#6b7280', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.email}
                          </td>
                        );
                        if (col.key === 'role') return (
                          <td key="role" style={TD}>
                            <span style={{ display: 'inline-block', background: roleStyle.bg, color: roleStyle.color, borderRadius: 12, fontSize: 11, fontWeight: 600, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                              {user.role}
                            </span>
                          </td>
                        );
                        if (col.key === 'department') return (
                          <td key="department" style={{ ...TD, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {user.department ?? <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        );
                        if (col.key === 'status') return (
                          <td key="status" style={TD}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: status.color, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.dot, flexShrink: 0 }} />
                              {status.label}
                            </span>
                          </td>
                        );
                        if (col.key === 'lastActivity') return (
                          <td key="lastActivity" style={{ ...TD, color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {formatLastActivity(user.lastActivityAt)}
                          </td>
                        );
                        if (col.key === 'phone') return (
                          <td key="phone" style={{ ...TD, color: '#6b7280', fontSize: 12 }}>
                            {user.phone ?? <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        );
                        if (col.key === 'verificationState') return (
                          <td key="verificationState" style={TD}>
                            {user.verificationState
                              ? <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: user.verificationState === 'verified' ? '#dcfce7' : user.verificationState === 'pending' ? '#fef9c3' : '#fee2e2', color: user.verificationState === 'verified' ? '#15803d' : user.verificationState === 'pending' ? '#a16207' : '#dc2626' }}>
                                {user.verificationState}
                              </span>
                              : <span style={{ color: '#d1d5db' }}>—</span>
                            }
                          </td>
                        );
                        if (col.key === 'createdAt') return (
                          <td key="createdAt" style={{ ...TD, color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {formatDate(user.createdAt)}
                          </td>
                        );
                        return null;
                      })}

                      <td style={{ ...TD, textAlign: 'right', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                          <button
                            onClick={() => onViewUser?.(user.id)}
                            title="View"
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, color: '#2563eb', cursor: 'pointer', padding: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                          >
                            <IconEye />
                          </button>
                          <button
                            onClick={() => onEditUser?.(user)}
                            title="Edit"
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, color: '#6b7280', cursor: 'pointer', padding: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#6b7280'; }}
                          >
                            <IconPencil />
                          </button>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === user.id ? null : user.id); }}
                              title="More"
                              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: openDropdown === user.id ? '#fee2e2' : '#f9fafb', border: `1px solid ${openDropdown === user.id ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 5, color: openDropdown === user.id ? '#dc2626' : '#6b7280', cursor: 'pointer', padding: 0 }}
                            >
                              <IconDots />
                            </button>
                            {openDropdown === user.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 28, zIndex: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 150, overflow: 'hidden' }}>
                                <button
                                  onClick={() => { setOpenDropdown(null); onDeleteUser?.(user); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', textAlign: 'left' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                  Delete User
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
          }
        </tbody>
      </table>
    </div>
  );
}
