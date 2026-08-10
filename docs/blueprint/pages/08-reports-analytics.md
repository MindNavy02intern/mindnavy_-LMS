# 08 · Reports & Analytics — `/reports-analytics`
Doc: Reports & Analytics §1–§14 · Entities: ALL (read-only module, one write-adjacent action) · Status: `[built]` (2026-08-09)

Contract: `backend/contact md files/REPORTS_CONTRACT.md`.

> **Deviation from this file's original `[planned]` draft, logged not silently
> fixed:** the draft below named 14 tabs (Dashboard Overview, Student
> Analytics, Instructor Analytics, Course Analytics, Learning Progress, Quiz
> & Exam Reports, Certificates Reports, Attendance Reports, **Revenue
> Reports**, Engagement Analytics, Compliance Reports, Audit Reports, Export
> Center, Custom Reports). The actual build task specified a different
> 13-tab structure (Overview, **Learner Analytics**, Instructor Analytics,
> Course Analytics, Learning Progress, **Assessments**, Certificates,
> Attendance, Engagement, Compliance, **Audit Logs**, Export Center, Custom
> Reports) — no standalone Revenue Reports tab (revenue is a single KPI,
> permanently `available:false`, inside Overview) — and was built to that
> spec, same "newer explicit instruction over a pre-build placeholder doc"
> precedent as `07-competencies.md`. This file now describes what was
> actually built. Sidebar link (`/reports-analytics`, `AdminLayout.tsx`)
> already existed and was dead (no matching route) — wired to the real route
> in this pass, plus the topbar "Generate Report" quick action (was a
> "coming soon" toast, now navigates to `?tab=export`).

## Module nature: read-only, one write-adjacent action
Every endpoint is a `GET`. The only state-changing call is `GET
/reports/export`, which writes a `REPORT_EXPORTED` audit-log row as a
side-effect (mirrors `USERS_EXPORTED`/`SKILLS_EXPORTED` elsewhere) — it does
not change any displayed number, so it carries no mutation ID. Every number
either reuses an existing module's owning function (R4) or is fresh
aggregation over a source table nothing else already defines — see
`REPORTS_CONTRACT.md`'s reuse table for exactly which is which per field.
`available:false` is used wherever no data model exists (revenue, watch
time, session duration, certificate expiry, per-lesson drop-off,
per-question response log, mandatory-training/compliance-violation
tracking) — never a fabricated 0.

## Tabs (as built)

