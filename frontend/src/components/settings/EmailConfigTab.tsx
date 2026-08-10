// Email Configuration tab (?tab=email).
//
// Deliberate deviation from the tab spec: SMTP Host/Port/Username/Password
// are NOT rendered as editable fields here. They live in server env vars
// (SMTP_HOST/PORT/USER/PASS — see mailer.js) and the module's global rule is
// "never expose .env values — only confirm if configured", which overrides
// the tab spec's field list. Only a configured/not-configured status badge
// is shown; From Name/From Email aren't secrets so they stay DB-editable.

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowRight } from 'lucide-react';
import { updateSystemSettings, sendTestEmail } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, BTN_SECONDARY, SaveBar, StatusBadge, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function EmailConfigTab({ settings, onSaved, showToast }: Props) {
  const navigate = useNavigate();
  const [emailFromName, setEmailFromName] = useState(settings.emailFromName ?? '');
  const [emailFromEmail, setEmailFromEmail] = useState(settings.emailFromEmail ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        emailFromName: emailFromName.trim() || null,
        emailFromEmail: emailFromEmail.trim() || null,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'email' });
      onSaved(updated);
      showToast('success', 'Email settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save email settings.');
    } finally {
      setSubmitting(false);
    }
  }, [emailFromName, emailFromEmail, onSaved, showToast]);

  useSaveAllListener(handleSave);

  async function handleTestEmail() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendTestEmail(testTo.trim() || undefined);
      setTestResult(result);
      if (result.success) showToast('success', result.message);
      else showToast('error', result.message);
    } catch (err) {
      const msg = err instanceof SettingsApiError ? err.message : 'Failed to send test email.';
      setTestResult({ success: false, message: msg });
      showToast('error', msg);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card
        title="SMTP Configuration"
        action={<StatusBadge text={settings.smtpConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'} tone={settings.smtpConfigured ? 'success' : 'warn'} />}
      >
        <div style={{ fontSize: 12.5, color: '#64748b' }}>
          SMTP host, port, credentials and encryption are set via server environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE) and are never shown or editable here. Ask whoever manages the server deployment to update them.
        </div>
      </Card>

      <Card title="Sender Identity">
        <FormGrid>
          <Field label="From Name">
            <input style={FULL_INPUT} value={emailFromName} onChange={e => setEmailFromName(e.target.value)} placeholder={settings.platformName} maxLength={120} />
          </Field>
          <Field label="From Email">
            <input style={FULL_INPUT} type="email" value={emailFromEmail} onChange={e => setEmailFromEmail(e.target.value)} placeholder="no-reply@example.com" />
          </Field>
        </FormGrid>
      </Card>

      <Card title="Send Test Email">
        <div style={{ display: 'flex', gap: 8, marginBottom: testResult ? 12 : 0 }}>
          <input style={FULL_INPUT} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder={settings.contactEmail ?? 'you@example.com'} />
          <button type="button" style={{ ...BTN_SECONDARY, flexShrink: 0 }} disabled={testing} onClick={handleTestEmail}>
            <Send size={14} strokeWidth={2} />
            {testing ? 'Sending…' : 'Send Test Email'}
          </button>
        </div>
        {testResult && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12.5, background: testResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, color: testResult.success ? '#15803d' : '#b91c1c' }}>
            {testResult.message}
          </div>
        )}
      </Card>

      <Card title="Domain Verification" subtitle="DKIM/SPF and bounce handling are configured per-provider in Integrations.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/integrations')}>
          Configure in Integrations
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <SaveBar submitting={submitting} label="Save Email Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
