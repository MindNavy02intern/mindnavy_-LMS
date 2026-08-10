// Maintenance Mode tab (?tab=maintenance). Enable/disable go through their
// own endpoints (not the generic PATCH) — they need a distinct audit action
// and, per the module rule, must never lock admins out (the maintenance
// middleware only gates /api/public/*, never /api/admin/*).

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { enableMaintenance, disableMaintenance } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FULL_INPUT, BTN_PRIMARY, BTN_DANGER, ToggleRow } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenanceTab({ settings, onSaved, showToast }: Props) {
  const [message, setMessage] = useState(settings.maintenanceMessage ?? '');
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(settings.scheduledMaintenanceAt));
  const [submitting, setSubmitting] = useState(false);

  async function handleEnable() {
    setSubmitting(true);
    try {
      const updated = await enableMaintenance({
        message: message.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      invalidateFor(appQueryClient, 'maintenance.enable');
      onSaved(updated);
      showToast('success', 'Maintenance mode enabled.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to enable maintenance mode.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setSubmitting(true);
    try {
      const updated = await disableMaintenance();
      invalidateFor(appQueryClient, 'maintenance.disable');
      onSaved(updated);
      showToast('success', 'Maintenance mode disabled.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to disable maintenance mode.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Card>
        <ToggleRow
          label="Maintenance Mode"
          description={settings.maintenanceMode ? 'The public site is currently down for maintenance.' : 'Take the public-facing site offline for maintenance.'}
          checked={settings.maintenanceMode}
          onChange={v => (v ? handleEnable() : handleDisable())}
          disabled={submitting}
        />
      </Card>

      <Card title="Maintenance Message">
        <textarea style={{ ...FULL_INPUT, minHeight: 90, resize: 'vertical' }} value={message} onChange={e => setMessage(e.target.value)} placeholder="We're performing scheduled maintenance. We'll be back shortly." maxLength={2000} />
      </Card>

      <Card title="Schedule Maintenance">
        <input style={{ ...FULL_INPUT, maxWidth: 260 }} type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button type="button" style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={handleEnable}>Enable Now</button>
          <button type="button" style={{ ...BTN_DANGER, opacity: submitting ? 0.7 : 1 }} disabled={submitting || !settings.maintenanceMode} onClick={handleDisable}>Disable</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
          <ShieldAlert size={15} color="#0369a1" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#0369a1' }}>Admins can still access the admin panel during maintenance — only public-facing endpoints (certificate verification, instructor applications) are gated.</span>
        </div>
      </Card>
    </div>
  );
}