| Tab | Query keys | Endpoint | Contents |
|---|---|---|---|
| Overview (`?tab=overview`, default) | `reportsOverview()` + reuses `reportsLearners()`/`reportsCourses()`/`reportsCertificates()`/`reportsAudit()` data for its charts | `GET /reports/overview` | 10 KPI cards (2×5): Total Users, Active Learners, Active Instructors, Courses Completed, Avg Learning Progress, Live Sessions Today, Total Revenue (unavailable), Certificates Issued, Engagement Score (unavailable), System Activity. Date range (week/month/quarter/custom) + department filter (`['org','departments']`, real dropdown — R2). Charts: Learning Activity trend + Top Active Learners ← Learner Analytics' `activityTrend`/`topPerformers`; Course Completion by Category ← Course Analytics' `bestCategories`; Recent Certificates ← Certificate Reports; System Activity feed ← Audit Reports' `logs`. Listens for the app-wide `analyticsUpdated` bridge event (aggregates too many domains for one mutation ID to name). |
| Learner Analytics (`?tab=learners`) | `reportsLearners(filters)` | `GET /reports/learners` | Activity trend line, progress distribution donut (excellent/good/average/poor buckets), dropout risk (High/Medium/Low, reuses `learners.service.AT_RISK_THRESHOLD`), completion-rate trend, top performers, inactive users. Filters: dateRange/department (real dropdown)/cohort (free-text Group ID — no groups-listing API exists on the frontend to build a real dropdown from, flagged not faked). |
| Instructor Analytics (`?tab=instructors`) | `reportsInstructors(filters)` | `GET /reports/instructors` | Top instructors (reuses `instructors.service.getTopInstructorIds()` — the one ranking definition), per-instructor course completion rate bar chart (real enrollment-outcome metric added this pass — see contract), live session attendance, performance comparison table. `avgRating` always `available:false` (no Review model) — reused from `instructors.service.getStats()`, never re-derived. |
| Course Analytics (`?tab=courses`) | `reportsCourses(filters)` | `GET /reports/courses` | Enrollment trend, completion rates per course (table), most popular ranking, best categories donut. Drop-off points and watch time both honest `available:false`. |
| Learning Progress (`?tab=progress`) | reuses `reportsLearners()` + `reportsCourses()` | *(none — composed from the two above)* | **Judgment call, flagged in `REPORTS_CONTRACT.md`:** the build task's tab list names this tab but never specifies its contents. Built as completion-rate trend + progress distribution (from Learner Analytics) + per-course progress table (from Course Analytics) rather than a dead 13th stub — no new metric invented. |
| Assessments (`?tab=assessments`) | `reportsAssessments(filters)` | `GET /reports/assessments` | Summary cards (Attempts/Avg Score/Pass Rate/Fail Rate), pass/fail donut, recent attempts table, course/date filters. Hardest Questions `available:false` — `QuizAttempt` stores only the final score, no per-question response log. |
| Certificates (`?tab=certificates`) | `reportsCertificates(filters)` | `GET /reports/certificates` | Summary cards (Issued/Expired/Revoked/Verification Requests), issued trend, recent certificates list. Expired and Verification Requests both `available:false` (`Certificate` has no `expiresAt` field; no verify-page-hit tracking exists). |
| Attendance (`?tab=attendance`) | `reportsAttendance(filters)` | `GET /reports/attendance` | Summary cards (Overall/Present/Late/Absent/Excused), trend, session attendance table. |
| Engagement (`?tab=engagement`) | `reportsEngagement(filters)` | `GET /reports/engagement` | Daily + Weekly active users line charts, retention rate, low engagement users. Avg session duration and video watch time both `available:false` (no tracking model). |
| Compliance (`?tab=compliance`) | `reportsCompliance(filters)` | `GET /reports/compliance` | Mandatory Training Completion, Expired Certifications, Compliance Violations, and Department Compliance are ALL `available:false` — **this schema has no mandatory-training flag on any Course/Framework model and no compliance-violation tracking model** (confirmed by a full schema grep, not assumed). At-Risk Users is the one real field — reuses `AT_RISK_THRESHOLD`, department-filterable via a real dropdown. |
| Audit Logs (`?tab=audit`) | `reportsAudit(filters)` | `GET /reports/audit` | Searchable/filterable table (search matches admin name only — `action` is a strict Prisma enum, free text can't safely `contains`/`equals` against it, use the dedicated `action` param for that), action/user/date filters, pagination, Export Logs shortcut (→ Export Center's `audit` type). |
| Export Center (`?tab=export`) | — (download, not cached) | `GET /reports/export` | Report type (7 options) + format (CSV/JSON) + date range → `Generate & Download` triggers a real file download (`Content-Disposition: attachment` — backend builds the file itself here, unlike Users/Competencies where the client builds the CSV from a JSON response). "Recent Exports" is honestly session-only — nothing persists server-side. Below it, a **Scheduled Reports** section (`GET/POST/PATCH/DELETE /reports/scheduled*`, shipped 2026-08-09): list with Active/Paused/Cancelled badges + Last Run/Next Run, New Schedule / Edit / Pause / Resume / Delete. An hourly backend sweep actually sends these (email + attachment) — see `REPORTS_CONTRACT.md` Part 3. |
| Custom Reports (`?tab=custom`) | — | — | Genuine "coming soon" — no saved-report-definition model or query-builder endpoint exists. Explains the intended shape (data source → columns/filters → save template → schedule) rather than a bare placeholder. |

## Mutation IDs
`reportSchedule.create`/`.update`/`.delete`/`.pause`/`.resume` are registered
in `invalidation.ts` and **shipped 2026-08-09** — the Export Center tab's
Scheduled Reports section. "Schedule Report" in the header now navigates to
`?tab=export` (that section) instead of showing a toast. `reportTemplate.save`
remains dead — no Custom Report Builder exists, same status as
`skillLevel.configure`.

## `[phase-later]`: AI predictive analytics, risk detection, forecasting, benchmarks, executive summaries, custom report builder.
