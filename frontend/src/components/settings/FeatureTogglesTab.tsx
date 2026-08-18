// Feature Toggles tab (?tab=features). AI/SCORM/Mobile App are disabled per
// the module note ("AI, Mobile App... coming soon with honest empty
// states") — Live Sessions/Certificates are real shipped modules, Marketplace/
// Gamification are live config flags with no gated module behind them yet.

import { useCallback, useState } from 'react';
import { Video, Award, Store, Sparkles, Trophy, PackageOpen, Smartphone } from 'lucide-react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { SaveBar, useSaveAllListener } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

type FeatureKey = 'liveSessionsEnabled' | 'certificatesModuleEnabled' | 'marketplaceEnabled' | 'aiEnabled' | 'gamificationEnabled' | 'scormModuleEnabled' | 'mobileAppEnabled';

const FEATURES: { key: FeatureKey; label: string; description: string; icon: typeof Video; comingSoon?: boolean }[] = [
  { key: 'liveSessionsEnabled', label: 'Live Sessions', description: 'Zoom-backed scheduled sessions module.', icon: Video },
  { key: 'certificatesModuleEnabled', label: 'Certificates', description: 'Issue and verify course completion certificates.', icon: Award },
  { key: 'marketplaceEnabled', label: 'Marketplace', description: 'Public course marketplace / storefront.', icon: Store },
  { key: 'aiEnabled', label: 'AI Features', description: 'AI recommendations, smart paths, analytics.', icon: Sparkles, comingSoon: true },
  { key: 'gamificationEnabled', label: 'Gamification', description: 'Badges, points, leaderboards.', icon: Trophy },
  { key: 'scormModuleEnabled', label: 'SCORM', description: 'Import and track SCORM packages.', icon: PackageOpen, comingSoon: true },
  { key: 'mobileAppEnabled', label: 'Mobile App', description: 'Native mobile app support.', icon: Smartphone, comingSoon: true },
];

export default function FeatureTogglesTab({ settings, onSaved, showToast }: Props) {
  const [form, setForm] = useState<Record<FeatureKey, boolean>>({
    liveSessionsEnabled: settings.liveSessionsEnabled,
    certificatesModuleEnabled: settings.certificatesModuleEnabled,
    marketplaceEnabled: settings.marketplaceEnabled,
    aiEnabled: settings.aiEnabled,
    gamificationEnabled: settings.gamificationEnabled,
    scormModuleEnabled: settings.scormModuleEnabled,
    mobileAppEnabled: settings.mobileAppEnabled,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings(form);
      invalidateFor(appQueryClient, 'featureToggle.set');
      // Real refresh bridge (no TanStack Query cache is actually wired up
      // anywhere in this app — invalidateFor() above is a no-op today, see
      // its own header note) — FeatureFlagsContext listens for this same
      // event every other stats panel already does.
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      onSaved(updated);
      showToast('success', 'Feature toggles saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save feature toggles.');
    } finally {
      setSubmitting(false);
    }
  }, [form, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        {FEATURES.map(({ key, label, description, icon: Icon, comingSoon }) => (
          <div key={key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, opacity: comingSoon ? 0.7 : 1 }} title={comingSoon ? 'Coming soon' : undefined}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} strokeWidth={2} color="#2563eb" />
              </div>
              <button
                type="button"
                disabled={comingSoon}
                data-testid={`feature-toggle-${key}`}
                onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                style={{ width: 40, height: 22, borderRadius: 999, border: 'none', background: form[key] ? '#2563eb' : '#cbd5e1', cursor: comingSoon ? 'not-allowed' : 'pointer', position: 'relative', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: form[key] ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              {label}
              {comingSoon && <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8' }}>SOON</span>}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>{description}</div>
          </div>
        ))}
      </div>

      <SaveBar submitting={submitting} label="Save Feature Toggles" savedAt={settings.updatedAt} />
    </form>
  );
}
