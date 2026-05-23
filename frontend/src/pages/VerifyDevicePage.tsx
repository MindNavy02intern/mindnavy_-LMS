import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import OtpVerificationModal from '../components/auth/OtpVerificationModal';

/**
 * VerifyDevicePage — Device recognition flow screen.
 *
 * This page is the landing point when the backend detects a login from an
 * unrecognised device and requires OTP verification before granting access.
 *
 * Backend integration (when ready):
 *   1. After Supabase signIn succeeds, call GET /api/devices/check.
 *   2. If the response is { requiresVerification: true }, redirect to /verify-device
 *      instead of /dashboard.
 *   3. POST /api/auth/otp/send is called automatically when this page mounts.
 *   4. On successful OTP → navigate to /dashboard.
 *   5. On close / cancel → sign out and navigate to /login.
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
