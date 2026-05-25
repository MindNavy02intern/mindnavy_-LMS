import { apiForgotPassword, apiResetPassword } from './adminAuth';

/**
 * Request a password reset code for the given email.
 * The code is sent to the admin's email (or printed to terminal in dev).
 *
 * Security note: "user not found" errors are swallowed so we never reveal
 * whether an email is registered in the system.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await apiForgotPassword(email);
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    const isNotFound =
      msg.includes('not found') || msg.includes('no user') || msg.includes('no admin');
    if (!isNotFound) throw err;
  }
}

/**
 * Set a new password using the code the admin received by email.
 * The backend validates the code and email before applying the change.
 */
export async function updatePassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await apiResetPassword(email, code, newPassword);
}
