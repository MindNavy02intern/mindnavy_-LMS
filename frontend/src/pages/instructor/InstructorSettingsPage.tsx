import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InstructorLayout from './InstructorLayout';
import { LABEL, INPUT, BTN_PRIMARY, BTN_DANGER, ERROR_BANNER, disabledStyle } from './instructorUiKit';
import { useInstructorAuth } from '../../context/InstructorAuthContext';
import { apiInstructorChangePassword, getStoredInstructorToken } from '../../api/instructorAuth';
import {
  getMyNotificationPreferences, updateMyNotificationPreferences, InstructorNotificationsApiError,
} from '../../api/instructorNotificationsApi';
import type { NotificationPreferences } from '../../types/instructorNotifications';
import { listMySessions, revokeMySession, InstructorSessionsApiError } from '../../api/instructorSessionsApi';
import type { InstructorSession } from '../../types/instructorSessions';

// blueprint 2.12 — Password / Notification Preferences / Sessions & Devices
// are real; Two-Factor Authentication and Avatar are explicit "Coming Soon"
// placeholders per Appendix A gaps #16/#17 (no backend exists for either,
// for any actor — do not build TOTP or an upload endpoint here).

type Tab = 'password' | 'preferences' | 'sessions' | 'mfa' | 'avatar';

const TABS: { key: Tab; label: string }[] = [
  { key: 'password', label: 'Change Password' },
  { key: 'preferences', label: 'Notification Preferences' },
  { key: 'sessions', label: 'Sessions & Devices' },
  { key: 'mfa', label: 'Two-Factor Authentication' },
  { key: 'avatar', label: 'Avatar' },
];

export default function InstructorSettingsPage() {
  const [tab, setTab] = useState<Tab>('password');

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">Settings</h1>
          <p className="mn-db-welcome-sub">Password, notifications, and session management for your account</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'password' && <PasswordTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'mfa' && <ComingSoonTab title="Two-Factor Authentication" reason="TOTP-based MFA is currently admin-only — instructor parity is planned for a later phase." />}
      {tab === 'avatar' && <ComingSoonTab title="Avatar" reason="Avatar upload has no backend endpoint yet for any account type — this ships once that exists." />}
    </InstructorLayout>
  );
}

function ComingSoonTab({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="mn-db-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{title} — Coming Soon</div>
      <p style={{ fontSize: 12, color: '#94a3b8', maxWidth: 420, margin: '0 auto' }}>{reason}</p>
    </div>
  );
}

// ── Change Password ──────────────────────────────────────────────────────────────

