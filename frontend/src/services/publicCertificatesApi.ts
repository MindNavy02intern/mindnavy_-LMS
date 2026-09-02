// Public Certificate Verification API — genuinely unauthenticated.
// Separate base (/api/public/certificates, NOT /api/admin/*) and a fetch
// wrapper with NO Authorization header at all — do not import getStoredToken
// here, and do not reuse certificatesApi.ts's wrapper even though the JSON
// envelope looks the same. This is what QR codes on printed/downloaded PDFs
// hit, from a logged-out browser.
//
// GET /verify/:code ALWAYS returns HTTP 200 with one of three `data.status`
// values (valid / revoked / not_found) — never a 404. There is deliberately
// no error path here beyond a genuine network failure.

import type { VerifyResult } from '../types/certificates';
import { fetchWithRetry } from '../lib/fetchWithRetry';

// Derived from the same VITE_API_BASE_URL every other service uses (so a
// deployment override follows one host, not two) — swapped to the public
// prefix rather than introducing a second env var.
const ADMIN_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';
const BASE = ADMIN_BASE.replace(/\/admin$/, '/public');

const USE_MOCK = false;

export class PublicCertificateApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicCertificateApiError';
  }
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

export async function verifyCertificate(code: string): Promise<VerifyResult> {
  if (USE_MOCK) return mockDelay({ status: 'not_found' });

  let res: Response;
  try {
    res = await fetchWithRetry(`${BASE}/certificates/verify/${encodeURIComponent(code)}`);
  } catch {
    throw new PublicCertificateApiError('Network error — please check your connection.');
  }

  let json: { success?: boolean; data?: VerifyResult; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false || !json.data) {
    throw new PublicCertificateApiError(json.message ?? `HTTP ${res.status}`);
  }

  return json.data;
}
