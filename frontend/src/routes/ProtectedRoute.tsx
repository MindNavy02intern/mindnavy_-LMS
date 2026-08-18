import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { UserRole } from '../types/auth';

interface Props {
  children: React.ReactNode;
  // Optional: restrict to specific roles (e.g. ['admin'] for admin-only pages)
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  // Not logged in → send to login page
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but wrong role → send to dashboard
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // FeatureFlagsProvider lives here (the single shared wrapper for every
  // protected route, App.tsx) rather than main.tsx — it only ever fetches
  // for an authenticated admin on a real page, never on /login, /signup,
  // /verify-device. Wrapping here (not inside AdminLayout) also means it's
  // a true ancestor of the page component itself, not just of AdminLayout's
  // children — so a page's own body can call useFeatureFlags() directly.
  return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}
