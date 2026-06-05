import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import TrustedDevicesPage from './pages/TrustedDevicesPage';
import VerifyDevicePage from './pages/VerifyDevicePage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './routes/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
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

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
