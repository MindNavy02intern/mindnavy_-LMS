import { useState, useEffect } from 'react';
import { groupsAPI } from '../../api/groups';
import type { Group } from '../../types/groups';
import CreateGroupModal from './CreateGroupModal';
import EditGroupModal from './EditGroupModal';
import MembersModal from './MembersModal';

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box', color: '#111827', outline: 'none', background: 'white',
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 16px', backgroundColor: '#2563eb', color: 'white',
  border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
  fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
};

const BTN_GHOST: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid #e5e7eb', backgroundColor: 'white',
  borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151',
};

const MODAL_OVERLAY: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

// ── GroupsTab ──────────────────────────────────────────────────────────────────

const GroupsTab: React.FC = () => {
  const [groups,       setGroups]       = useState<Group[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [hoveredId,    setHoveredId]    = useState<string | null>(null);

  // Create / Edit modals
  const [createOpen, setCreateOpen]   = useState(false);
  const [editGroup,  setEditGroup]    = useState<Group | null>(null);

  // Add members modal
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);

  // Delete confirm
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  function load() {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await groupsAPI.listGroups({ limit: 200 });
        setGroups(res.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load groups.');
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(() => { load(); }, []);

  function afterMutation() {
    load();
    window.dispatchEvent(new CustomEvent('organizationUpdated'));
    window.dispatchEvent(new CustomEvent('groupsUpdated'));
    window.dispatchEvent(new CustomEvent('userDataChanged'));
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await groupsAPI.deleteGroup(deleteId);
      setDeleteId(null);
      afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group.');
      setDeleteId(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = groups.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        <div style={{ fontSize: '14px' }}>Loading groups…</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fecaca', fontSize: '14px' }}>
          <span>{error}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '20px', lineHeight: 1 }} onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" placeholder="Search groups…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT, width: '100%', paddingLeft: '32px' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', color: '#374151', backgroundColor: 'white', cursor: 'pointer' }}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button onClick={() => setCreateOpen(true)} style={BTN_PRIMARY}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Group
        </button>
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', backgroundColor: '#f9fafb', borderRadius: '10px', textAlign: 'center', border: '1px dashed #e5e7eb' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            {search ? 'No groups match your search' : 'No groups found'}
          </div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
            {search ? 'Try a different search term.' : 'Create your first group to get started.'}
          </div>
          {!search && (
            <button onClick={() => setCreateOpen(true)} style={{ ...BTN_PRIMARY, margin: '16px auto 0', justifyContent: 'center' }}>
              + Create First Group
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Group</th>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Department</th>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Leader</th>
                <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Members</th>
                <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((group) => {
                const isHovered = hoveredId === group.id;
                return (
                  <tr
                    key={group.id}
                    onMouseEnter={() => setHoveredId(group.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isHovered ? '#f8faff' : 'white', transition: 'background-color 0.1s' }}
                  >
                    <td style={{ padding: '14px 16px', borderLeft: '3px solid #3b82f6' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{group.name}</div>
                      {group.description && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{group.description}</div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                      {group.department?.name ?? <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                      {group.leader?.fullName ?? <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 10px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                        {group.memberCount}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                        backgroundColor: group.status === 'ACTIVE' ? '#dcfce7' : '#f3f4f6',
                        color: group.status === 'ACTIVE' ? '#15803d' : '#6b7280',
                        border: `1px solid ${group.status === 'ACTIVE' ? '#bbf7d0' : '#e5e7eb'}`,
                      }}>
                        {group.status === 'ACTIVE' ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setMembersGroup(group)}
                          style={{ padding: '5px 10px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#15803d', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          👤 Members
                        </button>
                        <button
                          onClick={() => setEditGroup(group)}
                          style={{ padding: '5px 10px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => { setDeleteId(group.id); setDeleteName(group.name); }}
                          style={{ padding: '5px 10px', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', color: '#dc2626', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); afterMutation(); }}
        />
      )}

      {/* Edit Modal */}
      {editGroup && (
        <EditGroupModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onSaved={() => { setEditGroup(null); afterMutation(); }}
        />
      )}

      {/* Members Modal */}
      {membersGroup && (
        <MembersModal
          group={membersGroup}
          onClose={() => setMembersGroup(null)}
          onChanged={afterMutation}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div style={MODAL_OVERLAY}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>Delete Group?</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                Are you sure you want to delete <strong style={{ color: '#111827' }}>{deleteName}</strong>?
                All members will be removed. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} style={{ ...BTN_GHOST, padding: '9px 20px' }} disabled={deleteBusy}>Cancel</button>
              <button
                onClick={handleDelete}
                style={{ padding: '9px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: deleteBusy ? 0.7 : 1 }}
                disabled={deleteBusy}
              >
                {deleteBusy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsTab;
