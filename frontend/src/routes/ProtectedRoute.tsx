import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
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

  return <>{children}</>;
}
