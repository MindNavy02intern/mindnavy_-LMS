import { useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import { getSystemSettings, updateSystemSettings } from '../../services/settingsApi';

export default function RolesSettingsTab({ showToast }: { showToast: (type: ToastType, message: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleInheritanceEnabled, setRoleInheritanceEnabled] = useState(false);
  const [maxRolesPerUser, setMaxRolesPerUser] = useState(3);

  useEffect(() => {
    let cancelled = false;
    getSystemSettings()
      .then(s => {
        if (cancelled) return;
        setRoleInheritanceEnabled(s.roleInheritanceEnabled);
        setMaxRolesPerUser(s.maxRolesPerUser);
      })
      .catch(() => showToast('error', 'Failed to load role settings.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSystemSettings({ roleInheritanceEnabled, maxRolesPerUser });
      showToast('success', 'Role settings saved.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save role settings.');
    } finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Roles & Permissions Settings</div>
      <div style={{ fontSize: 11.5, color: '#6b7280', marginBottom: 18 }}>Org-wide policy for how roles combine and how many a single user can hold</div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={roleInheritanceEnabled} onChange={e => setRoleInheritanceEnabled(e.target.checked)} style={{ accentColor: '#2563eb' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Enable role inheritance</div>
          <div style={{ fontSize: 11.5, color: '#6b7280' }}>When on, a user assigned multiple roles inherits the union of their permissions instead of only the primary role's.</div>
        </div>
      </label>

      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Max roles per user</label>
      <input type="number" min={1} max={20} value={maxRolesPerUser} onChange={e => setMaxRolesPerUser(Number(e.target.value))}
        style={{ width: 100, padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 20 }} />

      <div>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
