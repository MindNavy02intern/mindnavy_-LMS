// Upload API — mirrors lmApi.ts pattern: flip USE_MOCK=false -> real endpoints,
// zero other changes needed. Base is the same Express server.
//
// The frontend PUTs raw bytes directly to the signed URL (Supabase storage);
// the backend never receives file bytes — it only issues and verifies URLs.
// Use XMLHttpRequest for the PUT so upload progress events work (see
// ThumbnailUpload.tsx). This module only covers sign / confirm / delete.

import { getStoredToken } from './adminAuth';
import {
  UploadApiError,
  type UploadSignRequest,
  type UploadSignResponse,
  type UploadConfirmRequest,
  type UploadConfirmResponse,
} from '../types/uploads';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';
const USE_MOCK = false;

// ── Mock data ──────────────────────────────────────────────────────────────────
// Shaped exactly like the real response — swapping USE_MOCK=true/false changes
// zero frontend logic (contract B6 parity guarantee).

const MOCK_SIGN: UploadSignResponse = {
  uploadUrl: 'https://mock-storage.example.com/upload/mock-signed-url',
  path: 'mock-course-id/mock-uuid-thumbnail.jpg',
  kind: 'thumbnail',
  maxBytes: 5 * 1024 * 1024,
  expiresIn: 600,
};

const MOCK_CONFIRM: UploadConfirmResponse = {
  url: 'https://mock-storage.example.com/thumbnails/mock-course-id/thumbnail.jpg',
};

function mockDelay<T>(data: T, ms = 80): Promise<T> {
  return new Promise(r => setTimeout(() => r(data), ms));
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

async function uploadFetch<T>(path: string, options: RequestInit): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    throw new UploadApiError(res.status, json.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function signUpload(req: UploadSignRequest): Promise<UploadSignResponse> {
  if (USE_MOCK) return mockDelay(MOCK_SIGN);
  return uploadFetch<UploadSignResponse>('/uploads/sign', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function confirmUpload(req: UploadConfirmRequest): Promise<UploadConfirmResponse> {
  if (USE_MOCK) return mockDelay(MOCK_CONFIRM);
  return uploadFetch<UploadConfirmResponse>('/uploads/confirm', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function deleteUpload(path: string, kind: UploadKind = 'thumbnail'): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined as void);
  await uploadFetch<void>(`/uploads?path=${encodeURIComponent(path)}&kind=${kind}`, {
    method: 'DELETE',
  });
}
