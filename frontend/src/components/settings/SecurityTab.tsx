// Security tab (?tab=security).

import { useCallback, useState, type KeyboardEvent } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, BTN_SECONDARY, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function SecurityTab({ settings, onSaved, showToast }: Props) {
  const [passwordMinLength, setPasswordMinLength] = useState(String(settings.passwordMinLength));
  const [passwordRequireUppercase, setPasswordRequireUppercase] = useState(settings.passwordRequireUppercase);
  const [passwordRequireNumbers, setPasswordRequireNumbers] = useState(settings.passwordRequireNumbers);
  const [passwordRequireSymbols, setPasswordRequireSymbols] = useState(settings.passwordRequireSymbols);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(String(settings.sessionTimeoutMinutes));
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(String(settings.maxLoginAttempts));
  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(settings.ipRestrictionEnabled);
  const [ips, setIps] = useState<string[]>(settings.allowedIPs);
  const [ipInput, setIpInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function addIp() {
    const v = ipInput.trim();
    if (!v) return;
    if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v)) { showToast('error', `"${v}" is not a valid IP or CIDR range.`); return; }
    setIps(prev => prev.includes(v) ? prev : [...prev, v]);
    setIpInput('');
  }
  function onIpKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIp(); }
  }

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        passwordMinLength: Number(passwordMinLength) || 8,
        passwordRequireUppercase, passwordRequireNumbers, passwordRequireSymbols,
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 60,
        maxLoginAttempts: Number(maxLoginAttempts) || 5,
        ipRestrictionEnabled, allowedIPs: ips,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'security' });
      onSaved(updated);
      showToast('success', 'Security settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save security settings.');
    } finally {
      setSubmitting(false);
    }
  }, [passwordMinLength, passwordRequireUppercase, passwordRequireNumbers, passwordRequireSymbols, sessionTimeoutMinutes, maxLoginAttempts, ipRestrictionEnabled, ips, onSaved, showToast]);

  useSaveAllListener(handleSave);

  function handleTestConfig() {
    const rules = [`min ${passwordMinLength} chars`];
    if (passwordRequireUppercase) rules.push('uppercase required');
    if (passwordRequireNumbers) rules.push('numbers required');
    if (passwordRequireSymbols) rules.push('symbols required');
    setTestResult(
      `Password policy: ${rules.join(', ')}. Session timeout: ${sessionTimeoutMinutes}m. ` +
      `Max login attempts: ${maxLoginAttempts}. IP restriction: ${ipRestrictionEnabled ? `ON (${ips.length} rule${ips.length === 1 ? '' : 's'})` : 'OFF'}.`
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Password Policy">
        <FormGrid>
          <Field label="Minimum Length">
            <input style={FULL_INPUT} type="number" min={6} max={64} value={passwordMinLength} onChange={e => setPasswordMinLength(e.target.value)} />
          </Field>
        </FormGrid>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <ToggleRow label="Require Uppercase" checked={passwordRequireUppercase} onChange={setPasswordRequireUppercase} />
          <ToggleRow label="Require Numbers" checked={passwordRequireNumbers} onChange={setPasswordRequireNumbers} />
          <ToggleRow label="Require Symbols" checked={passwordRequireSymbols} onChange={setPasswordRequireSymbols} />
        </div>
      </Card>

      <Card title="Session & Login">
        <FormGrid>
          <Field label="Session Timeout (minutes)">
            <input style={FULL_INPUT} type="number" min={5} max={1440} value={sessionTimeoutMinutes} onChange={e => setSessionTimeoutMinutes(e.target.value)} />
          </Field>
          <Field label="Max Login Attempts">
            <input style={FULL_INPUT} type="number" min={3} max={20} value={maxLoginAttempts} onChange={e => setMaxLoginAttempts(e.target.value)} />
          </Field>
        </FormGrid>
        <div style={{ marginTop: 16 }}>
          <ToggleRow label={<>Multi-Factor Authentication <ComingSoonBadge /></>} description="Require a second factor at login." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="IP Restriction">
        <ToggleRow label="Restrict Admin Access by IP" checked={ipRestrictionEnabled} onChange={setIpRestrictionEnabled} />
        {ipRestrictionEnabled && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {ips.map(ip => (
                <span key={ip} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: '#f1f5f9', fontSize: 12, color: '#374151' }}>
                  {ip}
                  <button type="button" onClick={() => setIps(prev => prev.filter(x => x !== ip))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={FULL_INPUT} value={ipInput} onChange={e => setIpInput(e.target.value)} onKeyDown={onIpKeyDown} placeholder="203.0.113.0/24 — press Enter to add" />
              <button type="button" onClick={addIp} style={{ ...FULL_INPUT, width: 'auto', cursor: 'pointer', fontWeight: 600 }}>Add</button>
            </div>
          </div>
        )}
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
