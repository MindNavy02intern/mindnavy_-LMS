// Issued Certificates API service — ADMIN base, Bearer auth.
// Mirrors quizzesApi.ts / learningPathsApi.ts for the JSON endpoints. The PDF
// endpoint is special: it streams application/pdf (or a 400 JSON error for a
// revoked cert), so it gets its own blob-fetch function instead of the shared
// JSON wrapper — a plain <a href="/api/admin/certificates/:id/pdf"> would
// never carry the Bearer header and would just 401.

import { getStoredToken } from '../api/adminAuth';
import type {
  Certificate,
  CertificatesPage,
  ListCertificatesParams,
  IssueCertificatePayload,
  ReissueCertificatePayload,
} from '../types/certificates';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

export class CertificateApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'CertificateApiError';
  }
}

async function certFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/certificates${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CertificateApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')          :
      res.status === 429 ? 'Too many requests — slow down.'        :
      res.status === 503 ? (json.message ?? 'Service unavailable.') :
      json.message ?? `HTTP ${res.status}`;
    throw new CertificateApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

const MOCK_CERTIFICATES: Certificate[] = [
  {
    id: 'cert-1', userId: 'user-1', studentName: 'Alice Brown',
    courseId: 'course-1', courseTitle: 'Complete React Developer',
    templateId: null, templateName: null,
    verificationCode: 'a'.repeat(32), status: 'active',
    issuedAt: '2026-01-01T00:00:00.000Z', revokedAt: null, expiresAt: null,
  },
];

export async function listCertificates(params: ListCertificatesParams = {}): Promise<CertificatesPage> {
  if (USE_MOCK) return mockDelay({ items: MOCK_CERTIFICATES, total: MOCK_CERTIFICATES.length, limit: 100, offset: 0 });
  const qs = new URLSearchParams();
  if (params.courseId) qs.set('courseId', params.courseId);
  if (params.userId)   qs.set('userId', params.userId);
  if (params.status)   qs.set('status', params.status);
  if (params.limit !== undefined)  qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return certFetch<CertificatesPage>(query ? `/?${query}` : '/');
}

export async function issueCertificate(payload: IssueCertificatePayload): Promise<Certificate> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<Certificate>({
      id: `cert-${Date.now()}`, userId: payload.userId, studentName: 'Mock Student',
      courseId: payload.courseId, courseTitle: 'Mock Course',
      templateId: payload.templateId ?? null, templateName: payload.templateId ? 'Mock Template' : null,
      verificationCode: Math.random().toString(16).slice(2).padEnd(32, '0'),
      status: 'active', issuedAt: now, revokedAt: null, expiresAt: null,
    });
  }
  return certFetch<Certificate>('/', 'POST', payload);
}

export async function revokeCertificate(id: string): Promise<Certificate> {
  if (USE_MOCK) {
    const c = MOCK_CERTIFICATES.find((x) => x.id === id) ?? MOCK_CERTIFICATES[0];
    return mockDelay<Certificate>({ ...c, status: 'revoked', revokedAt: new Date().toISOString() });
  }
  return certFetch<Certificate>(`/${id}/revoke`, 'POST');
}

export async function reissueCertificate(id: string, payload: ReissueCertificatePayload = {}): Promise<Certificate> {
  if (USE_MOCK) {
    const c = MOCK_CERTIFICATES.find((x) => x.id === id) ?? MOCK_CERTIFICATES[0];
    return mockDelay<Certificate>({
      ...c, status: 'active', revokedAt: null,
      verificationCode: Math.random().toString(16).slice(2).padEnd(32, '0'),
      issuedAt: new Date().toISOString(),
      ...(payload.templateId !== undefined ? { templateId: payload.templateId } : {}),
    });
  }
  return certFetch<Certificate>(`/${id}/reissue`, 'POST', payload);
}

export async function setCertificateExpiry(id: string, expiresAt: string | null): Promise<Certificate> {
  if (USE_MOCK) {
    const c = MOCK_CERTIFICATES.find((x) => x.id === id) ?? MOCK_CERTIFICATES[0];
    return mockDelay<Certificate>({ ...c, expiresAt });
  }
  return certFetch<Certificate>(`/${id}/expiry`, 'PATCH', { expiresAt });
}

// ── PDF download — blob + Bearer, never a plain <a href> ─────────────────────────
// The backend distinguishes a real PDF (200, application/pdf) from a revoked
// cert (400, application/json) by content-type as well as status, so this
// checks both before ever treating the response body as a blob.

export async function downloadCertificatePdf(id: string): Promise<Blob> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/certificates/${id}/pdf`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  const contentType = res.headers.get('content-type') ?? '';

  if (!res.ok || !contentType.includes('application/pdf')) {
    let message = res.status === 401 ? 'Unauthorized — please log in again.' : `HTTP ${res.status}`;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json() as { message?: string };
        if (json.message) message = json.message;
      } catch { /* non-JSON despite the header */ }
    }
    throw new CertificateApiError(res.status, message);
  }

  return res.blob();
}

// Triggers a real browser download from an already-fetched blob via a
// short-lived object URL — the only way to save a Bearer-authenticated
// response as a file (a plain anchor tag can't carry the auth header).
export function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
