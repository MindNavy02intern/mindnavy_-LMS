import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import OtpVerificationModal from '../components/auth/OtpVerificationModal';

/**
 * VerifyDevicePage — Device recognition flow screen.
 *
 * This page is the landing point when the backend detects a login from an
 * unrecognised device and requires OTP verification before granting access.
 *
 * Wired end-to-end (LoginPage.tsx + admin.service.js checkDeviceTrust/
 * verifyAdminOtp):
 *   1. After login succeeds, LoginPage calls GET /api/admin/devices/check.
 *   2. If the response is { requiresVerification: true }, it redirects here
 *      instead of /dashboard.
 *   3. POST /api/admin/otp/send is called automatically when this page mounts
 *      (inside OtpVerificationModal).
 *   4. On successful OTP → navigate to /dashboard. Checking "Trust this
 *      device" persists a TrustedDevice row so future logins from the same
 *      browser/network skip this page.
 *   5. On close / cancel → sign out and navigate to /login.
 *
 * Remaining gap (not closed by the above): the login token issued at step 0
 * is a normal AdminSession token regardless of whether this page is ever
 * reached — there is no separate "verified" session state, so this is a
 * client-side UX gate, not a server-enforced one. Closing that gap would mean
 * reworking AdminSession itself; out of scope here.
 * TODO: BACKEND — the backend should return a verified-session token here.
 *
 * The OtpVerificationModal is always open on this page (isOpen={true}).
 * The brand background is shown behind the modal's dark overlay for visual polish.
 */
export default function VerifyDevicePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleClose = async () => {
    // Closing the verification modal cancels the login attempt
    // TODO: BACKEND — optionally call /api/auth/session/invalidate here
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleSuccess = () => {
    // TODO: BACKEND — the backend should return a verified-session token here
    navigate('/dashboard', { replace: true });
  };

  return (
    // Brand background is visible through the modal's translucent overlay
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />

      <OtpVerificationModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        email={user?.email ?? 'your registered email'}
      />
    </div>
  );
}
