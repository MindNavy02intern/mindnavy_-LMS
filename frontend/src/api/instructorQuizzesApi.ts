// Instructor self-service Quizzes API — mirrors services/quizzesApi.ts (admin)
// field-for-field, scoped to /api/instructor/courses/:id/quizzes since the
// backend reuses the exact admin quizzes.service functions (types/quizzes.ts
// applies unchanged). Unlike admin, createMyQuiz never takes a courseId in
// the payload — it's forced server-side from the URL's :id.

import { getStoredInstructorToken } from './instructorAuth';
import type {
  Quiz,
  QuizDetail,
  Question,
  CreateQuizPayload,
  UpdateQuizPayload,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  ReorderQuestionsPayload,
} from '../types/quizzes';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorQuizApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorQuizApiError';
  }
}

async function quizFetch<T>(
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

  if (res.status === 401) throw new InstructorQuizApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.') :
      res.status === 429 ? 'Too many requests — slow down.' :
      json.message ?? `HTTP ${res.status}`;
    throw new InstructorQuizApiError(res.status, msg);
  }

  return json.data as T;
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

export function listMyQuizzes(courseId: string): Promise<Quiz[]> {
  return quizFetch<Quiz[]>(`/courses/${encodeURIComponent(courseId)}/quizzes`);
}

export function getMyQuiz(courseId: string, quizId: string): Promise<QuizDetail> {
  return quizFetch<QuizDetail>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`);
}

export function createMyQuiz(courseId: string, payload: Omit<CreateQuizPayload, 'courseId'>): Promise<Quiz> {
  return quizFetch<Quiz>(`/courses/${encodeURIComponent(courseId)}/quizzes`, 'POST', payload);
}

export function updateMyQuiz(courseId: string, quizId: string, patch: Omit<UpdateQuizPayload, 'courseId'>): Promise<Quiz> {
  return quizFetch<Quiz>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`, 'PATCH', patch);
}

export function deleteMyQuiz(courseId: string, quizId: string): Promise<{ id: string }> {
  return quizFetch<{ id: string }>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`, 'DELETE');
}

// ── Questions ─────────────────────────────────────────────────────────────────

export function createMyQuestion(courseId: string, quizId: string, payload: CreateQuestionPayload): Promise<Question> {
  return quizFetch<Question>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/questions`, 'POST', payload);
}

export function updateMyQuestion(courseId: string, quizId: string, questionId: string, patch: UpdateQuestionPayload): Promise<Question> {
  return quizFetch<Question>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}`, 'PATCH', patch);
}

export function deleteMyQuestion(courseId: string, quizId: string, questionId: string): Promise<{ id: string }> {
  return quizFetch<{ id: string }>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}`, 'DELETE');
}

// ── Reorder (bulk) ────────────────────────────────────────────────────────────

export function reorderMyQuestions(courseId: string, quizId: string, payload: ReorderQuestionsPayload): Promise<QuizDetail> {
  return quizFetch<QuizDetail>(`/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/reorder`, 'PATCH', payload);
}
