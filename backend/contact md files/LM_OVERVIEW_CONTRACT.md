# Learning Management — Overview Tab — API Contract (v1)

This is the single source of truth between **Backend (Hassan)** and **Frontend (Bilal)**.
Build to this. If anything needs to change, change it **here first**, then both sides update.

---

## ⚠️ Frontend changes needed to integrate (for Bilal)

The backend is built and matches this contract. The current `frontend/src/types/lm.ts`
(mock version) drifted on a few field names — these are the edits to align it with the
live API. Everything not listed here (stats, progress, content-stats, filter-options)
already matches — no change.

- **API base path:** call `/api/admin/lm/*` (not `/api/lm/*`). Every endpoint needs `Authorization: Bearer <token>`.
- **Error envelope:** `ApiResult.error` → **`message`** (success still uses `data`).
- **Distribution item:** `percent` → **`percentage`**.
- **Top course:** `enrolled` → **`enrolledCount`** (a `thumbnail` field is also available if you want it).
- **Courses response:** array key `data` → **`courses`**; row field `enrolled` → **`enrolledCount`**.
  - `pagination.pages` and `instructorId` already match ✅.
  - Widen `CourseStatus` to `'Published' | 'Draft' | 'Pending' | 'Archived'`.
- **Activity:** `by` → **`actorName`**.
- **Live session:** `attendees` → **`enrolledCount`**; **drop `durationMinutes`** (not in schema); add **`relatedCourse`**. `instructor`, `startTime`, `status` already match ✅.

---

## Common conventions (apply to ALL endpoints)

- **Base URL:** `http://localhost:5001/api/admin` (frontend reads `VITE_API_BASE_URL`).
  Every path below is relative to that base, e.g. `/lm/stats` → `GET http://localhost:5001/api/admin/lm/stats`.
- **Method:** all endpoints are `GET`.
- **Auth:** every request must send `Authorization: Bearer <token>` (same as the rest of the app, via `requireAdminAuth`). Missing/invalid token → `401`.
- **Success response:** HTTP `200` with body:
  ```json
  { "success": true, "data": <shape described per endpoint> }
  ```
- **Error response:** non-200 with body:
  ```json
  { "success": false, "message": "<human-readable message>" }
  ```
  Use `401` (unauthorized), `400` (bad query param), `500` (server error).
  > Errors use `message` (not `error`) to match the rest of the app — `requireAdminAuth` and every existing controller already return `message`, and the frontend `adminFetch`/`apiFetch` read `.message`.
- **Dates:** always ISO 8601 strings (e.g. `"2026-06-30T14:05:00.000Z"`). The **frontend** formats them / converts to relative time ("2 hours ago").
- **Percentages:** integers `0`–`100`.
- **`growth`:** percent change vs last month. May be negative. Is **`null`** when there is no prior-month data yet (frontend shows "—" instead of an arrow).
- **`thumbnail`:** a URL string, or `null`. Frontend shows a placeholder when `null`.
- **Money/IDs:** ids are strings (`uuid` — matches the recent modules: access policies, role templates, messages, users).

---

## 1. `GET /lm/stats` — KPI cards (6)

**Query:** none.

**`data`:**
```json
{
  "totalCourses":       { "value": 128, "growth": 12 },
  "activeCourses":      { "value": 84,  "growth": 5 },
  "totalEnrollments":   { "value": 3540, "growth": 8 },
  "coursesCompleted":   { "value": 1290, "growth": -3 },
  "avgCompletionRate":  { "value": 72,  "growth": 4 },
  "certificatesIssued": { "value": 910, "growth": 15 }
}
```
- `avgCompletionRate.value` is a percentage (0–100).
- Each `growth` is `number | null`.

---

## 2. `GET /lm/distribution` — Course distribution donut

**Query:** none.

**`data`:**
```json
{
  "total": 128,
  "items": [
    { "category": "Development", "count": 48, "percentage": 38 },
    { "category": "Design",      "count": 30, "percentage": 23 }
  ]
}
```
- `total` = sum of all counts (used for the donut center — backend provides it so frontend never recomputes/drifts).
- `percentage` is rounded 0–100.

---

## 3. `GET /lm/progress` — Learning progress line chart

**Query:** `range=week | month | year` (default `month`).

