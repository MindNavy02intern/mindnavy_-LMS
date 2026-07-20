# Quizzes & Exams — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**58/58 green**).
This is the source of truth for the Assessments tab. If anything here conflicts
with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/quizzes`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> **v1 scope — question types:** the builder accepts **4 of the 6** design-doc
> types: `MULTIPLE_CHOICE`, `TRUE_FALSE`, `MULTI_SELECT`, `ESSAY`.
> `FILL_IN_BLANK` and `MATCHING` exist in the schema enum but the API rejects
> them with `400` until v2 — **don't render editors for them.**

> **v1 scope — grading:** grading is a *documented decision*, not endpoints.
> `ESSAY` = manual review; every other type is auto-gradable. The detail
> response carries a derived `autoGradable` flag (true = no essay questions).
> Learner **attempts, submissions and the grading flow ship with the learner
> runtime** (same deferral as Learning Paths progress tracking) — build the
> builder UI only, no "grade attempts" screens.

> **v1 scope — attachment:** a quiz optionally attaches to a **course**
> (`courseId`, nullable). Lesson-level attachment is deferred — the query key
> `['quizzes', courseId?]` is course-scoped and stays that way.

> **Existing infra:** the tab shell exists at **`?tab=assessments`** (the
> blueprint calls it `?tab=quizzes` — known, reported GAP; keep `assessments`).
> `queryKeys.quizzes(courseId?)` already exists in queryKeys.ts — build against
> it, don't recreate it. `invalidation.ts` only knows the *student-side*
> `quiz.submit` today — **add `quiz.create` / `quiz.update` / `quiz.delete`
> entries** (invalidate `['quizzes']`, plus `['courses', courseId]` when the
> quiz is attached) in the same PR, per IMPACT_MAP §9.

> **Content stats:** the `quizzes` number on the LM Content stats card is still
> owned by `CourseContent type=QUIZ` (lm.service) and does **NOT** count rows
> from this system (one field, one owner — IMPACT_MAP B2). Don't expect that
> card to move when quizzes are created here.

---

## Types

```ts
export type QuestionType =
  | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'ESSAY'  // v1
  | 'FILL_IN_BLANK' | 'MATCHING';                                // rejected until v2

export interface Quiz {
  id: string;
  title: string;                  // 1–200 chars
  description: string | null;     // ≤ 2000 chars
  courseId: string | null;        // null = standalone quiz
  passingGrade: number;           // percent 0–100 (default 60)
  attemptsAllowed: number | null; // 1–100 · null = unlimited (default)
  timeLimit: number | null;       // minutes 1–600 · null = no limit (default)
  randomizeQuestions: boolean;    // default false
  questionCount: number;          // derived server-side, never compute client-side
  createdAt: string;
  updatedAt: string;
}

// Per-type answer payload — discriminated by Question.type:
//   MULTIPLE_CHOICE: { options: string[]; correctIndex: number }
//   TRUE_FALSE:      { correct: boolean }
//   MULTI_SELECT:    { options: string[]; correctIndexes: number[] }
//   ESSAY:           null  (manual grading, no answer data)
export type QuestionData =
  | { options: string[]; correctIndex: number }
  | { correct: boolean }
  | { options: string[]; correctIndexes: number[] }
  | null;

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;                 // 1–2000 chars
  data: QuestionData;
  points: number;                 // 1–100 (default 1)
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDetail extends Quiz {
  questions: Question[];          // already sorted by order asc
  totalPoints: number;            // derived: sum of question points
  autoGradable: boolean;          // derived: true = no ESSAY questions
}
```

Option limits: **2–10 options** per question, each **1–500 chars**.
`correctIndex` / every `correctIndexes` entry must be a valid option index;
`correctIndexes` is non-empty with no duplicates.

---

## Endpoints

### 1 · List quizzes
`GET /` → `200 { data: Quiz[] }` — newest first. Empty array before any exist
(never 500s). Optional filter: `GET /?courseId=<id>` → only that course's quizzes
(matches the `['quizzes', courseId]` key).

### 2 · Quiz detail (with ordered questions)
`GET /:id` → `200 { data: QuizDetail }` · unknown id → `404`

### 3 · Create quiz
`POST /` → `201 { data: Quiz, message }`

```json
{ "title": "Module 1 Exam", "courseId": "<courseId or omit>", "passingGrade": 80,
  "attemptsAllowed": 3, "timeLimit": 30, "randomizeQuestions": true }
