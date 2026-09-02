// Certificate Templates API service — ADMIN base, Bearer auth.
// Mirrors quizzesApi.ts / learningPathsApi.ts: USE_MOCK flag, same fetch
// wrapper conventions.
//
// PATCH semantics: `layout`, when sent, REPLACES the whole layout object
// server-side (missing keys reset to defaults — no deep merge). Every caller
// of updateTemplate() that changes layout MUST send the complete current
// layout, never a partial diff — this is different from every other PATCH
// in this app and is enforced by UpdateTemplatePayload's shape (no Partial<>).

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  CertificateTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  LogoSignResponse,
} from '../types/certificates';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

export class CertificateTemplateApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'CertificateTemplateApiError';
  }
}

async function templatesFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}/certificate-templates${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CertificateTemplateApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')          :
      res.status === 429 ? 'Too many requests — slow down.'        :
      res.status === 503 ? (json.message ?? 'Service unavailable.') :
      json.message ?? `HTTP ${res.status}`;
    throw new CertificateTemplateApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

const MOCK_TEMPLATES: CertificateTemplate[] = [
  {
    id: 'tpl-1', name: 'Default Template',
    layout: {
      title: 'Certificate of Completion',
      body: 'This certifies that {{studentName}} has successfully completed {{courseTitle}} on {{date}}.',
      primaryColor: '#1E3A8A', accentColor: '#B8860B',
      signatureName: null, signatureTitle: null,
    },
    certificateCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export async function listTemplates(): Promise<CertificateTemplate[]> {
  if (USE_MOCK) return mockDelay(MOCK_TEMPLATES);
  return templatesFetch<CertificateTemplate[]>('/');
}

export async function getTemplate(id: string): Promise<CertificateTemplate> {
  if (USE_MOCK) return mockDelay(MOCK_TEMPLATES[0]);
  return templatesFetch<CertificateTemplate>(`/${id}`);
}

export async function createTemplate(payload: CreateTemplatePayload): Promise<CertificateTemplate> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<CertificateTemplate>({
      id: `tpl-${Date.now()}`, name: payload.name, layout: payload.layout,
      certificateCount: 0, createdAt: now, updatedAt: now,
    });
  }
  return templatesFetch<CertificateTemplate>('/', 'POST', payload);
}

export async function updateTemplate(id: string, patch: UpdateTemplatePayload): Promise<CertificateTemplate> {
  if (USE_MOCK) {
    const t = MOCK_TEMPLATES.find((x) => x.id === id) ?? MOCK_TEMPLATES[0];
    return mockDelay<CertificateTemplate>({ ...t, ...patch, updatedAt: new Date().toISOString() });
  }
  return templatesFetch<CertificateTemplate>(`/${id}`, 'PATCH', patch);
}

export async function deleteTemplate(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return templatesFetch<{ id: string }>(`/${id}`, 'DELETE');
}

// ── Logo (sign -> PUT direct to storage -> confirm) ─────────────────────────

export async function signLogoUpload(templateId: string, payload: { fileName: string; fileType: string }): Promise<LogoSignResponse> {
  if (USE_MOCK) {
    return mockDelay<LogoSignResponse>({
      uploadUrl: 'https://mock-storage.example.com/upload/mock-signed-url',
      path: `certificate-templates/${templateId}/mock-logo.png`,
      maxBytes: 2 * 1024 * 1024,
      expiresIn: 600,
    });
  }
  return templatesFetch<LogoSignResponse>(`/${templateId}/logo/sign`, 'POST', payload);
}

export async function confirmLogoUpload(templateId: string, path: string): Promise<CertificateTemplate> {
  if (USE_MOCK) {
    const t = MOCK_TEMPLATES.find((x) => x.id === templateId) ?? MOCK_TEMPLATES[0];
    return mockDelay<CertificateTemplate>({ ...t, layout: { ...t.layout, logoUrl: 'https://mock-storage.example.com/logo.png' } });
  }
  return templatesFetch<CertificateTemplate>(`/${templateId}/logo/confirm`, 'POST', { path });
}

export async function removeLogo(templateId: string): Promise<CertificateTemplate> {
  if (USE_MOCK) {
    const t = MOCK_TEMPLATES.find((x) => x.id === templateId) ?? MOCK_TEMPLATES[0];
    return mockDelay<CertificateTemplate>({ ...t, layout: { ...t.layout, logoUrl: null } });
  }
  return templatesFetch<CertificateTemplate>(`/${templateId}/logo`, 'DELETE');
}
