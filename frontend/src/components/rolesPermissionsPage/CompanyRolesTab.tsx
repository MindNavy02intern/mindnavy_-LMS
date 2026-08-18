import { useCallback, useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  listCompanyRoles, createCompanyRole, updateCompanyRole, deleteCompanyRole,
  getCompanyRolePermissionCatalog, RolesPermissionsExtraError,
} from '../../api/rolesPermissionsExtra';
import type { CompanyRole, CompanyRoleStatus } from '../../api/rolesPermissionsExtra';

const STATUS_BADGE: Record<CompanyRoleStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
};

function SkeletonRow() {
  return (
    <tr>
      {[160, 220, 90, 60, 90].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Create / Edit modal ──────────────────────────────────────────────────────

function CompanyRoleModal({ role, catalog, onClose, onSuccess, showToast }: {
  role: CompanyRole | null;
  catalog: string[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [status, setStatus] = useState<CompanyRoleStatus>(role?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);

  const togglePerm = (p: string) => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  async function handleSave() {
    if (!name.trim()) { showToast('error', 'Role name is required.'); return; }
    setSaving(true);
    try {
      if (role) {
        await updateCompanyRole(role.id, { name: name.trim(), description: description.trim() || null, permissions, status });
        showToast('success', 'Company role updated.');
      } else {
        await createCompanyRole({ name: name.trim(), description: description.trim() || null, permissions, status });
        showToast('success', 'Company role created.');
      }
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof RolesPermissionsExtraError ? err.message : 'Failed to save role.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 480, maxHeight: '85vh', overflowY: 'auto', padding: 22 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>{role ? 'Edit Company Role' : 'Create Company Role'}</h3>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} disabled={role?.isSystem}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 12, boxSizing: 'border-box', background: role?.isSystem ? '#f9fafb' : '#fff' }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
        <textarea value={description ?? ''} onChange={e => setDescription(e.target.value)} rows={2}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Permissions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {catalog.map(p => (
            <button key={p} type="button" onClick={() => togglePerm(p)}
              style={{
                padding: '4px 10px', borderRadius: 100, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                border: permissions.includes(p) ? '1px solid #2563eb' : '1px solid #d1d5db',
                background: permissions.includes(p) ? '#eff6ff' : '#fff',
                color: permissions.includes(p) ? '#2563eb' : '#6b7280', fontWeight: 500,
              }}>
              {p}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
        <select value={status} onChange={e => setStatus(e.target.value as CompanyRoleStatus)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 18 }}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : role ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function CompanyRolesTab({ showToast }: { showToast: (type: ToastType, message: string) => void }) {
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<CompanyRole | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    listCompanyRoles({ limit: 50 })
      .then(res => setRoles(res.data))
      .catch(() => { setRoles([]); showToast('error', 'Failed to load company roles'); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { getCompanyRolePermissionCatalog().then(setCatalog).catch(() => {}); }, []);

  const handleSuccess = () => { setCreateOpen(false); setEditRole(null); fetchList(); };

  const handleDelete = async (role: CompanyRole) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setDeletingId(role.id);
    try {
      await deleteCompanyRole(role.id);
      showToast('success', 'Company role deleted.');
      fetchList();
    } catch (err) {
      if (err instanceof RolesPermissionsExtraError && err.code === 'ROLE_HAS_USERS') {
        showToast('error', err.message);
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to delete role.');
      }
    } finally { setDeletingId(null); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Company Roles</div>
          <div style={{ fontSize: 11.5, color: '#6b7280' }}>Roles for admin console operators — distinct from LMS Roles above</div>
        </div>
        <button onClick={() => setCreateOpen(true)} style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Role
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ROLE NAME</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>PERMISSIONS</th>
              <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ADMINS</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>STATUS</th>
              <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && roles.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No company roles yet.</td></tr>
            )}
            {!loading && roles.map(role => {
              const badge = STATUS_BADGE[role.status] ?? STATUS_BADGE.INACTIVE;
              return (
                <tr key={role.id} className="rp-table-row" style={{ borderBottom: '1px solid #f3f4f6', opacity: deletingId === role.id ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{role.name}</div>
                    {role.description && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{role.description}</div>}
                    {role.isSystem && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>SYSTEM</span>}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 11.5, maxWidth: 260 }}>
                    {role.permissions.length ? role.permissions.join(', ') : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>{role.userCount}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>
                      {role.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <button className="rp-action-btn" title="Edit role" onClick={() => setEditRole(role)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {!role.isSystem && (
                        <button className="rp-action-btn danger" title="Delete role" disabled={deletingId === role.id} onClick={() => handleDelete(role)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {createOpen && <CompanyRoleModal role={null} catalog={catalog} onClose={() => setCreateOpen(false)} onSuccess={handleSuccess} showToast={showToast} />}
      {editRole && <CompanyRoleModal role={editRole} catalog={catalog} onClose={() => setEditRole(null)} onSuccess={handleSuccess} showToast={showToast} />}
    </div>
  );
}
