// ─────────────────────────────────────────────────────────────────────────────
// Password Recovery API — wraps Supabase auth methods.
//
// Supabase handles the email delivery and token verification natively,
// so no custom backend is needed for the core flow.
//
// Each function has a "TODO: BACKEND" comment for any custom logic
// (audit logs, rate limiting, forced session invalidation, etc.) that the
// Express server will eventually add on top of the Supabase calls.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase';

/**
 * Send a password-reset email to the given address.
 *
 * Supabase will email a link that redirects to /reset-password with a token
 * embedded in the URL hash (#access_token=...&type=recovery).
 *
 * Security note: we do NOT reveal whether the email exists in the database.
 * "User not found" errors are swallowed intentionally to prevent email enumeration.
 *
 * TODO: BACKEND → after this call, optionally POST /api/auth/password-reset/request
 * to record the attempt in an audit log or apply custom rate limiting.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  // Suppress "User not found" — always show success to the user (security best practice)
  if (error) {
    const isNotFound =
      error.message.toLowerCase().includes('not found') ||
      error.message.toLowerCase().includes('no user');

    if (!isNotFound) {
      // Real errors: rate limit exceeded, network failure, etc.
      throw error;
    }
  }
}

/**
 * Update the current user's password.
 * Only works when there is an active PASSWORD_RECOVERY session
 * (i.e., the user arrived via the email reset link).
 *
 * After a successful update, the user is signed out so they must
 * log in again with the new password — this invalidates any stolen sessions.
 *
 * TODO: BACKEND → after this call, POST /api/auth/password-reset/confirm to:
 *   - Log the password-change event
 *   - Revoke all other active sessions for this user
 *   - Send a "your password was changed" notification email
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) throw error;

  // Sign out for security — user must log in with the new password
  await supabase.auth.signOut();
}