function PasswordTab() {
  const { signOut } = useInstructorAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const policyHints = [
    { test: (s: string) => s.length >= 12, label: 'At least 12 characters' },
    { test: (s: string) => /[A-Z]/.test(s), label: 'One uppercase letter' },
    { test: (s: string) => /[a-z]/.test(s), label: 'One lowercase letter' },
    { test: (s: string) => /[0-9]/.test(s), label: 'One number' },
    { test: (s: string) => /[^A-Za-z0-9]/.test(s), label: 'One special character' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);

    if (!currentPassword) { setError('Current password is required.'); return; }
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return; }

    setSaving(true);
    try {
      const token = getStoredInstructorToken();
      if (!token) throw new Error('Not signed in.');
      const result = await apiInstructorChangePassword(token, currentPassword, newPassword);
      if (!result.success) {
        setError(result.message);
        setFieldErrors(result.errors ?? []);
        setSaving(false);
        return;
      }
      // Backend already revoked every session for this account (including
      // this one) — sign out locally and send them back to login, mirroring
      // the existing admin password-change-revokes-sessions behavior.
      await signOut();
      navigate('/instructor/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
      setSaving(false);
    }
  }

  return (
    <div className="mn-db-card" style={{ maxWidth: 420 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={ERROR_BANNER}>{error}</div>}

        <div>
          <label style={LABEL}>Current Password *</label>
          <input type="password" style={INPUT} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label style={LABEL}>New Password *</label>
          <input type="password" style={INPUT} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label style={LABEL}>Confirm New Password *</label>
          <input type="password" style={INPUT} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Password requirements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {policyHints.map((h) => {
              const met = h.test(newPassword);
              return (
                <div key={h.label} style={{ fontSize: 11, color: met ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{met ? '✓' : '○'}</span> {h.label}
                </div>
              );
            })}
          </div>
          {fieldErrors.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {fieldErrors.map((e) => <div key={e} style={{ fontSize: 11, color: '#dc2626' }}>{e}</div>)}
            </div>
          )}
        </div>

        <div>
          <button type="submit" style={disabledStyle(BTN_PRIMARY, saving)} disabled={saving}>
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
          Changing your password signs you out everywhere, including this device — you'll need to log in again.
        </p>
      </form>
    </div>
  );
}

// ── Notification Preferences ───────────────────────────────────────────────────

const PREF_TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'emailEnabled', label: 'Email', description: 'Course, session, and account updates by email' },
  { key: 'pushEnabled', label: 'Push', description: 'Browser/mobile push notifications' },
  { key: 'smsEnabled', label: 'SMS', description: 'Text message alerts' },
  { key: 'marketingEnabled', label: 'Marketing', description: 'Product news and promotions' },
  { key: 'learningAlertsEnabled', label: 'Learning Alerts', description: 'Enrollments, completions, and reviews on your courses' },
  { key: 'securityEnabled', label: 'Security', description: 'Sign-ins, password changes, and account security events' },
];

function PreferencesTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyNotificationPreferences()
      .then((p) => { setPrefs(p); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorNotificationsApiError ? err.message : 'Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs || typeof prefs[key] !== 'boolean') return;
    const next = !prefs[key];
    setSavingKey(key);
    try {
      const updated = await updateMyNotificationPreferences({ [key]: next });
      setPrefs(updated);
    } catch (err) {
      setError(err instanceof InstructorNotificationsApiError ? err.message : 'Failed to update preference.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mn-db-card" style={{ maxWidth: 520 }}>
      {error && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{error}</div>}
      {loading || !prefs ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PREF_TOGGLES.map((t) => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid #f8fafc' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(prefs[t.key])}
                aria-label={t.label}
                disabled={savingKey === t.key}
                onClick={() => toggle(t.key)}
                style={{
                  position: 'relative', width: 40, height: 22, borderRadius: 999, border: 'none', flexShrink: 0,
                  background: prefs[t.key] ? '#2563eb' : '#e5e7eb', cursor: savingKey === t.key ? 'default' : 'pointer',
                  opacity: savingKey === t.key ? 0.6 : 1, transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: prefs[t.key] ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sessions & Devices ────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<InstructorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listMySessions()
      .then((rows) => { setSessions(rows); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorSessionsApiError ? err.message : 'Failed to load sessions.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function handleRevoke(session: InstructorSession) {
    if (session.isCurrent) return;
    if (!confirm(`Sign out "${session.device}"? That device will need to log in again.`)) return;
    setBusyId(session.id);
    try {
      await revokeMySession(session.id);
      load();
    } catch (err) {
      setError(err instanceof InstructorSessionsApiError ? err.message : 'Failed to revoke session.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mn-db-card">
      {error && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
      ) : sessions.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No active sessions.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.device}
                  {s.isCurrent && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 999, padding: '2px 7px' }}>THIS DEVICE</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {s.ipAddress ?? 'Unknown IP'} · Last used {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : 'never'}
                </div>
              </div>
              {s.isCurrent ? (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Use Sign Out to end this session</span>
              ) : (
                <button type="button" disabled={busyId === s.id} style={disabledStyle(BTN_DANGER, busyId === s.id)} onClick={() => handleRevoke(s)}>
                  {busyId === s.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
