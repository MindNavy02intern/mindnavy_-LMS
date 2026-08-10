// General Settings tab (?tab=general).

import { useCallback, useState } from 'react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, SaveBar, useSaveAllListener } from './_shared';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];
const LANGUAGES = [
  { value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }, { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' }, { value: 'es', label: 'Spanish' }, { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese (Simplified)' }, { value: 'ja', label: 'Japanese' },
];
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function GeneralTab({ settings, onSaved, showToast }: Props) {
  const [form, setForm] = useState({
    platformName: settings.platformName,
    platformDescription: settings.platformDescription ?? '',
    timezone: settings.timezone,
    defaultLanguage: settings.defaultLanguage,
    dateFormat: settings.dateFormat,
    currency: settings.currency,
    contactEmail: settings.contactEmail ?? '',
    contactPhone: settings.contactPhone ?? '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        platformName: form.platformName.trim(),
        platformDescription: form.platformDescription.trim() || null,
        timezone: form.timezone,
        defaultLanguage: form.defaultLanguage,
        dateFormat: form.dateFormat,
        currency: form.currency,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'general' });
      onSaved(updated);
      showToast('success', 'General settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save general settings.');
    } finally {
      setSubmitting(false);
    }
  }, [form, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Platform Identity">
        <FormGrid>
          <Field label="Platform Name">
            <input style={FULL_INPUT} value={form.platformName} onChange={e => setForm(f => ({ ...f, platformName: e.target.value }))} required maxLength={120} placeholder="MindNavy LMS" data-testid="general-platform-name" />
          </Field>
          <Field label="Platform Description">
            <textarea style={{ ...FULL_INPUT, minHeight: 68, resize: 'vertical' }} value={form.platformDescription} onChange={e => setForm(f => ({ ...f, platformDescription: e.target.value }))} maxLength={2000} />
          </Field>
        </FormGrid>
      </Card>

      <Card title="Locale & Formatting">
        <FormGrid>
          <Field label="Timezone">
            <select style={FULL_INPUT} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Default Language">
            <select style={FULL_INPUT} value={form.defaultLanguage} onChange={e => setForm(f => ({ ...f, defaultLanguage: e.target.value }))}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Date Format">
            <select style={FULL_INPUT} value={form.dateFormat} onChange={e => setForm(f => ({ ...f, dateFormat: e.target.value }))}>
              {DATE_FORMATS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select style={FULL_INPUT} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </FormGrid>
      </Card>

      <Card title="Contact Information">
        <FormGrid>
          <Field label="Contact Email" hint="Receives system alerts and admin notifications.">
            <input style={FULL_INPUT} type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="admin@example.com" />
          </Field>
          <Field label="Contact Phone">
            <input style={FULL_INPUT} value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+1 555 000 0000" />
          </Field>
        </FormGrid>
      </Card>

      <SaveBar submitting={submitting} label="Save General Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
