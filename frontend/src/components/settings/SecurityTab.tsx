// Security tab (?tab=security).
//
// Every control here reflects what the backend actually enforces
// (settings.service.js getSecurityPolicy): minimum password length (12 is the
// built-in floor — the setting can only raise it), the inactivity session
// timeout, and the failed-login lockout. Rules the backend always applies are
// shown locked on; features it doesn't enforce yet are marked Coming soon
// rather than offered as switches that do nothing.

import { useCallback, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, BTN_SECONDARY, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

// Mirrors backend utils/passwordPolicy.js PASSWORD_MIN_LENGTH_FLOOR.
const PASSWORD_MIN_LENGTH_FLOOR = 12;

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function SecurityTab({ settings, onSaved, showToast }: Props) {
  // A stored value below the floor (the old default was 8) is never what's
  // enforced — show and save the effective minimum instead.
  const [passwordMinLength, setPasswordMinLength] = useState(
    String(Math.max(PASSWORD_MIN_LENGTH_FLOOR, settings.passwordMinLength)),
  );
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(String(settings.sessionTimeoutMinutes));
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(String(settings.maxLoginAttempts));
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        passwordMinLength: Math.max(PASSWORD_MIN_LENGTH_FLOOR, Number(passwordMinLength) || 0),
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 60,
        maxLoginAttempts: Number(maxLoginAttempts) || 5,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'security' });
      onSaved(updated);
      showToast('success', 'Security settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save security settings.');
    } finally {
      setSubmitting(false);
    }
  }, [passwordMinLength, sessionTimeoutMinutes, maxLoginAttempts, onSaved, showToast]);

  useSaveAllListener(handleSave);

  function handleTestConfig() {
    setTestResult(
      `Password policy: min ${passwordMinLength} chars, uppercase, lowercase, number and symbol required. ` +
      `Sessions end after ${sessionTimeoutMinutes} min of inactivity (max 24h per sign-in). ` +
      `Accounts lock for 15 min after ${maxLoginAttempts} failed logins.`
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Password Policy">
        <FormGrid>
          <Field label="Minimum Length" hint={`At least ${PASSWORD_MIN_LENGTH_FLOOR} — raise it for a stricter policy.`}>
            <input style={FULL_INPUT} type="number" min={PASSWORD_MIN_LENGTH_FLOOR} max={64} value={passwordMinLength} onChange={e => setPasswordMinLength(e.target.value)} />
          </Field>
        </FormGrid>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <ToggleRow label="Require Uppercase & Lowercase" checked onChange={() => {}} disabled disabledHint="Always required" />
          <ToggleRow label="Require Numbers" checked onChange={() => {}} disabled disabledHint="Always required" />
          <ToggleRow label="Require Symbols" checked onChange={() => {}} disabled disabledHint="Always required" />
        </div>
      </Card>

      <Card title="Session & Login">
        <FormGrid>
          <Field label="Session Timeout (minutes)" hint="Signs out after this long without activity. Sessions never last more than 24h.">
            <input style={FULL_INPUT} type="number" min={5} max={1440} value={sessionTimeoutMinutes} onChange={e => setSessionTimeoutMinutes(e.target.value)} />
          </Field>
          <Field label="Max Login Attempts" hint="Failed logins allowed before a 15-minute lockout.">
            <input style={FULL_INPUT} type="number" min={3} max={20} value={maxLoginAttempts} onChange={e => setMaxLoginAttempts(e.target.value)} />
          </Field>
        </FormGrid>
        <div style={{ marginTop: 16 }}>
          <ToggleRow label={<>Org-Wide MFA Enforcement <ComingSoonBadge /></>} description="Require every admin to enroll in TOTP MFA. Individual admins can already enable it for their own account under Profile > Security." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="IP Restriction">
        <ToggleRow label={<>Restrict Admin Access by IP <ComingSoonBadge /></>} description="Limit admin sign-in to listed IP ranges. Not enforced yet." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
      </Card>

      <Card title="Test Configuration">
        <button type="button" style={BTN_SECONDARY} onClick={handleTestConfig}>
          <ShieldCheck size={15} strokeWidth={2} />
          Test Security Config
        </button>
        {testResult && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12.5, color: '#0369a1' }}>
            {testResult}
          </div>
        )}
      </Card>

      <SaveBar submitting={submitting} label="Save Security Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
