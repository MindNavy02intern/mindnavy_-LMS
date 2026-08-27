// Instructor self-service Courses + Course Builder API (Phase 3).
// Same fetch-wrapper convention as api/instructorSelfApi.ts — reuses the
// EXACT admin types (types/courses.ts, types/courseBuilder.ts) since the
// backend reuses the exact admin service functions; the response shapes are
// identical field-for-field.

import { getStoredInstructorToken } from './instructorAuth';
import {
  CourseApiError,
  type CourseDetail,
  type CourseListRow,
  type CoursesListParams,
  type CoursesListResponse,
  type CreateCoursePayload,
  type UpdateCoursePayload,
  type UpdateSettingsPayload,
  type CourseSettingsResponse,
  type SubmitCourseResponse,
} from '../types/courses';
import type { CourseSection, CreateLessonPayload, UpdateLessonPayload } from '../types/courseBuilder';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

async function instructorCoursesFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CourseApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string; errors?: string[] } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    // SUBMIT_CHECKS_FAILED (400) carries the full itemized readiness list in
    // `errors` — CourseApiError is the purpose-built class for exactly this,
    // same shape courseWorkflow.controller.js's badRequest(res, msg, {errors})
    // sends admin-side.
    throw new CourseApiError(res.status, msg, json.errors);
  }

  return json.data as T;
}

// ── Courses ───────────────────────────────────────────────────────────────────

export function listMyCourses(params: CoursesListParams = {}): Promise<CoursesListResponse> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  // Deliberately never sets ?instructor= — the backend forces it server-side
  // and ignores any client value regardless.
  return instructorCoursesFetch<CoursesListResponse>(`/courses?${qs.toString()}`);
}

export function getMyCourse(id: string): Promise<CourseDetail> {
  return instructorCoursesFetch<CourseDetail>(`/courses/${encodeURIComponent(id)}`);
}

export function createMyCourse(body: Omit<CreateCoursePayload, 'instructorId'>): Promise<CourseDetail> {
  return instructorCoursesFetch<CourseDetail>('/courses', 'POST', body);
}

export function updateMyCourse(id: string, body: Omit<UpdateCoursePayload, 'instructorId'>): Promise<CourseDetail> {
  return instructorCoursesFetch<CourseDetail>(`/courses/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function archiveMyCourse(id: string): Promise<{ id: string; status: string }> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(id)}`, 'DELETE');
}

export function restoreMyCourse(id: string): Promise<{ id: string; status: string }> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(id)}/restore`, 'POST');
}

// ── Workflow ────────────────────────────────────────────────────────────────

export function updateMyCourseSettings(id: string, body: UpdateSettingsPayload): Promise<CourseSettingsResponse> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(id)}/settings`, 'PATCH', body);
}

export function getMyCoursePreview(id: string): Promise<{ course: CourseDetail; sections: CourseSection[] }> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(id)}/preview`);
}

export function submitMyCourse(id: string): Promise<SubmitCourseResponse> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(id)}/submit`, 'POST');
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function listMySections(courseId: string): Promise<CourseSection[]> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections`);
}

export function createMySection(courseId: string, title: string): Promise<CourseSection> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections`, 'POST', { title });
}

export function updateMySection(courseId: string, sectionId: string, body: { title?: string; order?: number }): Promise<CourseSection> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}`, 'PATCH', body);
}

export function deleteMySection(courseId: string, sectionId: string): Promise<{ id: string }> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}`, 'DELETE');
}

// ── Lessons ───────────────────────────────────────────────────────────────────

export function createMyLesson(courseId: string, sectionId: string, body: CreateLessonPayload) {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}/lessons`, 'POST', body);
}

export function updateMyLesson(courseId: string, sectionId: string, lessonId: string, body: UpdateLessonPayload) {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}/lessons/${encodeURIComponent(lessonId)}`, 'PATCH', body);
}

export function deleteMyLesson(courseId: string, sectionId: string, lessonId: string): Promise<{ id: string }> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}/lessons/${encodeURIComponent(lessonId)}`, 'DELETE');
}

// ── Reorder ────────────────────────────────────────────────────────────────────

export interface ReorderPayload {
  sections?: { id: string; order: number }[];
  lessons?: { id: string; sectionId: string; order: number }[];
}

export function reorderMyCourse(courseId: string, body: ReorderPayload): Promise<CourseSection[]> {
  return instructorCoursesFetch(`/courses/${encodeURIComponent(courseId)}/reorder`, 'PATCH', body);
}

export type { CourseListRow };