**`data`:** array of points (one per day/week/month depending on range):
```json
[
  { "date": "2026-06-01", "completed": 40, "inProgress": 25, "notStarted": 12, "overdue": 5 },
  { "date": "2026-06-02", "completed": 44, "inProgress": 22, "notStarted": 10, "overdue": 6 }
]
```
- 4 series: `completed`, `inProgress`, `notStarted`, `overdue`.
- `date` is `YYYY-MM-DD`.

---

## 4. `GET /lm/top-courses` — Top performing courses

**Query:** `limit` (default `5`).

**`data`:** sorted by `completionRate` **descending**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "title": "Intro to React",
    "instructor": "Jane Doe",
    "completionRate": 92,
    "enrolledCount": 340,
    "thumbnail": "https://.../thumb.jpg"
  }
]
```

---

## 5. `GET /lm/content-stats` — Content statistics panel

**Query:** none.

**`data`:**
```json
{
  "totalContentItems": 1240,
  "videoLessons": 520,
  "documents": 300,
  "pdfFiles": 210,
  "quizzes": 150,
  "scormPackages": 60
}
```

---

## 6. `GET /lm/courses` — Recent courses table

**Query:**
- `page` (default `1`)
- `limit` (default `10`)
- `category` (string; omit or empty = all categories)
- `instructor` (instructor **id**; omit or empty = all instructors)

**`data`:**
```json
{
  "courses": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "title": "Intro to React",
      "instructor": "Jane Doe",
      "instructorId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "category": "Development",
      "level": "Beginner",
      "enrolledCount": 340,
      "progress": 72,
      "status": "Published",
      "thumbnail": "https://.../thumb.jpg"
    }
  ],
  "pagination": { "total": 128, "page": 1, "limit": 10, "pages": 13 }
}
```
- array key is `courses`; pagination uses `pages` (matches the backend's `buildPagination`), not `totalPages`.
- `instructorId` is the value to pass back to `/lm/courses?instructor=<id>`; `instructor` is the display name. May be `null`.
- `status` ∈ `"Published" | "Draft" | "Pending" | "Archived"`
- `level`  ∈ `"Beginner" | "Intermediate" | "Advanced"`
- `progress` = average enrollment progress for the course (0–100).

---

## 7. `GET /lm/activities` — Recent activities

**Query:** `limit` (default `5`).

**`data`:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "course_created",
    "title": "New course \"Intro to React\" was created",
    "actorName": "Jane Doe",
    "createdAt": "2026-06-30T14:05:00.000Z"
  }
]
```
- `type` ∈ `"course_created" | "session_completed" | "content_uploaded" | "assessment_created" | "certificate_issued"`
- Frontend converts `createdAt` → relative time and picks an icon per `type`.

---

## 8. `GET /lm/live-sessions` — Upcoming live sessions

**Query:** `status=upcoming | live | ended` (default `upcoming`).

