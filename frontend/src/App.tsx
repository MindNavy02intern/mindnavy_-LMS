import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import InstructorProtectedRoute from './routes/InstructorProtectedRoute';
import { InstructorAuthProvider } from './context/InstructorAuthContext';

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
const PublicVerifyPage               = lazy(() => import('./pages/PublicVerifyPage'));
const InstructorsPage                = lazy(() => import('./pages/Instructors/InstructorsPage'));
const InstructorProfilePage          = lazy(() => import('./pages/Instructors/InstructorProfilePage'));
const LearnersPage                   = lazy(() => import('./pages/Learners/LearnersPage'));
const CompetenciesPage               = lazy(() => import('./pages/Competencies/CompetenciesPage'));
const ReportsPage                    = lazy(() => import('./pages/Reports/ReportsPage'));
const FinancePage                    = lazy(() => import('./pages/Finance/FinancePage'));
const NotificationsPage              = lazy(() => import('./pages/Notifications/NotificationsPage'));
const IntegrationsPage               = lazy(() => import('./pages/Integrations/IntegrationsPage'));

// Instructor Dashboard — separate portal, separate session (see
// context/InstructorAuthContext.tsx). Phase 2 replaces the Phase 1 stub
// landing page with the real Dashboard + Profile; the other 10 nav items
// (blueprint Section 1.4) share one Coming Soon placeholder until their own
// phase lands. Aliased to avoid colliding with the admin-side
// pages/Instructors/InstructorProfilePage import above — same base name,
// different folder, different audience.
const InstructorLoginPage            = lazy(() => import('./pages/instructor/InstructorLoginPage'));
const InstructorDashboardPage        = lazy(() => import('./pages/instructor/InstructorDashboardPage'));
const InstructorSelfProfilePage      = lazy(() => import('./pages/instructor/InstructorProfilePage'));
// Phase 3 — My Courses + Course Builder + My Live Sessions replace their
// Coming Soon stubs.
const InstructorCoursesPage          = lazy(() => import('./pages/instructor/InstructorCoursesPage'));
const InstructorCourseBuilderPage    = lazy(() => import('./pages/instructor/InstructorCourseBuilderPage'));
const InstructorLiveSessionsPage     = lazy(() => import('./pages/instructor/InstructorLiveSessionsPage'));
const InstructorStudentsPage         = lazy(() => import('./pages/instructor/InstructorStudentsPage'));
// Phase 5 — My Reviews + My Competencies + My Earnings + My Reports replace
// their Coming Soon stubs.
const InstructorReviewsPage          = lazy(() => import('./pages/instructor/InstructorReviewsPage'));
const InstructorCompetenciesPage     = lazy(() => import('./pages/instructor/InstructorCompetenciesPage'));
const InstructorEarningsPage         = lazy(() => import('./pages/instructor/InstructorEarningsPage'));
const InstructorReportsPage          = lazy(() => import('./pages/instructor/InstructorReportsPage'));
// Phase 6 (FINAL) — Messages + Settings replace their Coming Soon stubs.
// My Certifications is also wired here even though it wasn't explicitly
// scoped to Phase 6 — its feature already existed as a tab inside My
// Profile, but the dedicated sidebar route never pointed at it; see
// InstructorCertificationsPage.tsx's header comment.
const InstructorMessagesPage         = lazy(() => import('./pages/instructor/InstructorMessagesPage'));
const InstructorSettingsPage         = lazy(() => import('./pages/instructor/InstructorSettingsPage'));
const InstructorCertificationsPage   = lazy(() => import('./pages/instructor/InstructorCertificationsPage'));

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

        {/*
         * Public certificate verification — QR codes on printed/downloaded
         * certificate PDFs link here. Genuinely public: no ProtectedRoute,
         * no AdminLayout/sidebar. Must work for a logged-out visitor.
         */}
        <Route path="/verify/:code" element={<PublicVerifyPage />} />

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
         * Public so the user can reach it right after login but before full session.
         * LoginPage.tsx redirects here when GET /api/admin/devices/check returns
         * { requiresVerification: true } instead of going straight to /dashboard.
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
        <Route
          path="/instructors"
          element={
            <ProtectedRoute>
              <InstructorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructors/:id/profile"
          element={
            <ProtectedRoute>
              <InstructorProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learners"
          element={
            <ProtectedRoute>
              <LearnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/competencies"
          element={
            <ProtectedRoute>
              <CompetenciesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports-analytics"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/finance"
          element={
            <ProtectedRoute>
              <FinancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/integrations"
          element={
            <ProtectedRoute>
              <IntegrationsPage />
            </ProtectedRoute>
          }
        />

        {/*
         * Instructor Dashboard subtree — entirely separate session from the
         * admin AuthContext above (InstructorAuthContext, separate
         * localStorage key, separate backend session table). Scoped to just
         * these two routes via a layout Route rather than wrapping the whole
         * app in main.tsx like AuthProvider does: AuthProvider is the
         * primary, always-needed session for every admin page, so it's fine
         * to have it resolve on every load. InstructorAuthProvider would
         * otherwise force EVERY admin page load to also wait on a GET
         * /api/instructor/auth/me call that has nothing to do with the page
         * being viewed — scoping it here means only /instructor/* pays that
         * cost, and the two logins can coexist in the same browser without
         * either clobbering the other's token.
         */}
        <Route element={<InstructorAuthProvider><Outlet /></InstructorAuthProvider>}>
          <Route path="/instructor/login" element={<InstructorLoginPage />} />
          <Route
            path="/instructor/dashboard"
            element={
              <InstructorProtectedRoute>
                <InstructorDashboardPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/profile"
            element={
              <InstructorProtectedRoute>
                <InstructorSelfProfilePage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/courses"
            element={
              <InstructorProtectedRoute>
                <InstructorCoursesPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/courses/:id/builder"
            element={
              <InstructorProtectedRoute>
                <InstructorCourseBuilderPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/live-sessions"
            element={
              <InstructorProtectedRoute>
                <InstructorLiveSessionsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/students"
            element={
              <InstructorProtectedRoute>
                <InstructorStudentsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/reviews"
            element={
              <InstructorProtectedRoute>
                <InstructorReviewsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/competencies"
            element={
              <InstructorProtectedRoute>
                <InstructorCompetenciesPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/earnings"
            element={
              <InstructorProtectedRoute>
                <InstructorEarningsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/reports"
            element={
              <InstructorProtectedRoute>
                <InstructorReportsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/certifications"
            element={
              <InstructorProtectedRoute>
                <InstructorCertificationsPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/messages"
            element={
              <InstructorProtectedRoute>
                <InstructorMessagesPage />
              </InstructorProtectedRoute>
            }
          />
          <Route
            path="/instructor/settings"
            element={
              <InstructorProtectedRoute>
                <InstructorSettingsPage />
              </InstructorProtectedRoute>
            }
          />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
