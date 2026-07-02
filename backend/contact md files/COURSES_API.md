# Courses API — Frontend Contract

Backend for the **Learning Management → Courses** tab (list + Create/Edit Basic Info).
This document is the single source of truth. Build the frontend exactly to these
shapes so the frontend and backend never conflict.

> Reconciliation note (if you saw the raw task): the field is **`thumbnail`** (not
> `thumbnailUrl`), **`category` is a plain string** (no Category table / `categoryId`),
> pagination uses **`pages`**, and IDs are **`uuid`**. Build to the shapes below.

---

## 1. Basics

- **Base URL:** `http://localhost:5001/api/admin`
- **Auth:** every request needs the admin token header (same as the LM Overview API):
  ```
  Authorization: Bearer <token>
  ```
  Reuse the existing `getStoredToken()` helper. **Do not** create a new fetch wrapper —
  reuse the `apiFetch()` you already use for the Overview (`lmApi.ts`), USE_MOCK-aware.
- **Content type for writes:** `Content-Type: application/json`
- **Make one request per action.** Use the list endpoint with filters + pagination; do
  not call per row.
- Courses are **admin-only** for now. The admin picks the instructor from the existing
  `/api/admin/lm/filter-options` list.

### Response envelope (always)
- Success (list): `{ "success": true, "data": { "courses": [...], "pagination": {...}, "statusCounts": {...} } }`
- Success (single / create / update): `{ "success": true, "message": "...", "data": {...} }`
- Success (delete/archive): `{ "success": true, "message": "...", "data": { "id": "...", "status": "Archived" } }`
- Error (any): `{ "success": false, "message": "..." }`  ← always read `message`

---

## 2. Allowed enum values (use these EXACT strings)

| Field | Allowed values |
|---|---|
| `level` | `Beginner`, `Intermediate`, `Advanced` |
| `status` | `Draft`, `Pending`, `Published`, `Archived` |
| `status` (list filter) | `All`, `Draft`, `Pending`, `Published`, `Archived` |

- **Create always saves as `Draft`** — any `status` you send to `POST` is ignored.
- **`All` excludes `Archived`.** Archived courses appear **only** under `?status=Archived`.
- `instructorId` must reference a real user whose role is **`INSTRUCTOR`** (else 400/404).

---

## 3. The Course objects

**`CourseListRow`** — returned by the list endpoint (one per row):
```ts
interface CourseListRow {
  id: string;                  // uuid
  title: string;
  instructor: string;          // display name ("—" if unset)
  instructorId: string | null;
  category: string | null;     // plain category name
  level: "Beginner" | "Intermediate" | "Advanced";
  enrolledCount: number;       // read-only, derived from enrollments
  status: "Draft" | "Pending" | "Published" | "Archived";
  thumbnail: string | null;    // URL string
  updatedAt: string;           // ISO date
}
```

**`CourseDetail`** — returned by get-one / create / update (all row fields **plus**):
```ts
interface CourseDetail extends CourseListRow {
  subtitle: string | null;
  description: string | null;
  language: string | null;
  tags: string[];
  createdBy: string | null;    // admin id who created it
  createdAt: string;           // ISO date
}
```

---

## 4. Endpoints

### 4.1 List courses
```
GET /courses
```
**Query params (all optional):**

| Param | Type / values | Default | Notes |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | |
| `limit` | integer 1..100 | `10` | capped at 100 |
| `status` | `All` \| `Draft` \| `Pending` \| `Published` \| `Archived` | `All` | `All` excludes Archived |
| `category` | string | — | exact category name |
| `instructor` | string (uuid) | — | instructor id |
| `search` | string | — | matches `title` (contains, case-insensitive) |

