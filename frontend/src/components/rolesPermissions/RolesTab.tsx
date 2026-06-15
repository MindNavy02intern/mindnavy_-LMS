import { useState, useEffect } from 'react';
import { rolesPermissionsAPI } from '../../api/rolesPermissions';
import type { Role, Permission } from '../../types/rolesPermissions';

// ── Role visual config ─────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { icon: string; border: string; iconBg: string }> = {
  Administrator: { icon: '🛡️', border: '#ef4444', iconBg: '#fff1f2' },
  Admin:         { icon: '🛡️', border: '#ef4444', iconBg: '#fff1f2' },
  Manager:       { icon: '👥', border: '#3b82f6', iconBg: '#eff6ff' },
  Instructor:    { icon: '📚', border: '#16a34a', iconBg: '#f0fdf4' },
  Learner:       { icon: '🎓', border: '#8b5cf6', iconBg: '#f5f3ff' },
};

function roleStyle(name: string) {
  return ROLE_STYLE[name] ?? { icon: '🔑', border: '#6b7280', iconBg: '#f9fafb' };
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box', width: '100%',
  color: '#111827', outline: 'none',
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

const MODAL_BOX = (maxWidth = '500px'): React.CSSProperties => ({
  backgroundColor: 'white', borderRadius: '12px', padding: '28px',
  maxWidth, width: '90%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
});

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px', color: '#374151',
};

const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };

// ── RolesTab ───────────────────────────────────────────────────────────────────

