// Storage tab (?tab=storage).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, HardDrive } from 'lucide-react';
import { getStorageUsage, updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { StorageUsage, SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, Field, FULL_INPUT, BTN_SECONDARY, SaveBar, StatusBadge, ErrorBanner, Skeleton, fmtBytes, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function StorageTab({ settings, onSaved, showToast }: Props) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(String(settings.maxUploadSizeMb));
  const [submitting, setSubmitting] = useState(false);

  const fetchUsage = useCallback(() => {
    setUsageLoading(true);
    setUsageError(null);
    getStorageUsage()
      .then(setUsage)
      .catch(err => setUsageError(err instanceof SettingsApiError ? err.message : 'Failed to load storage usage.'))
      .finally(() => setUsageLoading(false));
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({ maxUploadSizeMb: Number(maxUploadSizeMb) || 100 });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'storage' });
      onSaved(updated);
      showToast('success', 'Storage settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save storage settings.');
    } finally {
      setSubmitting(false);
    }
  }, [maxUploadSizeMb, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card
        title="Current Provider"
        action={<StatusBadge text={settings.storageConfigured ? 'CONNECTED' : 'NOT CONFIGURED'} tone={settings.storageConfigured ? 'success' : 'warn'} />}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151' }}>
          <HardDrive size={16} strokeWidth={2} color="#64748b" />
          Supabase Storage
        </div>
      </Card>

      <Card title="Storage Usage" action={<button type="button" onClick={fetchUsage} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>}>
        {usageLoading ? <Skeleton /> : usageError ? (
          <ErrorBanner message={usageError} onRetry={fetchUsage} />
        ) : usage && usage.buckets.length > 0 ? (
          <div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
              {usage.totalFiles} file{usage.totalFiles === 1 ? '' : 's'} · {fmtBytes(usage.totalSizeBytes)} total
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {usage.buckets.map(b => (
                <div key={b.bucket} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{b.bucket}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.public ? 'Public bucket' : 'Private bucket'}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12.5, color: '#374151' }}>
                    <div>{b.fileCount} file{b.fileCount === 1 ? '' : 's'}</div>
                    <div style={{ color: '#94a3b8' }}>{fmtBytes(b.totalSizeBytes)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No buckets found, or storage isn't configured yet.</div>
        )}
      </Card>

      <Card title="Upload Limits">
        <Field label="Max Upload Size (MB)">
          <input style={{ ...FULL_INPUT, maxWidth: 160 }} type="number" min={1} max={500} value={maxUploadSizeMb} onChange={e => setMaxUploadSizeMb(e.target.value)} />
        </Field>
      </Card>

      <Card title="Other Providers" subtitle="AWS S3 / Google Cloud Storage connections are configured in Integrations.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/integrations')}>
          Configure in Integrations
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <SaveBar submitting={submitting} label="Save Storage Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
