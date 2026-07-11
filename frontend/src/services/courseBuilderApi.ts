// Course Builder API — sections and lessons under a course.
// All writes go to the real backend; flip USE_MOCK to true for offline dev.

import { getStoredToken } from '../api/adminAuth';
import {
  CourseBuilderApiError,
  type CourseSection,
  type Lesson,
  type CreateLessonPayload,
  type UpdateLessonPayload,
} from '../types/courseBuilder';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';
const USE_MOCK = false;

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

async function builderFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CourseBuilderApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? 'Not found.' :
      res.status === 429 ? 'Please slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      json.message ?? `HTTP ${res.status}`;
    throw new CourseBuilderApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise(r => setTimeout(() => r(data), 80));
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_SECTIONS: CourseSection[] = [];

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getSections(courseId: string): Promise<CourseSection[]> {
  if (USE_MOCK) return mockDelay(MOCK_SECTIONS.filter(s => s.courseId === courseId));
  return builderFetch<CourseSection[]>(`/courses/${encodeURIComponent(courseId)}/sections`);
}

export async function createSection(courseId: string, data: { title: string }): Promise<CourseSection> {
  if (USE_MOCK) {
    const s: CourseSection = {
      id: `sec-${Date.now()}`, courseId, title: data.title,
      order: MOCK_SECTIONS.length, lessons: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    MOCK_SECTIONS.push(s);
    return mockDelay(s);
  }
  return builderFetch<CourseSection>(`/courses/${encodeURIComponent(courseId)}/sections`, 'POST', data);
}

export async function updateSection(id: string, data: { title: string }): Promise<CourseSection> {
  if (USE_MOCK) {
    const s = MOCK_SECTIONS.find(x => x.id === id);
    if (!s) throw new CourseBuilderApiError(404, 'Section not found.');
    Object.assign(s, data, { updatedAt: new Date().toISOString() });
    return mockDelay({ ...s });
  }
  return builderFetch<CourseSection>(`/sections/${encodeURIComponent(id)}`, 'PATCH', data);
}

export async function deleteSection(id: string): Promise<{ id: string }> {
  if (USE_MOCK) {
    const idx = MOCK_SECTIONS.findIndex(x => x.id === id);
    if (idx === -1) throw new CourseBuilderApiError(404, 'Section not found.');
    MOCK_SECTIONS.splice(idx, 1);
    return mockDelay({ id });
  }
  return builderFetch<{ id: string }>(`/sections/${encodeURIComponent(id)}`, 'DELETE');
}

export async function createLesson(sectionId: string, payload: CreateLessonPayload): Promise<Lesson> {
  if (USE_MOCK) {
    const l: Lesson = {
      id: `les-${Date.now()}`, sectionId,
      title: payload.title, type: payload.type,
      content: payload.content ?? null,
      durationMin: payload.durationMin ?? null,
      order: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    return mockDelay(l);
  }
  return builderFetch<Lesson>(`/sections/${encodeURIComponent(sectionId)}/lessons`, 'POST', payload);
}

export async function updateLesson(id: string, patch: UpdateLessonPayload): Promise<Lesson> {
  if (USE_MOCK) throw new CourseBuilderApiError(501, 'Mock update not implemented.');
  return builderFetch<Lesson>(`/lessons/${encodeURIComponent(id)}`, 'PATCH', patch);
}

export async function deleteLesson(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return builderFetch<{ id: string }>(`/lessons/${encodeURIComponent(id)}`, 'DELETE');
}

export async function reorderSections(
  courseId: string,
  payload: { sections: { id: string; order: number }[]; lessons: { id: string; sectionId: string; order: number }[] },
): Promise<CourseSection[]> {
  if (USE_MOCK) return mockDelay(MOCK_SECTIONS.filter(s => s.courseId === courseId));
  return builderFetch<CourseSection[]>(`/courses/${encodeURIComponent(courseId)}/reorder`, 'PATCH', payload);
}
