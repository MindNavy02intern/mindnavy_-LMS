// Domain & URL tab (?tab=domain).

import { useCallback, useState } from 'react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, SaveBar, StatusBadge, ComingSoonBadge, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function DomainUrlTab({ settings, onSaved, showToast }: Props) {
  const [metaTitle, setMetaTitle] = useState(settings.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(settings.metaDescription ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        metaTitle: metaTitle.trim() || null,
        metaDescription: metaDescription.trim() || null,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'domain' });
      onSaved(updated);
      showToast('success', 'Domain & SEO settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  }, [metaTitle, metaDescription, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Custom Domain">
        <Field label={<>Custom Domain <ComingSoonBadge /></>} hint="Point your own domain at this MindNavy instance.">
          <input style={FULL_INPUT} value="" disabled placeholder="app.yourcompany.com" />
        </Field>
      </Card>

      <Card title="Current URL">
        <div style={{ fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>{window.location.origin}</div>
      </Card>

      <Card title="SSL" action={<StatusBadge text="Managed by hosting provider" tone="neutral" />}>
        <div style={{ fontSize: 12.5, color: '#64748b' }}>TLS certificates are provisioned and renewed automatically by the hosting platform.</div>
      </Card>

      <Card title="SEO Settings">
        <FormGrid>
          <Field label="Meta Title">
            <input style={FULL_INPUT} value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={settings.platformName} maxLength={120} />
          </Field>
          <Field label="Meta Description">
            <textarea style={{ ...FULL_INPUT, minHeight: 68, resize: 'vertical' }} value={metaDescription} onChange={e => setMetaDescription(e.target.value)} maxLength={500} />
          </Field>
        </FormGrid>
      </Card>

      <SaveBar submitting={submitting} label="Save Domain & SEO Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
