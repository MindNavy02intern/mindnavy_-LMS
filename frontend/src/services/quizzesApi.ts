// Quizzes & Exams API service — v1 (admin builder only).
// Endpoints: /api/admin/quizzes (list + CRUD + questions + reorder).
// Mirrors learningPathsApi.ts / coursesApi.ts: USE_MOCK flag, same fetch
// wrapper conventions, Bearer auth. Mock shapes match every field, including
// server-derived ones (questionCount, totalPoints, autoGradable).
//
// No QUIZZES_CONTRACT.md exists in the repo — endpoints/shapes reverse-
// engineered directly from backend/src/{routes,controllers,services,
// validators}/quizzes.*.js (verified live against a running server).

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
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

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Error class ───────────────────────────────────────────────────────────────

export class QuizApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'QuizApiError';
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function quizFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}/quizzes${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new QuizApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')          :
      res.status === 429 ? 'Too many requests — slow down.'        :
      res.status === 503 ? (json.message ?? 'Service unavailable.') :
      json.message ?? `HTTP ${res.status}`;
    throw new QuizApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q-1', quizId: 'quiz-1', type: 'MULTIPLE_CHOICE',
    prompt: 'Which hook manages local component state?',
    data: { options: ['useEffect', 'useState', 'useRef', 'useMemo'], correctIndex: 1 },
    points: 2, order: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'q-2', quizId: 'quiz-1', type: 'TRUE_FALSE',
    prompt: 'React re-renders every component on every state change.',
    data: { correct: false },
    points: 1, order: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'q-3', quizId: 'quiz-1', type: 'MULTI_SELECT',
    prompt: 'Which of these are valid array methods?',
    data: { options: ['map', 'filter', 'push', 'reducer'], correctIndexes: [0, 1, 2] },
    points: 3, order: 2,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'q-4', quizId: 'quiz-1', type: 'ESSAY',
    prompt: 'Explain the virtual DOM in your own words.',
    data: null,
    points: 5, order: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const MOCK_QUIZZES: Quiz[] = [
  {
    id: 'quiz-1', title: 'React Fundamentals Quiz', description: 'Covers hooks and rendering.',
    courseId: 'course-1', passingGrade: 70, attemptsAllowed: 3, timeLimit: 20,
    randomizeQuestions: false, questionCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'quiz-2', title: 'General Knowledge Check', description: null,
    courseId: null, passingGrade: 60, attemptsAllowed: null, timeLimit: null,
    randomizeQuestions: true, questionCount: 0,
    createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z',
  },
];

const MOCK_DETAIL: QuizDetail = {
  ...MOCK_QUIZZES[0],
  questions: MOCK_QUESTIONS,
  totalPoints: MOCK_QUESTIONS.reduce((sum, q) => sum + q.points, 0),
  autoGradable: MOCK_QUESTIONS.every((q) => q.type !== 'ESSAY'),
};

// ── Quizzes ──────────────────────────────────────────────────────────────────────

export async function listQuizzes(courseId?: string): Promise<Quiz[]> {
  if (USE_MOCK) return mockDelay(courseId ? MOCK_QUIZZES.filter((q) => q.courseId === courseId) : MOCK_QUIZZES);
  const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  return quizFetch<Quiz[]>(`/${qs}`);
}

export async function getQuiz(id: string): Promise<QuizDetail> {
  if (USE_MOCK) return mockDelay(MOCK_DETAIL);
  return quizFetch<QuizDetail>(`/${id}`);
}

export async function createQuiz(payload: CreateQuizPayload): Promise<Quiz> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<Quiz>({
      id: `quiz-${Date.now()}`,
      title: payload.title,
      description: payload.description ?? null,
      courseId: payload.courseId ?? null,
      passingGrade: payload.passingGrade ?? 60,
      attemptsAllowed: payload.attemptsAllowed ?? null,
      timeLimit: payload.timeLimit ?? null,
      randomizeQuestions: payload.randomizeQuestions ?? false,
      questionCount: 0,
      createdAt: now, updatedAt: now,
    });
  }
  return quizFetch<Quiz>('/', 'POST', payload);
}

export async function updateQuiz(id: string, patch: UpdateQuizPayload): Promise<Quiz> {
  if (USE_MOCK) {
    const q = MOCK_QUIZZES.find((x) => x.id === id) ?? MOCK_QUIZZES[0];
    return mockDelay<Quiz>({ ...q, ...patch, updatedAt: new Date().toISOString() });
  }
  return quizFetch<Quiz>(`/${id}`, 'PATCH', patch);
}

export async function deleteQuiz(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return quizFetch<{ id: string }>(`/${id}`, 'DELETE');
}

// ── Questions ────────────────────────────────────────────────────────────────────

export async function createQuestion(quizId: string, payload: CreateQuestionPayload): Promise<Question> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<Question>({
      id: `q-${Date.now()}`, quizId,
      type: payload.type, prompt: payload.prompt, data: payload.data,
      points: payload.points ?? 1, order: payload.order ?? MOCK_QUESTIONS.length,
      createdAt: now, updatedAt: now,
    } as Question);
  }
  return quizFetch<Question>(`/${quizId}/questions`, 'POST', payload);
}

export async function updateQuestion(quizId: string, questionId: string, patch: UpdateQuestionPayload): Promise<Question> {
  if (USE_MOCK) {
    const q = MOCK_QUESTIONS.find((x) => x.id === questionId) ?? MOCK_QUESTIONS[0];
    return mockDelay<Question>({ ...q, ...patch, updatedAt: new Date().toISOString() } as Question);
  }
  return quizFetch<Question>(`/${quizId}/questions/${questionId}`, 'PATCH', patch);
}

export async function deleteQuestion(quizId: string, questionId: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id: questionId });
  return quizFetch<{ id: string }>(`/${quizId}/questions/${questionId}`, 'DELETE');
}

// ── Reorder (bulk) ─────────────────────────────────────────────────────────────────

export async function reorderQuestions(quizId: string, payload: ReorderQuestionsPayload): Promise<QuizDetail> {
  if (USE_MOCK) return mockDelay(MOCK_DETAIL);
  return quizFetch<QuizDetail>(`/${quizId}/reorder`, 'PATCH', payload);
}
