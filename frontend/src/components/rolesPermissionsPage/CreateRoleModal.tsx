import { useState } from 'react';
import type { ToastType } from '../users/Toast';
import type {
  RolePage,
  RoleLevel,
  AccessScope,
  RiskClassification,
  CreateRolePagePayload,
  PermissionsByCategory,
} from '../../types/rolesPage';
import { createRolePage, updateRolePage } from '../../api/rolesPage';

// ── Permission categories ──────────────────────────────────────────────────────

const PERM_CATEGORIES: { key: string; label: string; actions: string[] }[] = [
  { key: 'USERS',           label: 'Users',           actions: ['View', 'Create', 'Edit', 'Delete', 'Manage', 'Export'] },
  { key: 'COURSES',         label: 'Courses',         actions: ['View', 'Create', 'Edit', 'Delete', 'Publish', 'Approve'] },
  { key: 'LEARNING_PATHS',  label: 'Learning Paths',  actions: ['View', 'Create', 'Edit', 'Delete', 'Assign'] },
  { key: 'LIVE_SESSIONS',   label: 'Live Sessions',   actions: ['View', 'Create', 'Manage', 'Moderate'] },
  { key: 'QUIZZES',         label: 'Quizzes',         actions: ['View', 'Create', 'Edit', 'Delete', 'Approve'] },
  { key: 'CERTIFICATES',    label: 'Certificates',    actions: ['View', 'Create', 'Issue', 'Revoke'] },
  { key: 'FINANCE',         label: 'Finance',         actions: ['View', 'Manage', 'Approve', 'Export'] },
  { key: 'REPORTS',         label: 'Reports',         actions: ['View', 'Create', 'Export'] },
  { key: 'ANALYTICS',       label: 'Analytics',       actions: ['View', 'Export'] },
  { key: 'NOTIFICATIONS',   label: 'Notifications',   actions: ['View', 'Create', 'Send'] },
  { key: 'SECURITY',        label: 'Security',        actions: ['View', 'Manage'] },
  { key: 'SYSTEM_SETTINGS', label: 'System Settings', actions: ['View', 'Manage'] },
];

const ROLE_LEVELS:   RoleLevel[]          = ['System', 'Department', 'Branch', 'Functional', 'Default'];
const ACCESS_SCOPES: AccessScope[]        = ['Global', 'Department', 'Branch', 'Course'];
const RISK_LEVELS:   RiskClassification[] = ['Low', 'Medium', 'High', 'Critical'];

function initPermissions(): PermissionsByCategory {
  return Object.fromEntries(PERM_CATEGORIES.map(c => [c.key, []]));
}

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

  // Basic Info
  const [name,        setName]        = useState(editRole?.name ?? '');
  const [description, setDescription] = useState(editRole?.description ?? '');
  const [level,       setLevel]       = useState<RoleLevel>(editRole?.level ?? 'Functional');
  const [risk,        setRisk]        = useState<RiskClassification>(editRole?.riskClassification ?? 'Low');
  const [priority,    setPriority]    = useState<number>(editRole?.priority ?? 3);

  // Scope
  const [scope,        setScope]       = useState<AccessScope>(editRole?.scope ?? 'Global');
  const [deptScope,    setDeptScope]   = useState(editRole?.departmentScope ?? '');
  const [branchScope,  setBranchScope] = useState(editRole?.branchScope ?? '');

  // Permissions
  const [permissions, setPermissions] = useState<PermissionsByCategory>(initPermissions);

  // State
  const [nameError,   setNameError]   = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  function toggleAction(catKey: string, action: string) {
    setPermissions(prev => {
      const curr = prev[catKey] ?? [];
      const next = curr.includes(action)
        ? curr.filter(a => a !== action)
        : [...curr, action];
      return { ...prev, [catKey]: next };
    });
  }

  function toggleCategory(catKey: string, actions: string[]) {
    setPermissions(prev => {
      const curr     = prev[catKey] ?? [];
      const allSelected = actions.every(a => curr.includes(a));
      return { ...prev, [catKey]: allSelected ? [] : [...actions] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!name.trim()) { setNameError('Role name is required.'); return; }
    setNameError(null);

    const payload: CreateRolePagePayload = {
      name:               name.trim(),
      description:        description.trim() || null,
      level,
      riskClassification: risk,
      priority,
      scope,
      departmentScope:    scope === 'Department' ? (deptScope.trim() || null) : null,
      branchScope:        scope === 'Branch'     ? (branchScope.trim() || null) : null,
      permissions,
    };

    setSubmitting(true);
    try {
      if (isEdit && editRole) {
        await updateRolePage(editRole.id, payload);
        showToast('success', 'Role updated successfully');
      } else {
        await createRolePage(payload);
        showToast('success', 'Role created successfully');
      }
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save role';
      setServerError(msg);
      showToast('error', msg);
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
              {isEdit ? 'Update role details and permissions.' : 'Define a new role with scope and permissions.'}
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

              {/* Role Level */}
              <div>
                <label style={LABEL}>Role Level <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value as RoleLevel)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Risk Classification */}
              <div>
                <label style={LABEL}>Risk Classification</label>
                <select
                  value={risk}
                  onChange={e => setRisk(e.target.value as RiskClassification)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={LABEL}>Priority Level</label>
                <select
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {[1, 2, 3, 4, 5].map(p => (
                    <option key={p} value={p}>{p} {p === 1 ? '(Lowest)' : p === 5 ? '(Highest)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Scope ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Access Scope" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={LABEL}>Access Scope</label>
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value as AccessScope)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {ACCESS_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {scope === 'Department' && (
                <div>
                  <label style={LABEL}>Department</label>
                  <input
                    type="text"
                    value={deptScope}
                    onChange={e => setDeptScope(e.target.value)}
                    placeholder="e.g. Engineering"
                    style={INPUT}
                    onFocus={focusIn} onBlur={focusOut}
                  />
                </div>
              )}

              {scope === 'Branch' && (
                <div>
                  <label style={LABEL}>Branch</label>
                  <input
                    type="text"
                    value={branchScope}
                    onChange={e => setBranchScope(e.target.value)}
                    placeholder="e.g. Riyadh Branch"
                    style={INPUT}
                    onFocus={focusIn} onBlur={focusOut}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Permissions ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Permissions" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PERM_CATEGORIES.map(cat => {
                const selected = permissions[cat.key] ?? [];
                const allSelected = cat.actions.every(a => selected.includes(a));
                return (
                  <div
                    key={cat.key}
                    style={{
                      border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                    }}
                  >
                    {/* Category header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', background: '#f8fafc',
                      borderBottom: '1px solid #e5e7eb',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        {cat.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.key, cat.actions)}
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
                    {/* Actions */}
                    <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {cat.actions.map(action => {
                        const checked = selected.includes(action);
                        return (
                          <label
                            key={action}
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
                              onChange={() => toggleAction(cat.key, action)}
                              style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            {action}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
              {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Role')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
