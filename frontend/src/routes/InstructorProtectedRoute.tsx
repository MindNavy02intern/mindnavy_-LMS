import { Navigate } from 'react-router-dom';
import { useInstructorAuth } from '../context/InstructorAuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface Props {
  children: React.ReactNode;
}

// Mirrors routes/ProtectedRoute.tsx's shape exactly, scoped to the separate
// instructor session (useInstructorAuth, not useAuth) — an admin session and
// an instructor session are independent, so this must never fall back to the
// admin AuthContext.
export default function InstructorProtectedRoute({ children }: Props) {
  const { instructor, loading } = useInstructorAuth();

  if (loading) return <LoadingSpinner />;

  if (!instructor) return <Navigate to="/instructor/login" replace />;

  return <>{children}</>;
}
