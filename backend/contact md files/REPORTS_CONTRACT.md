# Reports & Analytics — API Contract v1

Source of truth for the Reports & Analytics module, mirroring
`COMPETENCIES_CONTRACT.md`/`INSTRUCTORS_CONTRACT.md`'s format exactly. If
anything here conflicts with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/reports`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload> }` — **except** `GET /export`, which returns the raw file (`Content-Disposition: attachment`), and `GET /export?format=json`, which returns `{ type, generatedAt, columns, rows }` directly (no `success`/`data` wrapper — it IS the downloadable file body).
- **Envelope (error):** `{ "success": false, "message": string }`
- **Dates:** ISO 8601 strings · **Rate limit:** `adminUsersAnalyticsRateLimiter` on every endpoint (30/min prod, 300/min dev) — same convention as every other module's `/stats`/`/analytics`.

---

## ⚠️ Read before building against this

> **1. This is a read-only aggregation module — one write-adjacent
> exception.** No endpoint here owns a table. `GET /export` writes a
> `REPORT_EXPORTED` audit-log row as a side-effect (mirrors
> `USERS_EXPORTED`/`SKILLS_EXPORTED`), but changes no displayed number — it
> carries no mutation ID, no `invalidateFor()` call.

> **2. R4 discipline — every metric is reused from its owning module or is
> genuinely new.** Confirmed metric-by-metric before writing a single query
> (full audit in the build session, not assumed):
> - `activeLearners` / `avgLearningProgress` ← `learners.service.getStats()`
> - `activeInstructors` ← `instructors.service.getStats()`
> - `coursesCompleted` / `certificatesIssued` ← `lm.service.getStats()`
>   (`countWithGrowth` convention — `revokedAt: null` = issued)
> - Top-instructor ranking ← `instructors.service.getTopInstructorIds()`
>   (the ONE definition, per that file's own header comment)
> - At-risk threshold ← `learners.service.AT_RISK_THRESHOLD`
> - Live-session status ← never read `LiveSession.status` raw; where a
>   report needs the schedule-derived status this module goes through
>   `liveSessions.service.listSessions()`, same as every other consumer
>
> Everything else (learner activity/dropout-risk trends, course drop-off,
> assessment/attendance/audit aggregates, engagement, per-instructor
> completion rate, compliance) is fresh Prisma aggregation — nothing else in
> the codebase defines these, confirmed by grepping every existing
> `*.service.js` for a stats/analytics export before writing a query.

> **3. Confirmed absences (full schema grep, not assumed) — these are
> PERMANENTLY `available:false`, not "not implemented yet":**
> - No `Payment`/`Transaction`/`Invoice` model anywhere → `totalRevenue`
>   always unavailable, same reason string used by every other module
>   (`dashboard.service`, `instructors.service`).
> - No watch-time/session-duration/video-progress tracking model → `avgSessionDuration`, `videoWatchTime`, Course Analytics' `watchTime`, Overview's `engagementScore` all unavailable.
> - `Certificate` has no `expiresAt` field → Certificate Reports' `expired`
>   and Compliance's `expiredCertifications` both unavailable.
> - `CourseEnrollment.progress` is a single 0-100 percent, no per-lesson
>   checkpoint → Course Analytics' `dropOffPoints` unavailable.
> - `QuizAttempt` stores only the final `score`, no per-question response
>   log → Assessment Reports' `hardestQuestions` unavailable.
> - **No mandatory-training flag exists on `Course` or
>   `CompetencyFramework`, and no compliance-violation tracking model exists
>   anywhere** → Compliance's `mandatoryTrainingCompletion`,
>   `complianceViolations`, and `departmentCompliance` all unavailable.
>   `atRiskUsers` is the one real field on that endpoint (reuses
>   `AT_RISK_THRESHOLD`, not a bespoke "compliance risk").

> **4. `dateRange` is a rolling window, not calendar-aligned.** `week` =
> trailing 7 days, `month` = trailing ~30 days (same day last month),
> `quarter` = trailing 3 months, `custom` = `dateFrom`/`dateTo` (both
> required, ISO dates). Every module in this codebase uses fixed
> "this-calendar-month vs last-calendar-month" — Reports is deliberately
> different because it's the one module with a user-selectable window, and
> `changePercent` here means **current window vs. the immediately preceding
> window of the same length** (`priorWindow()` in `reports.service.js`), not
> month-over-month. Documented divergence, not an inconsistency bug.

> **5. Export Center's backend builds the actual file**, unlike
> Users/Competencies (backend returns JSON, frontend builds the CSV). A
> deliberate deviation: Export Center is one central place emitting 7
> different report types in 2 formats, so the file itself is built
> server-side (`toCsv()` in `reports.controller.js`) and streamed with
> `Content-Disposition: attachment`.

---

## Types

```ts
export type Metric = { value: number | null; changePercent: number | null; available: boolean; reason?: string };
export type DateRangeKey = 'week' | 'month' | 'quarter' | 'custom';
export interface Pagination { total: number; page: number; limit: number; pages: number }
export interface TrendSeries { labels: string[]; values: number[] }
```
Every endpoint accepts `dateRange` (default `month`) + `dateFrom`/`dateTo`
(required iff `dateRange=custom`). `400` if `dateRange` is invalid or custom
dates are missing/malformed/reversed.

---

## Part 1 — Core Analytics API

### `GET /overview`
Query: `dateRange · department?`
```jsonc
{ "success": true, "data": {
  "totalUsers": { "value": 20, "changePercent": 150, "available": true },
  "activeLearners": { "value": 8, "changePercent": 0, "available": true },
  "activeInstructors": { "value": 11, "changePercent": 300, "available": true },
  "coursesCompleted": { "value": 6, "changePercent": -50, "available": true },
  "avgLearningProgress": { "value": 33, "changePercent": null, "available": true },
  "liveSessionsToday": { "value": 0, "changePercent": null, "available": true },
  "totalRevenue": { "value": null, "changePercent": null, "available": false, "reason": "No Payment/Transaction model exists yet — ships with the Finance module." },
  "certificatesIssued": { "value": 6, "changePercent": -80, "available": true },
  "engagementScore": { "value": null, "changePercent": null, "available": false, "reason": "No engagement-scoring model exists yet — same gap Dashboard's studentEngagement metrics already have." },
  "systemActivity": { "value": 1265, "changePercent": 229, "available": true }
}}
```
`liveSessionsToday` is a fixed calendar-day count, independent of
`dateRange`. `systemActivity` = `AuditLog` rows in the window (genuinely new
— the only KPI here with no other owner besides this endpoint itself).
Live-verified against the real dev DB during the build (not just
type-checked) — response above is real output, not a mock.

### `GET /learners`
Query: `dateRange · department? · cohort? · page · limit`
```jsonc
{ "success": true, "data": {
  "activityTrend": { "labels": ["2026-07-09", …], "activeUsers": [0, 0, …] },
  "progressDistribution": { "excellent": 2, "good": 0, "average": 2, "poor": 6 },
  "completionRate": { "value": 100, "trend": [0, 0, …, 67, 0] },
  "dropoutRisk": { "high": [], "medium": [], "low": [] },
  "retentionRate": { "value": 0, "changePercent": null, "available": true },
  "topPerformers": [ { "userId": "…", "name": "Dan Black", "avgProgress": 100, "enrollments": 1 } ],
  "inactiveUsers": [ { "id": "…", "name": "…", "lastActivityAt": null } ]
}}
```
`progressDistribution` buckets: excellent ≥90, good ≥70, average ≥40, poor
<40 (over raw `CourseEnrollment.progress`). `completionRate.trend`[i] =
enrollments that both started AND completed within bucket i, divided by
enrollments that started in it (cohort-style, not "% of all-time completed
by this date"). `dropoutRisk` buckets: high ≥`AT_RISK_THRESHOLD` (70),
medium 40-69, low <40 — only users with a `learnerProfile.riskScore` row
(null riskScore ≠ 0, never bucketed). `retentionRate` = users active in both
the current AND immediately-preceding window, divided by users active in
the preceding window.

### `GET /instructors`
Query: `dateRange · page · limit`
```jsonc
{ "success": true, "data": {
  "avgRating": { "value": null, "changePercent": null, "available": false, "reason": "No Review/Rating model exists yet — ships with instructor reviews." },
  "courseCompletionRate": { "value": 50, "changePercent": null, "available": true },
  "liveSessionAttendance": { "value": null, "changePercent": null, "available": false, "reason": "No live sessions with recorded attendance in this window." },
  "topInstructors": [ { "id": "…", "name": "bilal", "publishedCourses": 3, "liveSessions": 3 } ],
  "performanceComparison": [ { "id": "…", "name": "bilal", "publishedCourses": 3, "totalCourses": 86, "liveSessions": 3, "completionRate": 50 } ]
}}
```
`courseCompletionRate` (top-level) = % of enrollments across ALL
instructors' courses that are COMPLETED — an enrollment/student-outcome
metric, deliberately NOT "% of courses published" (that's the separate,
real `publishedCourses` field). `performanceComparison[].completionRate` is
the SAME metric broken out per instructor (raw SQL join —
`course_enrollments` ⋈ `courses` grouped by `instructorId, status`, since
Prisma's `groupBy` can't group by a nested relation field); `null` when that
instructor's courses have zero enrollments, never a fabricated 0.

### `GET /courses`
Query: `dateRange · categoryId? · page · limit`
```jsonc
{ "success": true, "data": {
  "enrollmentTrend": { "labels": [...], "values": [...] },
  "completionRates": [ { "id": "…", "title": "…", "enrollments": 2, "completed": 1, "completionRate": 50 } ],
  "mostPopular": [ { "id": "…", "title": "…", "enrollments": 2 } ],
  "dropOffPoints": { "value": null, "changePercent": null, "available": false, "reason": "No per-lesson progress checkpoint model exists — CourseEnrollment only stores an overall progress percent." },
  "bestCategories": [ { "name": "Design", "avgProgress": 5, "enrollments": 2 } ],
  "watchTime": { "value": null, "changePercent": null, "available": false, "reason": "No watch-time/video-progress tracking model exists yet." }
}}
```

### `GET /assessments`
Query: `dateRange · courseId? · page · limit`. Reads `QuizAttempt` where
`submittedAt` falls in range (excludes `IN_PROGRESS` attempts with no
submission timestamp). Pass/fail threshold: score ≥60 (same default as
`Quiz.passingGrade`). `avgScore`/`passRate`/`failRate` all `available:false`
together when zero graded attempts exist in the window — never a fabricated
0%. `hardestQuestions` permanently unavailable (see note 3).

### `GET /certificates`
Query: `dateRange · page · limit`. `totalIssued` = `revokedAt: null` in
window (`issuedAt`); `revoked` = all-time count of `revokedAt: {not: null}`
(a different population than `totalIssued` — one is windowed+active, the
other is all-time+revoked, they aren't complements of each other). `expired`
and `verificationRequests` permanently unavailable (see note 3).

### `GET /attendance`
Query: `dateRange · page · limit`. Reads `SessionAttendance` joined to
`LiveSession.startTime` in range. `overallRate` = (PRESENT+LATE)/total.
Every card `available:false` together when zero attendance rows exist in
the window (not per-card).

### `GET /audit`
Query: `dateRange · search? · action? · userId? · page · limit`.
**`action` is a strict Prisma enum (~150 values)** — `search` therefore only
matches `admin.fullName` (real string field), never tries `contains`/
`equals` against `action` (an unrecognized string throws a
`PrismaClientValidationError`, which — if you're tempted to add it back —
gets silently swallowed by this file's `safe()` wrapper into a FALSE "0
results", a real bug caught during this build, not a hypothetical). Use the
dedicated `action` param for exact-enum filtering. `userId` matches either
`adminId` OR `targetUserId`. Same `count`+`findMany`+pagination shape as
`instructors.service.getSuspensionHistory`/`learners.service.getSuspensionHistory`
(the only two prior precedents for a paginated `AuditLog` list) — generalized,
not forked.
```jsonc
{ "success": true, "data": { "logs": [
  { "id": "…", "action": "ADMIN_LOGIN", "userId": "…", "userName": "MindNavy Admin", "targetId": null, "targetType": null, "metadata": {"sessionId":"…"}, "createdAt": "…" }
], "pagination": { "total": 1247, "page": 1, "limit": 25, "pages": 50 } } }
```

### `GET /engagement`
Query: `dateRange`. `dailyActiveUsers`/`weeklyActiveUsers` are two DIFFERENT
bucketings of the SAME window (day buckets vs. fixed 7-day buckets), not the
same data at two granularities. `retentionRate` unavailable when zero users
were active in the prior comparison window (division by zero, not a
fabricated 0%). `avgSessionDuration`/`videoWatchTime` permanently
unavailable (see note 3).

---

## Part 2 — Export Center + Compliance

### `GET /export`
Query: `type (learners|instructors|courses|certificates|assessments|attendance|audit, required) · format (csv|json, default csv) · dateRange`.
Row-capped at 5000 (`EXPORT_ROW_CAP`, same convention as
`users.service.exportUsers`), not paginated — a bounded snapshot. Returns
the file directly:
- `format=csv` → `Content-Type: text/csv`, `Content-Disposition: attachment; filename="reports-<type>-<date>.csv"`, body is the CSV text.
- `format=json` → same `Content-Disposition`, body is `{ type, generatedAt, columns, rows }` (not the `{success,data}` envelope).

Writes `REPORT_EXPORTED` to `AuditLog` (best-effort, never blocks the
download on audit-write failure). `400` for an unknown `type`/`format`.

### `GET /compliance`
Query: `dateRange · departmentId?`. See note 3 — four of five fields are
`available:false` with the SAME reason string (no mandatory-training or
compliance-violation model exists); `atRiskUsers` is real, reuses
`AT_RISK_THRESHOLD`, department-filterable by `departmentId` (the real FK,
not the free-text `department` string other endpoints filter by — this one
filters `AppUser.departmentId` since the frontend's Compliance tab sources
its dropdown from `GET /organization/departments`, which returns IDs).

---

## Error codes

| Status | When |
|---|---|
| 400 | invalid `dateRange` · missing/malformed/reversed custom dates · invalid `page`/`limit` · unknown export `type`/`format` |
| 401 | missing/invalid admin token |
| 429 | rate limited |
| 503 | `prisma db push` not run yet (only relevant to `REPORT_EXPORTED`'s audit write and any future Reports-owned table — no endpoint's core data path depends on schema not yet pushed) |

No endpoint returns 404 (nothing here is scoped to a single resource id)
or 409 (nothing here writes domain data).

---

## Part 3 — Scheduled Reports (shipped 2026-08-09)

The module's first owned table (`ScheduledReport`, `reports.prisma`) — every
other endpoint above reuses other modules' models. A background sweep
(`setInterval`, hourly — no node-cron in this codebase, matches the existing
role-assignment-expiry sweep in `server.js`) finds every `ACTIVE` row whose
`nextRunAt` has passed, regenerates the report via the SAME `getExportData()`
+ `toCsv()` Part 2 export uses (now shared via `utils/csv.js`), emails it as
an attachment (`utils/mailer.js`, extended with an `attachments` param) to
`recipients`, then advances `lastRunAt`/`nextRunAt`. Runs are isolated in a
per-report `try/catch` — one bad send never blocks the batch or crashes the
timer, and a failed run leaves `nextRunAt` untouched so it's retried next
hour instead of silently skipped for a full cycle.

- **Base URL:** `http://localhost:5001/api/admin/reports/scheduled` (separate router, same auth/rate-limit convention as everything else in this contract)
- `format`/`frequency`/`status` are real Prisma enums (`CSV`/`JSON`, `DAILY`/`WEEKLY`/`MONTHLY`, `ACTIVE`/`PAUSED`/`CANCELLED`); `reportType` is a plain string validated against the SAME `EXPORT_TYPES` set Part 2's `GET /export` uses (exported from `reports.validator.js` — one list, not a fork).
- `createdById` is a plain string actor id, no Prisma relation — same convention as `Course.createdBy`/`Skill.createdById` (competencies.prisma), not a FK to `AppUser` (the authenticated actor on every `/api/admin/*` route is `AdminUser` via `req.admin`, a different table than the task's original `FK → AppUser` spec named — flagged and corrected before building, not built as specified).
- `CANCELLED` exists in the status enum for badge completeness but no endpoint sets it in this pass — `DELETE` hard-deletes the row like every other module's delete, it does not soft-cancel.

| Endpoint | Notes |
|---|---|
| `GET /` | `?page&limit&status?` → `{ reports: ScheduledReport[], pagination }` |
| `POST /` | `{ name, reportType, format, frequency, filters?, recipients }` → creates with `status: ACTIVE`, computes `nextRunAt` from `frequency` |
| `PATCH /:id` | Any subset of the create fields. Changing `frequency` recomputes `nextRunAt` from now (the old cadence's countdown is meaningless once the interval changes) |
| `DELETE /:id` | Hard delete |
| `PATCH /:id/pause` | `status → PAUSED` |
| `PATCH /:id/resume` | `status → ACTIVE`, recomputes `nextRunAt` from now (so a report paused for weeks doesn't fire a backlog of runs on resume) |

Every write logs to `AuditLog`: `SCHEDULED_REPORT_CREATED/UPDATED/DELETED/PAUSED/RESUMED` (admin-authored) and `SCHEDULED_REPORT_RUN` (system-authored by the sweep, `adminId: null`).

## Mutation IDs (frontend `invalidation.ts`)

| Mutation ID | Status | Invalidate (extra) |
|---|---|---|
| `reportSchedule.create` / `.update` / `.delete` / `.pause` / `.resume` | **shipped 2026-08-09** — Export Center tab's "Scheduled Reports" section; header's "Schedule Report" button now navigates there instead of showing a toast | `['report-schedules']` |
| `reportTemplate.save` | **dead** — no Custom Report Builder exists | `['report-templates']` |

`queryKeys.reportsOverview()` / `.reportsLearners()` / `.reportsInstructors()`
/ `.reportsCourses()` / `.reportsAssessments()` / `.reportsCertificates()` /
`.reportsAttendance()` / `.reportsAudit()` / `.reportsEngagement()` /
`.reportsCompliance()` are registered in `queryKeys.ts` for when a real
TanStack Query cache is wired up — today (no caching layer exists app-wide,
see `invalidation.ts`'s own header comment) each tab self-fetches on mount
and listens for the `analyticsUpdated` bridge event, same pattern as every
other module's `*OverviewTab`/`*AnalyticsTab`.

---

*Built 2026-08-09 across 5 parts: Part 1 (9 core endpoints), Part 2 (Export
Center + Compliance), Part 3 (page shell + Overview tab), Part 4 (remaining
12 tabs), Part 5 (this contract + IMPACT_MAP + Playwright + self-review).
Every endpoint was hit live against the real dev DB during the build (curl +
a real login token), not just type-checked — two real bugs were caught and
fixed this way (instructor completion-rate formula, audit search's enum
`equals` throwing silently) that `tsc`/review alone would have missed. The
frontend was also driven in a real headless browser (login → click every
sidebar/tab link → screenshot → check `console --errors`), not just built
and assumed correct.*
