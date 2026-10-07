import { fetchWithRetry } from '../lib/fetchWithRetry';
// Admin auth API — JWT-based, talks to Express backend at VITE_API_BASE_URL
//
// Token lifecycle:
//   login() → stores token in localStorage
//   apiGetMe() → used on mount to restore session
//   apiLogout() → removes token from localStorage
//   getStoredToken() → read by other API modules to attach Authorization header

export interface AdminUser {
  id:          string;
  email:       string;
  name:        string;
  fullName?:   string;
  phone?:      string | null;
  bio?:        string | null;
  role:        string;
  mfaEnabled?: boolean;
}

/** A real session — the only shape that carries a token. */
export interface SessionResult {
  token: string;
  admin: AdminUser;
  mfaRequired?: false;
  deviceVerificationRequired?: false;
}

/**
 * Credentials were right but this browser isn't a trusted device. There is
 * NO session yet: verificationToken can only request and submit the email
 * code (apiSendDeviceLoginOtp / apiVerifyDeviceLogin), and is never stored
 * as the auth token.
 */
export interface DeviceVerificationChallenge {
  deviceVerificationRequired: true;
  verificationToken: string;
  /** Where the code was sent — shown on the verify screen. */
  email: string;
  mfaRequired?: false;
}

export type LoginResult =
  | SessionResult
  | { mfaRequired: true; mfaToken: string; deviceVerificationRequired?: false }
  | DeviceVerificationChallenge;

/** What the TOTP step can return: a session, or (new browser) the device step. */
export type MfaLoginResult = SessionResult | DeviceVerificationChallenge;

const ADMIN_API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';
const TOKEN_KEY = 'mn_admin_token';

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optHeaders, ...rest } = options;
  const res = await fetchWithRetry(`${ADMIN_API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...optHeaders },
  });
  const body = await res.json().catch(() => ({ message: 'Request failed' }));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Request failed');
  return body as T;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResult> {
  return adminFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Second step of login when the admin has TOTP MFA enabled — takes the
// short-lived mfaToken from apiLogin's mfaRequired response + a 6-digit
// authenticator code. Returns a session, or — on a browser that isn't
// trusted yet — the same device-verification challenge a password login can.
export async function apiVerifyMfaLogin(mfaToken: string, code: string): Promise<MfaLoginResult> {
  return adminFetch('/auth/mfa/login-verify', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, code }),
  });
}

// ── New-device login step (server-enforced) ───────────────────────────────────
// Used only while a DeviceVerificationChallenge is pending. No Authorization
// header — no session exists yet; the verificationToken goes in the body.

export async function apiSendDeviceLoginOtp(verificationToken: string): Promise<void> {
  await adminFetch('/login/device/send-otp', {
    method: 'POST',
    body: JSON.stringify({ verificationToken }),
  });
}

export async function apiVerifyDeviceLogin(
  verificationToken: string,
  code: string,
  trustDevice: boolean,
): Promise<SessionResult> {
  return adminFetch('/login/device/verify', {
    method: 'POST',
    body: JSON.stringify({ verificationToken, code, trustDevice }),
  });
}

export async function apiGetMe(token: string): Promise<{ admin: AdminUser }> {
  return adminFetch('/me', { headers: bearer(token) });
}

export async function apiLogout(token: string): Promise<void> {
  // Best-effort — we clear local state regardless of whether the server responds
  await adminFetch('/logout', { method: 'POST', headers: bearer(token) }).catch(err => console.error(err));
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function apiForgotPassword(email: string): Promise<void> {
  await adminFetch('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await adminFetch('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

// ── Profile Page self-service ─────────────────────────────────────────────────

export async function apiUpdateProfile(
  token: string,
  updates: { fullName?: string; phone?: string | null; bio?: string | null },
): Promise<{ admin: AdminUser }> {
  return adminFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
    headers: bearer(token),
  });
}

export async function apiChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  return adminFetch('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
    headers: bearer(token),
  });
}

// ── TOTP MFA (per-admin, ProfilePage's Two-Factor Authentication row) ───────────

export interface MfaSetupResult { secret: string; qrCodeDataUrl: string }

export async function apiMfaSetup(token: string): Promise<{ success: boolean; data: MfaSetupResult }> {
  return adminFetch('/auth/mfa/setup', { method: 'POST', headers: bearer(token) });
}

export async function apiMfaVerify(token: string, secret: string, code: string): Promise<{ success: boolean; message: string }> {
  return adminFetch('/auth/mfa/verify', {
    method: 'POST', headers: bearer(token), body: JSON.stringify({ secret, code }),
  });
}

export async function apiMfaDisable(token: string, password: string): Promise<{ success: boolean; message: string }> {
  return adminFetch('/auth/mfa/disable', {
    method: 'POST', headers: bearer(token), body: JSON.stringify({ password }),
  });
}

// ── OTP ───────────────────────────────────────────────────────────────────────

export async function apiSendOtp(email: string, token: string): Promise<void> {
  await adminFetch('/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: bearer(token),
  });
}

export async function apiVerifyOtp(
  code: string,
  trustDevice: boolean,
  token: string,
): Promise<{ success: boolean; message: string }> {
  return adminFetch('/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ code, trustDevice }),
    headers: bearer(token),
  });
}

// ── Device trust ──────────────────────────────────────────────────────────────

export async function apiCheckDevice(token: string): Promise<{ requiresVerification: boolean }> {
  return adminFetch('/devices/check', { headers: bearer(token) });
}
