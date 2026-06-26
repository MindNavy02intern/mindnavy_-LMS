import { useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import { getRolesPageList } from '../../api/rolesPage';
import type { RolePage } from '../../types/rolesPage';
import {
  getRoleTemplateDetails,
  applyRoleTemplate,
  RoleTemplateError,
} from '../../api/roleTemplates';
import type { RoleTemplatePermission } from '../../api/roleTemplates';

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#374151', background: '#ffffff',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

function focusIn(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.15)';
}
function focusOut(e: React.FocusEvent<HTMLSelectElement>) {
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

interface Props {
  templateId:   string;
  templateName: string;
  onClose:      () => void;
  onSuccess:    () => void;
  showToast:    (type: ToastType, message: string) => void;
}

export default function ApplyRoleTemplateModal({ templateId, templateName, onClose, onSuccess, showToast }: Props) {
  // Template's own permission bundle, fetched fresh regardless of whether the
  // card was already expanded — keeps this modal self-contained.
  const [permissions,    setPermissions]    = useState<RoleTemplatePermission[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError,   setDetailsError]   = useState<string | null>(null);

  // Role picker
  const [roles,        setRoles]        = useState<RolePage[]>([]);
  const [rolesLoading,  setRolesLoading] = useState(true);
  const [rolesError,    setRolesError]   = useState<string | null>(null);
  const [roleId,        setRoleId]       = useState('');

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setDetailsLoading(true); setDetailsError(null); })();
    getRoleTemplateDetails(templateId)
      .then(d => { if (!cancelled) setPermissions(d.permissions); })
      .catch(() => { if (!cancelled) setDetailsError('Failed to load template permissions.'); })
      .finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [templateId]);

  useEffect(() => {
    let cancelled = false;
    (() => { setRolesLoading(true); setRolesError(null); })();
    getRolesPageList({ page: 1, limit: 200, search: '', status: '' })
      .then(res => { if (!cancelled) setRoles(res.data); })
      .catch(() => { if (!cancelled) setRolesError('Failed to load roles.'); })
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const grouped = permissions.reduce<Record<string, RoleTemplatePermission[]>>((acc, perm) => {
    const cat = perm.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!roleId) { setServerError('Select a role to apply this template to.'); return; }

    setSubmitting(true);
    try {
      const result = await applyRoleTemplate(templateId, roleId);
      const roleName = roles.find(r => r.id === roleId)?.name ?? 'the selected role';
      if (result.applied === 0) {
        showToast('success', `${templateName} is already fully applied to ${roleName} — no new permissions added.`);
      } else {
        showToast('success', `Applied ${result.applied} permission${result.applied !== 1 ? 's' : ''} from ${templateName} to ${roleName}.`);
      }
      // Apply changes an existing role's permissions — every other component
      // reading role/permission data (Permission Matrix, Role Details
      // Drawer, etc.) needs to know. It does NOT touch any user, so no
      // userDataChanged.
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      onSuccess();
    } catch (err) {
      if (err instanceof RoleTemplateError) {
        // 404 covers both "template not found" and "role not found" — the
        // backend's own message already distinguishes which.
        setServerError(err.message);
        showToast('error', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to apply template';
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
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Apply Template</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              Apply "{templateName}" to a role.
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

        <form onSubmit={handleApply}>
          {/* ── Role picker ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="Apply To" />
            <label style={LABEL}>Role <span style={{ color: '#ef4444' }}>*</span></label>
            {rolesError ? (
              <div style={{ color: '#b91c1c', fontSize: 12 }}>{rolesError}</div>
            ) : (
              <select
                value={roleId}
                onChange={e => { setRoleId(e.target.value); setServerError(null); }}
                disabled={rolesLoading}
                style={{ ...INPUT, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="">{rolesLoading ? 'Loading roles…' : 'Select a role…'}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>

          {/* ── Permission preview ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title={`Permissions in this template${!detailsLoading ? ` (${permissions.length})` : ''}`} />

            {detailsLoading && (
              <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>Loading permissions…</div>
            )}
            {!detailsLoading && detailsError && (
              <div style={{ color: '#b91c1c', fontSize: 12, padding: '8px 0' }}>{detailsError}</div>
            )}
            {!detailsLoading && !detailsError && permissions.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>This template has no permissions.</div>
            )}
            {!detailsLoading && !detailsError && permissions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {Object.entries(grouped).map(([category, perms]) => (
                  <div key={category}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>
                      {category}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {perms.map(p => (
                        <span
                          key={p.id}
                          title={p.description ?? undefined}
                          style={{
                            fontSize: 11, color: '#374151', background: '#f3f4f6',
                            border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 7px',
                          }}
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
              disabled={submitting || rolesLoading}
              style={{
                padding: '8px 20px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600,
                background: submitting ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: 7,
                cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff',
              }}
            >
              {submitting ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
