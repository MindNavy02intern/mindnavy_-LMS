import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  type AdminUser,
  apiGetMe,
  apiLogin,
  apiLogout,
  getStoredToken,
  removeToken,
  storeToken,
} from './api/adminAuth';
import type { Profile } from './types/auth';

interface AuthContextType {
  user: AdminUser | null;
  profile: Profile | null;
  loading: boolean;
  /** True when the demo admin session is active (DEV only). */
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Activates the mock admin session for frontend testing (DEV only, no-op in production). */
  enterDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY: Mock session for frontend testing without a real backend.
// import.meta.env.DEV is replaced with `false` at build time so Vite
// tree-shakes all demo code out of production bundles.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_STORAGE_KEY = 'mn_demo_mode';

const DEMO_USER: AdminUser = {
  id: 'demo-admin-00000000-0000-0000-0000-000000000000',
  email: 'demo.admin@mindnavy.local',
  name: 'Demo Admin',
  role: 'super_admin',
};

const DEMO_PROFILE: Profile = {
  id: 'demo-admin-00000000-0000-0000-0000-000000000000',
  full_name: 'Demo Admin',
  avatar_url: null,
  role: 'super_admin',
};
// ─────────────────────────────────────────────────────────────────────────────

function mapAdminToProfile(admin: AdminUser): Profile {
  return {
    id: admin.id,
    full_name: admin.name,
    avatar_url: null,
    role: (admin.role as Profile['role']) ?? 'admin',
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Ref so the demo flag is readable inside async callbacks without stale closure
  const isDemoRef = useRef(false);

  // ── On mount: restore session from localStorage ───────────────────────────
  useEffect(() => {
    // DEV-ONLY: Restore demo session saved in sessionStorage
    if (import.meta.env.DEV && sessionStorage.getItem(DEMO_STORAGE_KEY) === '1') {
      isDemoRef.current = true;
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Verify the stored token is still valid and restore user state
    apiGetMe(token)
      .then(({ admin }) => {
        setUser(admin);
        setProfile(mapAdminToProfile(admin));
      })
      .catch(() => {
        // Token expired or invalid — clear it; ProtectedRoute will redirect to /login
        removeToken();
      })
      .finally(() => setLoading(false));
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<void> => {
    const { token, admin } = await apiLogin(email, password);
    storeToken(token);
    setUser(admin);
    setProfile(mapAdminToProfile(admin));
  };

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = async (): Promise<void> => {
    if (isDemoMode) {
      // DEV-ONLY: Clear the mock session instead of calling the backend
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      isDemoRef.current = false;
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      return;
    }

    const token = getStoredToken();
    if (token) await apiLogout(token);
    removeToken();
    setUser(null);
    setProfile(null);
  };

  // ── DEV-ONLY: enterDemoMode ───────────────────────────────────────────────
  const enterDemoMode = () => {
    if (!import.meta.env.DEV) return;
    sessionStorage.setItem(DEMO_STORAGE_KEY, '1');
    isDemoRef.current = true;
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    setIsDemoMode(true);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isDemoMode, login, signOut, enterDemoMode }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
