import { useEffect, useRef, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type { User } from '../../types/users';
import { getUsers } from '../../api/users';
import { rolesPermissionsAPI } from '../../api/rolesPermissions';
import type { Role } from '../../types/rolesPermissions';
import {
  createAssignment,
  UserRoleAssignmentError,
} from '../../api/userRoleAssignments';
import type { AssignmentType } from '../../api/userRoleAssignments';

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#374151', background: '#ffffff',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.15)';
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow   = 'none';
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      color: '#6b7280', paddingBottom: 8, marginBottom: 12,
      borderBottom: '1px solid #f3f4f6',
    }}>
      {title}
    </div>
  );
}

function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Avatar helper ──────────────────────────────────────────────────────────────

function Avatar({ name, src, size = 28 }: { name: string; src: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const hue = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,32%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
    }}>
      {initials || '?'}
    </div>
  );
}

// ── Assignment type option list ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: AssignmentType; label: string; description: string }[] = [
  { value: 'PRIMARY',   label: 'Primary',   description: 'Main role — replaces any existing primary' },
  { value: 'SECONDARY', label: 'Secondary', description: 'Additional role alongside primary' },
  { value: 'TEMPORARY', label: 'Temporary', description: 'Time-limited access' },
  { value: 'EMERGENCY', label: 'Emergency', description: 'Emergency override access' },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignRoleModal({ onClose, onSuccess, showToast }: Props) {
  // User combobox
  const [userQuery,    setUserQuery]    = useState('');
  const [userResults,  setUserResults]  = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = userQuery.trim();
    if (!query || selectedUser) {
      (() => { setUserResults([]); setUsersLoading(false); })();
      return;
    }
    let cancelled = false;
    (() => setUsersLoading(true))();
    const timer = setTimeout(() => {
      getUsers({ search: query, limit: 50 })
        .then(res => { if (!cancelled) { setUserResults(res.users); setUsersLoading(false); } })
        .catch(() => { if (!cancelled) { setUserResults([]); setUsersLoading(false); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userQuery, selectedUser]);

  // Close the user dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userBoxRef.current && !userBoxRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Roles dropdown
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleId,      setRoleId]      = useState('');

  useEffect(() => {
    let cancelled = false;
    rolesPermissionsAPI.getRoles({ limit: 200 })
      .then(res => { if (!cancelled) setRoles(res.data ?? []); })
      .catch(() => { /* role list fetch failed — dropdown just stays empty */ })
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Assignment type + expiry
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('PRIMARY');
  const [expiresAt,      setExpiresAt]      = useState('');

  // Form state
  const [errors,      setErrors]      = useState<{ user?: string; role?: string; expiresAt?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!selectedUser) errs.user = 'Select a user to assign a role to.';
    if (!roleId)       errs.role = 'Select a role.';
    if (assignmentType === 'TEMPORARY' && !expiresAt) {
      errs.expiresAt = 'Expiration date is required for temporary assignments.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate() || !selectedUser) return;

    setSubmitting(true);
    try {
      await createAssignment({
        userId: selectedUser.id,
        roleId,
        assignmentType,
        expiresAt: assignmentType === 'TEMPORARY' ? expiresAt : null,
      });
      showToast('success', `Role assigned to ${selectedUser.fullName}`);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      onSuccess();
    } catch (err) {
      if (err instanceof UserRoleAssignmentError) {
        if (err.status === 409) {
          setErrors(prev => ({ ...prev, role: 'User already has this role active' }));
          setServerError('User already has this role active');
        } else {
          setServerError(err.message);
        }
        showToast('error', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to assign role';
        setServerError(msg);
        showToast('error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 560, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        marginTop: 'auto', marginBottom: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
              Assign Role
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              Assign a role to a user.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
              cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {serverError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
            padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#b91c1c',
          }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Section 1: User & Role ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="User & Role" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* User combobox */}
              <div ref={userBoxRef} style={{ position: 'relative' }}>
                <label style={LABEL}>User <span style={{ color: '#ef4444' }}>*</span></label>
                {selectedUser ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px',
                  }}>
                    <Avatar name={selectedUser.fullName} src={selectedUser.avatar} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedUser.fullName}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setUserQuery(''); setErrors(prev => ({ ...prev, user: undefined })); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, flexShrink: 0 }}
                      title="Change user"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={userQuery}
                    onChange={e => { setUserQuery(e.target.value); setUserDropdownOpen(true); setErrors(prev => ({ ...prev, user: undefined })); }}
                    onFocus={e => { focusIn(e); setUserDropdownOpen(true); }}
                    onBlur={focusOut}
                    placeholder="Search by name or email…"
                    style={{ ...INPUT, borderColor: errors.user ? '#ef4444' : '#d1d5db' }}
                  />
                )}
                {errors.user && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.user}</div>}

                {userDropdownOpen && !selectedUser && userQuery.trim() && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
                    zIndex: 10,
                  }}>
                    {usersLoading && (
                      <div style={{ padding: '14px 12px', fontSize: 12.5, color: '#9ca3af' }}>Searching…</div>
                    )}
                    {!usersLoading && userResults.length === 0 && (
                      <div style={{ padding: '14px 12px', fontSize: 12.5, color: '#9ca3af' }}>No users match your search.</div>
                    )}
                    {!usersLoading && userResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setUserDropdownOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#f9fafb')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = '#fff')}
                      >
                        <Avatar name={u.fullName} src={u.avatar} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role */}
              <div>
                <label style={LABEL}>Role <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={roleId}
                  onChange={e => { setRoleId(e.target.value); setErrors(prev => ({ ...prev, role: undefined })); }}
                  disabled={rolesLoading}
                  style={{ ...INPUT, cursor: 'pointer', borderColor: errors.role ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="">{rolesLoading ? 'Loading roles…' : 'Select role…'}</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {errors.role && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.role}</div>}
              </div>
            </div>
          </div>

          {/* ── Section 2: Assignment Type ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="Assignment Type" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TYPE_OPTIONS.map(opt => {
                const active = assignmentType === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                      padding: '9px 12px', borderRadius: 8,
                      background: active ? '#eff6ff' : '#f9fafb',
                      border: active ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    }}
                  >
                    <input
                      type="radio"
                      name="assignmentType"
                      checked={active}
                      onChange={() => setAssignmentType(opt.value)}
                      style={{ marginTop: 2, accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 1 }}>{opt.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Section 3: Expiration (TEMPORARY only) ── */}
          {assignmentType === 'TEMPORARY' && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader title="Expiration" />
              <div>
                <label style={LABEL}>Expiration Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  value={expiresAt}
                  min={tomorrowISODate()}
                  onChange={e => { setExpiresAt(e.target.value); setErrors(prev => ({ ...prev, expiresAt: undefined })); }}
                  style={{ ...INPUT, cursor: 'text', borderColor: errors.expiresAt ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {errors.expiresAt && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.expiresAt}</div>}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            paddingTop: 16, borderTop: '1px solid #f3f4f6',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 18px', fontSize: 13, fontFamily: 'inherit',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 7, cursor: 'pointer', color: '#374151',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600,
                background: submitting ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: 7,
                cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff',
              }}
            >
              {submitting ? 'Assigning…' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
