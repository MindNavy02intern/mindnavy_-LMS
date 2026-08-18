// Quizzes & Exams domain types — all 6 design-doc question types.
// Source of truth: backend/src/{validators,services}/quizzes.validator.js / .service.js
// (no QUIZZES_CONTRACT.md exists in the repo — reverse-engineered from backend source).
//
// FILL_IN_BLANK and MATCHING started as schema-forward-compat-only (400'd by
// the validator, no editor) — both now have real editors and are accepted.
//
// CRITICAL: questionCount / totalPoints / autoGradable are server-derived —
// never compute them client-side (IMPACT_MAP R1/R4). questionCount ships on
// both list and detail; totalPoints/autoGradable are detail-only (derived
// live from the question list server-side, not stored).

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'ESSAY' | 'FILL_IN_BLANK' | 'MATCHING';

export interface MultipleChoiceData {
  options:      string[]; // 2-10
  correctIndex: number;
}

export interface TrueFalseData {
  correct: boolean;
}

export interface MultiSelectData {
  options:        string[]; // 2-10
  correctIndexes: number[]; // non-empty, unique
}

export interface FillInBlankData {
  correctAnswer: string; // 1-500 chars, exact-match graded
}

export interface MatchingPair { left: string; right: string }

export interface MatchingData {
  pairs: MatchingPair[]; // 2-10 pairs
}

// Discriminated union — a question's `data` shape is locked to its `type`.
// Mirrors the backend rule that (type, data) always travel together.
export type Question =
  | { id: string; quizId: string; type: 'MULTIPLE_CHOICE'; prompt: string; data: MultipleChoiceData; points: number; order: number; createdAt: string; updatedAt: string }
  | { id: string; quizId: string; type: 'TRUE_FALSE';      prompt: string; data: TrueFalseData;      points: number; order: number; createdAt: string; updatedAt: string }
  | { id: string; quizId: string; type: 'MULTI_SELECT';    prompt: string; data: MultiSelectData;    points: number; order: number; createdAt: string; updatedAt: string }
  | { id: string; quizId: string; type: 'ESSAY';           prompt: string; data: null;               points: number; order: number; createdAt: string; updatedAt: string }
  | { id: string; quizId: string; type: 'FILL_IN_BLANK';   prompt: string; data: FillInBlankData;    points: number; order: number; createdAt: string; updatedAt: string }
  | { id: string; quizId: string; type: 'MATCHING';        prompt: string; data: MatchingData;       points: number; order: number; createdAt: string; updatedAt: string };

export interface Quiz {
  id:                 string;
  title:              string;
  description:        string | null;
  courseId:           string | null;
  passingGrade:       number;
  attemptsAllowed:    number | null; // null = unlimited
  timeLimit:          number | null; // null = no limit (minutes)
  randomizeQuestions: boolean;
  questionCount:      number;        // server-derived — never compute client-side
  createdAt:          string;        // ISO
  updatedAt:          string;        // ISO
}

export interface QuizDetail extends Quiz {
  questions:    Question[]; // sorted by order (server-sorted)
  totalPoints:  number;     // server-derived — never sum question.points client-side
  autoGradable: boolean;    // server-derived — false whenever an ESSAY question is present
}

// ── API payloads ────────────────────────────────────────────────────────────────

export interface CreateQuizPayload {
  title:               string;
  description?:        string | null;
  courseId?:            string | null;
  passingGrade?:        number;
  attemptsAllowed?:     number | null;
  timeLimit?:           number | null;
  randomizeQuestions?:  boolean;
}

export interface UpdateQuizPayload {
  title?:               string;
  description?:         string | null; // null clears it
  courseId?:             string | null; // null detaches from course
  passingGrade?:         number;
  attemptsAllowed?:      number | null; // null = unlimited
  timeLimit?:            number | null; // null = no limit
  randomizeQuestions?:   boolean;
}

// A question's create/update payload always carries (type, data) together —
// this union makes it impossible at compile time to send one without the other.
export type QuestionTypeData =
  | { type: 'MULTIPLE_CHOICE'; data: MultipleChoiceData }
  | { type: 'TRUE_FALSE';      data: TrueFalseData }
  | { type: 'MULTI_SELECT';    data: MultiSelectData }
  | { type: 'ESSAY';           data: null }
  | { type: 'FILL_IN_BLANK';   data: FillInBlankData }
  | { type: 'MATCHING';        data: MatchingData };

export type CreateQuestionPayload = QuestionTypeData & {
  prompt: string;
  points?: number;
  order?:  number;
};

// Edit: prompt/points/order may change alone; (type, data) may ONLY be sent
// as a pair (enforced by the backend — sending type without data is a 400).
export type UpdateQuestionPayload =
  { prompt?: string; points?: number; order?: number } &
  (QuestionTypeData | { type?: undefined; data?: undefined });

export interface ReorderItem { id: string; order: number }
export interface ReorderQuestionsPayload { items: ReorderItem[] }
