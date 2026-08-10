// Backup & Restore tab (?tab=backup).

import { useRef, useState } from 'react';
import { Download, Upload, ShieldAlert } from 'lucide-react';
import { createBackup, restoreBackup } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { BackupPayload, SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export function downloadBackupFile(backup: BackupPayload) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindnavy-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BackupRestoreTab({ settings, onSaved, showToast }: Props) {
  const [creating, setCreating] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<BackupPayload | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleCreateBackup() {
    setCreating(true);
    try {
      const backup = await createBackup();
      invalidateFor(appQueryClient, 'backup.run');
      downloadBackupFile(backup);
      onSaved({ ...settings, lastBackupAt: backup.exportedAt });
      showToast('success', 'Backup created and downloaded.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to create backup.');
    } finally {
      setCreating(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.settings || typeof parsed.settings !== 'object') throw new Error('Missing "settings" key.');
        setPendingRestore(parsed);
      } catch {
        showToast('error', 'That file is not a valid MindNavy settings backup.');
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmRestore() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      const updated = await restoreBackup(pendingRestore.settings);
      invalidateFor(appQueryClient, 'backup.restore');
      onSaved(updated);
      setPendingRestore(null);
      showToast('success', 'Settings restored from backup.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to restore backup.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div>
      <Card title="Create Backup" subtitle="Exports every setting on this page as a downloadable JSON snapshot.">
        <button type="button" style={{ ...BTN_PRIMARY, opacity: creating ? 0.7 : 1 }} disabled={creating} onClick={handleCreateBackup}>
          <Download size={15} strokeWidth={2} />
          {creating ? 'Creating…' : 'Create Backup'}
        </button>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10 }}>
          Last backup: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : 'never'}
        </div>
      </Card>

      <Card title="Restore from Backup" subtitle="Upload a previously exported JSON file to restore its settings.">
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileSelected} />
        <button type="button" style={BTN_SECONDARY} onClick={() => fileRef.current?.click()}>
          <Upload size={15} strokeWidth={2} />
          Upload Backup File
        </button>

        {pendingRestore && (
          <div style={{ marginTop: 16, padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ShieldAlert size={15} color="#b45309" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Confirm restore</span>
            </div>
            <div style={{ fontSize: 12, color: '#78350f', marginBottom: 10 }}>
              Exported {new Date(pendingRestore.exportedAt).toLocaleString()} from "{pendingRestore.platformName}" — {Object.keys(pendingRestore.settings).length} fields.
              This will overwrite every current setting with the values in this file.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={{ ...BTN_DANGER, opacity: restoring ? 0.7 : 1 }} disabled={restoring} onClick={handleConfirmRestore}>
                {restoring ? 'Restoring…' : 'Confirm Restore'}
              </button>
              <button type="button" style={BTN_SECONDARY} disabled={restoring} onClick={() => setPendingRestore(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Database Backup">
        <div style={{ fontSize: 12.5, color: '#64748b' }}>
          Full database backups (point-in-time restore, automated snapshots) aren't available through the app — contact your hosting provider (e.g. Supabase's own backup/restore console).
        </div>
      </Card>
    </div>
  );
}
