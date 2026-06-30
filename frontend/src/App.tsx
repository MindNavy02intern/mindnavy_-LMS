import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';

const LoginPage          = lazy(() => import('./pages/LoginPage'));
const SignupPage         = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const TrustedDevicesPage = lazy(() => import('./pages/TrustedDevicesPage'));
const VerifyDevicePage   = lazy(() => import('./pages/VerifyDevicePage'));
const NotFoundPage                  = lazy(() => import('./pages/NotFoundPage'));
const RolesPermissionsStandalonePage = lazy(() => import('./pages/RolesPermissionsStandalonePage'));
const SystemSettingsPage             = lazy(() => import('./pages/SystemSettingsPage'));
const ProfilePage                    = lazy(() => import('./pages/ProfilePage'));
const LearningManagementPage         = lazy(() => import('./pages/LearningManagementPage'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
        Loading MindNavy...
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Root → redirect to dashboard (ProtectedRoute redirects to /login if not signed in) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public routes */}
        <Route path="/login"  element={<LoginPage />}  />
        <Route path="/signup" element={<SignupPage />} />

        {/* Password recovery routes — public, no auth required */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/*
         * /reset-password receives the Supabase recovery token in the URL hash.
         * The page reads it, verifies via onAuthStateChange(PASSWORD_RECOVERY), then
         * shows the new-password form.
         * TODO: BACKEND — if the backend issues its own tokens, parse them in ResetPasswordPage.
         */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/*
         * Device verification route — shown when the backend detects an unrecognised device.
         * Public so the user can reach it right after Supabase login but before full session.
         * TODO: BACKEND — redirect here from LoginPage when GET /api/devices/check returns
         *   { requiresVerification: true } instead of going straight to /dashboard.
         */}
        <Route path="/verify-device" element={<VerifyDevicePage />} />

        {/* Protected routes — must be logged in */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trusted-devices"
          element={
            <ProtectedRoute>
              <TrustedDevicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles-permissions"
          element={
            <ProtectedRoute>
              <RolesPermissionsStandalonePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SystemSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learning-management"
          element={
            <ProtectedRoute>
              <LearningManagementPage />
            </ProtectedRoute>
          }
        />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
