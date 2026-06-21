import { useEffect, useMemo, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type { User } from '../../types/users';
import { getStoredToken } from '../../api/adminAuth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function fetchAllUsers(): Promise<User[]> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/users?limit=200`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json().catch(() => ({ users: [] }));
  return (json as { users?: User[] }).users ?? [];
}

async function patchUserRole(userId: string, roleName: string): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role: roleName }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
  }
}

// ── Avatar helper ──────────────────────────────────────────────────────────────

function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const hue = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,32%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
    }}>
      {initials || '?'}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  roleId:    string;
  roleName:  string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignUsersToRoleModal({ roleId: _roleId, roleName, onClose, onSuccess, showToast }: Props) {
  const [users,        setUsers]        = useState<User[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [submitting,   setSubmitting]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetchAllUsers()
      .then(list => { if (!cancelled) { setUsers(list); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFetchError('Failed to load users'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  function toggleUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const filteredIds = filtered.map(u => u.id);
    const allSelected = filteredIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach(id => next.delete(id));
      else filteredIds.forEach(id => next.add(id));
      return next;
    });
  }

  async function handleAssign() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);

    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => patchUserRole(id, roleName)));

    const failed = results.filter(r => r.status === 'rejected');
    const succeeded = results.length - failed.length;

    if (succeeded > 0) {
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      showToast('success', `${succeeded} user${succeeded !== 1 ? 's' : ''} assigned to "${roleName}"`);
      onSuccess();
    }
    if (failed.length > 0) {
      showToast('error', `${failed.length} assignment${failed.length !== 1 ? 's' : ''} failed`);
    }
    setSubmitting(false);
    if (succeeded > 0) onClose();
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(u => selectedIds.has(u.id));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 560,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Assign Users
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              Assign users to role: <strong>{roleName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
              cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search + select-all */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 10,
                paddingTop: 7, paddingBottom: 7,
                border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13,
                fontFamily: 'inherit', color: '#374151', background: '#fff',
                boxSizing: 'border-box', outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>
          {!loading && !fetchError && filtered.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                />
                Select all ({filtered.length})
              </label>
              {selectedIds.size > 0 && (
                <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                  {selectedIds.size} selected
                </span>
              )}
            </div>
          )}
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {/* Loading */}
          {loading && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              <style>{`@keyframes au-spin { to { transform: rotate(360deg); } }`}</style>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ animation: 'au-spin 1s linear infinite', verticalAlign: 'middle', marginRight: 6 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading users…
            </div>
          )}

          {/* Error */}
          {!loading && fetchError && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: '#b91c1c', fontSize: 13 }}>
              {fetchError}
            </div>
          )}

          {/* Empty */}
          {!loading && !fetchError && filtered.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              {search ? 'No users match your search.' : 'No users found.'}
            </div>
          )}

          {/* Rows */}
          {!loading && !fetchError && filtered.map(user => {
            const selected = selectedIds.has(user.id);
            return (
              <div
                key={user.id}
                onClick={() => toggleUser(user.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 20px', cursor: 'pointer',
                  background: selected ? '#eff6ff' : '#fff',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selected ? '#eff6ff' : '#fff'; }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleUser(user.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
                />
                <Avatar name={user.fullName} src={user.avatar} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.fullName}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                </div>
                {user.role && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px',
                    borderRadius: 100, background: '#f3f4f6', color: '#6b7280',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {user.role}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px', borderTop: '1px solid #f3f4f6', flexShrink: 0,
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
            type="button"
            onClick={handleAssign}
            disabled={submitting || selectedIds.size === 0}
            style={{
              padding: '8px 20px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              background: submitting || selectedIds.size === 0 ? '#93c5fd' : '#2563eb',
              border: 'none', borderRadius: 7,
              cursor: submitting || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              color: '#fff',
            }}
          >
            {submitting
              ? 'Assigning…'
              : selectedIds.size === 0
                ? 'Assign Users'
                : `Assign ${selectedIds.size} User${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
