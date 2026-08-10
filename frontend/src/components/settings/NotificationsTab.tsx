// Notification Settings tab (?tab=notifications). Global on/off switches
// only — per-template rules and delivery rules live in the Notifications
// module (blueprint 10), linked below rather than duplicated here.

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, BTN_SECONDARY, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function NotificationsTab({ settings, onSaved, showToast }: Props) {
  const navigate = useNavigate();
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(settings.emailNotificationsEnabled);
  const [digestEmailsEnabled, setDigestEmailsEnabled] = useState(settings.digestEmailsEnabled);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({ emailNotificationsEnabled, digestEmailsEnabled });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'notifications' });
      onSaved(updated);
      showToast('success', 'Notification settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save notification settings.');
    } finally {
      setSubmitting(false);
    }
  }, [emailNotificationsEnabled, digestEmailsEnabled, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Global Channels">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Email Notifications" description="Master switch for all outbound email notifications." checked={emailNotificationsEnabled} onChange={setEmailNotificationsEnabled} />
          <ToggleRow label="Digest Emails" description="Batch low-priority notifications into a daily digest." checked={digestEmailsEnabled} onChange={setDigestEmailsEnabled} />
          <ToggleRow label={<>Push Notifications <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>SMS Notifications <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Templates & Rules" subtitle="Per-template content, triggers, and reminder schedules live in the Notifications module.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/notifications?tab=templates')}>
          Go to Notification Templates
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <SaveBar submitting={submitting} label="Save Notification Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
