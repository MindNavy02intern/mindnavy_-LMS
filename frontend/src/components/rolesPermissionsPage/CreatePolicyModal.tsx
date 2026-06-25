import { useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import { rolesPermissionsAPI } from '../../api/rolesPermissions';
import type { Role } from '../../types/rolesPermissions';
import {
  createAccessPolicy,
  updateAccessPolicy,
  AccessPolicyError,
} from '../../api/accessPoliciesPage';
import type {
  AccessPolicy,
  PolicyResource,
  PolicyAction,
  PolicyEffect,
  PolicyStatus,
} from '../../api/accessPoliciesPage';

// ── Static option lists ──────────────────────────────────────────────────────

const RESOURCE_OPTIONS: PolicyResource[] = ['USERS', 'REPORTS', 'SETTINGS', 'ORGANIZATION', 'LEARNERS', 'COURSES', 'ADMIN'];
const ACTION_OPTIONS:   PolicyAction[]   = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'MANAGE', 'EXPORT'];

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
  onClose:     () => void;
  onSuccess:   () => void;
  showToast:   (type: ToastType, message: string) => void;
  editPolicy?: AccessPolicy | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreatePolicyModal({ onClose, onSuccess, showToast, editPolicy }: Props) {
  const isEdit = Boolean(editPolicy);

  // Basic info
  const [name,        setName]        = useState(editPolicy?.name ?? '');
  const [description, setDescription] = useState(editPolicy?.description ?? '');
  const [status,      setStatus]      = useState<PolicyStatus>(editPolicy?.status ?? 'ACTIVE');

  // Policy rule
  const [resource, setResource] = useState<PolicyResource | ''>(editPolicy?.resource ?? '');
  const [action,   setAction]   = useState<PolicyAction   | ''>(editPolicy?.action   ?? '');
  const [effect,   setEffect]   = useState<PolicyEffect>(editPolicy?.effect ?? 'ALLOW');
  const [priority, setPriority] = useState(editPolicy?.priority ?? 0);

  // Scope
  const [roleId,      setRoleId]      = useState(editPolicy?.roleId ?? '');
  const [roles,        setRoles]        = useState<Role[]>([]);
  const [rolesLoading,  setRolesLoading] = useState(true);

  // Form state
  const [errors,      setErrors]      = useState<{ name?: string; resource?: string; action?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    rolesPermissionsAPI.getRoles({ limit: 200 })
      .then(res => { if (!cancelled) setRoles(res.data ?? []); })
      .catch(() => { /* role list is optional scope — fail quietly, dropdown just stays empty */ })
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Policy name is required.';
    if (!resource)     errs.resource = 'Resource is required.';
    if (!action)       errs.action   = 'Action is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    const payload = {
      name:        name.trim(),
      description: description.trim() || null,
      resource:    resource as PolicyResource,
      action:      action as PolicyAction,
      effect,
      status,
      priority,
      roleId:      roleId || null,
    };

    setSubmitting(true);
    try {
      if (isEdit && editPolicy) {
        await updateAccessPolicy(editPolicy.id, payload);
        showToast('success', 'Policy updated successfully');
      } else {
        await createAccessPolicy(payload);
        showToast('success', 'Policy created successfully');
      }
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      onSuccess();
    } catch (err) {
      if (err instanceof AccessPolicyError) {
        if (err.status === 409) {
          setErrors(prev => ({ ...prev, name: 'A policy with this name already exists.' }));
          setServerError('A policy with this name already exists.');
        } else if (err.status === 404) {
          setServerError('Role not found.');
        } else {
          setServerError(err.message);
        }
        showToast('error', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save policy';
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
              {isEdit ? 'Edit Policy' : 'Create Policy'}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              {isEdit ? 'Update this access policy.' : 'Define a new access control policy.'}
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
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="Basic Information" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={LABEL}>Policy Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={name}
                  maxLength={100}
                  onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })); }}
                  placeholder="e.g. Restrict report exports"
                  style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
              </div>

              <div>
                <label style={LABEL}>Description</label>
                <textarea
                  value={description}
                  maxLength={500}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What this policy controls…"
                  rows={2}
                  style={{ ...INPUT, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
              </div>

              <div>
                <label style={LABEL}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as PolicyStatus)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Policy Rule ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="Policy Rule" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={LABEL}>Resource <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={resource}
                  onChange={e => { setResource(e.target.value as PolicyResource); setErrors(prev => ({ ...prev, resource: undefined })); }}
                  style={{ ...INPUT, cursor: 'pointer', borderColor: errors.resource ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="">Select resource…</option>
                  {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.resource && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.resource}</div>}
              </div>

              <div>
                <label style={LABEL}>Action <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={action}
                  onChange={e => { setAction(e.target.value as PolicyAction); setErrors(prev => ({ ...prev, action: undefined })); }}
                  style={{ ...INPUT, cursor: 'pointer', borderColor: errors.action ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  <option value="">Select action…</option>
                  {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {errors.action && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.action}</div>}
              </div>

              <div>
                <label style={LABEL}>Effect <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEffect('ALLOW')}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                      borderRadius: 7, cursor: 'pointer',
                      background: effect === 'ALLOW' ? '#f0fdf4' : '#f9fafb',
                      border: effect === 'ALLOW' ? '2px solid #16a34a' : '1px solid #e5e7eb',
                      color: effect === 'ALLOW' ? '#16a34a' : '#6b7280',
                    }}
                  >
                    ✅ Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => setEffect('DENY')}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                      borderRadius: 7, cursor: 'pointer',
                      background: effect === 'DENY' ? '#fef2f2' : '#f9fafb',
                      border: effect === 'DENY' ? '2px solid #dc2626' : '1px solid #e5e7eb',
                      color: effect === 'DENY' ? '#dc2626' : '#6b7280',
                    }}
                  >
                    ❌ Deny
                  </button>
                </div>
              </div>

              <div>
                <label style={LABEL}>Priority</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={priority}
                  onChange={e => setPriority(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                  style={{ ...INPUT, cursor: 'text' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 3 }}>Higher = evaluated first</div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Scope ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Scope (optional)" />
            <div>
              <label style={LABEL}>Apply to Role</label>
              <select
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                disabled={rolesLoading}
                style={{ ...INPUT, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="">{rolesLoading ? 'Loading roles…' : 'All Roles (no restriction)'}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
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
              {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Policy')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
