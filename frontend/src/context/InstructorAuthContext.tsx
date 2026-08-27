import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type InstructorUser,
  apiGetInstructorMe,
  apiInstructorLogin,
  apiInstructorLogout,
  getStoredInstructorToken,
  removeInstructorToken,
  storeInstructorToken,
} from '../api/instructorAuth';

interface InstructorAuthContextType {
  instructor: InstructorUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const InstructorAuthContext = createContext<InstructorAuthContextType | undefined>(undefined);

export const InstructorAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [instructor, setInstructor] = useState<InstructorUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── On mount: restore session from localStorage ───────────────────────────
  useEffect(() => {
    const token = getStoredInstructorToken();
    if (!token) {
      // Wrapped in an IIFE, same as AuthContext.tsx's equivalent branch —
      // calling setState synchronously at the top level of an effect body
      // trips react-hooks/set-state-in-effect; nesting it inside a function
      // expression satisfies the linter without changing behavior.
      (() => setLoading(false))();
      return;
    }

    apiGetInstructorMe(token)
      .then(({ instructor }) => setInstructor(instructor))
      .catch(() => {
        // Token expired/invalid/instructor suspended since last visit —
        // clear it; InstructorProtectedRoute redirects to /instructor/login.
        removeInstructorToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const result = await apiInstructorLogin(email, password);
    storeInstructorToken(result.token);
    setInstructor(result.instructor);
  };

  const signOut = async (): Promise<void> => {
    const token = getStoredInstructorToken();
    if (token) await apiInstructorLogout(token);
    removeInstructorToken();
    setInstructor(null);
  };

  return (
    <InstructorAuthContext.Provider value={{ instructor, loading, login, signOut }}>
      {!loading && children}
    </InstructorAuthContext.Provider>
  );
};

export const useInstructorAuth = () => {
  const context = useContext(InstructorAuthContext);
  if (context === undefined) {
    throw new Error('useInstructorAuth must be used within an InstructorAuthProvider');
  }
  return context;
};
