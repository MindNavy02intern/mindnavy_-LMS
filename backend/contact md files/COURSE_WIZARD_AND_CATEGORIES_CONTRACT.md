# Course Wizard (Steps 4–6) + Approval + Categories — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (37/37 green).
This is the source of truth for the `USE_MOCK` services + types. If anything here
conflicts with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin` (same base as the rest of the app)
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string, "errors"?: string[] }`
  — `errors[]` appears ONLY on submit-validation failures (render the whole list)
- **IDs:** uuid strings · **Dates:** ISO 8601 strings · **Money:** integer **cents**
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> ⚠️ **BREAKING CHANGE:** `PATCH /courses/:id` no longer accepts `status` — it
> returns **400** if you send it. Status transitions happen ONLY through
> `submit` / `approve` / `reject` / `DELETE` (archive). If any existing code
> PATCHes a status, migrate it to the new endpoints.

---

## Part 1 — Course detail additions (GET /courses/:id)

The course detail now carries everything the wizard prefills from:

```ts
export type CourseVisibility = 'Public' | 'Private' | 'Unlisted';

export interface CourseSettings {
  isFree: boolean;                 // default true
  price: number | null;            // integer CENTS; always null while isFree
  currency: string | null;         // 3-letter ISO, normalized uppercase (default "USD")
  enrollmentLimit: number | null;
  visibility: CourseVisibility;    // default 'Public'
  certificateEnabled: boolean;
  dripContentEnabled: boolean;
  accessRules: AccessRules | null;
  seoTitle: string | null;         // max 70
  seoDescription: string | null;   // max 200
}

export interface AccessRules {     // every key optional; unknown keys are a 400
  requiresEnrollment?: boolean;
  startDate?: string;              // ISO 8601
  endDate?: string;                // ISO 8601
  allowedGroupIds?: string[];      // max 50
  prerequisiteCourseIds?: string[];// max 50
}

// New fields on the existing Course detail object:
export interface CourseDetailAdditions {
  settings: CourseSettings;        // wizard Step 4 prefill
  categoryId: string | null;       // link into the Category table
  rejectionReason: string | null;  // set while a rejection is active, else null
  reviewedAt: string | null;       // last approve/reject decision time
}
```

---

## Part 2 — Step 4: Settings

### `PATCH /courses/:id/settings`
Body: any subset of `CourseSettings` fields (at least one). `visibility` accepts
`"Public" | "Private" | "Unlisted"` case-insensitively; `currency` accepts any
case, returns uppercase.

- These fields are **owned by this endpoint only** — the generic course PATCH
  rejects them.
- Cross-field rule: the course must always END UP valid — `isFree: false`
  requires a positive `price` (either in this body or already saved). Flipping
  back to `isFree: true` clears `price` to null server-side.
- **200** → `data: CourseSettings & { id, updatedAt }`
- **400** validation (`message` says which field) · **404** course not found

---

## Part 3 — Step 5: Preview

### `GET /courses/:id/preview`
One call, no composition needed on your side:

- **200** → `data: { course: CourseDetail, sections: CourseSection[] }`
  — `course` is the same shape as `GET /courses/:id` (incl. `settings`);
  `sections` is the same tree as `GET /courses/:courseId/sections` (lessons
  nested, ordered).
- **404** course not found
- Desktop/Mobile toggle is purely a container-width change on your side.
- Quiz preview / video playback test: still out of scope v1 — `getPreview()`
  returns `{ course, sections }` only, no quiz data, regardless of the quiz
  system itself shipping and being smoke-tested elsewhere (this endpoint
  specifically was never extended to include it).
  Video lessons: render `lesson.content` as the player src.

---

## Part 4 — Step 6: Submit for approval

### `POST /courses/:id/submit`
No body.

- Only a **Draft** course can be submitted.
- v1 readiness checks (ALL failures returned at once): title, description,
  thumbnail, ≥1 section, ≥1 lesson.
- **200** → `data: { id, status: "Pending" }` — invalidate `['courses']`,
  `['courses', id]`, `['approvals']`, `['tasks']`, `['dashboard','course-analytics']`
- **400** not ready → `{ message, errors: string[] }` — render `errors` inline
- **400** wrong state → `message` like `"Only Draft courses can be submitted (course is Pending)."`
- **404** course not found
- Submitting clears any previous `rejectionReason`.

---

## Part 5 — Approval workflow

