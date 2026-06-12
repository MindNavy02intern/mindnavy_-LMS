import { useCallback, useEffect, useState } from 'react';
import { getHierarchySettings, updateHierarchySettings, resetHierarchySettings } from '../../api/organization';
import type { HierarchySettings } from '../../types/organization';
import { ApiError } from '../../api/users';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

type Settings = Omit<HierarchySettings, 'id' | 'createdAt' | 'updatedAt'>;

const DEFAULTS: Settings = {
  allowMultiReporting:          false,
  maxReportingLevels:           5,
  requireManagerApproval:       true,
  applyRoleBasedAccess:         true,
  departmentHeadsSeeOwnOnly:    true,
  inheritPermissionsFromParent: true,
  allowPermissionOverride:      false,
  requireApprovalForMoves:      true,
  approvalLevels:               2,
  autoApproveAfterDays:         7,
  customRules:                  '',
};

// ── Toggle row ──────────────────────────────────────────────────────────────────

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#2563eb' : '#d1d5db',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

// ── Number input row ────────────────────────────────────────────────────────────

function NumberField({ label, description, value, min, max, onChange, disabled }: { label: string; description?: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{description}</div>}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', textAlign: 'right', color: '#374151', background: disabled ? '#f9fafb' : '#fff', cursor: disabled ? 'not-allowed' : 'text', flexShrink: 0 }}
      />
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</h4>
      <div style={{ borderTop: '1px solid #f3f4f6' }}>{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HierarchySettings({ showToast }: Props) {
  const [original, setOriginal] = useState<HierarchySettings | null>(null);
  const [form,     setForm]     = useState<Settings>(DEFAULTS);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty,    setDirty]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHierarchySettings();
      setOriginal(data);
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
      setForm(rest);
      setDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm(p => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateHierarchySettings(form);
      showToast('success', res.message || 'Settings saved');
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = res.data;
      setOriginal(res.data);
      setForm(rest);
      setDirty(false);
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all hierarchy settings to defaults? This cannot be undone.')) return;
    setResetting(true);
    try {
      const res = await resetHierarchySettings();
      showToast('success', res.message || 'Settings reset to defaults');
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = res.data;
      setOriginal(res.data);
      setForm(rest);
      setDirty(false);
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Failed to reset settings');
    } finally {
      setResetting(false);
    }
  }

  function handleDiscard() {
    if (!original) return;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original;
    setForm(rest);
    setDirty(false);
  }

  const busy = saving || resetting;

  return (
    <div style={{ marginTop: 8, maxWidth: 720 }}>
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 13, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading settings…</div>
      )}

      {!loading && (
        <>
          <Section title="Reporting Structure">
            <Toggle label="Allow Multi-Reporting" description="Users can report to multiple managers simultaneously." checked={form.allowMultiReporting} onChange={v => set('allowMultiReporting', v)} disabled={busy} />
            <NumberField label="Max Reporting Levels" description="Maximum depth of the reporting hierarchy (1–20)." value={form.maxReportingLevels} min={1} max={20} onChange={v => set('maxReportingLevels', v)} disabled={busy} />
            <Toggle label="Require Manager Approval" description="Transfers and role changes require manager sign-off." checked={form.requireManagerApproval} onChange={v => set('requireManagerApproval', v)} disabled={busy} />
          </Section>

          <Section title="Access & Permissions">
            <Toggle label="Apply Role-Based Access" description="Enforce access control based on user roles." checked={form.applyRoleBasedAccess} onChange={v => set('applyRoleBasedAccess', v)} disabled={busy} />
            <Toggle label="Department Heads See Own Only" description="Department heads can only view their own department's data." checked={form.departmentHeadsSeeOwnOnly} onChange={v => set('departmentHeadsSeeOwnOnly', v)} disabled={busy} />
            <Toggle label="Inherit Permissions from Parent" description="Child nodes automatically inherit permissions from their parent." checked={form.inheritPermissionsFromParent} onChange={v => set('inheritPermissionsFromParent', v)} disabled={busy} />
            <Toggle label="Allow Permission Override" description="Admins can override inherited permissions on a per-node basis." checked={form.allowPermissionOverride} onChange={v => set('allowPermissionOverride', v)} disabled={busy} />
          </Section>

          <Section title="Approval Workflow">
            <Toggle label="Require Approval for Moves" description="Moving users between departments/teams requires approval." checked={form.requireApprovalForMoves} onChange={v => set('requireApprovalForMoves', v)} disabled={busy} />
            <NumberField label="Approval Levels" description="Number of approval levels required for org moves (1–5)." value={form.approvalLevels} min={1} max={5} onChange={v => set('approvalLevels', v)} disabled={busy || !form.requireApprovalForMoves} />
            <NumberField label="Auto-Approve After (days)" description="Pending approvals auto-approve after this many days (0 = never)." value={form.autoApproveAfterDays} min={0} max={365} onChange={v => set('autoApproveAfterDays', v)} disabled={busy || !form.requireApprovalForMoves} />
          </Section>

          <Section title="Custom Rules">
            <div style={{ padding: '14px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Custom Rules (JSON)</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Advanced configuration in JSON format. Leave blank to use defaults.</div>
              <textarea
                rows={5}
                value={form.customRules ?? ''}
                onChange={e => set('customRules', e.target.value)}
                disabled={busy}
                placeholder='{}'
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', border: '1px solid #d1d5db', borderRadius: 6, resize: 'vertical', color: '#374151', background: busy ? '#f9fafb' : '#fff', boxSizing: 'border-box' }}
              />
            </div>
          </Section>

          {original && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
              Last updated: {new Date(original.updatedAt).toLocaleString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {dirty && (
              <button onClick={handleDiscard} disabled={busy} style={{ padding: '9px 18px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#374151' }}>Discard</button>
            )}
            <button onClick={handleReset} disabled={busy} style={{ padding: '9px 18px', fontSize: 13, fontFamily: 'inherit', background: '#fff', border: '1px solid #d1d5db', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#6b7280' }}>
              {resetting ? 'Resetting…' : 'Reset to Defaults'}
            </button>
            <button onClick={handleSave} disabled={busy || !dirty} style={{ padding: '9px 22px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: busy || !dirty ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: busy || !dirty ? 'not-allowed' : 'pointer', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
