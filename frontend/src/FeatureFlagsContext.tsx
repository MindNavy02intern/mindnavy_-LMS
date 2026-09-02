import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getFeatureFlags, type FeatureFlags } from './services/settingsApi';

// Defaults match SystemSettings' Prisma @default values (settings.prisma) —
// used only until the real GET /system-settings/features response lands, so
// nav/tabs don't flash hidden-then-shown on every load.
const DEFAULT_FLAGS: FeatureFlags = {
  liveSessionsEnabled: true,
  certificatesModuleEnabled: true,
  marketplaceEnabled: false,
  aiEnabled: false,
  gamificationEnabled: false,
  scormModuleEnabled: false,
  mobileAppEnabled: false,
};

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  loading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({ flags: DEFAULT_FLAGS, loading: true });

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      getFeatureFlags().then(setFlags).catch(err => console.error(err)).finally(() => setLoading(false));
    }
    load();
    // Narrowed from the old 'analyticsUpdated' catch-all — feature flags
    // only change via featureToggle.set (queryKeys.settings('features')),
    // so 'settingsUpdated' is the correct, precise signal.
    window.addEventListener('settingsUpdated', load);
    return () => window.removeEventListener('settingsUpdated', load);
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextType {
  return useContext(FeatureFlagsContext);
}
