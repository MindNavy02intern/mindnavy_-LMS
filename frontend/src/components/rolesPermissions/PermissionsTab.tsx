import { useState, useEffect } from 'react';
import { rolesPermissionsAPI } from '../../api/rolesPermissions';
import type { Permission } from '../../types/rolesPermissions';

// ── Category config ────────────────────────────────────────────────────────────

const PERMISSION_CATEGORIES = [
  { value: 'USERS',        label: 'User Management', icon: '👤' },
  { value: 'REPORTS',      label: 'Reports',         icon: '📊' },
  { value: 'SETTINGS',     label: 'Settings',        icon: '⚙️' },
  { value: 'ORGANIZATION', label: 'Organization',    icon: '🏢' },
  { value: 'LEARNERS',     label: 'Learners',        icon: '🎓' },
  { value: 'COURSES',      label: 'Courses',         icon: '📚' },
  { value: 'ADMIN',        label: 'Admin',           icon: '🛡️' },
];

const CAT_META: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  USERS:        { label: 'User Management', icon: '👤', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  REPORTS:      { label: 'Reports',         icon: '📊', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  SETTINGS:     { label: 'Settings',        icon: '⚙️', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  ORGANIZATION: { label: 'Organization',    icon: '🏢', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  LEARNERS:     { label: 'Learners',        icon: '🎓', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
  COURSES:      { label: 'Courses',         icon: '📚', bg: '#fdf2f8', color: '#be185d', border: '#f9a8d4' },
  ADMIN:        { label: 'Admin',           icon: '🛡️', bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
};

function catMeta(cat: string) {
  return CAT_META[cat] ?? { label: cat, icon: '🔹', bg: '#f9fafb', color: '#374151', border: '#e5e7eb' };
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

// ── PermissionsTab ─────────────────────────────────────────────────────────────

const PermissionsTab: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', category: 'USERS' });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await rolesPermissionsAPI.getPermissions({ limit: 200 });
      setPermissions(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', description: '', category: 'USERS' });
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(perm: Permission) {
    setEditingId(perm.id);
    setForm({ name: perm.name, description: perm.description ?? '', category: perm.category });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Permission name is required.'); return; }
    setFormBusy(true);
    setFormError('');
    try {
      if (editingId) {
        await rolesPermissionsAPI.updatePermission(editingId, form);
      } else {
        await rolesPermissionsAPI.createPermission(form);
      }
      setModalOpen(false);
      load();
      window.dispatchEvent(new CustomEvent('permissionsUpdated'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save permission.');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await rolesPermissionsAPI.deletePermission(deleteId);
      setDeleteId(null);
      load();
      window.dispatchEvent(new CustomEvent('permissionsUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete permission.');
      setDeleteId(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = permissions.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        <div style={{ fontSize: '14px' }}>Loading permissions…</div>
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
            type="text" placeholder="Search permissions by name…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: '32px' }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', color: '#374151', backgroundColor: 'white', cursor: 'pointer' }}
        >
          <option value="ALL">All Categories</option>
          {PERMISSION_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
          ))}
        </select>

        <button onClick={openCreate} style={BTN_PRIMARY}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Permission
        </button>
      </div>

      {/* Table or Empty State */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', backgroundColor: '#f9fafb', borderRadius: '10px', textAlign: 'center', border: '1px dashed #e5e7eb' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            {search ? 'No permissions match your search' : 'No permissions found'}
          </div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
            {search ? 'Try a different search term or category filter.' : 'Create your first permission to get started.'}
          </div>
          {!search && (
            <button onClick={openCreate} style={{ ...BTN_PRIMARY, margin: '16px auto 0', justifyContent: 'center' }}>
              + Create First Permission
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Permission</th>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Description</th>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Category</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((perm) => {
                const cm = catMeta(perm.category);
                const isHovered = hoveredId === perm.id;
                return (
                  <tr
                    key={perm.id}
                    onMouseEnter={() => setHoveredId(perm.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isHovered ? '#f8faff' : 'white', transition: 'background-color 0.1s' }}
                  >
                    {/* Permission name with lock icon */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🔐</span>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{perm.name}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td style={{ padding: '13px 16px', color: '#6b7280', fontSize: '13px' }}>
                      {perm.description || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No description</span>}
                    </td>

                    {/* Category badge with label */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                        backgroundColor: cm.bg, color: cm.color,
                        border: `1px solid ${cm.border}`,
                      }}>
                        {cm.icon} {cm.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(perm)} style={{ padding: '5px 10px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => setDeleteId(perm.id)} style={{ padding: '5px 10px', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', color: '#dc2626', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Row count footer */}
          <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#9ca3af' }}>
            Showing {filtered.length} of {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_BOX()}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {editingId ? '✏️ Edit Permission' : '➕ Create Permission'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                {editingId ? 'Update permission details below.' : 'Define a new permission for roles.'}
              </p>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fecaca' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={FIELD}>
                <label style={LABEL}>Permission Name *</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={INPUT} placeholder="e.g. View Reports"
                />
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Description</label>
                <textarea
                  value={form.description} rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="What this permission allows…"
                />
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  style={{ ...INPUT, cursor: 'pointer' }}
                >
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setModalOpen(false)} style={BTN_GHOST} disabled={formBusy}>Cancel</button>
              <button onClick={handleSave} style={{ ...BTN_PRIMARY, opacity: formBusy ? 0.7 : 1, justifyContent: 'center' }} disabled={formBusy}>
                {formBusy ? 'Saving…' : 'Save Permission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_BOX('400px')}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>Delete Permission?</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                This will also remove it from all roles. This cannot be undone.
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

export default PermissionsTab;