The pending queue is the existing list endpoint: `GET /courses?status=Pending`
(no new list endpoint). "Request Changes" = Reject in v1.

### `POST /courses/:id/approve`
No body. Only **Pending** courses.

- **200** → `data: { id, status: "Published", reviewedAt }` — invalidate
  `['courses']`, `['courses', id]`, `['approvals']`, `['categories']`,
  `['dashboard','course-analytics']`
- **400** wrong state · **404** not found

### `POST /courses/:id/reject`
Body: `{ reason: string }` — **required**, max 1000 chars. Only **Pending** courses.

- **200** → `data: { id, status: "Draft", rejectionReason, reviewedAt }` —
  invalidate `['courses', id]`, `['approvals']`, `['notifications']`
- **400** missing/too-long reason, or wrong state · **404** not found
- The reason then shows on `GET /courses/:id` as `rejectionReason` until the
  course is resubmitted or approved. "Notify instructor" v1 = showing this
  reason — `rejectCourse()` itself never calls the notifications system
  (NOTIFICATIONS_CONTRACT.md), even though that system now exists for other
  flows; wiring a real COURSE_REJECTED notification is still a follow-up.

Race safety: transitions are atomic server-side — if two admins act at once the
loser gets **400** `"Course status changed in the meantime — refresh and try again."`
→ refetch and re-render.

Dashboard note: `GET /dashboard/analytics` → `courseAnalytics.totalCourses /
activeCourses / pendingApprovalCourses` are now **live counts** (no longer stubbed
zeros), so the `['dashboard','course-analytics']` invalidations on submit/approve/
reject visibly move those KPIs.

---

## Part 6 — Categories (Category Management Center)

2-level hierarchy: root categories + subcategories. `courseCount` is computed
live, never stored.

```ts
export interface Category {
  id: string;
  name: string;                  // max 100; unique per level (case-insensitive)
  parentId: string | null;
  courseCount: number;           // direct assignments only
  createdAt: string;
  updatedAt: string;
  children?: Category[];         // present on roots in the GET tree
}

export interface CreateCategoryPayload { name: string; parentId?: string | null; }
export interface UpdateCategoryPayload { name?: string; parentId?: string | null; }
```

### `GET /categories`
- **200** → `data: Category[]` — roots (alphabetical) with `children[]` nested
  (alphabetical), each node with `courseCount`.

### `POST /categories`
Body: `CreateCategoryPayload`.
- **201** → `data: Category`
- **400** duplicate name at that level · parent is itself a subcategory (2-level
  cap) · **404** parent not found

### `PATCH /categories/:id`
Body: `UpdateCategoryPayload` (at least one field). `parentId: null` promotes to root.
- Renaming also resyncs the legacy `category` string on that category's courses.
- **200** → `data: Category`
- **400** duplicate · self-parent · 2-level cap · has-children-can't-become-child
- **404** category/parent not found

### `DELETE /categories/:id`
- Blocked (400 with a human message) while it has subcategories or assigned
  courses — no cascades. **200** → `data: { id }` · **404** not found
- Invalidate on any category write: `['categories']`, `['courses']`.

### Course ↔ category linking (migration)
- `POST /courses` and `PATCH /courses/:id` now accept **`categoryId`** (uuid).
  When sent, the server verifies it (404 if unknown) and auto-syncs the legacy
  `category` string from the category's name — send `categoryId` alone.
- `categoryId: null` on PATCH unlinks. The legacy free-text `category` field
  still works everywhere (back-compat), but new UI should use `categoryId`.
- `GET /lm/filter-options` `categories` now comes from the Category table
  (unioned with legacy values until every course is linked) — same `string[]`
  shape as before, zero changes needed to existing filter code.

---

## Quick error map (for toasts / inline messages)
| Status | Meaning | UI |
|---|---|---|
| 400 | validation / wrong state / blocked delete | inline near the field (`message`, plus `errors[]` on submit) |
| 401 | not authenticated | bounce to login |
| 404 | course/category not found | "not found" state |
| 429 | rate limited | "slow down and retry" toast |
| 500 | server error | generic error toast |

## USE_MOCK guidance
Mirror the existing `lmApi.ts` pattern: `courseWizardApi` / `categoriesApi`
with a `USE_MOCK` flag returning these exact shapes. Flip to `false` to hit the
real endpoints — no other frontend code should need to change.