**`data`:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "title": "Live Q&A: React Hooks",
    "instructor": "Jane Doe",
    "startTime": "2026-07-02T16:00:00.000Z",
    "status": "upcoming",
    "enrolledCount": 58,
    "relatedCourse": "Intro to React"
  }
]
```
- `startTime` is ISO; frontend formats the time.
- `status` ∈ `"upcoming" | "live" | "ended"` (lowercase).
- `instructor` / `relatedCourse` come from the related course; either may be `null`.
- `enrolledCount` = enrollments on the related course (proxy for expected attendance).
- ⚠️ **No `durationMinutes`** — not in the schema. If you need it, it's a schema addition to agree on separately.

---

## 9. `GET /lm/filter-options` — Dropdown sources (feeds the courses table filters)

**Query:** none.

**`data`:**
```json
{
  "categories": ["Development", "Design", "Business"],
  "instructors": [
    { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "name": "Jane Doe" },
    { "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "name": "John Smith" }
  ]
}
```
- Without this, the "All Categories / All Instructors" dropdowns have no data source.
- `instructors[].id` is the value you pass back to `/lm/courses?instructor=<id>`.

---

## Shared TypeScript types (frontend imports these; backend matches the field names)

> Save as `frontend/src/types/lm.ts`. Field names must stay 1:1 with the JSON above — do not rename one side only.

```ts
// Field names match GET /api/admin/lm/* (LM Overview contract v1).
// Do NOT rename these — they must stay in sync with the backend response.

export type ApiResult<T> =
  | { success: true;  data: T }
  | { success: false; message: string };

// 1. stats
export interface KpiMetric { value: number; growth: number | null }
export interface LmStats {
  totalCourses:       KpiMetric;
  activeCourses:      KpiMetric;
  totalEnrollments:   KpiMetric;
  coursesCompleted:   KpiMetric;
  avgCompletionRate:  KpiMetric;
  certificatesIssued: KpiMetric;
}

// 2. distribution
export interface DistributionItem { category: string; count: number; percentage: number }
export interface LmDistribution { total: number; items: DistributionItem[] }

// 3. progress
export type ProgressRange = 'week' | 'month' | 'year';
export interface ProgressPoint {
  date: string;          // YYYY-MM-DD
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

// 4. top-courses
export interface TopCourse {
  id: string;
  title: string;
  instructor: string;
  completionRate: number;   // 0-100
  enrolledCount: number;
  thumbnail: string | null;
}

// 5. content-stats
export interface LmContentStats {
  totalContentItems: number;
  videoLessons: number;
  documents: number;
  pdfFiles: number;
  quizzes: number;
  scormPackages: number;
}

// 6. courses
export type CourseStatus = 'Published' | 'Draft' | 'Pending' | 'Archived';
export type CourseLevel  = 'Beginner' | 'Intermediate' | 'Advanced';
export interface CourseRow {
  id: string;
  title: string;
  instructor: string;
  instructorId: string | null;
  category: string;
  level: CourseLevel;
  enrolledCount: number;
  progress: number;          // 0-100
  status: CourseStatus;
  thumbnail: string | null;
}
export interface Pagination { total: number; page: number; limit: number; pages: number }
export interface LmCoursesResponse { courses: CourseRow[]; pagination: Pagination }
export interface LmCoursesQuery {
  page?: number;
  limit?: number;
  category?: string;
  instructor?: string;       // instructor id
}

// 7. activities
export type ActivityType =
  | 'course_created'
  | 'session_completed'
  | 'content_uploaded'
  | 'assessment_created'
  | 'certificate_issued';
export interface LmActivity {
  id: string;
  type: ActivityType;
  title: string;
  actorName: string;
  createdAt: string;         // ISO
}

// 8. live-sessions
export type LiveSessionStatus = 'upcoming' | 'live' | 'ended';
export interface LiveSession {
  id: string;
  title: string;
  instructor: string | null;
  startTime: string;         // ISO
  status: LiveSessionStatus;
  enrolledCount: number;
  relatedCourse: string | null;
}

// 9. filter-options
export interface InstructorOption { id: string; name: string }
export interface LmFilterOptions { categories: string[]; instructors: InstructorOption[] }
```

---

## Endpoint summary

| # | Method & path | Query | Returns (`data`) |
|---|---------------|-------|------------------|
| 1 | `GET /lm/stats` | — | `LmStats` |
| 2 | `GET /lm/distribution` | — | `LmDistribution` |
| 3 | `GET /lm/progress` | `range` | `ProgressPoint[]` |
| 4 | `GET /lm/top-courses` | `limit` | `TopCourse[]` |
| 5 | `GET /lm/content-stats` | — | `LmContentStats` |
| 6 | `GET /lm/courses` | `page,limit,category,instructor` | `LmCoursesResponse` |
| 7 | `GET /lm/activities` | `limit` | `LmActivity[]` |
| 8 | `GET /lm/live-sessions` | `status` | `LiveSession[]` |
| 9 | `GET /lm/filter-options` | — | `LmFilterOptions` |

**Definition of Done (both sides):**
- All 9 endpoints return the exact shapes above, wrapped in `{ success, data }`.
- `/lm/courses` pagination + `category`/`instructor` filters work.
- `/lm/progress` `range` works (week/month/year).
- All endpoints behind `requireAdminAuth`; no 500s.
- Frontend: every widget has loading (skeleton) + error states; charts render; zero TypeScript errors.
- A Playwright `lm-overview.full.spec.ts` exists and is added to `testMatch` in `playwright.config.ts`.

---

# Courses Tab — API Contract (v1)  (Tasks 64 / 65)

CRUD for the Courses tab inside the Learning Management page. Same conventions as above
(base `/api/admin`, `Bearer` auth, `{ success, data }` / `{ success:false, message }`, ISO dates).
**Admin-only** for now (`requireAdminAuth`); the admin picks the instructor from `/lm/filter-options`.

**Build to THIS (it differs from the raw task on purpose, to integrate cleanly):**
- Field is **`thumbnail`** (URL string), not `thumbnailUrl` — one name across both tabs.
- **`category` is a plain string** (no Category table / `categoryId`). The dropdown uses
  `/lm/filter-options.categories: string[]`; the list filter sends the category **name**.
- Pagination uses **`pages`** (not `totalPages`). IDs are `uuid`.
- `status` is **forced to `Draft`** on create (any client-sent status is ignored).

### 1. GET /api/admin/courses
Query: `page(1)`, `limit(10)`, `status(All|Draft|Pending|Published|Archived)`, `category?`, `instructor?(id)`, `search?`
```json
{
  "courses": [
    { "id": "…", "title": "Intro to React", "instructor": "Jane Doe", "category": "Development",
      "level": "Beginner", "enrolledCount": 340, "status": "Published",
      "thumbnail": "https://…", "updatedAt": "2026-06-30T14:05:00.000Z" }
  ],
  "pagination": { "total": 250, "page": 1, "limit": 10, "pages": 25 },
  "statusCounts": { "all": 250, "draft": 12, "pending": 8, "published": 230, "archived": 6 }
}
```
- `statusCounts` feeds the filter tabs; it honors `category`/`instructor`/`search` but ignores `status`.
- **`all` = Draft + Pending + Published (excludes Archived)**, and the `All` tab list also excludes Archived.
  Archived courses appear **only** in the Archived tab (`?status=Archived`).

### 2. GET /api/admin/courses/:id
`data` = full course: all list fields **plus** `subtitle`, `description`, `instructorId`, `language`,
`tags: string[]`, `createdBy`, `createdAt`.

### 3. POST /api/admin/courses
Body: `{ title*(req), instructorId*(req), subtitle?, description?, category?, tags?, language?, level?, thumbnail? }`
- Creates with `status = "Draft"`. Missing `title`/`instructorId` → **400**. `instructorId` must be a real
  `INSTRUCTOR` → else **400/404**. Returns `201 { success, message, data: <full course> }`.

### 4. PATCH /api/admin/courses/:id
Body: any subset of `{ title, subtitle, description, category, tags, language, level, thumbnail, instructorId, status }`.
Returns the updated full course. No/unknown fields → 400; bad `instructorId` → 400/404; missing id → 404.

### 5. DELETE /api/admin/courses/:id
**Soft archive** — sets `status = "Archived"` (row is NOT removed). Returns `{ id, status: "Archived" }`.

### TypeScript (add to `frontend/src/types/lm.ts` or a `courses.ts`)
```ts
export interface CourseListRow {
  id: string; title: string; instructor: string; instructorId: string | null;
  category: string | null; level: CourseLevel; enrolledCount: number;
  status: CourseStatus; thumbnail: string | null; updatedAt: string;
}
export interface CourseStatusCounts { all: number; draft: number; pending: number; published: number; archived: number }
export interface CoursesListResponse { courses: CourseListRow[]; pagination: Pagination; statusCounts: CourseStatusCounts }
export interface CreateCoursePayload {
  title: string; instructorId: string;
  subtitle?: string; description?: string; category?: string;
  tags?: string[]; language?: string; level?: CourseLevel; thumbnail?: string;
}
export interface CourseDetail extends CourseListRow {
  subtitle: string | null; description: string | null;
  language: string | null; tags: string[]; createdBy: string | null; createdAt: string;
}
```
`Pagination`, `CourseLevel`, `CourseStatus` reuse the Overview types — **`CourseStatus` must include `'Pending' | 'Archived'`**.

### Definition of Done
- List: status tabs + counts + pagination + `category`/`instructor`/`search` filters work.
- Create saves Draft; PATCH edits; DELETE soft-archives. Bad instructor / missing title → 400, no 500s.
- `courses-tab.full.spec.ts` added to `testMatch` (Bilal's side; not run here).