const RolesTab: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteUserCount, setDeleteUserCount] = useState<number | null>(null);
  const [deleteCheckBusy, setDeleteCheckBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Permissions modal
  const [permsRoleId, setPermsRoleId] = useState<string | null>(null);
  const [permsRoleName, setPermsRoleName] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await rolesPermissionsAPI.getRoles({ limit: 200 });
      setRoles(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', description: '', status: 'ACTIVE' });
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    setEditingId(role.id);
    setForm({ name: role.name, description: role.description ?? '', status: role.status });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Role name is required.'); return; }
    setFormBusy(true);
    setFormError('');
    try {
      if (editingId) {
        await rolesPermissionsAPI.updateRole(editingId, form);
      } else {
        await rolesPermissionsAPI.createRole(form);
      }
      setModalOpen(false);
      load();
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save role.');
    } finally {
      setFormBusy(false);
    }
  }

  async function openDeleteCheck(id: string, name: string) {
    setDeleteId(id);
    setDeleteName(name);
    setDeleteUserCount(null);
    setDeleteCheckBusy(true);
    try {
      const res = await rolesPermissionsAPI.getRoleById(id);
      setDeleteUserCount(res.data?.userCount ?? 0);
    } catch {
      setDeleteUserCount(0);
    } finally {
      setDeleteCheckBusy(false);
    }
  }

  function closeDeleteDialog() {
    setDeleteId(null);
    setDeleteName('');
    setDeleteUserCount(null);
    setDeleteCheckBusy(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await rolesPermissionsAPI.deleteRole(deleteId);
      closeDeleteDialog();
      load();
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role.');
      closeDeleteDialog();
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = roles.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        <div style={{ fontSize: '14px' }}>Loading roles…</div>
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
        {/* Search with icon */}
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" placeholder="Search roles by name…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: '32px' }}
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

        <button onClick={openCreate} style={BTN_PRIMARY}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Role
        </button>
      </div>

      {/* Table or Empty State */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', backgroundColor: '#f9fafb', borderRadius: '10px', textAlign: 'center', border: '1px dashed #e5e7eb' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            {search ? 'No roles match your search' : 'No roles found'}
          </div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
            {search ? 'Try a different search term.' : 'Create your first role to get started.'}
          </div>
          {!search && (
            <button onClick={openCreate} style={{ ...BTN_PRIMARY, margin: '16px auto 0', justifyContent: 'center' }}>
              + Create First Role
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Role</th>
                <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Users</th>
                <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((role) => {
                const rs = roleStyle(role.name);
                const isHovered = hoveredId === role.id;
                return (
                  <tr
                    key={role.id}
                    onMouseEnter={() => setHoveredId(role.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isHovered ? '#f8faff' : 'white', transition: 'background-color 0.1s' }}
                  >
                    {/* Role name with icon + colored left border */}
                    <td style={{ padding: '14px 16px', borderLeft: `3px solid ${rs.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: rs.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                          {rs.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{role.name}</div>
                          {role.description && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{role.description}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Users count */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {role.userCount ?? 0}
                        {role.isCustomRole && (
                          <span
                            title="Custom role — requires a system update to assign users directly. Contact your administrator."
                            style={{ fontSize: 11, color: '#9ca3af', cursor: 'help', lineHeight: 1 }}
                          >ⓘ</span>
                        )}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                        backgroundColor: role.status === 'ACTIVE' ? '#dcfce7' : '#f3f4f6',
                        color: role.status === 'ACTIVE' ? '#15803d' : '#6b7280',
                        border: `1px solid ${role.status === 'ACTIVE' ? '#bbf7d0' : '#e5e7eb'}`,
                      }}>
                        {role.status === 'ACTIVE' ? '● Active' : '○ Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setPermsRoleId(role.id); setPermsRoleName(role.name); }}
                          style={{ padding: '5px 10px', border: '1px solid #ddd8fe', backgroundColor: '#faf5ff', color: '#7c3aed', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          🔐 Permissions
                        </button>
                        <button onClick={() => openEdit(role)} style={{ padding: '5px 10px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => openDeleteCheck(role.id, role.name)} style={{ padding: '5px 10px', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', color: '#dc2626', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_BOX()}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {editingId ? '✏️ Edit Role' : '➕ Create Role'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                {editingId ? 'Update role details below.' : 'Fill in the details to create a new role.'}
              </p>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fecaca' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={FIELD}>
                <label style={LABEL}>Role Name *</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={INPUT} placeholder="e.g. Content Manager"
                />
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Description</label>
                <textarea
                  value={form.description} rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="What this role can do…"
                />
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                  style={{ ...INPUT, cursor: 'pointer' }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setModalOpen(false)} style={BTN_GHOST} disabled={formBusy}>Cancel</button>
              <button onClick={handleSave} style={{ ...BTN_PRIMARY, opacity: formBusy ? 0.7 : 1, justifyContent: 'center' }} disabled={formBusy}>
                {formBusy ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_BOX('420px')}>
            {deleteCheckBusy || deleteUserCount === null ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Checking role…</div>
              </div>
            ) : deleteUserCount > 0 ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
                  <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>Cannot Delete Role</h2>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 12px', lineHeight: 1.6 }}>
                    <strong style={{ color: '#111827' }}>{deleteUserCount}</strong>{' '}
                    user{deleteUserCount !== 1 ? 's are' : ' is'} currently assigned to{' '}
                    <strong style={{ color: '#111827' }}>{deleteName}</strong>.
                    You cannot delete this role while users are assigned to it.
                    Please reassign those users first.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button onClick={closeDeleteDialog} style={{ ...BTN_PRIMARY, justifyContent: 'center' }}>
                    OK, Got It
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
                  <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>Delete Role?</h2>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                    Are you sure you want to delete{' '}
                    <strong style={{ color: '#111827' }}>{deleteName}</strong>?
                    This action cannot be undone.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={closeDeleteDialog} style={{ ...BTN_GHOST, padding: '9px 20px' }} disabled={deleteBusy}>Cancel</button>
                  <button
                    onClick={handleDelete}
                    style={{ padding: '9px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: deleteBusy ? 0.7 : 1 }}
                    disabled={deleteBusy}
                  >
                    {deleteBusy ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permsRoleId && (
        <RolePermissionsModal
          roleId={permsRoleId}
          roleName={permsRoleName}
          onClose={() => setPermsRoleId(null)}
        />
      )}
    </div>
  );
};

export default RolesTab;

// ── RolePermissionsModal ───────────────────────────────────────────────────────

interface PermsModalProps {
  roleId: string;
  roleName: string;
  onClose: () => void;
}

const PERM_CATEGORIES = ['USERS', 'REPORTS', 'SETTINGS', 'ORGANIZATION', 'LEARNERS', 'COURSES', 'ADMIN'];

const CATEGORY_LABEL: Record<string, string> = {
  USERS: 'User Management', REPORTS: 'Reports', SETTINGS: 'Settings',
  ORGANIZATION: 'Organization', LEARNERS: 'Learners', COURSES: 'Courses', ADMIN: 'Admin',
};

const CATEGORY_COLOR: Record<string, { bg: string; color: string; icon: string }> = {
  USERS:        { bg: '#eff6ff', color: '#1d4ed8', icon: '👤' },
  REPORTS:      { bg: '#f5f3ff', color: '#6d28d9', icon: '📊' },
  SETTINGS:     { bg: '#fff7ed', color: '#c2410c', icon: '⚙️' },
  ORGANIZATION: { bg: '#f0fdf4', color: '#15803d', icon: '🏢' },
  LEARNERS:     { bg: '#ecfeff', color: '#0e7490', icon: '🎓' },
  COURSES:      { bg: '#fdf2f8', color: '#be185d', icon: '📚' },
  ADMIN:        { bg: '#fff1f2', color: '#be123c', icon: '🛡️' },
};

const RolePermissionsModal: React.FC<PermsModalProps> = ({ roleId, roleName, onClose }) => {
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [permsRes, rolePermsRes] = await Promise.all([
          rolesPermissionsAPI.getPermissions({ limit: 200 }),
          rolesPermissionsAPI.getRolePermissions(roleId),
        ]);
        if (!cancelled) {
          setAllPerms(permsRes.data ?? []);
          setSelected(new Set((rolePermsRes.data ?? []).map((p) => p.id)));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load permissions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [roleId, tick]);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('permissionsUpdated', refresh);
    return () => window.removeEventListener('permissionsUpdated', refresh);
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      await rolesPermissionsAPI.assignPermissionsToRole(roleId, [...selected]);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('permissionsUpdated'));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions.');
    } finally {
      setBusy(false);
    }
  }

  const byCategory = PERM_CATEGORIES.reduce<Record<string, Permission[]>>((acc, cat) => {
    acc[cat] = allPerms.filter((p) => p.category === cat);
    return acc;
  }, {});

  const rs = roleStyle(roleName);

  return (
    <div style={MODAL_OVERLAY}>
      <div style={{ ...MODAL_BOX('580px'), display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: rs.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            {rs.icon}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Manage Permissions</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Role: <strong style={{ color: '#374151' }}>{roleName}</strong> · {selected.size} permission{selected.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        {/* Select All shortcut */}
        {!loading && allPerms.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '4px' }}>
            <button
              onClick={() => setSelected(new Set(allPerms.map((p) => p.id)))}
              style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '20px', cursor: 'pointer', backgroundColor: 'white', color: '#374151' }}
            >
              Select All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '20px', cursor: 'pointer', backgroundColor: 'white', color: '#374151' }}
            >
              Clear All
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', margin: '12px 0', fontSize: '14px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontSize: '13px' }}>Loading permissions…</div>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', maxHeight: '420px', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '12px' }}>
            {PERM_CATEGORIES.map((cat) => {
              const perms = byCategory[cat];
              if (!perms.length) return null;
              const cc = CATEGORY_COLOR[cat] ?? { bg: '#f9fafb', color: '#374151', icon: '🔹' };
              return (
                <div key={cat}>
                  <div style={{ padding: '8px 14px', backgroundColor: cc.bg, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span>{cc.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: cc.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: cc.color, opacity: 0.7 }}>
                      {perms.filter((p) => selected.has(p.id)).length}/{perms.length}
                    </span>
                  </div>
                  {perms.map((perm) => {
                    const isChecked = selected.has(perm.id);
                    return (
                      <label key={perm.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', backgroundColor: isChecked ? '#f8faff' : 'white' }}>
                        <input
                          type="checkbox" checked={isChecked}
                          onChange={() => toggle(perm.id)}
                          style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '14px', color: '#111827' }}>{perm.name}</div>
                          {perm.description && (
                            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{perm.description}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            {allPerms.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔒</div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>No permissions yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Add permissions in the Permissions tab first.</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={BTN_GHOST} disabled={busy}>Cancel</button>
          <button onClick={handleSave} style={{ ...BTN_PRIMARY, opacity: busy ? 0.7 : 1, justifyContent: 'center' }} disabled={busy || loading}>
            {busy ? 'Saving…' : '✓ Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};
