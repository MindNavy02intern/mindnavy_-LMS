# Enrollments — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**34/34 green**).
This is the source of truth for the Enrollments tab. If anything here conflicts
with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/enrollments`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> **No new table:** this rides the EXISTING `course_enrollments` model — the same
> rows behind the LM KPIs, enrollment trend chart, top-courses and the course
> list's `enrolledCount`. Every write here moves those numbers → invalidate the
> full IMPACT_MAP §5.2 row, never a subset.

> **Status enum is the EXISTING one:** `NOT_STARTED | IN_PROGRESS | COMPLETED |
> OVERDUE`. There is **no `DROPPED`** in v1 (deferred; the trend chart's 4 series
> stay stable) — "remove a learner" = DELETE (unenroll).

> **progress is learner-derived:** admins can never write it. `PATCH` accepts
> **`status` only** — sending `progress` is a 400 with an explanatory message.
> Setting `COMPLETED` stamps `completedAt`; leaving `COMPLETED` clears it.
> progress is NOT auto-set to 100 on COMPLETED (learner-owned, documented decision).

> **enrollmentLimit IS enforced** (Wizard Step 4 setting): enrolling past the
> limit → `400 "Course is full: its enrollment limit has been reached."` —
> surface it near the enroll dialog's submit button.

> **Unenroll does NOT revoke certificates** — a learner unenrolled after earning
> a certificate keeps it (certificates have their own revoke flow).

> **Existing infra:** `queryKeys.enrollments(entityId?)` already exists in
> queryKeys.ts. Pickers: users from `['users']`, courses from `['courses']` (R2).

---

## Types

```ts
export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string | null;   // derived
  userId: string;
  userName: string | null;      // derived
  userEmail: string | null;     // derived
  userAvatar: string | null;    // derived
  progress: number;             // 0–100, READ-ONLY (learner-derived)
  status: EnrollmentStatus;
  enrolledAt: string;           // ISO (creation time)
  completedAt: string | null;   // server-managed by status transitions
  updatedAt: string;
}

export interface EnrollmentListData {
  enrollments: Enrollment[];
  pagination: { total: number; page: number; limit: number; pages: number };
  // Chips: counts share every active filter EXCEPT status (same as Courses tab)
  statusCounts: { All: number; NOT_STARTED: number; IN_PROGRESS: number; COMPLETED: number; OVERDUE: number };
}
```

## Endpoints

### `GET /` — list (paginated, newest first)
Query params (all optional): `courseId` · `userId` · `status=<EnrollmentStatus>` ·
`search` (matches learner name/email OR course title, ≤200 chars) ·
`page` (default 1) · `limit` (default 10, max 100)
→ `200 { success, data: EnrollmentListData }` · bad status → `400`

### `POST /` — manual enroll
```jsonc
{ "courseId": "<uuid>", "userId": "<uuid>" }   // both required
```
→ `201 { success, message: "User enrolled.", data: Enrollment }` (status `NOT_STARTED`, progress 0)
Errors (all `400` with message): unknown course · archived course · unknown/archived
user · already enrolled · course full (enrollmentLimit)

### `PATCH /:id` — status only
```jsonc
{ "status": "COMPLETED" }   // the ONLY accepted field
```
→ `200 { success, message: "Enrollment updated.", data: Enrollment }`
`progress`/`completedAt` in the body → `400` · unknown id → `404`

### `DELETE /:id` — unenroll
→ `200 { success, message: "User unenrolled.", data: { id } }` · unknown id → `404`

---

*Backend files: `routes/enrollments.routes.js` · `controllers/enrollments.controller.js` ·
`services/enrollments.service.js` · `validators/enrollments.validator.js` ·
smoke: `scripts/enrollmentsSmokeTest.js`. No schema change was needed (no db push).*

---

## Addendum (2026-08-08) — startDate / expiryDate / cohortId

Extended for the Learners module (`LEARNERS_CONTRACT.md`, Part 3), which enrolls
through `POST /api/admin/learners/:id/enrollments` — a thin wrapper over THIS
same `enrollments.service.createEnrollment`, not a fork. Everything above is
still accurate; this only adds fields.

`CourseEnrollment` gained three nullable, additive columns (db push required —
see the Learners contract's own note): `startDate`, `expiryDate` (both
`DateTime?`), `cohortId` (`String?`, FK to the existing `Group` model —
groups.prisma, no new cohort concept). Every enrollment created before this
addendum has all three `null`; nothing back-filled.

`POST /` now also accepts, all optional:
```jsonc
{ "courseId": "…", "userId": "…", "startDate": "2026-09-01T00:00:00.000Z",
  "expiryDate": "2027-03-01T00:00:00.000Z", "cohortId": "<group id>" }
```
`expiryDate` must be after `startDate` when both are sent → `400`. Unknown
`cohortId` → `400 COHORT_NOT_FOUND`. The `Enrollment` type gains the matching
three response fields (all nullable). `PATCH /:id` is unchanged — still
`status` only.
