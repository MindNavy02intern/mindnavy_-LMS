import { useEffect, useState } from 'react';
import { getUsers } from '../../api/users';
import { getPreferences, updatePreferences } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { UserNotificationPreferences } from '../../types/notifications';
import { CARD_PAD, EMPTY, INPUT, LABEL, BTN_PRIMARY } from './shared';

interface UserOption { id: string; fullName: string; email: string }

const TOGGLES: { key: keyof UserNotificationPreferences; label: string; hint: string }[] = [
  { key: 'emailEnabled', label: 'Email', hint: 'General email notifications' },
  { key: 'pushEnabled', label: 'Push', hint: 'Browser/mobile push (requires FCM — coming soon)' },
  { key: 'smsEnabled', label: 'SMS', hint: 'Text messages (requires Twilio — coming soon)' },
  { key: 'marketingEnabled', label: 'Marketing', hint: 'Promotions and platform news' },
  { key: 'learningAlertsEnabled', label: 'Learning Alerts', hint: 'Course, assignment, and quiz updates' },
  { key: 'securityEnabled', label: 'Security', hint: 'Login and account security alerts' },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? '#2563eb' : '#e2e8f0', position: 'relative', flexShrink: 0, transition: 'background 0.15s',
      }}
      aria-pressed={on}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.15s',
      }} />
    </button>
  );
}

export default function PreferencesTab({ showToast }: { showToast: (type: 'success' | 'error', message: string) => void }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setOptions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      getUsers({ search: search.trim(), limit: 8 }).then(res => {
        if (!cancelled) setOptions(res.users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email })));
      }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  function selectUser(u: UserOption) {
    setSelected(u);
    setOptions([]);
    setSearch('');
    setLoading(true);
    getPreferences(u.id).then(setPrefs).catch(() => setPrefs(null)).finally(() => setLoading(false));
  }

  async function handleSave() {
    if (!selected || !prefs) return;
    setSaving(true);
    try {
      const updated = await updatePreferences(selected.id, {
        emailEnabled: prefs.emailEnabled, pushEnabled: prefs.pushEnabled, smsEnabled: prefs.smsEnabled,
        marketingEnabled: prefs.marketingEnabled, learningAlertsEnabled: prefs.learningAlertsEnabled,
        securityEnabled: prefs.securityEnabled, quietHoursStart: prefs.quietHoursStart, quietHoursEnd: prefs.quietHoursEnd,
      });
      setPrefs(updated);
      invalidateFor(appQueryClient, 'notificationPrefs.update');
      showToast('success', 'Preferences saved.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <div style={{ position: 'relative' }}>
        <label style={LABEL}>Search user</label>
        {selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
            <span>{selected.fullName} <span style={{ color: '#94a3b8' }}>({selected.email})</span></span>
            <button type="button" onClick={() => { setSelected(null); setPrefs(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Change</button>
          </div>
        ) : (
          <>
            <input style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" />
            {options.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                {options.map(u => (
                  <button key={u.id} type="button" onClick={() => selectUser(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                    {u.fullName} <span style={{ color: '#94a3b8' }}>({u.email})</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {loading ? <div style={EMPTY}>Loading preferences…</div> : prefs && (
        <div style={CARD_PAD}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TOGGLES.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle on={Boolean(prefs[t.key])} onChange={v => setPrefs(prev => prev ? { ...prev, [t.key]: v } : prev)} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{t.hint}</div>
                </div>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', gap: 12 }}>
              <div>
                <label style={LABEL} htmlFor="qh-start">Quiet Hours Start</label>
                <input id="qh-start" type="time" style={INPUT} value={prefs.quietHoursStart ?? ''} onChange={e => setPrefs(prev => prev ? { ...prev, quietHoursStart: e.target.value || null } : prev)} />
              </div>
              <div>
                <label style={LABEL} htmlFor="qh-end">Quiet Hours End</label>
                <input id="qh-end" type="time" style={INPUT} value={prefs.quietHoursEnd ?? ''} onChange={e => setPrefs(prev => prev ? { ...prev, quietHoursEnd: e.target.value || null } : prev)} />
              </div>
            </div>

            <button type="button" onClick={handleSave} disabled={saving} style={{ ...BTN_PRIMARY, alignSelf: 'flex-start', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {!selected && <div style={EMPTY}>Search for a user to view or edit their notification preferences</div>}
    </div>
  );
}
