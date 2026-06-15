import { useState, useEffect } from 'react';
import { groupsAPI } from '../../api/groups';
import { getUsers } from '../../api/users';
import type { Group } from '../../types/groups';
import type { User } from '../../types/users';

interface Props {
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

const AddMembersModal: React.FC<Props> = ({ group, onClose, onSaved }) => {
  const [allUsers,       setAllUsers]       = useState<User[]>([]);
  const [existingIds,    setExistingIds]    = useState<Set<string>>(new Set());
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);
  const [search,         setSearch]         = useState('');
  const [loading,        setLoading]        = useState(true);
  const [busy,           setBusy]           = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError('');
      const [usersResult, membersResult] = await Promise.allSettled([
        getUsers({ limit: 200 }),
        groupsAPI.getGroupMembers(group.id),
      ]);
      if (cancelled) return;
      if (usersResult.status === 'fulfilled') {
        setAllUsers(usersResult.value.users ?? []);
      } else {
        setError(usersResult.reason instanceof Error ? usersResult.reason.message : 'Failed to load users.');
      }
      if (membersResult.status === 'fulfilled') {
        setExistingIds(new Set((membersResult.value.data ?? []).map((m) => m.userId)));
      }
      setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [group.id]);

  function toggleUser(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleAdd() {
    if (selectedIds.length === 0) { setError('Select at least one user.'); return; }
    setBusy(true);
    setError('');
    try {
      await groupsAPI.addMembers(group.id, selectedIds);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add members.');
    } finally {
      setBusy(false);
    }
  }

  const available = allUsers.filter((u) => !existingIds.has(u.id));
  const filtered  = available.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', maxWidth: '520px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>👤 Add Members</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            Group: <strong style={{ color: '#374151' }}>{group.name}</strong>
            {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px', fontSize: '14px', border: '1px solid #fecaca', flexShrink: 0 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', flex: 1 }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontSize: '13px' }}>Loading users…</div>
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px', flexShrink: 0 }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text" placeholder="Search users…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 30px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {/* User list */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', minHeight: '200px', maxHeight: '340px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>👤</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                    {error ? 'Could not load users.' : (available.length === 0 ? 'All users are already members' : 'No matching users')}
                  </div>
                </div>
              ) : (
                filtered.map((user) => {
                  const checked = selectedIds.includes(user.id);
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
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: '#111827' }}>{user.fullName}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} disabled={busy}>
                Cancel
              </button>
              <button
                onClick={handleAdd}
                style={{ padding: '8px 16px', backgroundColor: busy || selectedIds.length === 0 ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: busy || selectedIds.length === 0 ? 'default' : 'pointer', fontSize: '14px', fontWeight: 500 }}
                disabled={busy || selectedIds.length === 0}
              >
                {busy ? 'Adding…' : `Add ${selectedIds.length > 0 ? selectedIds.length + ' ' : ''}Member${selectedIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddMembersModal;
