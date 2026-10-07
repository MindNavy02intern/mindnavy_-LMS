import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import OtpVerificationModal from '../components/auth/OtpVerificationModal';
import { apiSendDeviceLoginOtp, apiVerifyDeviceLogin, type SessionResult } from '../api/adminAuth';
import type { VerifyOtpResponse } from '../types/device';

/**
 * VerifyDevicePage — new-device step of admin sign-in (server-enforced).
 *
 *   1. The admin's credentials were accepted, but the server didn't recognise
 *      this browser, so POST /api/admin/login answered
 *      { deviceVerificationRequired, verificationToken } — and issued NO
 *      session. LoginPage sends the admin here.
 *   2. The code is requested with POST /api/admin/login/device/send-otp
 *      (automatically when the modal opens) using that verificationToken.
 *   3. POST /api/admin/login/device/verify returns the real session only when
 *      the code is right. "Trust this device" makes future logins from this
 *      browser/network skip this page.
 *   4. Cancel → the pending verification is dropped; back to /login.
 *
 * The verificationToken lives only in AuthContext memory. Refreshing this page
 * loses it and sends the admin back to sign in — there is no stored session to
 * fall through to, which is what closes the old "refresh to skip" gap.
 */
export default function VerifyDevicePage() {
  const { pendingDeviceVerification, acceptSession, cancelDeviceVerification } = useAuth();
  const navigate = useNavigate();
  // Held until the success animation finishes, then committed in handleSuccess.
  const [session, setSession] = useState<SessionResult | null>(null);

  const verificationToken = pendingDeviceVerification?.verificationToken;

  // Stable per ticket — the modal re-sends whenever this function changes.
  const handleSend = useCallback(async () => {
    if (!verificationToken) return;
    await apiSendDeviceLoginOtp(verificationToken);
  }, [verificationToken]);

  const handleVerify = useCallback(async (code: string, trustDevice: boolean): Promise<VerifyOtpResponse> => {
    if (!verificationToken) {
      return { success: false, message: 'Your verification session has expired. Please sign in again.' };
    }
    // Throws with the server's message on a wrong/expired code (the modal shows it).
    const result = await apiVerifyDeviceLogin(verificationToken, code, trustDevice);
    setSession(result);
    return { success: true, message: 'Verified.' };
  }, [verificationToken]);

  const handleSuccess = () => {
    if (session) acceptSession(session);
    navigate('/dashboard', { replace: true });
  };

  const handleClose = () => {
    cancelDeviceVerification();
    navigate('/login', { replace: true });
  };

  // Arrived without a pending login (direct visit, refresh) → nothing to verify.
  if (!pendingDeviceVerification && !session) return <Navigate to="/login" replace />;

  return (
    // Brand background is visible through the modal's translucent overlay
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />

      <OtpVerificationModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        email={pendingDeviceVerification?.email ?? session?.admin.email ?? 'your registered email'}
        onSend={handleSend}
        onVerify={handleVerify}
      />
    </div>
  );
}
