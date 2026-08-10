# Learners & Enrollment/Progress/Assessments/Certificates/Attendance/Documents/Tickets — API Contract v1

Source of truth for the Learners module, mirroring `INSTRUCTORS_CONTRACT.md`'s
format exactly. If anything here conflicts with a task description, **this
contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/learners`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min · stats/analytics 30/min (300 dev) · writes 60/10min

---

## ⚠️ Read before building against this

> **1. A learner IS an `AppUser` with `role = LEARNER`.** No separate table.
> `:id` everywhere is the AppUser id — the same value in `CourseEnrollment.userId`
> and `Certificate.userId`. `LearnerProfile` is an OPTIONAL side table
> (program/level/department/batch/advisor/verificationStatus/riskScore/
> learnerCode) — a learner created via `POST /api/admin/users` has none and
> still appears here with `hasProfile: false`.

> **2. TERMINOLOGY: "Learner" only, everywhere — never "Student".** This is a
> hard rule, not a preference. `frontend/src/lib/invalidation.ts` and
> `queryKeys.ts` already had DEAD `student.*` / `queryKeys.students.*`
> scaffolding predating this module (built for a `/students` page that was
> never shipped — zero consumers, confirmed before writing any code). It was
> deliberately left untouched, not renamed or reused — this module's own
> `queryKeys.learners.*` / `learner.*` mutation IDs are entirely separate.

> **3. `learnerCode` is `LRN-0001` style, never `STD-`.** Server-generated,
> sequential-looking (not strictly gapless — collision-retried), unique.

> **4. Status/verification/email/password are owned by the Users module,**
> same rule as Instructors. `PATCH /learners/:id` 400s on `status`, `email`,
> `role`, `verificationState`, `password`. Unlike Instructors, there is **no
> `/verify` verb** — `verificationStatus` (a LearnerProfile field, a different
> concept from AppUser's account `verificationState`) is a plain field on the
> generic update endpoint. There IS a `/reset-password` verb, which Instructors
> does not have.

> **5. Reuse over duplication, everywhere it was possible:**
> - Enrollments (`/learners/:id/enrollments`, `/bulk-enroll`) are thin
>   wrappers over the EXISTING `enrollments.service` (`ENROLLMENTS_CONTRACT.md`)
>   — the same service the Learning Management `EnrollmentsTab` uses. Not a fork.
> - Certificates (`/learners/:id/certificates`) are thin wrappers over the
>   EXISTING `certificates.service` (`CERTIFICATES_CONTRACT.md`).
> - `certificate.reissue` / `certificate.revoke` (frontend mutation IDs) are
>   REUSED as-is, not forked — they already target the real, generic
>   `queryKeys.certificates()`.
> - `ticket.respond` / `.resolve` / `.escalate` are REUSED — they already
>   existed (dead, unconsumed) targeting the real, generic
>   `queryKeys.supportTickets()`. This module is their first real consumer.
> - Everything else genuinely new (enroll/unenroll/progress reset,
>   assessments, documents) has its own new IDs — see the table at the bottom.

> **6. Three models were built new because nothing else covered them,**
> confirmed by an explicit audit before writing any code: `QuizAttempt`
> (Assessments — `Quiz`/`Question` are the admin-side BUILDER only, no
> learner-attempt table existed), `SessionAttendance` (`LiveSession` was
> scheduling-only, no per-learner record existed), `SupportTicket` +
> `TicketMessage` (no ticket model existed anywhere). All three are real, no
> `available:false` needed for their endpoints.

> **7. Documents reuse the `instructor-documents` Supabase bucket**, under a
> `learners/<id>/documents/` prefix — no dedicated `learner-documents` bucket
> exists (confirmed live against Supabase before writing the upload code).
> Override with `SUPABASE_LEARNER_DOCS_BUCKET` if a dedicated bucket is
> provisioned later; zero code changes needed.

> **8. No ticket-creation endpoint exists.** `GET/PATCH` only, per spec — there
> is no learner-facing app in this system to raise a ticket from (same
> documented gap as `InstructorReview` having no submission endpoint). Rows
> exist only via direct DB/seed access until a learner-facing app ships.

---

## Types

```ts
export type LearnerStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'archived';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired'; // AppUser-owned, account-level
export type LearnerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type LearnerVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'; // LearnerProfile-owned, distinct concept

