import { fetchWithRetry } from '../lib/fetchWithRetry';
// Instructor auth API — separate from adminAuth.ts by design (Section 0 of
// INSTRUCTOR_DASHBOARD_BLUEPRINT.docx): a different audience, a different
// backend session table (AppUserSession, not AdminSession), and a different
// localStorage key so an admin and an instructor session can coexist in the
// same browser without clobbering each other.
//
// Token lifecycle mirrors adminAuth.ts exactly:
//   login() → stores token in localStorage
//   apiGetInstructorMe() → used on mount to restore session
//   apiInstructorLogout() → removes token from localStorage

export interface InstructorUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  verificationState: string;
}

export interface InstructorLoginResult {
  token: string;
  instructor: InstructorUser;
}

const INSTRUCTOR_API = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL ?? 'http://localhost:5001/api/instructor/auth';
const TOKEN_KEY = 'mn_instructor_token';

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getStoredInstructorToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeInstructorToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeInstructorToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function instructorFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optHeaders, ...rest } = options;
  const res = await fetchWithRetry(`${INSTRUCTOR_API}${path}`, {
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

export async function apiInstructorLogin(email: string, password: string): Promise<InstructorLoginResult> {
  return instructorFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiGetInstructorMe(token: string): Promise<{ instructor: InstructorUser }> {
  return instructorFetch('/me', { headers: bearer(token) });
}

export async function apiInstructorLogout(token: string): Promise<void> {
  // Best-effort — clear local state regardless of whether the server responds.
  await instructorFetch('/logout', { method: 'POST', headers: bearer(token) }).catch(err => console.error(err));
}

export interface ChangePasswordResult {
  success: boolean;
  message: string;
  errors?: string[];
}

// Does NOT throw on a validation/wrong-password failure — the backend
// returns { success: false, message } with a 400, which the Settings page
// needs to show inline, not as a thrown error. Only a genuine transport/
// session failure throws.
export async function apiInstructorChangePassword(token: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const res = await fetchWithRetry(`${INSTRUCTOR_API}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...bearer(token) },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.status === 401) throw new Error('Your session has expired — please log in again.');
  const body = await res.json().catch(() => ({ success: false, message: 'Request failed' }));
  return body as ChangePasswordResult;
}
