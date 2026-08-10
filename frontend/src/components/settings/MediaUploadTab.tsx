// Media & Upload tab (?tab=media).

import { useCallback, useState } from 'react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

const FILE_TYPES = ['pdf', 'mp4', 'mov', 'jpg', 'png', 'docx', 'zip', 'scorm'];

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function MediaUploadTab({ settings, onSaved, showToast }: Props) {
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(settings.maxUploadSizeMb);
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(settings.allowedFileTypes);
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(settings.imageCompressionEnabled);
  const [submitting, setSubmitting] = useState(false);

  function toggleType(t: string) {
    setAllowedFileTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({ maxUploadSizeMb, allowedFileTypes, imageCompressionEnabled });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'media' });
      onSaved(updated);
      showToast('success', 'Media & upload settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save media settings.');
    } finally {
      setSubmitting(false);
    }
  }, [maxUploadSizeMb, allowedFileTypes, imageCompressionEnabled, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Max File Size">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input type="range" min={1} max={500} value={maxUploadSizeMb} onChange={e => setMaxUploadSizeMb(Number(e.target.value))} style={{ flex: 1 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', minWidth: 60, textAlign: 'right' }}>{maxUploadSizeMb} MB</div>
        </div>
      </Card>

      <Card title="Allowed File Types">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
          {FILE_TYPES.map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: allowedFileTypes.includes(t) ? '#eff6ff' : '#fff', fontSize: 12.5, color: '#374151', textTransform: 'uppercase' }}>
              <input type="checkbox" checked={allowedFileTypes.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Processing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Image Compression" description="Automatically compress uploaded images." checked={imageCompressionEnabled} onChange={setImageCompressionEnabled} />
          <ToggleRow label={<>Video Processing / Transcoding <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Current Limits Summary">
        <div style={{ fontSize: 12.5, color: '#374151' }}>
          Up to <strong>{maxUploadSizeMb} MB</strong> per file · Allowed types: <strong>{allowedFileTypes.length > 0 ? allowedFileTypes.join(', ').toUpperCase() : 'none'}</strong> · Compression: <strong>{imageCompressionEnabled ? 'on' : 'off'}</strong>
        </div>
      </Card>

      <SaveBar submitting={submitting} label="Save Media Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