export interface Learner {
  id: string; userId: string; fullName: string; email: string; avatar: string | null; phone: string | null;
  status: LearnerStatus; verificationState: VerificationState;
  orgDepartment: string | null; branch: string | null; // AppUser org fields
  learnerCode: string | null; program: string | null; level: LearnerLevel | null;
  department: string | null; batch: string | null; advisorId: string | null; // LearnerProfile academic fields
  verificationStatus: LearnerVerificationStatus | null; riskScore: number | null; // null = no signal, never 0
  joinedDate: string; hasProfile: boolean;
  coursesCount: number; completedCoursesCount: number; avgProgress: number | null; certificatesCount: number;
  lastActiveAt: string | null; suspendedAt: string | null; createdAt: string; updatedAt: string;
}

export interface LearnerDetail extends Learner {
  advisorName: string | null; // detail-only enrichment
  badges: { active: boolean; atRisk: boolean; verified: boolean };
}
```

`Metric` envelope (stats cards) is identical to Instructors':
`{ value: number|null, changePercent: number|null, available: boolean, reason?: string }`.

---

## Instructors (Part 1)

### `GET /api/admin/learners`
Query: `tab` (`all|active|inactive|at-risk|completed|suspended|pending-verification|graduated`)
· `search` (name/email) · `department` · `program` · `sort` (`recent|name|courses|progress`)
· `page` · `limit` (max 100).

`at-risk`/`completed`/`pending-verification`/`graduated` are DERIVED, not
status values — no such AppUser status exists:
- **at-risk** = `learnerProfile.riskScore >= 70` (tunable constant, `AT_RISK_THRESHOLD` in `learners.service.js`)
- **completed** = ≥1 `CourseEnrollment` with `status = COMPLETED`
- **pending-verification** = `learnerProfile.verificationStatus = PENDING`
- **graduated** = ≥1 enrollment AND every enrollment `COMPLETED` — a judgment call, confirm with stakeholders before relying on it for anything high-stakes

```jsonc
{ "success": true, "data": {
  "learners": [ /* Learner[] */ ],
  "tabCounts": { "all": 42, "active": 38, "inactive": 2, "suspended": 1,
                 "at-risk": 3, "completed": 12, "pending-verification": 5, "graduated": 2 },
  "pagination": { "total": 42, "page": 1, "limit": 10, "pages": 5 }
}}
```
`tabCounts` are global (search/filter independent).

### `GET /api/admin/learners/stats` — 6 cards
`totalLearners · activeLearners · newLearners · completedCourses · avgProgress · atRiskLearners`.
`avgProgress` and `atRiskLearners` always have `changePercent: null` — no
historical snapshot table exists to diff against; never fabricated.

### `GET /api/admin/learners/analytics` — 7 sections
`learnersByProgram` (donut) · `progressOverview` (12-month area, avg progress
of enrollments STARTED that month) · `atRiskLearners` (top 10 by riskScore) ·
`enrollmentTrend` (12-month bar) · `topPerformingLearners` (ranked by
completed-course count, avg progress tiebreak) · `recentCertificates` (latest
10) · `learnerEngagement` (% active in last 30 days — the donut's center score
IS this percentage, not a second metric).

### `GET /api/admin/learners/:id`
`404` for unknown id or non-learner id. Returns `LearnerDetail` — summary
counts only (coursesCount/completedCoursesCount/avgProgress/certificatesCount),
NOT the full courses/activity/assessments/etc. arrays — those are their own
endpoints below, fetched per side-panel tab (same shape as
`InstructorSidePanel`'s Documents/Reviews/Certifications tabs never preloading
into the base `GET /instructors/:id`).

### `POST /api/admin/learners`
Body: `fullName, email, password? (required unless status=INVITED), status?,
phone?, program?, level?, department?, batch?, advisorId?,
verificationStatus?, riskScore?`. `201` → `Learner`.

### `PATCH /api/admin/learners/:id`
Profile fields + `fullName`/`phone`. `status/email/role/verificationState/
password/learnerCode` → `400` naming the right endpoint. Upserts the profile
if none exists yet.

### `PATCH /api/admin/learners/:id/suspend`
Body: `{ reason (required, ≥3 chars), violationType? (CHEATING|POLICY|
BEHAVIOR|ACCOUNT_ABUSE|PAYMENT_FRAUD|SECURITY), notes? }`. Delegates to
`users.service` — same shared `VIOLATION_TYPES` taxonomy as Instructors
(extended, not forked — see `users.validator.js`). `200` → `LearnerDetail`.

### `PATCH /api/admin/learners/:id/reactivate`
Body: `{ notes? }`, may be empty. `200` → `LearnerDetail`.

### `PATCH /api/admin/learners/:id/reset-password`
Body: `{ newPassword }` (same strength policy as create). Delegates to
`users.service.resetUserPassword` — revokes all active sessions. `200` → `{ id }`.
**No equivalent endpoint exists for Instructors.**

### `GET /api/admin/learners/:id/suspension-history`
Identical shape/semantics to Instructors' — reads `USER_SUSPENDED`/
`USER_REACTIVATED` audit rows, not a suspensions table. `violationType` is the
6-value learner taxonomy above.

### `DELETE /api/admin/learners/:id`
Soft archive. Blocked (`409`) while the learner has active (non-`COMPLETED`)
enrollments — `{ data: { activeEnrollments: N } }`.

---

## Enrollments / Progress / Activity (Part 3)

### `GET /api/admin/learners/:id/enrollments`
Query: `page, limit, status`. Thin wrapper over `enrollments.service.listEnrollments({userId: id, ...})`.

### `POST /api/admin/learners/:id/enrollments`
```jsonc
{ "courseId": "…" }               // OR
{ "learningPathId": "…" }         // exactly one of the two, not both
// both variants also accept, all optional:
"startDate": "ISO", "expiryDate": "ISO", "cohortId": "<Group id>"
```
`courseId` variant: `201` → `Enrollment` (see `ENROLLMENTS_CONTRACT.md`'s
addendum for the shape — `startDate`/`expiryDate`/`cohortId` are new, nullable,
additive columns on the SAME `CourseEnrollment` table, not a new model).
`learningPathId` variant ("Assign Path"): expands into one enrollment per
COURSE-type item in the path (LIVE_SESSION items are skipped — no enrollment
concept for those). `200` → `{ pathId, enrolledCount, results: [{courseId,
success, enrollment?|error?}] }` — **partial success by design**: one course
already-enrolled/full/archived doesn't abort the rest.
`404 LEARNING_PATH_NOT_FOUND` if the path doesn't exist; `400
LEARNING_PATH_EMPTY` if it has zero course items.

### `DELETE /api/admin/learners/:id/enrollments/:enrollmentId`
Ownership-scoped (an enrollment belonging to another learner → `404`, not a
cross-learner unenroll). Thin wrapper over `enrollments.service.deleteEnrollment`.

### `POST /api/admin/learners/bulk-enroll`
Body: `{ learnerIds: string[] (1-500), courseId|learningPathId, startDate?,
expiryDate?, cohortId? }`. Partial success per learner, same shape as the
learning-path expansion above: `{ enrolledCount, failedCount, results: [...] }`.

### `GET /api/admin/learners/:id/progress`
`{ courses: [{ enrollmentId, courseId, courseTitle, courseThumbnail,
progress, status, completedAt, updatedAt }] }` — every `CourseEnrollment` row
for this learner, newest-updated first.

### `POST /api/admin/learners/:id/progress/:courseId/reset`
Resets ONE enrollment (matched by `courseId` + this learner) to `progress: 0,
status: NOT_STARTED, completedAt: null`. `404` if no such enrollment.

### `GET /api/admin/learners/:id/activity`
Query: `page, limit, type?` (`login|lesson_viewed|video_watched|quiz_attempt|
assignment_upload|session_attended`). Merges THREE real sources — `login` ←
`AppUserSession.createdAt`, `quiz_attempt` ← `QuizAttempt`, `session_attended`
← `SessionAttendance` — sorted desc, paginated in memory (bounded fetch
window). `lesson_viewed`/`video_watched`/`assignment_upload` have **no source
table anywhere in this system** — valid `type` filter values (return a clean
empty result, never `400`) but never appear in the unfiltered feed. Response
always carries `unavailableTypes: string[]` so the frontend can render "not
tracked" honestly rather than an ambiguous empty list.

---

## Assessments (Part 5) — `QuizAttempt`

Admin-facing half of a runtime with no learner-facing half yet (no
attempt-taking UI exists anywhere in this system) — rows are seeded/inserted
directly, not submitted by a learner through this app.

### `GET /api/admin/learners/:id/assessments`
`{ assessments: [{ id, quizId, quizTitle, passingGrade, courseId, courseTitle,
status (IN_PROGRESS|SUBMITTED|GRADED|REOPENED), score, feedback, attemptNo,
startedAt, submittedAt, gradedAt, gradedById, createdAt, updatedAt }],
pagination }`.

### `POST /api/admin/learners/:id/assessments/:aid/reopen`
Status → `REOPENED` only — nothing else touched. Distinct from Reset.

### `POST /api/admin/learners/:id/assessments/:aid/reset`
Full reset: `score/feedback/submittedAt/gradedAt/gradedById → null`,
`status → IN_PROGRESS`, `attemptNo` incremented.

### `PATCH /api/admin/learners/:id/assessments/:aid/grade`
Body: `{ score (required, integer 0-100), feedback? }`. → `status: GRADED`,
stamps `gradedAt`/`gradedById`. `submittedAt` is NOT touched (grading an
existing attempt doesn't imply a new submission).

`404 ATTEMPT_NOT_FOUND` for an unknown/foreign attempt id (ownership-scoped,
same 404-not-403 rule as instructor documents).

---

## Certificates (Part 5) — thin wrapper, see `CERTIFICATES_CONTRACT.md`

### `GET /api/admin/learners/:id/certificates`
`{ certificates: Certificate[], pagination }` — `Certificate` is the EXACT
same shape `certificates.service` returns everywhere else in the app (see
`CERTIFICATES_CONTRACT.md`), not a second type.

### `POST /api/admin/learners/:id/certificates/:cid/reissue`
Body optional: `{ templateId? }`. Ownership-scoped (`404` if the cert belongs
to another learner). Delegates to `certificates.service.reissueCertificate` —
same "old QR/PDF stops verifying" behavior.

### `POST /api/admin/learners/:id/certificates/:cid/revoke`
Body optional: `{ reason? }` — **new, additive** on the underlying
`certificates.service.revokeCertificate(id, adminId, reason)` (see that
contract's own addendum). Recorded in the `CERTIFICATE_REVOKED` audit entry's
`details.reason`, NOT a new `Certificate` column.

Download (`GET /certificates/:id/pdf`) and Verify (opens `/verify/:code`,
public) are NOT learner-scoped routes — the frontend calls the existing
generic ones directly using the `id`/`verificationCode` from the list response.

---

## Attendance (Part 5) — `SessionAttendance`, read-only

### `GET /api/admin/learners/:id/attendance`
`{ records: [{ id, sessionId, sessionTitle, sessionStartTime, status
(PRESENT|LATE|ABSENT|EXCUSED), joinedAt, leftAt, durationMin,
participationScore, createdAt }], summary: { present, late, absent, excused },
pagination }`.

**`summary` is computed via a separate unpaginated `groupBy` over the full
result set** — NOT derived from the current page's `records` (an earlier draft
had this bug: summary counts would silently change depending on which page
you were viewing; fixed before shipping). No manual-correction write endpoint
— read-only, per the task spec ("phase-later" per the model comment).

---

## Documents (Part 7) — `LearnerDocument`, mirrors `InstructorDocument`

Types: `IDENTITY | ENROLLMENT_AGREEMENT | ACADEMIC_RECORD | COMPLIANCE_FORM |
CERTIFICATE`. Statuses: `PENDING | VERIFIED | REJECTED | ARCHIVED`. Bucket:
see note 7 above. Upload is the same 3-step sign→PUT→confirm as
`INSTRUCTORS_CONTRACT.md`'s Documents section — identical rules (10MB cap,
PDF/PNG/JPEG/WEBP only, no SVG, path scoped to `learners/<id>/documents/`,
`downloadUrl` signed + 5-min expiry + never cached, archive is soft).

```
GET    /api/admin/learners/:id/documents                (?type, ?status, ?includeArchived)
POST   /api/admin/learners/:id/documents/sign             { fileName, fileType, type }
POST   /api/admin/learners/:id/documents/confirm          { path, fileName, type, expiresAt? }
PATCH  /api/admin/learners/:id/documents/:docId/verify
PATCH  /api/admin/learners/:id/documents/:docId/reject     { reason (required, ≥3 chars) }
DELETE /api/admin/learners/:id/documents/:docId            (soft — file stays, compliance record)
```

---

## Tickets (Part 7) — `SupportTicket` + `TicketMessage`, NO create endpoint

See note 8 above — `GET`/respond/resolve/escalate only.

```
GET   /api/admin/learners/:id/tickets                      (?page, ?limit, ?status)
PATCH /api/admin/learners/:id/tickets/:tid/respond          { body (required) }
PATCH /api/admin/learners/:id/tickets/:tid/resolve          { resolution? }
PATCH /api/admin/learners/:id/tickets/:tid/escalate         { priority? }
```
`respond` adds a `TicketMessage` and advances `OPEN → IN_PROGRESS` (a response
never downgrades urgency — `IN_PROGRESS`/`ESCALATED` stay as-is).
`{ tickets: [{ id, subject, body, category, status, priority, assignedToId,
resolvedAt, resolution, messageCount, createdAt, updatedAt }], pagination }`.

---

## Error codes

| Status | When |
|---|---|
| 400 | validation · foreign field on PATCH · missing suspend/reject reason · both or neither of courseId/learningPathId · expiryDate before startDate · empty learning path |
| 401 | missing/invalid admin token |
| 404 | unknown learner/enrollment/attempt/certificate/document/ticket id, or an id belonging to a DIFFERENT learner (never distinguished from "doesn't exist") |
| 409 | delete blocked by active enrollments · already-revoked certificate · archived document re-verify/reject |
| 429 | rate limited |
| 503 | storage not configured (documents) · `prisma db push` not run yet |

No known error path returns 500.

---

## Mutation IDs (frontend `invalidation.ts`)

**New:**

| Mutation ID | Invalidate (extra) |
|---|---|
| `learner.create` | `['learners']`, `['users']`, `['dashboard','user-analytics']`, `['learners',id]` |
| `learner.update` | `['learners']`, `['learners',id]` |
| `learner.suspend` / `.reactivate` | + `['users']`, `['dashboard','user-analytics']` (delegates to users.service) |
| `learner.delete` | `['learners']`, `['users']`, `['dashboard','user-analytics']` |
| `learner.resetPassword` | `['users']` |
| `learner.enroll` / `.unenroll` | `['learners']`, `['enrollments',id\|courseId]`, `['courses']`, `['dashboard','course-analytics']`, `['learners',id]` |
| `learner.bulkEnroll` | `['learners']`, `['enrollments',courseId]`, `['courses']`, `['dashboard','course-analytics']`, `['learners',id]` per affected learner |
| `learner.progressReset` | `['learners',id]`, `['dashboard','course-analytics']` |
| `learner.assessmentReopen` / `.assessmentReset` | `['learners',id]` |
| `learner.assessmentGrade` | `['learners',id]`, `['dashboard','course-analytics']` |
| `learnerDoc.upload` / `.verify` / `.reject` / `.archive` | `['learners',id,'documents']` (+`['learners',id]` on upload, `['approvals']` on verify/reject) |

**Reused, not forked** (documented so nobody re-forks them later):
`certificate.reissue`, `certificate.revoke`, `ticket.respond`, `ticket.resolve`, `ticket.escalate`, `user.import` (extended to also invalidate `['learners']`).

---

*Backend built 2026-08-08/09 across Parts 1/3/5/7. Frontend built same window
across Parts 2/4/6/8/9. `db push` required after each schema-touching part —
see the session's own turn-by-turn reports for exactly which parts needed it.
Bug-fix pass (2026-08-09): fixed `activity?limit` validator cap (was capped
at 50, should allow up to 100 like every other list endpoint) and built
`BulkEnrollLearnersModal` — the Part 3 `bulk-enroll` endpoint had shipped
backend-only with no frontend ever wired to it.*
