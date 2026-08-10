import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout';
import { useTabParam } from '../hooks/useTabParam';
import { useToast, ToastContainer } from '../components/users/Toast';
import { getSystemSettings, createBackup } from '../services/settingsApi';
import { SettingsApiError, type SystemSettings } from '../types/settings';
import { ErrorBanner, Skeleton, SAVE_ALL_EVENT } from '../components/settings/_shared';
import SettingsPageHeader from '../components/settings/SettingsPageHeader';
import { downloadBackupFile } from '../components/settings/BackupRestoreTab';

import GeneralTab from '../components/settings/GeneralTab';
import BrandingTab from '../components/settings/BrandingTab';
import LocalizationTab from '../components/settings/LocalizationTab';
import RegistrationTab from '../components/settings/RegistrationTab';
import LearningTab from '../components/settings/LearningTab';
import SecurityTab from '../components/settings/SecurityTab';
import AuthenticationTab from '../components/settings/AuthenticationTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import EmailConfigTab from '../components/settings/EmailConfigTab';
import StorageTab from '../components/settings/StorageTab';
import MediaUploadTab from '../components/settings/MediaUploadTab';
import AutomationTab from '../components/settings/AutomationTab';
import MaintenanceTab from '../components/settings/MaintenanceTab';
import BackupRestoreTab from '../components/settings/BackupRestoreTab';
import FeatureTogglesTab from '../components/settings/FeatureTogglesTab';
import DomainUrlTab from '../components/settings/DomainUrlTab';
import MobileAppTab from '../components/settings/MobileAppTab';
import ApiDeveloperTab from '../components/settings/ApiDeveloperTab';
import AiFeaturesTab from '../components/settings/AiFeaturesTab';
import ConfigLogsTab from '../components/settings/ConfigLogsTab';

const TABS = [
  { key: 'general',        label: 'General' },
  { key: 'branding',       label: 'Branding' },
  { key: 'localization',   label: 'Localization' },
  { key: 'registration',   label: 'Registration' },
  { key: 'learning',       label: 'Learning' },
  { key: 'security',       label: 'Security' },
  { key: 'authentication', label: 'Authentication' },
  { key: 'notifications',  label: 'Notifications' },
  { key: 'email',          label: 'Email Config' },
  { key: 'storage',        label: 'Storage' },
  { key: 'media',          label: 'Media & Upload' },
  { key: 'automation',     label: 'Automation' },
  { key: 'maintenance',    label: 'Maintenance' },
  { key: 'backup',         label: 'Backup & Restore' },
  { key: 'features',       label: 'Feature Toggles' },
  { key: 'domain',         label: 'Domain & URL' },
  { key: 'mobile',         label: 'Mobile App' },
  { key: 'api',            label: 'API & Developer' },
  { key: 'ai',             label: 'AI Features' },
  { key: 'logs',           label: 'Config Logs' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function SystemSettingsPage() {
  const [tabKey, setTabKey] = useTabParam('general');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'general') as TabKey;

  const { toasts, showToast, dismiss } = useToast();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchSettings = useCallback(() => {
    setLoading(true);
    setError(null);
    getSystemSettings()
      .then(setSettings)
      .catch(err => setError(err instanceof SettingsApiError ? err.message : 'Failed to load system settings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { document.title = 'System Settings — MindNavy'; }, []);

  function handleSaved(updated: SystemSettings) {
    setSettings(updated);
  }

  function handleSaveAll() {
    setSavingAll(true);
    window.dispatchEvent(new CustomEvent(SAVE_ALL_EVENT));
    // The active tab's own submit handler resolves independently (it shows its
    // own toast/spinner) — this just gives the header button a brief pressed
    // state instead of tracking every tab's async result centrally.
    setTimeout(() => setSavingAll(false), 600);
  }

  async function handleExportConfig() {
    setExporting(true);
    try {
      const backup = await createBackup();
      downloadBackupFile(backup);
      showToast('success', 'Config exported.');
      fetchSettings();
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to export config.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout pageTitle="System Settings">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
        <SettingsPageHeader
          onSaveAll={handleSaveAll}
          onExport={handleExportConfig}
          onViewLogs={() => setTabKey('logs')}
          onRestore={() => setTabKey('backup')}
          saving={savingAll || exporting}
        />

        {settings?.maintenanceMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b' }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              <strong>Maintenance mode is ON.</strong> Public-facing endpoints are returning 503. {settings.maintenanceMessage && <span>— "{settings.maintenanceMessage}"</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0' }}>
          {TABS.map(t => (
            <button
              key={t.key} type="button" onClick={() => setTabKey(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', fontSize: 12.5, fontWeight: 600,
                fontFamily: 'inherit', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                border: 'none', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === t.key ? '#2563eb' : '#64748b', marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}><Skeleton /></div>
        ) : error || !settings ? (
          <ErrorBanner message={error ?? 'Settings unavailable.'} onRetry={fetchSettings} />
        ) : (
          <>
            {tab === 'general'        && <GeneralTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'branding'       && <BrandingTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'localization'   && <LocalizationTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'registration'   && <RegistrationTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'learning'       && <LearningTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'security'       && <SecurityTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'authentication' && <AuthenticationTab settings={settings} />}
            {tab === 'notifications'  && <NotificationsTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'email'          && <EmailConfigTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'storage'        && <StorageTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'media'          && <MediaUploadTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'automation'     && <AutomationTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'maintenance'    && <MaintenanceTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'backup'         && <BackupRestoreTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'features'       && <FeatureTogglesTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'domain'         && <DomainUrlTab settings={settings} onSaved={handleSaved} showToast={showToast} />}
            {tab === 'mobile'         && <MobileAppTab showToast={showToast} />}
            {tab === 'api'            && <ApiDeveloperTab showToast={showToast} />}
            {tab === 'ai'             && <AiFeaturesTab showToast={showToast} />}
            {tab === 'logs'           && <ConfigLogsTab />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
