import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types/auth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True when the demo admin session is active (DEV only). */
  isDemoMode: boolean;
  signOut: () => Promise<void>;
  /** Activates the mock admin session for frontend testing (DEV only, no-op in production). */
  enterDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY: Mock session for frontend testing without a real backend / database.
// This entire block is dead code in production builds because import.meta.env.DEV
// is statically replaced with `false` by Vite, so tree-shaking removes it.
// DO NOT use DEMO_USER or DEMO_PROFILE outside of development guards.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_STORAGE_KEY = 'mn_demo_mode';

const DEMO_USER = {
  id: 'demo-admin-00000000-0000-0000-0000-000000000000',
  email: 'demo.admin@mindnavy.local',
  app_metadata: {},
  user_metadata: { full_name: 'Demo Admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as User;

const DEMO_PROFILE: Profile = {
  id: 'demo-admin-00000000-0000-0000-0000-000000000000',
  full_name: 'Demo Admin',
  avatar_url: null,
  role: 'super_admin',
};
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Ref so the Supabase subscription callback can read the latest demo state
  // without needing to be recreated every time isDemoMode changes.
  const isDemoRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    // DEV-ONLY: Restore a demo session that was saved in sessionStorage
    // (sessionStorage clears automatically when the browser tab is closed)
    if (import.meta.env.DEV && sessionStorage.getItem(DEMO_STORAGE_KEY) === '1') {
      isDemoRef.current = true;
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setIsDemoMode(true);
      setLoading(false);
      return; // Skip Supabase entirely while demo is active
    }

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Guard: do not let Supabase state changes overwrite an active demo session
        if (isDemoRef.current) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // DEV-ONLY: Activates the mock admin session.
  // In production, import.meta.env.DEV is false so this is a no-op.
  const enterDemoMode = () => {
    if (!import.meta.env.DEV) return;
    sessionStorage.setItem(DEMO_STORAGE_KEY, '1');
    isDemoRef.current = true;
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    setIsDemoMode(true);
    setLoading(false);
  };

  const signOut = async (): Promise<void> => {
    if (isDemoMode) {
      // DEV-ONLY: Clear the demo session instead of calling Supabase
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      isDemoRef.current = false;
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isDemoMode, signOut, enterDemoMode }}>
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
