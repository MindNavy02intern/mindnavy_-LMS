// Automation tab (?tab=automation).

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, BTN_SECONDARY, SaveBar, ToggleRow, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function AutomationTab({ settings, onSaved, showToast }: Props) {
  const navigate = useNavigate();
  const [autoEnrollmentEnabled, setAutoEnrollmentEnabled] = useState(settings.autoEnrollmentEnabled);
  const [autoCertificationEnabled, setAutoCertificationEnabled] = useState(settings.autoCertificationEnabled);
  const [reminderNotificationsEnabled, setReminderNotificationsEnabled] = useState(settings.reminderNotificationsEnabled);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({ autoEnrollmentEnabled, autoCertificationEnabled, reminderNotificationsEnabled });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'automation' });
      onSaved(updated);
      showToast('success', 'Automation settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save automation settings.');
    } finally {
      setSubmitting(false);
    }
  }, [autoEnrollmentEnabled, autoCertificationEnabled, reminderNotificationsEnabled, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Automation Rules" subtitle="Same auto-enrollment switch as the Learning tab — shown here alongside the module's other automations.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Auto Enrollment" description="Automatically enroll learners in assigned learning paths." checked={autoEnrollmentEnabled} onChange={setAutoEnrollmentEnabled} />
          <ToggleRow label="Auto Certification" description="Issue certificates automatically on course completion, no manual approval." checked={autoCertificationEnabled} onChange={setAutoCertificationEnabled} />
          <ToggleRow label="Reminder Notifications" description="Send automated reminders for deadlines, expirations and incomplete courses." checked={reminderNotificationsEnabled} onChange={setReminderNotificationsEnabled} />
        </div>
      </Card>

      <Card title="Scheduling" subtitle="Reminder cadence and recipient rules are configured in Notification Automations.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/notifications?tab=automations')}>
          Go to Notification Automations
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <SaveBar submitting={submitting} label="Save Automation Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