**200 response:**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "title": "Intro to React",
        "instructor": "Jane Doe",
        "instructorId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "category": "Development",
        "level": "Beginner",
        "enrolledCount": 340,
        "status": "Published",
        "thumbnail": "https://cdn.example.com/thumb.jpg",
        "updatedAt": "2026-06-30T14:05:00.000Z"
      }
    ],
    "pagination": { "total": 250, "page": 1, "limit": 10, "pages": 25 },
    "statusCounts": { "all": 250, "draft": 12, "pending": 8, "published": 230, "archived": 6 }
  }
}
```
- Ordered by `updatedAt` (desc).
- `statusCounts` feeds the filter tabs; it honors `category`/`instructor`/`search` but ignores `status`.
- **`all` = Draft + Pending + Published (excludes Archived)** — matches the `All` list.

---

### 4.2 Get one course
```
GET /courses/:id
```
- **200:** `{ "success": true, "data": <CourseDetail> }`
- **404:** `{ "success": false, "message": "Course not found." }`

---

### 4.3 Create course
```
POST /courses
```
**Body:**
```json
{
  "title": "Intro to React",
  "instructorId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "subtitle": "optional",
  "description": "optional long text",
  "category": "Development",
  "tags": ["react", "frontend"],
  "language": "English",
  "level": "Beginner",
  "thumbnail": "https://cdn.example.com/thumb.jpg"
}
```

| Field | Required | Default | Rules |
|---|---|---|---|
| `title` | ✅ | — | string, max 200 |
| `instructorId` | ✅ | — | must be an existing user with role `INSTRUCTOR` |
| `subtitle` | ❌ | `null` | string, max 300 |
| `description` | ❌ | `null` | string, max 5000 |
| `category` | ❌ | `"Uncategorized"` | string, max 100 |
| `tags` | ❌ | `[]` | array, max 20 items, each ≤ 40 chars |
| `language` | ❌ | `null` | string, max 50 |
| `level` | ❌ | `Beginner` | level enum |
| `thumbnail` | ❌ | `null` | URL string, max 2000 |
| `status` | — | `Draft` | **ignored** — always created as `Draft` |

- **201:** `{ "success": true, "message": "Course created as Draft.", "data": <CourseDetail> }`
- **400:** validation failed, e.g. missing `title`/`instructorId`, or "The selected user is not an instructor."
- **404:** `{ "success": false, "message": "Instructor not found." }` (bad `instructorId`)

---

### 4.4 Update course (edit Basic Info)
```
PATCH /courses/:id
```
Send **any subset** of: `title`, `subtitle`, `description`, `category`, `tags`,
`language`, `level`, `thumbnail`, `instructorId`, `status`. Only included fields change.
```json
{ "subtitle": "New subtitle", "level": "Intermediate", "status": "Published" }
```
- **200:** `{ "success": true, "message": "Course updated.", "data": <CourseDetail> }`
- **400:** validation failed / no valid fields / not an instructor.
- **404:** course id or instructor not found.
- **Publishing has no readiness checks yet:** setting `status: "Published"` succeeds even for a Draft with
  only a title. Content/completeness validation belongs to the later Course Builder steps (2–6).

---

### 4.5 Archive course (soft delete)
```
DELETE /courses/:id
```
Sets `status = "Archived"` — the row is **not** removed.
- **200:** `{ "success": true, "message": "Course archived.", "data": { "id": "...", "status": "Archived" } }`
- **404:** `{ "success": false, "message": "Course not found." }`
- **Un-archive / restore:** there is no separate endpoint — send `PATCH /courses/:id` with
  `{ "status": "Draft" }` (or `"Published"`).

---

## 5. Error reference (handle these in the UI)

| Status | Meaning | UI action |
|---|---|---|
| `400` | Validation error / not an instructor | Show `message` near the form field |
| `401` | Not logged in / invalid session | Redirect to login |
| `404` | Course or instructor not found | Show "not found" message |
| `429` | Too many requests (rate limit) | Show "Please slow down and retry" |
| `500` | Server error (should not happen on bad input) | Generic error toast |

Every error body is `{ "success": false, "message": "..." }`.

> **Auth/rate limits:** all endpoints require the Bearer token. Reads (GET) are limited to
> **120 requests / minute**; writes (POST/PATCH/DELETE) to **60 requests / 10 minutes** per admin.
> Debounce the search box (~300ms) so typing doesn't burn through the read budget.

---

## 6. Ready-to-use TypeScript API client

Add to `frontend/src/api/lmApi.ts` (or a new `coursesApi.ts`), wired behind your USE_MOCK flag:

```ts
import { getStoredToken } from './adminAuth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export type CourseLevel        = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus       = 'Draft' | 'Pending' | 'Published' | 'Archived';
export type CourseStatusFilter = 'All' | CourseStatus;

