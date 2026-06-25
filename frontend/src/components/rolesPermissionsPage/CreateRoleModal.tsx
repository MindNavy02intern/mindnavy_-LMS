import { useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type { RolePage, Permission, CreateRolePagePayload, RoleStatus } from '../../types/rolesPage';
import {
  createRolePage,
  updateRolePage,
  assignRolePermissions,
  getRolePermissions,
  getAllPermissions,
  RolesPageError,
} from '../../api/rolesPage';

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

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
  editRole?: RolePage | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateRoleModal({ onClose, onSuccess, showToast, editRole }: Props) {
  const isEdit = Boolean(editRole);

  // Basic fields
  const [name,        setName]        = useState(editRole?.name ?? '');
  const [description, setDescription] = useState(editRole?.description ?? '');
  const [status,      setStatus]      = useState<RoleStatus>(editRole?.status ?? 'ACTIVE');

  // Permissions
  const [allPermissions,  setAllPermissions]  = useState<Permission[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [permsLoading,    setPermsLoading]    = useState(true);
  const [permsError,      setPermsError]      = useState<string | null>(null);

  // Form state
  const [nameError,   setNameError]   = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  // ── Load permissions on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (() => { setPermsLoading(true); setPermsError(null); })();

    const fetchAll = async () => {
      try {
        const [perms, existingPerms] = await Promise.all([
          getAllPermissions(),
          isEdit && editRole ? getRolePermissions(editRole.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setAllPermissions(perms);
        setSelectedPermIds(new Set((existingPerms as Permission[]).map(p => p.id)));
      } catch {
        if (!cancelled) setPermsError('Failed to load permissions');
      } finally {
        if (!cancelled) setPermsLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [isEdit, editRole]);

  // ── Permission toggles ────────────────────────────────────────────────────
  function togglePerm(id: string) {
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCategory(ids: string[]) {
    const allSelected = ids.every(id => selectedPermIds.has(id));
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  // ── Group permissions by category ─────────────────────────────────────────
  const grouped = allPermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const cat = perm.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!name.trim()) { setNameError('Role name is required.'); return; }
    setNameError(null);

    const payload: CreateRolePagePayload = {
      name:        name.trim(),
      description: description.trim() || null,
      status,
    };

    setSubmitting(true);
    try {
      let roleId: string;

      if (isEdit && editRole) {
        await updateRolePage(editRole.id, payload);
        roleId = editRole.id;
        showToast('success', 'Role updated successfully');
      } else {
        const newRole = await createRolePage(payload);
        roleId = newRole.id;
        showToast('success', 'Role created successfully');
      }

      // Assign permissions if any selected
      if (selectedPermIds.size > 0) {
        await assignRolePermissions(roleId, Array.from(selectedPermIds));
      }

      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      onSuccess();
    } catch (err) {
      if (err instanceof RolesPageError && err.status === 409) {
        const msg = 'A role with this name already exists.';
        setServerError(msg);
        showToast('error', msg);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save role';
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
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 700, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        marginTop: 'auto', marginBottom: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
              {isEdit ? 'Edit Role' : 'Create Role'}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              {isEdit ? 'Update role details and permissions.' : 'Define a new role and assign permissions.'}
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
          {/* ── Section 1: Basic Info ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Basic Information" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Role Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={LABEL}>Role Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError(null); }}
                  placeholder="e.g. Content Manager"
                  style={{ ...INPUT, borderColor: nameError ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {nameError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{nameError}</div>}
              </div>

              {/* Description */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={LABEL}>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What this role can do…"
                  rows={2}
                  style={{ ...INPUT, resize: 'vertical', minHeight: 60, verticalAlign: 'top', lineHeight: 1.5 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
              </div>

              {/* Status */}
              <div>
                <label style={LABEL}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as RoleStatus)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Permissions ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Permissions" />

            {permsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'rp-spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
                Loading permissions…
              </div>
            )}

            {!permsLoading && permsError && (
              <div style={{ color: '#b91c1c', fontSize: 12, padding: '8px 0' }}>{permsError}</div>
            )}

            {!permsLoading && !permsError && allPermissions.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>No permissions found in the system.</div>
            )}

            {!permsLoading && !permsError && allPermissions.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(grouped).map(([category, perms]) => {
                  const permIds = perms.map(p => p.id);
                  const allSelected = permIds.every(id => selectedPermIds.has(id));
                  return (
                    <div
                      key={category}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}
                    >
                      {/* Category header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', background: '#f8fafc',
                        borderBottom: '1px solid #e5e7eb',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {category}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCategory(permIds)}
                          style={{
                            fontSize: 10, padding: '2px 7px',
                            border: '1px solid #d1d5db', borderRadius: 4,
                            cursor: 'pointer', background: allSelected ? '#dbeafe' : 'white',
                            color: allSelected ? '#1d4ed8' : '#6b7280', fontFamily: 'inherit',
                          }}
                        >
                          {allSelected ? 'Clear' : 'All'}
                        </button>
                      </div>
                      {/* Permission checkboxes */}
                      <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {perms.map(perm => {
                          const checked = selectedPermIds.has(perm.id);
                          return (
                            <label
                              key={perm.id}
                              title={perm.description ?? undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 11, color: '#374151', cursor: 'pointer',
                                padding: '2px 6px', borderRadius: 4,
                                background: checked ? '#eff6ff' : 'transparent',
                                border: `1px solid ${checked ? '#bfdbfe' : 'transparent'}`,
                                userSelect: 'none',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(perm.id)}
                                style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                              />
                              {perm.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
              {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Role')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
