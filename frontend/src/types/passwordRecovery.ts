// ─────────────────────────────────────────────────────────────────────────────
// Password Reset & Recovery — TypeScript types
// These types model every UI state in the forgot-password and reset-password flows.
// ─────────────────────────────────────────────────────────────────────────────

/** Steps the ForgotPasswordPage cycles through */
export type ForgotPasswordStep =
  | 'email-input'   // initial: email text field
  | 'loading'       // waiting for the API call
  | 'email-sent'    // success: "check your inbox" screen
  | 'error';        // non-recoverable send error (rate limit, network)

/** Steps the ResetPasswordPage cycles through */
export type ResetPasswordStep =
  | 'loading'       // page just mounted: checking if the token in the URL is valid
  | 'token-error'   // token is missing, expired, or already used
  | 'form'          // valid token: show new-password inputs
  | 'submitting'    // form submitted, waiting for API
  | 'success'       // password changed — prompt user to sign in
  | 'error';        // update failed (token expired mid-form, network, etc.)

/**
 * Numeric strength score for a password.
 * 0 = no input, 1 = too short, 2 = weak, 3 = fair, 4 = good, 5 = strong
 */
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

/** Which individual password rules have been satisfied */
export interface PasswordChecks {
  minLength: boolean;   // >= 8 characters
  hasUpper: boolean;    // at least one A-Z
  hasLower: boolean;    // at least one a-z
  hasDigit: boolean;    // at least one 0-9
  hasSpecial: boolean;  // at least one !@#$%^&*...
}

/** Full result returned by the password strength analyser */
export interface PasswordStrengthResult {
  score: PasswordStrengthScore;
  label: string;       // "Too short" | "Weak" | "Fair" | "Good" | "Strong" | ""
  color: string;       // CSS colour for the active bars
  checks: PasswordChecks;
}

/** Payload for POST /api/auth/password-reset/request (future backend endpoint) */
export interface PasswordResetRequest {
  email: string;
}

/** Payload for POST /api/auth/password-reset/confirm (future backend endpoint) */
export interface PasswordResetConfirm {
  /** New plain-text password — hashed server-side */
  password: string;
  /** Supabase handles token via URL hash; backend may need it explicitly */
  token?: string;
}

/** Props for PasswordStrengthMeter component */
export interface PasswordStrengthMeterProps {
  password: string;
}