export interface CourseListRow {
  id: string;
  title: string;
  instructor: string;
  instructorId: string | null;
  category: string | null;
  level: CourseLevel;
  enrolledCount: number;
  status: CourseStatus;
  thumbnail: string | null;
  updatedAt: string;
}

export interface CourseDetail extends CourseListRow {
  subtitle: string | null;
  description: string | null;
  language: string | null;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface CourseStatusCounts { all: number; draft: number; pending: number; published: number; archived: number }
export interface Pagination { total: number; page: number; limit: number; pages: number }
export interface CoursesListResponse { courses: CourseListRow[]; pagination: Pagination; statusCounts: CourseStatusCounts }

export interface CreateCoursePayload {
  title: string;
  instructorId: string;
  subtitle?: string;
  description?: string;
  category?: string;
  tags?: string[];
  language?: string;
  level?: CourseLevel;
  thumbnail?: string;
}
export type UpdateCoursePayload = Partial<CreateCoursePayload & { status: CourseStatus }>;

export class CourseApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CourseApiError';
  }
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
  if (!res.ok) {
    throw new CourseApiError(res.status, (json as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export async function listCourses(params: {
  page?: number; limit?: number; status?: CourseStatusFilter;
  category?: string; instructor?: string; search?: string;
} = {}): Promise<CoursesListResponse> {
  const qs = new URLSearchParams();
  if (params.page)       qs.set('page', String(params.page));
  if (params.limit)      qs.set('limit', String(params.limit));
  if (params.status)     qs.set('status', params.status);
  if (params.category)   qs.set('category', params.category);
  if (params.instructor) qs.set('instructor', params.instructor);
  if (params.search)     qs.set('search', params.search);
  const q = qs.toString();
  const json = await apiFetch<{ success: boolean; data: CoursesListResponse }>(`/courses${q ? `?${q}` : ''}`);
  return json.data;
}

export async function getCourse(id: string): Promise<CourseDetail> {
  const json = await apiFetch<{ success: boolean; data: CourseDetail }>(`/courses/${encodeURIComponent(id)}`);
  return json.data;
}

export async function createCourse(payload: CreateCoursePayload): Promise<CourseDetail> {
  const json = await apiFetch<{ success: boolean; data: CourseDetail }>('/courses', 'POST', payload);
  return json.data;
}

export async function updateCourse(id: string, payload: UpdateCoursePayload): Promise<CourseDetail> {
  const json = await apiFetch<{ success: boolean; data: CourseDetail }>(`/courses/${encodeURIComponent(id)}`, 'PATCH', payload);
  return json.data;
}

export async function archiveCourse(id: string): Promise<{ id: string; status: CourseStatus }> {
  const json = await apiFetch<{ success: boolean; data: { id: string; status: CourseStatus } }>(
    `/courses/${encodeURIComponent(id)}`, 'DELETE',
  );
  return json.data;
}
```

---

## 7. Notes for the Category & Instructor dropdowns

Both come from the **existing** LM filter-options endpoint — do not add a new one:
```
GET /api/admin/lm/filter-options
->  data: { categories: string[], instructors: { id: string; name: string }[] }
```
- **Category** → use a **combobox / free-text input**, not a locked dropdown: `categories` is derived from
  **existing** courses, so it is **empty on a fresh DB**. Let the admin type a new category (suggesting the
  existing `categories`). The list filter and create form send the category **name** (string); the backend
  accepts any string.
- **Instructor dropdown** → `instructors`; send `instructors[].id` as `instructorId` (create) and as `instructor` (list filter).
  ⚠️ **Prerequisite:** creating a course requires at least one AppUser with role `INSTRUCTOR`. If none exist,
  this list is empty and create is blocked until an instructor is added.
