import { useState, useEffect } from 'react';
import { groupsAPI } from '../../api/groups';
import { getUsers } from '../../api/users';
import type { Group, GroupMember } from '../../types/groups';
import type { User } from '../../types/users';

// ── Role display helpers ────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  learner:         'Learner',
  instructor:      'Instructor',
  manager:         'Manager',
  admin_assistant: 'Admin Asst.',
};

const ROLE_COLOR: Record<string, React.CSSProperties> = {
  learner:         { backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  instructor:      { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  manager:         { backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  admin_assistant: { backgroundColor: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' },
};

const ROLE_FILTERS = [
  { key: 'all',             label: 'All' },
  { key: 'learner',         label: 'Learner' },
  { key: 'instructor',      label: 'Instructor' },
  { key: 'manager',         label: 'Manager' },
  { key: 'admin_assistant', label: 'Admin Asst.' },
];

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  group: Group;
  onClose: () => void;
  onChanged: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

const MembersModal: React.FC<Props> = ({ group, onClose, onChanged }) => {
  const [tab,         setTab]        = useState<'current' | 'add'>('current');
  const [members,     setMembers]    = useState<GroupMember[]>([]);
  const [allUsers,    setAllUsers]   = useState<User[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');
  const [roleFilter,  setRoleFilter] = useState('all');
  const [search,      setSearch]     = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addBusy,     setAddBusy]    = useState(false);
  const [removingId,  setRemovingId] = useState<string | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError('');
      const [membersRes, usersRes] = await Promise.allSettled([
        groupsAPI.getGroupMembers(group.id),
        getUsers({ limit: 200 }),
      ]);
      if (cancelled) return;
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.data ?? []);
      else setError(membersRes.reason instanceof Error ? membersRes.reason.message : 'Failed to load members.');
      if (usersRes.status === 'fulfilled') setAllUsers(usersRes.value.users ?? []);
      else if (!error) setError(usersRes.reason instanceof Error ? usersRes.reason.message : 'Failed to load users.');
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [group.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async function refreshMembers() {
    try {
      const res = await groupsAPI.getGroupMembers(group.id);
      setMembers(res.data ?? []);
    } catch { /* keep existing list on silent refresh failure */ }
  }

  const existingIds = new Set(members.map(m => m.userId));
  const userMap     = new Map(allUsers.map(u => [u.id, u]));

  // Add tab – filtered list
  const available     = allUsers.filter(u => !existingIds.has(u.id));
  const roleFiltered  = roleFilter === 'all' ? available : available.filter(u => u.role === roleFilter);
  const searchedUsers = roleFiltered.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function switchTab(t: 'current' | 'add') {
    setTab(t);
    setSearch('');
    setRoleFilter('all');
    setError('');
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    setError('');
    try {
      await groupsAPI.removeMember(group.id, userId);
      window.dispatchEvent(new CustomEvent('groupsUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      onChanged();
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member.');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAdd() {
    if (selectedIds.length === 0) { setError('Select at least one user.'); return; }
    setAddBusy(true);
    setError('');
    try {
      await groupsAPI.addMembers(group.id, selectedIds);
      window.dispatchEvent(new CustomEvent('groupsUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      onChanged();
      setSelectedIds([]);
      await refreshMembers();
      switchTab('current');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add members.');
    } finally {
      setAddBusy(false);
    }
  }

  function toggleUser(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '600px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>👥 Group Members</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                <strong style={{ color: '#374151' }}>{group.name}</strong>
                {' · '}
                <span style={{ color: '#2563eb', fontWeight: 500 }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '24px', lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {(['current', 'add'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? '#2563eb' : '#6b7280',
                  borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t === 'current' ? `Current Members (${members.length})` : 'Add Members'}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ margin: '12px 24px 0', padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', border: '1px solid #fecaca', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── CURRENT MEMBERS TAB ────────────────────────────────────────────── */}
        {tab === 'current' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                <div style={{ fontSize: '13px' }}>Loading…</div>
              </div>
            ) : members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>No members yet</div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>Add people to this group using the "Add Members" tab.</div>
                <button
                  onClick={() => switchTab('add')}
                  style={{ marginTop: '16px', padding: '8px 18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                >
                  + Add Members
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                {members.map((member, idx) => {
                  const appUser   = userMap.get(member.userId);
                  const name      = member.user?.fullName ?? appUser?.fullName ?? 'Unknown User';
                  const email     = member.user?.email   ?? appUser?.email    ?? '';
                  const role      = appUser?.role ?? '';
                  const roleStyle = ROLE_COLOR[role] ?? {};
                  const isRemoving = removingId === member.userId;
                  const isLast     = idx === members.length - 1;
                  return (
                    <div
                      key={member.userId}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #f1f5f9', backgroundColor: isRemoving ? '#fff5f5' : 'white' }}
                    >
                      {/* Avatar */}
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        {initials(name)}
                      </div>

                      {/* Name + email */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                      </div>

                      {/* App role badge */}
                      {role && (
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, ...roleStyle }}>
                          {ROLE_LABEL[role] ?? role}
                        </span>
                      )}

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemove(member.userId)}
                        disabled={removingId !== null}
                        style={{
                          padding: '4px 10px', border: '1px solid #fee2e2',
                          backgroundColor: isRemoving ? '#fee2e2' : 'white',
                          color: '#dc2626', borderRadius: '6px',
                          cursor: removingId ? 'default' : 'pointer',
                          fontSize: '12px', fontWeight: 500, flexShrink: 0,
                          opacity: removingId && !isRemoving ? 0.5 : 1,
                        }}
                      >
                        {isRemoving ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADD MEMBERS TAB ────────────────────────────────────────────────── */}
        {tab === 'add' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px 0', minHeight: 0 }}>
            {/* Role filter pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', flexShrink: 0 }}>
              {ROLE_FILTERS.map(rf => (
                <button
                  key={rf.key}
                  onClick={() => setRoleFilter(rf.key)}
                  style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
                    fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${roleFilter === rf.key ? '#2563eb' : '#e5e7eb'}`,
                    backgroundColor: roleFilter === rf.key ? '#2563eb' : 'white',
                    color: roleFilter === rf.key ? 'white' : '#374151',
                  }}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px', flexShrink: 0 }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text" placeholder="Search by name or email…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 30px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {/* User list */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', minHeight: '180px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                  <div style={{ fontSize: '13px' }}>Loading users…</div>
                </div>
              ) : searchedUsers.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>👤</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                    {error
                      ? 'Could not load users.'
                      : available.length === 0
                        ? 'All users are already members of this group.'
                        : 'No users match the current filter.'}
                  </div>
                </div>
              ) : (
                searchedUsers.map(user => {
                  const checked    = selectedIds.includes(user.id);
                  const roleStyle  = ROLE_COLOR[user.role] ?? {};
                  return (
                    <label
                      key={user.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', backgroundColor: checked ? '#f0f9ff' : 'white' }}
                    >
                      <input
                        type="checkbox" checked={checked}
                        onChange={() => toggleUser(user.id)}
                        style={{ cursor: 'pointer', accentColor: '#2563eb', width: 15, height: 15, flexShrink: 0 }}
                      />
                      {/* Avatar */}
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                        {initials(user.fullName)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: '#111827' }}>{user.fullName}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                      </div>
                      {/* Role badge */}
                      {user.role && (
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, ...roleStyle }}>
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', paddingBottom: '24px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : ''}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  disabled={addBusy}
                  style={{ padding: '8px 16px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addBusy || selectedIds.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: addBusy || selectedIds.length === 0 ? '#93c5fd' : '#2563eb',
                    color: 'white', border: 'none', borderRadius: '6px',
                    cursor: addBusy || selectedIds.length === 0 ? 'default' : 'pointer',
                    fontSize: '14px', fontWeight: 500,
                  }}
                >
                  {addBusy ? 'Adding…' : `Add ${selectedIds.length > 0 ? selectedIds.length + ' ' : ''}Member${selectedIds.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembersModal;
