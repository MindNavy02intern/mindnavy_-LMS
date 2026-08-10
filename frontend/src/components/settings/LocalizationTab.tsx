// Localization tab (?tab=localization). Edits the same defaultLanguage/
// timezone/dateFormat/currency fields as General's Locale & Formatting
// section — same underlying settings row, no drift risk, just a dedicated
// deep-dive per the blueprint tab list.

import { useCallback, useState } from 'react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

const LANGUAGES = [
  { value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }, { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' }, { value: 'es', label: 'Spanish' }, { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese (Simplified)' }, { value: 'ja', label: 'Japanese' },
];
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function LocalizationTab({ settings, onSaved, showToast }: Props) {
  const [form, setForm] = useState({
    defaultLanguage: settings.defaultLanguage,
    timezone: settings.timezone,
    dateFormat: settings.dateFormat,
    currency: settings.currency,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings(form);
      invalidateFor(appQueryClient, 'settings.update', { domain: 'localization' });
      onSaved(updated);
      showToast('success', 'Localization settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save localization settings.');
    } finally {
      setSubmitting(false);
    }
  }, [form, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Language & Region">
        <FormGrid>
          <Field label="Default Language">
            <select style={FULL_INPUT} value={form.defaultLanguage} onChange={e => setForm(f => ({ ...f, defaultLanguage: e.target.value }))}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select style={FULL_INPUT} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
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

      <Card title="Advanced Localization">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label={<>RTL Support <ComingSoonBadge /></>} description="Right-to-left layout for Arabic/Hebrew." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>Translation Management <ComingSoonBadge /></>} description="Manage per-language string overrides." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <SaveBar submitting={submitting} label="Save Localization Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
