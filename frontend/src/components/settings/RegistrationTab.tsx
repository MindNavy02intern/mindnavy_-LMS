// User Registration tab (?tab=registration).

import { useCallback, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError, REGISTRATION_MODES, type RegistrationMode } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, Field, FULL_INPUT, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

const MODE_LABELS: Record<RegistrationMode, { label: string; hint: string }> = {
  OPEN: { label: 'Open', hint: 'Anyone can sign up freely.' },
  INVITE_ONLY: { label: 'Invite Only', hint: 'New users need an invitation link.' },
  APPROVAL_REQUIRED: { label: 'Approval Required', hint: 'Admin must approve every new signup.' },
};

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function RegistrationTab({ settings, onSaved, showToast }: Props) {
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(settings.registrationMode);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(settings.emailVerificationRequired);
  const [defaultUserRole, setDefaultUserRole] = useState(settings.defaultUserRole);
  const [domains, setDomains] = useState<string[]>(settings.allowedEmailDomains);
  const [domainInput, setDomainInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function addDomain() {
    const d = domainInput.trim().replace(/^@/, '').toLowerCase();
    if (!d) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return;
    setDomains(prev => prev.includes(d) ? prev : [...prev, d]);
    setDomainInput('');
  }
  function onDomainKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addDomain(); }
  }

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        registrationMode, emailVerificationRequired, defaultUserRole, allowedEmailDomains: domains,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'registration' });
      onSaved(updated);
      showToast('success', 'Registration settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save registration settings.');
    } finally {
      setSubmitting(false);
    }
  }, [registrationMode, emailVerificationRequired, defaultUserRole, domains, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Registration Mode">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REGISTRATION_MODES.map(mode => (
            <label key={mode} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: registrationMode === mode ? '#eff6ff' : '#fff' }}>
              <input type="radio" name="registrationMode" checked={registrationMode === mode} onChange={() => setRegistrationMode(mode)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{MODE_LABELS[mode].label}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{MODE_LABELS[mode].hint}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Verification">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Email Verification" description="New accounts must verify their email before access." checked={emailVerificationRequired} onChange={setEmailVerificationRequired} />
          <ToggleRow label={<>Phone Verification <ComingSoonBadge /></>} description="Require SMS OTP on signup." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>CAPTCHA <ComingSoonBadge /></>} description="Bot protection on the signup form." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Allowed Email Domains" subtitle="Leave empty to allow any domain.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {domains.map(d => (
            <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: '#f1f5f9', fontSize: 12, color: '#374151' }}>
              {d}
              <button type="button" onClick={() => setDomains(prev => prev.filter(x => x !== d))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={FULL_INPUT} value={domainInput} onChange={e => setDomainInput(e.target.value)} onKeyDown={onDomainKeyDown} placeholder="example.com — press Enter to add" />
          <button type="button" onClick={addDomain} style={{ ...FULL_INPUT, width: 'auto', cursor: 'pointer', fontWeight: 600 }}>Add</button>
        </div>
      </Card>

      <Card title="Defaults">
        <Field label="Default User Role" hint="Assigned to new signups when no role is specified.">
          <select style={FULL_INPUT} value={defaultUserRole} onChange={e => setDefaultUserRole(e.target.value as SystemSettings['defaultUserRole'])}>
            <option value="LEARNER">Learner</option>
            <option value="INSTRUCTOR">Instructor</option>
          </select>
        </Field>
      </Card>

      <SaveBar submitting={submitting} label="Save Registration Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