```
- `title` required, ≤ 200 chars → else `400`. Everything else optional (defaults above).
- `courseId` must exist → else `400 "Referenced course does not exist."`

### 4 · Update quiz
`PATCH /:id` → `200 { data: Quiz, message }`
Any subset of `title` / `description` / `courseId` / `passingGrade` /
`attemptsAllowed` / `timeLimit` / `randomizeQuestions`.
Explicit nulls: `courseId: null` detaches · `attemptsAllowed: null` = unlimited ·
`timeLimit: null` = no limit · `description: null` clears.
Empty body → `400 "No valid fields provided to update."`

### 5 · Delete quiz
`DELETE /:id` → `200 { data: { id } }` — **hard delete**; questions are removed
by DB cascade. Confirm in the UI before calling.

### 6 · Add question
`POST /:id/questions` → `201 { data: Question, message }`

```json
{ "type": "MULTIPLE_CHOICE", "prompt": "Pick one", "points": 2,
  "data": { "options": ["A", "B", "C"], "correctIndex": 1 } }
```
- `type` + `prompt` required; `data` shape must match the type (see Types) → else `400`
- `ESSAY` takes **no** `data` (omit it or send `null`; anything else → `400`)
- v2 types (`FILL_IN_BLANK`, `MATCHING`) → `400` with an explanatory message
- `order` optional — defaults to end of list → append the response to local state,
  no refetch needed.

### 7 · Update question
`PATCH /:id/questions/:questionId` → `200 { data: Question, message }`
Any subset of `prompt` / `points` / `order` — **but `type` and `data` must travel
together** (changing a question's type requires the new answer payload in the
same request; `type` without `data` → `400`).
Question belongs to another quiz → `404`.

### 8 · Delete question
`DELETE /:id/questions/:questionId` → `200 { data: { id } }`
Unknown or belongs to another quiz → `404`.

### 9 · Reorder questions (bulk — the drag-and-drop endpoint)
`PATCH /:id/reorder` → `200 { data: QuizDetail, message }`

```json
{ "items": [ { "id": "<questionId1>", "order": 0 }, { "id": "<questionId2>", "order": 1 } ] }
```
Same pattern as Course Builder / Learning Paths: **one bulk call after drop,
then replace local state from the response** (full re-read quiz detail, questions
sorted). All updates apply in one transaction — all or nothing. A question id
that doesn't belong to this quiz → `400`, nothing is changed. Max 500 entries.

---

## Error summary

| Status | When |
|---|---|
| `400` | validation failure · unknown `courseId` · wrong `data` shape for type · v2 type · type without data · foreign question in reorder |
| `401` | missing/invalid token |
| `404` | unknown quiz id · question not in this quiz |
| `429` | rate limit — show "slow down and retry" |
| `503` | tables not migrated (`prisma db push` not run) — should never happen now |

## Notes for the UI

1. **Question editors per type (v1):** MC = options list + single correct radio ·
   T/F = one toggle · Multi-Select = options list + correct checkboxes ·
   Essay = prompt + points only (show a "manual grading" badge).
2. `questionCount`, `totalPoints`, `autoGradable` are server-derived — render as
   received, never compute client-side (IMPACT_MAP R3/R4).
3. **Answer data contains the correct answers** — this is an admin-only builder
   API, fine here. When the learner runtime ships, learners get a separate
   endpoint that strips answers; never reuse these responses for a student view.
4. Invalidate `['quizzes']` (and `['quizzes', courseId]` + `['courses', courseId]`
   when attached) after every mutation here — including question add/edit/delete/
   reorder, since they change `questionCount` / `totalPoints` on the list.
5. `randomizeQuestions` only stores the setting in v1 — actual shuffling happens
   in the learner runtime later. The builder always shows real order.
