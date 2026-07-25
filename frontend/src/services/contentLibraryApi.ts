// Content Library API service — v1. Extends the EXISTING course_contents table.
// Endpoints: /api/admin/content. Same sign -> direct PUT -> confirm pattern as
// course thumbnails/videos (see uploadsApi.ts / ThumbnailUpload.tsx) — but this
// feature has its OWN sign/confirm endpoints under /content, not the shared
// /uploads ones.

import { getStoredToken } from '../api/adminAuth';
import type {
  ContentItem,
  ContentListData,
  ContentListParams,
  ContentSignRequest,
  ContentSignResponse,
  ContentConfirmRequest,
  UpdateContentPayload,
} from '../types/contentLibrary';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Error class ───────────────────────────────────────────────────────────────

export class ContentLibraryApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'ContentLibraryApiError';
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function contentFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/content${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new ContentLibraryApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')                  :
      res.status === 429 ? 'Too many requests — slow down and retry.'      :
      res.status === 503 ? (json.message ?? 'Storage is not configured yet.') :
      json.message ?? `HTTP ${res.status}`;
    throw new ContentLibraryApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

const MOCK_DATA: ContentListData = {
  content: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 1 },
  typeCounts: { All: 0 },
};

// ── Public API ─────────────────────────────────────────────────────────────────

export async function listContent(params: ContentListParams = {}): Promise<ContentListData> {
  if (USE_MOCK) return mockDelay(MOCK_DATA);
  const qs = new URLSearchParams();
  if (params.search)   qs.set('search',   params.search);
  if (params.type)     qs.set('type',     params.type);
  if (params.tag)      qs.set('tag',      params.tag);
  if (params.courseId) qs.set('courseId', params.courseId);
  if (params.page)     qs.set('page',     String(params.page));
  if (params.limit)    qs.set('limit',    String(params.limit));
  return contentFetch<ContentListData>(`/?${qs.toString()}`);
}

export async function signContentUpload(req: ContentSignRequest): Promise<ContentSignResponse> {
  if (USE_MOCK) {
    return mockDelay<ContentSignResponse>({
      uploadUrl: 'https://mock-storage.example.com/upload/mock-signed-url',
      path: `mock/${Date.now()}-${req.fileName}`,
      type: 'DOCUMENT', maxBytes: 50 * 1024 * 1024, expiresIn: 600,
    });
  }
  return contentFetch<ContentSignResponse>('/sign', 'POST', req);
}

export async function confirmContentUpload(req: ContentConfirmRequest): Promise<ContentItem> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<ContentItem>({
      id: `content-${Date.now()}`, title: req.title ?? 'Untitled', type: 'DOCUMENT',
      courseId: req.courseId ?? null, courseTitle: null,
      fileUrl: 'https://mock-storage.example.com/mock-file', sizeBytes: 1024, mimeType: 'application/pdf',
      tags: req.tags ?? [], uploadedBy: null, createdAt: now, updatedAt: now,
    });
  }
  return contentFetch<ContentItem>('/confirm', 'POST', req);
}

export async function updateContent(id: string, patch: UpdateContentPayload): Promise<ContentItem> {
  if (USE_MOCK) {
    return mockDelay<ContentItem>({
      id, title: patch.title ?? 'Untitled', type: 'DOCUMENT', courseId: patch.courseId ?? null,
      courseTitle: null, fileUrl: null, sizeBytes: null, mimeType: null,
      tags: patch.tags ?? [], uploadedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }
  return contentFetch<ContentItem>(`/${id}`, 'PATCH', patch);
}

export async function deleteContent(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return contentFetch<{ id: string }>(`/${id}`, 'DELETE');
}
