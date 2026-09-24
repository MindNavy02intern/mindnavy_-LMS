# IMPACT_MAP.md — MindNavy LMS · Data Reflection Map

**Audience:** Claude Code (primary) and developers (Bilal = frontend, Hassan = backend).
**Purpose:** Single source of truth for the question *"when X changes, what else must update?"*
**Authority:** CLAUDE.md → "Project Blueprint & Data Reflection Protocol" makes this file MANDATORY reading before every task. If a task and this map conflict, flag it — do not silently pick one.
**Companion:** `docs/blueprint/` (INDEX.md + 13 page files) maps every page, tab, table, filter, dropdown, and button to the mutation IDs and rows in this file. Blueprint = WHERE things live; this map = WHAT updates WHEN.

---

## 1. AGENT PROTOCOL — follow on EVERY task

**BEFORE writing code:**
1. List the entities the task touches (see §5 matrices).
2. For every mutation involved: copy its invalidation list from §5. Implementing a mutation without its full invalidation list = incomplete task.
3. For every NEW surface the task adds (widget, KPI card, table, dropdown, badge, counter, chart, tab): register it in §4 and wire it to an existing query key. A surface must never keep a private copy of shared data.
4. For every NEW mutation the task adds: add a row to the correct entity matrix in §5, in the same change.

**AFTER writing code:**
5. Update this file if you added or renamed any surface, mutation, query key, or endpoint.
6. If the mutation changes any dashboard number, add/extend a Playwright reflection test (template in §7).

**HARD RULES (non-negotiable):**
- **R1 — No client-side arithmetic on displayed stats.** Never `+1`/`-1` a displayed number after a mutation. Invalidate the query and let the surface refetch. (Optimistic updates are allowed for *lists*, never for *aggregates*.)
- **R2 — Dropdowns are surfaces.** Every dropdown/select reads the SAME query as its source entity list (role dropdown ⇒ `['roles']`, department dropdown ⇒ `['org','departments']`). Hardcoded option arrays are forbidden — this is the existing CLAUDE.md rule "never hardcode values that should come from APIs" applied to selects.
- **R3 — Aggregates are computed, never stored.** Backend computes every displayed count/sum live from source tables (`COUNT`, `SUM`). No stored counters, no separate aggregates tables at this stage (see §8).
- **R4 — One source of truth per datum.** If two surfaces show "the same number", they MUST consume the same query key and the same endpoint field. Two endpoints returning "total users" independently is a bug.
- **R5 — This map is code.** Out-of-date map = failing review. Updating it is part of the task, not documentation debt.

---

## 2. DEFAULT INVALIDATION POLICY

Every state-changing mutation ALWAYS invalidates the following, **in addition to** its entity row in §5:

| Always invalidate | Surface it feeds |
|---|---|
| `['activity']` | Learning Activity Feed (Dashboard §8) |
| `['notifications']` | Notifications Center (Dashboard §13) |
| `['dashboard','stats']` | Quick Statistics — all 9 KPI cards (Dashboard §4) |

**Why a blanket policy:** per the product spec, nearly every admin action appends an activity entry and may raise a notification; the 9 KPIs are cheap live COUNTs, so refetching them on any mutation is safe and kills the entire class of "the number didn't update" bugs. Opting out requires a written comment at the mutation site explaining why.

**Audit log** is written by the backend automatically on every mutation (§8). The frontend never creates audit entries and never needs to invalidate them unless the Audit page is open — that page uses `['audit']` with refetch-on-focus.

---

## 3. QUERY KEY REGISTRY (canonical)

All keys are created via `src/lib/queryKeys.ts` (factory). Never write key arrays inline in components or hooks.

**Dashboard**
`['dashboard','stats']` · `['dashboard','revenue']` · `['dashboard','user-analytics']` · `['dashboard','course-analytics']` · `['dashboard','instructor-performance']` · `['dashboard','student-engagement']` · `['dashboard','live-overview']` · `['reports','snapshot']` · `['calendar']` · `['tasks']` · `['transactions','recent']` · `['activity']` · `['notifications']` · `['approvals']` *(list + count from one endpoint)*

**Users domain**
`['users', filters?]` · `['users', id]` · `['users','suspended']` · `['users','pending-verification']` · `['users','archived']` · `['users','invitations']` · `['users','guests']` · `['users','tags']` · `['admins']`

**Access domain**
`['roles']` · `['roles', id]` · `['roles','company']` · `['role-templates']` · `['role-assignments', userId?]` · `['permission-matrix', roleId?]` · `['policies']` · `['audit', filters?]`

**Organization domain**
`['org','departments']` · `['org','branches']` · `['org','teams']` · `['org','chart']` · `['groups']` · `['competencies']`

**Learning domain**
`['courses', filters?]` · `['courses', id]` · `['categories']` · `['learning-paths']` · `['quizzes', courseId?]` · `['assignments', courseId?]` · `['certificates', filters?]` · `['certificate-templates']` · `['content-library']` · `['live-sessions', filters?]`

**Instructors domain**
`['instructors', filters?]` · `['instructors', id]` · `['instructor-applications']` · `['instructors', id, 'earnings']` · `['instructors', id, 'reviews']` · `['instructors', id, 'documents']`

**Students domain**
`['students', filters?]` · `['students', id]` · `['enrollments', studentId | courseId]` · `['students', id, 'progress']` · `['students', id, 'certificates']` · `['attendance', sessionId?]` · `['billing', studentId?]` · `['support-tickets']`

**Competencies domain** — shipped 2026-08-09, see `COMPETENCIES_CONTRACT.md`
`['competencies', filters?]` · `['competencies', id]` · `['competencies','stats']` · `['competencies','categories']` · `['competencies','frameworks']` · `['competencies','frameworks', id]` · `['competencies','levels']` · `['competencies','analytics']` · `['competencies','skill-gaps', filters?]` · `['competencies','assessments', filters?]` · `['competencies','settings']` · `['users', id, 'skills']`

**Reports & Analytics domain** — shipped 2026-08-09, see `REPORTS_CONTRACT.md`
`['reports','overview']` · `['reports','learners', filters?]` · `['reports','instructors', filters?]` · `['reports','courses', filters?]` · `['reports','assessments', filters?]` · `['reports','certificates', filters?]` · `['reports','attendance', filters?]` · `['reports','audit', filters?]` · `['reports','engagement', filters?]` · `['reports','compliance', filters?]`

**Finance domain (module pages)**
`['finance','dashboard']` · `['plans']` · `['subscriptions', filters?]` · `['invoices', filters?]` · `['payouts', filters?]` · `['coupons']` · `['tax','config']` · `['finance','settings']` · `['gateways']`

**Notifications module domain**
`['notifications','stats']` · `['notifications','rules']` · `['notification-templates']` · `['campaigns', filters?]` · `['notifications','settings']`

**Integrations / Settings / Security domains**
`['integrations']` · `['integrations','stats']` · `['integrations','sync']` · `['api-keys']` · `['webhooks']` · `['settings', domain]` · `['system','backups']` · `['security','stats']` · `['security','sessions']` · `['security','threats']` · `['security','devices']` · `['security','ip']` · `['security','incidents']` · `['security','retention']` · `['reports','templates']` · `['report-schedules']` · `['imports', jobId]` · `['export-schedules']` · `['import-templates']`

---

## 4. SURFACE REGISTRY

### 4a. Dashboard Overview widgets (from admin doc, Dashboard §3–§21)

| Widget | Query key | Endpoint (contract) | Derived from (source tables) |
|---|---|---|---|
| Welcome Section (name, role, last login, system status) | `['dashboard','stats']`* | `GET /api/dashboard/stats` | session, users, system |
| **Quick Statistics — 9 KPI cards:** Total Users · Active Students · Active Instructors · Published Courses · Pending Approvals · Total Revenue · Active Subscriptions · Certificates Issued · Live Sessions Running | `['dashboard','stats']` | `GET /api/dashboard/stats` | users, enrollments, instructors, courses, approvals, transactions, subscriptions, certificates, live_sessions |
| Revenue Overview (daily/monthly/annual, subscriptions, refunds, payouts, growth + 4 charts) | `['dashboard','revenue']` | `GET /api/dashboard/revenue` | transactions, subscriptions, payouts |
| User Analytics (new registrations, active, retention, roles distribution, verification status, suspended, geo) | `['dashboard','user-analytics']` | `GET /api/dashboard/user-analytics` | users, sessions, roles |
| Course Analytics (total/active/draft/pending, completion rates, popular, quiz performance, path progress) | `['dashboard','course-analytics']` | `GET /api/dashboard/course-analytics` | courses, enrollments, quiz_results, learning_paths |
| Learning Activity Feed | `['activity']` | `GET /api/activity` | activity_log |
| Pending Approvals widget (courses, instructors, verifications, refunds, certifications, moderation) | `['approvals']` | `GET /api/approvals` | approval queue views |
| Live Sessions Overview (active, upcoming, attendance, recording status) | `['dashboard','live-overview']` | `GET /api/dashboard/live-overview` | live_sessions, attendance |
| Instructor Performance (ratings, engagement, revenue, completion, reviews) | `['dashboard','instructor-performance']` | `GET /api/dashboard/instructor-performance` | instructors, reviews, transactions, enrollments |
| Student Engagement (progress, DAU, quiz participation, completion, drop-off, at-risk) | `['dashboard','student-engagement']` | `GET /api/dashboard/student-engagement` | enrollments, activity_log, quiz_results |
| Notifications Center (topbar bell — unchanged, reads `recentActivities`) + sidebar unread badge (shipped 2026-08-10, real count from `GET /api/admin/notifications?read=false`) | `['notifications']` | `GET /api/admin/dashboard/core` (bell panel) · `GET /api/admin/notifications` (badge + `/notifications?tab=inapp` page) | audit_log (bell) · notification_logs (badge + page) |
| Tasks & Reminders | `['tasks']` | `GET /api/tasks` | tasks |
| Recent Transactions | `['transactions','recent']` | `GET /api/transactions?limit=…` | transactions |
| Calendar & Events | `['calendar']` | `GET /api/calendar` | live_sessions, events, deadlines |
| Reports Snapshot | `['reports','snapshot']` | `GET /api/reports/snapshot` | aggregate views |
| System Health / Security Alerts | `['system','health']` / `['security','alerts']` | `GET /api/system/health` / `GET /api/security/alerts` | infra, security_events |

\* Welcome section piggybacks on stats payload — do not create a separate endpoint for it.

### 4b. Dropdowns & selects (R2 — each one is a surface of its source entity)

| Dropdown / select | Appears in | Reads query key |
|---|---|---|
| Role | Add User form · Users table filter · Assign Role dialogs · Role Assignments tab | `['roles']` |
| Department / Branch / Team | Add User form · Users filters · Org chart moves · Group config | `['org','departments']` / `['org','branches']` / `['org','teams']` |
| Group | Add User form · Bulk actions · Student cohorts | `['groups']` |
| Manager | Add User form · Org hierarchy | `['users', {role:'manager'}]` |
| Category | Course create Step 1 · Courses filter | `['categories']` |
| Instructor | Course assignment · Live session scheduling · Filters | `['instructors']` |
| Course | Enroll Student flow · Quiz builder · Learning Path builder · Certificate rules | `['courses']` |
| Competency / Skill | Add User form · Instructor profile | `['competencies']` |
| Tag / Label | User tags · Filters | `['users','tags']` |

**Consequence:** creating/renaming/deleting any of these entities automatically fixes every dropdown, because the dropdown shares the entity's query key. If a dropdown ever looks stale after a mutation, the mutation is missing an invalidation — fix it in §5, not in the dropdown.

> **Instructor dropdown — one owner:** it is served by `GET /api/admin/lm/filter-options` (`{ id, name }`, non-archived INSTRUCTORs), **not** by `GET /api/admin/instructors`. The instructors list is a paginated table with aggregates; using it to fill a `<select>` would page-truncate the options. Both read the same `app_users` rows, so they cannot disagree about who exists — invalidating `['instructors']` must therefore also refresh the LM filter-options consumer.

### 4c. Instructors module surfaces (blueprint 05 — backend built 2026-08-03)

| Surface | Query key | Endpoint | Derived from (source tables) |
|---|---|---|---|
| Instructors table (All / Active / Inactive / Suspended / Top Performers tabs) | `['instructors', filters]` | `GET /api/admin/instructors` | app_users, instructor_profiles, courses, course_enrollments |
| Tab badge counts (incl. Pending) | same response — `tabCounts` | same call | app_users, instructor_applications |
| 6 stats cards | `['instructors', 'stats']` † | `GET /api/admin/instructors/stats` | app_users, instructor_applications, courses |
| Instructor profile page **+ side panel** (badges · pending approvals · activity feed · 12-month enrollment chart) | `['instructors', id]` | `GET /api/admin/instructors/:id` | + live_sessions, certificates, audit_logs |
| Bottom analytics: specialization donut · courses-by-status donut · Top Instructors ranking · earnings (unavailable) | `['instructors','analytics']` † | `GET /api/admin/instructors/analytics` | app_users, instructor_profiles, courses, course_enrollments |
| Applications queue (Pending tab) | `['instructor-applications']` | `GET /api/admin/instructor-applications` | instructor_applications |
| Reviews tab (approve/remove/flag) | `queryKeys.instructors.reviews(id)` | `GET/PATCH /api/admin/instructors/:id/reviews[/:reviewId/approve\|remove\|flag]` | instructor_reviews |
| Documents tab (upload/verify/reject/archive) | `queryKeys.instructors.documents(id)` | `GET/POST/PATCH/DELETE /api/admin/instructors/:id/documents/*` | instructor_documents |
| Earnings tab | `['instructors', id, 'earnings']` | *(no endpoint — no Finance/earnings model exists for instructors)* | — |
| Instructor Profile page (`/instructors/:id/profile`) | `['instructors', id]` + the two rows above | `GET /api/admin/instructors/:id` | reuses Courses/Reviews/Certifications/Documents tab components from the side panel |

† `queryKeys.instructors` has no `stats()` or `analytics()` member yet — add both alongside the frontend work (tasks 106 / 112) rather than inventing inline key arrays.

**"Top instructor" has exactly one definition:** the global top 10 by distinct enrolled students, computed by `getTopInstructorIds()` in `instructors.service`. The `badges.topInstructor` flag, the Top Instructors chart and the `?tab=top` ordering all read it, so a badge can never contradict the list it links to. Changing the metric means changing that one function.

**Rating and revenue have no source table.** `GET /instructors/stats` returns them as `{ value: null, available: false }` and every row's `rating` / `revenue` is `null`. Rule R4 still holds — the field has one owner, that owner just has nothing to read yet. Rendering `0` would invent data.

---

### 4d. Competencies module surfaces (blueprint 07 — backend + frontend built 2026-08-09, see `COMPETENCIES_CONTRACT.md`)

Eight new models (`Skill`, `SkillCategory`, `CompetencyFramework`,
`FrameworkSkill`, `UserSkillProfile`, `SkillAssessment`,
`SkillCourseMapping`, `CompetencySettings` — the last added when Import/Export
and Settings were built out from stubs, see the Addendum in
`COMPETENCIES_CONTRACT.md`), none reused from an existing entity.

| Surface | Query key | Endpoint | Derived from (source tables) |
|---|---|---|---|
| Competency List tab (search/category/level/status filters) | `['competencies', filters]` | `GET /api/admin/competencies/skills` | skills, skill_categories, skill_course_mappings, user_skill_profiles |
| Competency side panel (`?competency=id`) | `['competencies', id]` | `GET /api/admin/competencies/skills/:id` | + course lookups (mapping's courseId has no db FK — reads flag `missing:true`) |
| 6 stats cards | `['competencies','stats']` | `GET /api/admin/competencies/stats` | skills, competency_frameworks, skill_assessments, user_skill_profiles |
| Overview analytics (category donut · gap-severity donut · proficiency-trend line · top-competencies table · competency matrix · recent activity) | `['competencies','analytics']` | `GET /api/admin/competencies/analytics` | + framework_skills, app_users (role, for the matrix) |
| Frameworks tab (list + detail split pane, required-skills editor) | `['competencies','frameworks']` / `['competencies','frameworks', id]` | `GET /api/admin/competencies/frameworks[/:id]` | competency_frameworks, framework_skills |
| Categories tab (2-level tree) | `['competencies','categories']` | `GET /api/admin/competencies/categories` | skill_categories, skills |
| Assessments tab (log + New Assessment) | `['competencies','assessments']` | `GET/POST /api/admin/competencies/assessments` | skill_assessments (write also upserts user_skill_profiles) |
| Skill Gaps tab (framework/department filters) | `['competencies','skill-gaps']` | `GET /api/admin/competencies/skill-gaps` | framework_skills ⋈ user_skill_profiles — see the shared-definition note below |
| User Progress tab (search a user → their full skill catalog, `missing` flags) | `['users', id, 'skills']` | `GET /api/admin/competencies/users/:userId/skills` | skills, user_skill_profiles |
| Proficiency Levels tab | *(no key — static reference)* | *(none — fixed 5-value enum, no config endpoint exists)* | — |
| Import/Export tab (built, post-v1) | *(none — export is a read, not a mutation)* | `GET /api/admin/competencies/skills/export` (JSON, filtered/uncapped) · `POST /api/admin/competencies/skills/import` (multipart CSV) | skills, skill_categories (category-name resolution) |
| Settings tab (built, post-v1) | `['competencies','settings']` | `GET/PATCH /api/admin/competencies/settings` | competency_settings (new model, single row) |

**Skill gaps have exactly one definition.** `computeSkillGaps()` in
`competencies.service.js` is called by the `skillGaps` stats card, the
`skillGapOverview` analytics donut, and `GET /skill-gaps` — none of the three
can ever disagree. It has a documented, non-obvious limitation: this schema
has no user/department↔framework assignment relation, so a gap only fires for
a `(user, skill)` pair where the user *already* has a `UserSkillProfile` row
for a framework-required skill, ranked below the requirement. A user with
zero profile rows for that skill is invisible to gap detection — there is no
data source that says who is *expected* to hold it, and inventing one would
be fabricated data (R3).

**`DELETE /skills/:id` is a guarded hard delete** (409 while any profile,
assessment, framework requirement, or course mapping references it) — the
everyday deactivation action is `PATCH { status: 'ARCHIVED' }` instead, same
two-path shape as Instructors' documents (`archive` = soft, a separate hard
delete exists for genuinely unused rows).

---

### 4e. Reports & Analytics module surfaces (blueprint 08 — shipped 2026-08-09, see `REPORTS_CONTRACT.md`)

Read-only aggregation over EXISTING tables — no new models. Every metric
either reuses its owning module's function (R4) or is fresh aggregation
where no owner exists yet (see the contract's reuse table for the
field-by-field breakdown). `available:false` is used wherever no data model
exists at all (revenue, watch time, session duration, certificate expiry,
per-lesson drop-off, per-question response log, mandatory-training/
compliance-violation tracking) — confirmed by a full schema grep before
building, never assumed.

| Surface | Query key | Endpoint | Derived from (source tables / reused owner) |
|---|---|---|---|
| Overview tab (10 KPI cards + 5 charts) | `['reports','overview']` (KPIs) + reuses the 4 rows below for its charts | `GET /api/admin/reports/overview` | app_users, course_enrollments, certificates, live_sessions, audit_logs + `learners.service`/`instructors.service`/`lm.service`.getStats() |
| Learner Analytics tab | `['reports','learners', filters]` | `GET /api/admin/reports/learners` | app_users, course_enrollments, learner_profiles + `learners.service.AT_RISK_THRESHOLD` |
| Instructor Analytics tab | `['reports','instructors', filters]` | `GET /api/admin/reports/instructors` | app_users, courses, course_enrollments, live_sessions, session_attendance + `instructors.service.getStats()`/`.getTopInstructorIds()` |
| Course Analytics tab | `['reports','courses', filters]` | `GET /api/admin/reports/courses` | courses, course_enrollments |
| Learning Progress tab | reuses `['reports','learners']` + `['reports','courses']` | *(none — composed from the two above, see contract note on this tab's own spec gap)* | — |
| Assessments tab | `['reports','assessments', filters]` | `GET /api/admin/reports/assessments` | quiz_attempts |
| Certificates tab | `['reports','certificates', filters]` | `GET /api/admin/reports/certificates` | certificates |
| Attendance tab | `['reports','attendance', filters]` | `GET /api/admin/reports/attendance` | session_attendance, live_sessions |
| Engagement tab | `['reports','engagement', filters]` | `GET /api/admin/reports/engagement` | app_users |
| Compliance tab | `['reports','compliance', filters]` | `GET /api/admin/reports/compliance` | app_users, learner_profiles (`atRiskUsers` only — the other 4 fields are permanently unavailable, no compliance model exists) |
| Audit Logs tab | `['reports','audit', filters]` | `GET /api/admin/reports/audit` | audit_logs (same table Users/Instructors/Learners suspension-history already reads, generalized here into the first standalone audit-list endpoint) |
| Export Center tab | — (file download, not cached) | `GET /api/admin/reports/export` | whichever table the chosen `type` reads — writes `REPORT_EXPORTED` to audit_logs as a side-effect |
| Custom Reports tab | — | — | Genuine stub — no saved-report-definition model exists |

**`dateRange` is this module's own convention**, distinct from every other
module's fixed month-over-month: a rolling window (week/month/quarter/
custom) where `changePercent` compares the current window to the
immediately preceding window of the SAME length. See contract note 4.

---

## 5. ENTITY IMPACT MATRICES

Format per row: **Mutation** → *extra* keys to invalidate (defaults from §2 are always implied) → surfaces that visibly change.
`(pending backend)` = endpoint agreed in contract with Hassan but not implemented; mock lives in `lmApi.ts`.

### 5.1 USER (User Management doc §1–§17)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `user.create` (Add User §6) | `['users']` `['dashboard','user-analytics']` + `['org',…]` if dept/branch/team set + `['groups']` if group set + `['users','pending-verification']` if created unverified + `['users','invitations']` if invite sent | Users table row · **Total Users KPI** · User Analytics (New Registrations, Roles Distribution, Verification Status) · Manager dropdown (if manager-capable role) · dept/team member counts · Pending Verification tab · Activity "New User Registration" |
| `user.import` (bulk §7) | same as `user.create` + `['reports','snapshot']` | Same as create ×N · Import Report screen |
| `user.invite` / `invite.resend` / `invite.cancel` (§9) | `['users','invitations']` | Invitations tab · invitation badge |
| `user.verify.approve` / `.reject` (§11, §25) | `['users']` `['users','pending-verification']` `['approvals']` `['dashboard','user-analytics']` | Pending Verification tab · **Pending Approvals KPI + widget** · Verification Status chart |
| `user.suspend` / `user.reactivate` (§10) | `['users']` `['users','suspended']` `['users', id]` `['dashboard','user-analytics']` | Users table status badge · Suspended Users tab · User Analytics (Suspended count) · **Active Students / Active Instructors KPI** if the user is one |
| `user.archive` / `user.restore` (§12) | `['users']` `['users','archived']` `['users', id]` | Users table · Archived tab · **Total Users KPI** (if archived excluded from count — confirm with Hassan, then document here) |
| `user.delete` | `['users']` + everything the user touched: `['enrollments',…]` `['role-assignments']` `['org',…]` `['groups']` | Users table · Total Users KPI · rosters · assignment lists |
| `user.update` (profile, dept, manager) (§5) | `['users']` `['users', id]` + `['org',…]` if org fields changed | Profile page · table row · org chart |
| `user.merge` (§16) | `['users']` `['users', idA]` `['users', idB]` `['enrollments',…]` `['certificates']` `['billing']` | Both profiles → one · merged learning history |
| `user.tag.add/remove` (§17) | `['users','tags']` `['users', id]` | Tag filters · profile labels |
| `user.assignRole` → see **5.5 ROLE** | | |
| `user.courseUnenroll` (User Details Drawer, Courses tab — new 2026-08-17) | `['users']` `['users', id]` `['enrollments', id]` `['enrollments', courseId]` `['courses']` `['courses', courseId]` `['dashboard','course-analytics']` | Users table enrollment count · drawer Courses tab · Learning Management course roster. Assign (create) reuses `learner.enroll` as-is, gated in the UI to role=learner — the backend enroll path is LEARNER-only (`learners.service.assertIsLearner`); no new mutation ID for it. |
| `user.note.add` / (delete has no separate id — same drawer-local refresh) (More tab, Notes tile — new 2026-08-17) | local only: drawer refetch, no other surface reads `UserNote` | Notes tile list |
| `user.revokeSessions` (More tab, Devices & Sessions tile — new 2026-08-17) | local only: drawer refetch | Devices & Sessions tile. Per-session (`DELETE /users/:id/sessions/:sessionId`), distinct from Force Logout (`user.forceLogout`, revokes ALL sessions at once). |

### 5.2 STUDENT / ENROLLMENT (Students doc §1–§15)

> **DEAD SECTION as of 2026-08-09 — do not build against this.** The
> `/students` page this table describes was never shipped (blueprint
> `06-students.md` still `[planned]`, no Route exists) — confirmed zero
> frontend consumers of the `student.*` mutation IDs or `queryKeys.students.*`
> below before the Learners module was built. **The real, shipped module is
> `LEARNERS_CONTRACT.md` / §5.18 below** — same underlying `CourseEnrollment`
> table, entirely separate (real) mutation IDs (`learner.enroll` not
> `enrollment.create`, `queryKeys.learners.*` not `queryKeys.students.*`).
> This table is kept for history, not reused or renamed in place.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `enrollment.create` (Enroll Student §3 — `POST /api/admin/enrollments`, contract `ENROLLMENTS_CONTRACT.md`; enforces `course.enrollmentLimit`, 400 "course is full") | `['enrollments']` `['enrollments',studentId]` `['enrollments',courseId]` `['students', id]` `['courses', courseId]` `['courses']` (enrolledCount) `['dashboard','course-analytics']` `['dashboard','student-engagement']` | Enrollments tab · student profile Courses tab · course enrolled-count · **Active Students KPI** · Course Analytics (popular courses) · Engagement widget · LM enrollment KPIs + trend chart |
| `enrollment.cancel` / `student.dropout` (`DELETE /api/admin/enrollments/:id` — unenroll does NOT revoke an issued certificate) | same as create + drop-off metrics | Same surfaces, opposite direction · Drop-Off Rates |
| `enrollment.statusUpdate` (`PATCH /api/admin/enrollments/:id` — status ONLY; progress is learner-derived and rejected with 400; COMPLETED stamps `completedAt`, leaving COMPLETED clears it) | same as `enrollment.create` | Enrollments tab status chips · LM completions KPI + status distribution chart |
| `progress.update` (lesson complete §4) | `['students', id, 'progress']` `['dashboard','student-engagement']` | Progress bars · Engagement (Learning Progress, Learning Time) |
| `course.complete` (per student) | `['students', id, 'progress']` `['enrollments',…]` `['dashboard','course-analytics']` `['dashboard','student-engagement']` + triggers `certificate.issue` if rule matches (→ 5.8) | Completion Rates · status "Completed" · possibly Certificates chain |
| `quiz.submit` / `assignment.submit` (§6) | `['quizzes',courseId]` `['assignments',courseId]` `['students', id]` `['dashboard','course-analytics']` `['dashboard','student-engagement']` | Assessment Center · Quiz Performance · Quiz Participation · Activity "Student Completed Quiz / Assignment Submitted" |
| `attendance.record` (§8) | `['attendance',sessionId]` `['students', id]` `['dashboard','live-overview']` | Attendance metrics · session attendance · Live Overview |
| `student.suspend` (§15) | as `user.suspend` + `['students']` | + Students table |

### 5.3 INSTRUCTOR (Instructors doc §1–§16)

Backend v1 built 2026-08-03 — contract `INSTRUCTORS_CONTRACT.md`. An instructor
IS an `AppUser` with `role = INSTRUCTOR` (+ an optional `InstructorProfile` side
table), so every mutation below that touches status/verification also moves the
Users surfaces — `['users']` is not optional on those rows.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `instructorApplication.submit` (§3 — public `POST /api/public/instructor-applications`) | `['instructor-applications']` `['approvals']` `['tasks']` | Applications list · Tasks "Approve Instructors" · **Pending Approvals KPI is NOT yet wired to this queue — open decision, see contract §Known gaps** |
| `instructorApplication.approve` (§4) | `['instructor-applications']` `['instructors']` `['approvals']` `['users']` `['dashboard','user-analytics']` | **Active Instructors KPI** · Instructors table · Approvals drop · Instructor dropdown gains option (R2) |
| `instructorApplication.reject` (§4) | `['instructor-applications']` `['approvals']` | Applications · Approvals |
| `instructorApplication.requestChanges` (§4) | `['instructor-applications']` `['approvals']` | Application returns to the applicant; resubmission reopens the SAME row as PENDING |
| `instructor.create` (§2 — `POST /api/admin/instructors`) | `['instructors']` `['users']` `['dashboard','user-analytics']` | Instructors table · Users table (same AppUser row) · Instructor dropdown gains option (R2) |
| `instructor.update` (§5) | `['instructors']` `['instructors', id]` | Instructors table row · profile page |
| `instructor.verify` (§5) | `['instructors']` `['instructors', id]` `['users']` | Verification badge here AND in the Users table (one AppUser field) |
| `instructor.suspend` (§14 — delegates to users.service) | `['instructors']` `['instructors', id]` `['users']` `['courses']` `['dashboard','instructor-performance']` | Instructors table · Users table status chip · **Active Instructors KPI** · **CORRECTED 2026-08-27** (was documented here as "courses do NOT unpublish in v1 — open decision"; that was stale — `instructors.service.js:suspendInstructor` calls `unpublishInstructorCourses()` on every suspend and always has, confirmed by direct code read while building Instructor Dashboard Phase 1 auth. Every PUBLISHED course the instructor owns is force-unpublished to Draft in the same transaction. See INSTRUCTOR_DASHBOARD_BLUEPRINT.docx Appendix A #18 and Section 3.1 for the instructor-facing consequence — the Instructor Dashboard's My Courses page must surface WHY a course silently reverted to Draft.) |
| `instructor.reactivate` (§14) | `['instructors']` `['instructors', id]` `['users']` `['dashboard','user-analytics']` | Same surfaces, opposite direction |
| `instructor.delete` (§2 — soft archive, 409 while they own courses/sessions) | `['instructors']` `['users']` `['courses']` `['dashboard','user-analytics']` | Row leaves the Instructors table · Users table shows ARCHIVED · Instructor dropdown loses option |
| `review.moderate` (§10 — one mutation ID covers approve/remove/flag; three distinct endpoints, `PATCH .../reviews/:reviewId/approve` \| `/remove` \| `/flag`) | `['instructors', id, 'reviews']` `['dashboard','instructor-performance']` | Reviews tab list — status badge flips. **Shipped 2026-08-07, NOT in INSTRUCTORS_CONTRACT.md v1** (documented there as a `[planned]` gap — "no Review model", "decision for Hassan, not a bug"). The instructor ROW's `rating` field (list/stats/analytics) is still always null — it is an AppUser aggregate, unrelated to this row-level moderation queue. |
| `payout.execute` (§9) → see 5.7 FINANCE | | Finance module shipped 2026-08-09 (`InstructorPayout` model, `FINANCE_CONTRACT.md`) — payouts are calculated from real `revenueShareBps` × successful `Payment` sums, still 0 everywhere until a real payment gateway exists |
| `instructorDoc.upload` (§12 — sign → direct PUT to storage → confirm; API never receives the file) | `['instructors', id, 'documents']` `['instructors', id]` | Documents tab list · panel doc count |
| `instructorDoc.verify` (§12) | `['instructors', id, 'documents']` `['approvals']` | Documents tab row → VERIFIED |
| `instructorDoc.reject` (§12 — reason required ≥3 chars) | `['instructors', id, 'documents']` `['approvals']` | Documents tab row → REJECTED |
| `instructorDoc.archive` (§12 — soft delete, file stays for compliance) | `['instructors', id, 'documents']` | Row disappears from the list (hidden by default, not deleted) |
| `instructorCert.upload` (§11 — sign → direct PUT to storage → create; API never receives the file; file itself is optional) | `['instructors', id, 'certifications']` `['instructors', id]` | Certifications tab list. **Shipped 2026-08-07, NOT in INSTRUCTORS_CONTRACT.md v1** (documented there as a deliberately unshipped, SEPARATE entity from Documents §12 — "folding them into Documents would have made both half-features"). |
| `instructorCert.verify` (§11) | `['instructors', id, 'certifications']` `['approvals']` | Certifications tab row → VERIFIED |
| `instructorCert.reject` (§11) | `['instructors', id, 'certifications']` `['approvals']` | Certifications tab row → REJECTED |
| `instructorCert.delete` (§11 — HARD delete, unlike instructorDoc.archive — this model has no ARCHIVED status) | `['instructors', id, 'certifications']` | Row disappears from the list permanently |

### 5.4 COURSE / LEARNING (LMS doc §1–§18)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `course.createDraft` (§3) | `['courses']` `['dashboard','course-analytics']` | Courses table · Draft Courses count |
| `course.settings.update` (§3 Step 4 — `PATCH /courses/:id/settings`) | `['courses', id]` | Wizard Step 4 form · course detail settings (pricing/visibility/SEO) |
| `course.submitForApproval` (§3 Step 6 — stamps `Course.submittedAt`, the only truthful "waiting since" source; `updatedAt` is overwritten by later edits) | `['courses']` `['courses', id]` `['approvals']` `['tasks']` `['dashboard','course-analytics']` + `['instructors', instructorId]` (their `pendingApprovals` block) | Pending Approval Courses · **Pending Approvals KPI + widget** · Tasks "Review Pending Courses" · instructor side panel queue |
| `course.approve` + publish (§4–5) | `['courses']` `['courses', id]` `['approvals']` `['categories']` `['dashboard','course-analytics']` `['instructors', instructorId]` `['instructors','stats']` + `['learning-paths']` if course belongs to a path | **Published Courses KPI** · Approvals drop · Course dropdown gains option (R2) · category counts · Activity "New Course Published" |
| `course.reject` / `requestChanges` (§5) | `['courses', id]` `['approvals']` `['notifications']` + `['instructors', instructorId]` | Review status · instructor notified · drops out of their side-panel queue |
| `course.archive` | `['courses']` `['dashboard','course-analytics']` + `['learning-paths']` if in path + `['instructors', instructorId]` `['instructors']` when fired from the Instructor Courses tab | Published Courses KPI down · Course dropdown loses option · instructor's coursesCount updates without a stale panel |
| `course.unpublish` (§6 — `POST /courses/:id/unpublish`, Published→Draft; not a rejection, not an un-approval — `reviewedAt`/`rejectionReason` untouched) | `['courses']` `['courses', id]` `['dashboard','course-analytics']` + `['instructors', instructorId]` `['instructors']` | Course drops off the catalogue, back to Draft tab · instructor's publishedCoursesCount updates |
| `course.restore` | `['courses']` `['dashboard','course-analytics']` `['learning-paths']` | Archived course reappears in Draft tab · KPI updates · learning-path item badge changes from Archived → Draft |
| `category.create/rename/delete` (§6) | `['categories']` `['courses']` | Category dropdown everywhere (R2) · course filters |
| `learningPath.create` / `.update` / `.delete` (§7 — `/api/admin/learning-paths`, contract `LEARNING_PATHS_CONTRACT.md`) | `['learning-paths']` `['dashboard','course-analytics']` | Paths list · path detail · path progress metrics (dashboard side stays stub until v2 progress tracking) |
| `learningPath.item.add` / `.remove` / `.reorder` (§7 — reorder is ONE bulk call, replace state from response like Course Builder; items are `COURSE`/`LIVE_SESSION`/`QUIZ` as of 2026-08-17) | `['learning-paths']` | Path detail item list · `itemCount` on the paths list |
| `quiz.create` / `.update` / `.delete` (§8 — `/api/admin/quizzes`, contract `QUIZZES_CONTRACT.md`) | `['quizzes']` + `['quizzes', courseId]` `['courses', courseId]` when attached | Assessments tab quiz list · course detail (attached quizzes) |
| `quiz.question.add` / `.update` / `.delete` / `.reorder` (§8 — reorder is ONE bulk call, replace state from response; question writes change server-derived `questionCount`/`totalPoints`/`autoGradable` — next real GET, never computed client-side, R1/R4; all 6 question types incl. `FILL_IN_BLANK`/`MATCHING` as of 2026-08-17) | `['quizzes']` | Quiz builder question list · derived counts on the quiz list |
| `liveSession.create` / `.update` / `.delete` (§12 — `/api/admin/live-sessions`, contract `LIVE_SESSIONS_CONTRACT.md`; create/update talk to the REAL Zoom API; status is schedule-derived server-side, never written by the client) | `['live-sessions']` `['calendar']` `['dashboard','live-overview']` + `['learning-paths']` (session items show title/status; delete leaves `missing: true` items) | Live Sessions tab · LM Overview live-sessions widget · Calendar & Events · learning-path item badges |
| `content.confirm` (upload) / `content.update` / `content.delete` (§11, §16 — `/api/admin/content`, contract `CONTENT_LIBRARY_CONTRACT.md`; sign → direct PUT → confirm, same flow as course uploads) | `['content-library']` + `['courses', id]` when the item is course-scoped | Library grid · LM Content stats tiles (same `course_contents` table — B2) · Activity "Instructor Uploaded Content" |
| `section.create` | `['courses', courseId, 'sections']` `['content-library']` | Section list in Course Builder · content item count |
| `section.update` | `['courses', courseId, 'sections']` | Section title in builder |
| `section.delete` | `['courses', courseId, 'sections']` `['content-library']` | Section + cascaded lessons removed from builder · content count |
| `lesson.create` | `['courses', courseId, 'sections']` `['content-library']` | Lesson list in section · content item count |
| `lesson.update` | `['courses', courseId, 'sections']` | Lesson row in builder |
| `lesson.delete` | `['courses', courseId, 'sections']` `['content-library']` | Lesson removed from section · content count |
| `sections.reorder` | `['courses', courseId, 'sections']` | Section + lesson order in builder — ONE bulk PATCH per reorder |

### 5.5 ROLE / PERMISSION (Roles doc §1–§42)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `role.create` (§3) | `['roles']` | Roles table · **every Role dropdown** (R2) |
| `role.edit` permissions (§5, §13) | `['roles']` `['roles', id]` `['permission-matrix']` `['role-assignments']` | Matrix · Role details · ⚠️ effective permissions of every user holding the role — backend must bump permission version so active sessions re-check (contract item, Hassan) |
| `role.duplicate` (§6) | `['roles']` | Roles table + dropdowns |
| `role.delete` (§7) | `['roles']` `['role-assignments']` `['users']` | Dropdowns lose option · affected users fall back per deletion logic (doc §7 — reassignment required before delete) |
| `role.assignToUser` (§25) / `template.apply` (§23) | `['role-assignments', userId]` `['users', id]` `['users']` `['dashboard','user-analytics']` | User Role Assignments tab · profile · Roles Distribution chart |
| `policy.create/update` (§16–20) | `['policies']` | Policies list · access decisions |

### 5.6 ORGANIZATION / GROUPS (User Mgmt doc §18, §20)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `department/branch/team.create/rename/delete` | `['org', kind]` `['org','chart']` `['users']` | Org chart · **all org dropdowns** (R2) · Add User form options · user profiles referencing it |
| `orgChart.moveUser` (drag & drop §18) | `['org','chart']` `['users', id]` `['org','teams']` | Chart · profile · rosters |
| `group.create/update/delete` (§20) | `['groups']` `['users']` if membership changed | Group dropdowns · member lists · cohorts |

### 5.7 FINANCE (Dashboard §5, §15 · Instructors §9 · Students §13)

Real backend shipped 2026-08-09 (blueprint 09, `FINANCE_CONTRACT.md`) —
`Payment`/`Subscription`/`Invoice`/`Transaction`/`Refund`/`InstructorPayout`/
`Coupon`/`TaxRule`/`FinanceSettings` all exist now. `transaction.purchase`
stays dead (no checkout flow triggers a Payment write yet — no gateway); the
rows below marked shipped are real. `payout.approve/.complete/.calculate` and
`subscription.create/.update/.extend` are NEW mutation IDs this module added
(not in the pre-existing scaffold) — see `FINANCE_CONTRACT.md` decision #7.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `transaction.purchase` (course/subscription, dead — no checkout flow exists) | `['transactions','recent']` `['dashboard','revenue']` `['billing',studentId]` + `['enrollments',…]` via chained enrollment (5.2) | **Total Revenue KPI** · **Active Subscriptions KPI** · Revenue charts · Recent Transactions · Payment Alerts notification |
| `refund.request` (shipped — `PATCH /finance/payments/:id/refund`, creates a PENDING Refund; Payment status untouched until approved) | `['approvals']` `['tasks']` | **Pending Approvals KPI** · Tasks "Review Refund Requests" · Refunds tab gains a PENDING row |
| `refund.approve` (shipped — `PATCH /finance/refunds/:id/approve`, terminal PROCESSED in one step, no gateway wait) | `['approvals']` `['transactions','recent']` `['dashboard','revenue']` `['billing',studentId]` + possibly `['enrollments',…]` revoke | Refund Statistics · Revenue down · Payment row flips to REFUNDED |
| `refund.reject` (shipped — reason written to audit log only, `Refund` has no rejectionReason column) | `['approvals']` | Refund queue |
| `payout.execute` (instructor, dead alias — Payouts tab uses `.approve`/`.complete` below instead) | `['instructors', id, 'earnings']` `['dashboard','revenue']` `['transactions','recent']` | Instructor Payouts metric · earnings tab |
| `payout.calculate` (shipped, new — `POST /finance/payouts/calculate`, idempotent per period, skips zero-gross instructors) | `['payouts']` `['dashboard','revenue']` | Payouts tab gains new PENDING rows (0 today — Payment table is empty) |
| `payout.approve` (shipped, new) | `['payouts']` `['instructors', id, 'earnings']` | Payouts tab row → APPROVED |
| `payout.complete` (shipped, new — writes a `Transaction(type=PAYOUT)`) | `['payouts']` `['dashboard','revenue']` `['transactions','recent']` `['instructors', id, 'earnings']` | Payouts tab row → COMPLETED · Transactions ledger |
| `subscription.cancel` (shipped) | `['dashboard','revenue']` `['billing',studentId]` `['subscriptions']` | **Active Subscriptions KPI** · Subscription Growth chart |
| `subscription.create` (shipped, new — no separate Plan model, writes Subscription directly) | `['subscriptions']` `['dashboard','revenue']` `['finance','dashboard']` | Subscriptions tab gains row · **Active Subscriptions KPI** |
| `subscription.update` (shipped, new — also covers "Upgrade", no separate endpoint) | `['subscriptions']` `['billing',studentId]` | Subscriptions tab row |
| `subscription.extend` (shipped, new) | `['subscriptions']` `['billing',studentId]` | Subscriptions tab row's renewal date |

### 5.8 CERTIFICATE (LMS doc §9 · Students doc §7)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `certificate.issue` (§9 — `POST /api/admin/certificates`, contract `CERTIFICATES_CONTRACT.md`; requires `Course.certificateEnabled`) | `['certificates']` `['students', id, 'certificates']` `['dashboard','course-analytics']` | **Certificates Issued KPI** (counts non-revoked only) · student profile · Activity "Certificate Issued" |
| *(server-side only, no frontend mutation)* Auto-issue triggers (`certificateTriggers.service.js`, 2026-08-17) call `issueCertificate()` from enrollment completion, quiz passing grade, and learning-path completion — same DB write as `certificate.issue` above. No new frontend invalidation needed: whichever real mutation fired (`enrollment.statusUpdate` / `learner.assessmentGrade`) already invalidates its own rows; the new certificate shows up next time `['certificates']` is fetched. | — | Certificates list gains a row on next fetch |
| Logo upload/remove (`CertificateLogoUpload.tsx` → `.../logo/confirm` \| `DELETE .../logo`, 2026-08-17) reuses `certificateTemplate.update`'s invalidation — same write (template layout), same reflections. | `['certificate-templates']` `['certificates']` | Template logo preview · issue dialog template picker |
| `certificate.revoke` / `.reissue` (`POST /:id/revoke` · `/:id/reissue` — reissue mints a NEW verification code + issuedAt, clears revokedAt; old QR/PDF stop verifying immediately) | same | Same, reversed · verify page flips valid/revoked · reissue can move a revoked cert back into the KPI count |
| `certificateTemplate.create` (`/api/admin/certificate-templates`) | `['certificate-templates']` | Templates list · template picker in issue dialog |
| `certificateTemplate.update` | `['certificate-templates']` `['certificates']` (templateName is read live off the relation, not snapshotted — a rename changes what issued certs display) | Templates list · issued-certificates table's Template column |
| `certificateTemplate.delete` | `['certificate-templates']` `['certificates']` (templateId is SetNull on any cert using it — falls back to default layout, cert row survives) | Templates list · issued-certificates table's Template column (→ "Default") |

### 5.9 APPROVALS (meta-entity — Dashboard §9)

Any mutation that CREATES a pending item (`course.submitForApproval`, `instructorApplication.submit`, `user.verify` request, `refund.request`, certification requests, content moderation flags) MUST invalidate `['approvals']` + `['tasks']`. Any DECISION on a pending item MUST invalidate `['approvals']` + `['tasks']` + **the underlying entity's row** from its own matrix. The Pending Approvals KPI, the widget, and Tasks & Reminders all read from the same `['approvals']` / `['tasks']` sources — never maintain separate counts.

### 5.10 CROSS-CUTTING SINKS (write-only from mutations)

Activity Feed, Notifications, Tasks, Audit Log, Calendar are **sinks**: mutations write to them (mostly backend-side), surfaces read them. Frontend responsibility = invalidate their keys (§2 covers activity/notifications automatically; add `['tasks']`/`['calendar']` when the matrix says so). Frontend NEVER fabricates sink entries locally.

### 5.11 COMPETENCY / SKILL (blueprint 07 — shipped 2026-08-09, see `COMPETENCIES_CONTRACT.md`)

Real backend now exists for the rows below marked shipped — the rest
(`skillLevel.configure`, `competencyMap.*`, `competencyCert.*`) remain the
pre-existing dead/planned rows this map already carried (no config-levels
endpoint, no course/path skill-mapping UI, no certification-tracking entity
in the v1 task spec) — kept, not deleted, same as `ticket.create`/`.assign`
staying documented-but-dead in §5.14.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `skill.create` / `.update` / `.delete` (shipped) | `['competencies']` `['competencies','stats']` `['competencies','analytics']` `['competencies', id]` (all three callers always pass the skill id) | Competency List table · stats cards · Overview charts · side panel |
| `skill.assignToCourse` / `.removeCourse` (shipped, new) | `['competencies']` `['competencies', id]` `['courses', courseId]` | Side panel's linked-courses list · List tab's Linked Courses column |
| `skillCategory.create` / `.update` / `.archive` (shipped) | `['competencies','categories']` `['competencies']` `['competencies','analytics']` + `['competencies','stats']` on create only | Categories tree · category filters |
| `skillCategory.delete` (shipped, new — hard delete, separate from `.archive`) | `['competencies','categories']` `['competencies']` `['competencies','stats']` | Categories tree |
| `framework.create` / `.update` / `.delete` (shipped) | `['competencies','frameworks']` `['competencies','stats']` `['competencies','frameworks', id]` (all three callers always pass the framework id) + `['competencies','analytics']` on create/delete only (a rename/status edit doesn't change gap/matrix data — `computeSkillGaps` doesn't filter by framework status) | Frameworks tab list + detail · Overview's frameworks table · stats cards |
| `framework.addSkill` / `.removeSkill` (shipped, new) | `['competencies','frameworks']` `['competencies','frameworks', frameworkId]` `['competencies','stats']` `['competencies','analytics']` `['competencies','skill-gaps']` | Framework detail's required-skills table · Skill Gaps tab (a framework's requirements are the gap definition's input) |
| `skillLevel.configure` (dead — no endpoint) | `['competencies','levels']` | Level ladders — Proficiency Levels tab is a static reference instead |
| `assessment.create` (shipped, new — auto-upserts `UserSkillProfile` server-side unless Settings' auto-update toggle is off, in which case `profile` in the response is `null`) | `['competencies','assessments']` `['users', id, 'skills']` `['competencies','stats']` `['competencies','analytics']` `['competencies','skill-gaps']` | Assessments log · User Progress tab · stats cards · Skill Gaps tab |
| `skill.import` (shipped, post-v1 — CSV bulk create via Import/Export tab) | `['competencies']` `['competencies','stats']` `['competencies','analytics']` | Competency List table · stats cards · Overview charts (no single id — many skills created at once) |
| `competencySettings.update` (shipped, post-v1 — one `CompetencySettings` row) | `['competencies','settings']` `['competencies','analytics']` `['competencies','skill-gaps']` `['competencies','stats']` | Settings form · Skill Gap Overview donut + Skill Gaps tab (severity thresholds) · future `assessment.create` calls (passing threshold / auto-update toggle — not retroactive) |
| `competencyMap.link/unlink` (dead — no endpoint) | `['competencies']` + target entity key (`['courses', id]` / `['learning-paths']` / `['quizzes',…]`) | Mapping views · skill chips on courses/paths |
| `competencyCert.assign/verify/revoke` (dead — no endpoint) | `['users', id, 'skills']` `['competencies']` | Certification tracking · profiles |

### 5.12 NOTIFICATION CAMPAIGNS (blueprint 10) — shipped 2026-08-10, see `NOTIFICATIONS_CONTRACT.md`

Real backend now exists: `NotificationTemplate`, `Announcement`,
`NotificationAutomation`, `NotificationLog` (doubles as the in-app feed,
`channel=IN_APP` — see contract decision #2), `UserNotificationPreference`
(notifications.prisma). Mounted at `/api/admin/notifications`. Note the
mutation IDs below predate this build (frontend team pre-scaffolded
`invalidation.ts` rows against the blueprint's conceptual names) — kept as-is
rather than renamed, since renaming a working row is churn without benefit.
`template.*` in the blueprint prose maps to the actually-implemented
`notificationTemplate.*` IDs (disambiguated from other modules' generic
"template" mutations, same reasoning as `notificationRule.*` vs a bare
`rule.*`). Automation trigger EXECUTION is not wired to real events yet
(contract decision #5) — CRUD/pause/resume are fully live.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `emailCampaign.create` / `pushCampaign.send` / `smsCampaign.send` (dead — no separate campaign entity per-channel; a real `Announcement` covers this shape, see contract) / `announcement.send` (shipped) | `['campaigns']` `['notifications','stats']` (recipients' `['notifications']` IN_APP rows created server-side) | Campaign lists · notification dashboard widgets · targeted users' feeds |
| `announcement.delete` (shipped, new — no row existed) | `['campaigns']` | Announcements tab list |
| `campaign.schedule/pause/cancel/duplicate` (shipped: `schedule`≈create-with-scheduledAt, `cancel`≈`PATCH .../cancel`; `pause`/`duplicate` dead — no partial-send-pause or campaign-duplicate endpoint) | `['campaigns']` `['calendar']` | Scheduled tab · delivery calendar |
| `notificationTemplate.create/update/duplicate` (shipped) | `['notification-templates']` | Templates tab · **template pickers** (R2 — Automations' template select) |
| `notificationTemplate.delete` (shipped, new — no row existed) | `['notification-templates']` | Templates tab list |
| `notificationRule.create/update/delete/toggle` (shipped — `NotificationAutomation` CRUD + pause/resume, `toggle` covers both) | `['notifications','rules']` | Automation tab · active-rules widget · Dashboard's Active Automations list |
| `notification.markRead/.archive/.pin` (`.archive`/`.pin` dead — no archived/pinned state on `NotificationLog`, only read via `status`) | `['notifications']` only (skip §2 stats default — pure feed state) | Feed everywhere: dashboard widget + in-app tab |
| `notification.send` (shipped, new — admin manually sends to specific `userIds`, distinct from broad-audience campaigns) | `['notifications']` `['notifications','stats']` | In-App tab list · sentTotal/pending stat cards |
| `notification.delete` (shipped, new — same feed-state-only reasoning as markRead/archive/pin) | `['notifications']` only | In-App tab list |
| `notificationPrefs.update` (shipped, new — per-user; a future admin-global `notificationPrefs.updateGlobal` per blueprint 10 §10 remains dead, no endpoint) | `['notifications','settings']` | Preferences tab |
| `emergencyAlert.send` (shipped) | `['campaigns']` `['security','alerts']` | Emergency tab · Security Alerts widget (Dashboard §15) |
| `delivery.retry` (shipped) | `['notifications','stats']` | Delivery logs · failed count |

### 5.13 FINANCE CONFIG (blueprint 09 — runtime money flows stay in §5.7)

Real backend shipped 2026-08-09 alongside §5.7 (see note there). `plan.*` and
`gateway.*` stay dead — no `Plan` model, no gateway integration in v1
(`FINANCE_CONTRACT.md` decisions #1 and Payment Gateways section).
`tax.configure` now covers all three `TaxRule` CRUD writes (create/update/
delete collapse to one mutation ID, decision #5).

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `plan.create/update` (dead — no Plan model, see decision #1) | `['plans']` `['subscriptions']` | Plans table · **plan dropdowns** (R2) · checkout options |
| `invoice.generate` (shipped — subtotal/total are SERVER-computed from `items`, never client-trusted) / `invoice.void` (shipped) | `['invoices']` `['billing', studentId]` | Invoices table · student Billing tab |
| `invoice.update/send` (shipped) | `['invoices']` | Invoice row/status · customer notified |
| `coupon.create/update/disable` (shipped) | `['coupons']` | Coupons table · checkout coupon validation |
| `coupon.delete` (shipped, new — hard delete, separate from `.disable`) | `['coupons']` | Coupons table |
| `tax.configure` (shipped — covers TaxRule create/update/delete, all three write endpoints) | `['tax','config']` `['invoices']` | Tax Management tab · future invoice/checkout totals |
| `billingSettings.update` (shipped — `FinanceSettings` singleton, new model not in the original Prisma list, decision #6) | `['finance','settings']` — ⚠️ if currency changed: broad refetch of ALL money displays | Billing Settings tab · every money surface in the app |
| `gateway.connect/configure/testMode` (dead — Payment Gateways tab is static UI only in v1, buttons disabled) | `['gateways']` `['integrations']` | Gateways tab · integrations dashboard · checkout methods |
| `commission.update` (dead — no commission-rules endpoint; `revenueShareBps` is edited on `InstructorProfile`, not here) | `['payouts']` `['instructors', id, 'earnings']` `['dashboard','revenue']` | Payout calculations · earnings tabs |
| `payment.retry` (dead — no gateway to retry against) | `['transactions','recent']` `['finance','dashboard']` | Payments table · finance KPIs |
| `payment.approve` (dead, alias of §5.7 `transaction.purchase`) | as §5.7 `transaction.purchase` | — |

### 5.14 SUPPORT TICKETS (blueprint 06 §10)

> `ticket.respond`/`.resolve`/`.escalate` were dead (no `SupportTicket` model
> existed) until the Learners module (§5.18) shipped `SupportTicket` +
> `TicketMessage` for real 2026-08-09 and became their first real consumer —
> REUSED as-is, not forked (the keys were already correct/generic). `ticket.
> create`/`.assign` remain dead — no create-ticket endpoint exists anywhere
> (no learner-facing app to raise one from); `.assign` has no admin-side
> owner-reassignment endpoint either. Don't build against those two yet.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `ticket.create` (student side) | `['support-tickets']` `['tasks']` | Support tab · Tasks widget |
| `ticket.assign/respond/resolve/escalate` | `['support-tickets']` | Ticket status · student notified via §2 defaults |

### 5.15 INTEGRATIONS (blueprint 11) — shipped 2026-08-10, see INTEGRATIONS_CONTRACT.md

> Registry over the real Zoom/Supabase/SMTP providers (Live Sessions and
> Content/Uploads still own the actual meeting/storage calls; this module
> never re-implements them — INTEGRATIONS_CONTRACT.md #1) plus a
> `COMING_SOON` catalog, API keys, webhooks, logs, and data syncs. All five
> mutation rows below shipped exactly as originally specced here — no
> renames. `['integrations','logs']` (new, `queryKeys.integrationsLogs()`)
> was added as an extra key on connect/disconnect/testMode/sync.run since
> each of those writes a real `IntegrationLog` row.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `integration.connect/disconnect` | `['integrations']` `['integrations','stats']` `['integrations','logs']` — no live provider dropdowns exist yet to cascade into (Live Sessions' provider list and Finance's gateway list are still static in v1) | Integration cards · dashboard widgets |
| `integration.configure/testMode` | `['integrations']` (+`['integrations','logs']` for testMode) | Config panels · Video/Storage/Email tab cards |
| `apiKey.generate/revoke` | `['api-keys']` | API Keys tab |
| `webhook.create/update/delete/toggle` | `['webhooks']` | Webhooks tab |
| `sync.run` (on completion) | `['integrations','sync']` `['integrations','logs']` + synced entity keys (HR sync → `['users']`) | Data Sync tab · synced tables |

### 5.16 SYSTEM SETTINGS (blueprint 12)

Backend built 2026-08-10 — contract `SYSTEM_SETTINGS_CONTRACT.md`. The single
`SystemSettings` row backs 17 of the 20 tabs (Authentication/Mobile App/API &
Developer are pure read-only + link-out, nothing to PATCH); Config Logs reads
`SystemConfigLog`, a new per-field diff table this module owns.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `settings.update` (ctx.domain = tab key, e.g. `'general'`) | `['settings', domain]` + `['dashboard','stats']` etc. (§2 defaults) | The settings form that saved + Config Logs (new row per changed field) |
| `featureToggle.set` | `['settings','features']` | Feature Toggles tab. **Gap:** flags are persisted but nothing reads them yet — sidebar/routes/widgets do NOT gate on `liveSessionsEnabled` etc. Wiring that consumption (AdminLayout nav filter, route guards) is unbuilt; flag before treating a toggle as functionally live. |
| `maintenance.enable/disable` | `['settings','maintenance']` | Red banner on the System Settings page (all tabs) · `/api/public/*` starts/stops returning 503 (`maintenanceMode.middleware.js`) · `/api/admin/*` is never gated, admins always keep access |
| `backup.run/restore` | `['system','backups']` | Backup & Restore tab · `lastBackupAt` timestamp |
| `settings.restoreVersion` — **not used**; restore reuses `backup.restore` since there's one full-row snapshot, not per-domain versions | — | — |
| `retention.update` — **dead**, no retention UI was built in this module (Security tab's IP/password/session policy is a different set of fields) | — | — |

### 5.17 SECURITY ACTIONS (blueprint 13)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `securityAlert.resolve` | `['security','alerts']` `['security','threats']` `['security','stats']` | Security Alerts widget (Dashboard §15) + module tabs |
| `incident.create/update/close` | `['security','incidents']` `['tasks']` | Incidents tab · Tasks widget |
| `device.block/approve` | `['security','devices']` `['security','sessions']` | Devices tab · affected user sessions |
| `ip.block/unblock` | `['security','ip']` | IP tab · policy enforcement (03 §19) |

### 5.18 LEARNER (blueprint 06 — shipped 2026-08-09, see `LEARNERS_CONTRACT.md`)

A learner IS an `AppUser` with `role = LEARNER` — same architecture as §5.3
INSTRUCTOR (one optional `LearnerProfile` side table, never a parallel
learners table). Reuses the EXISTING `CourseEnrollment`/`Certificate` tables
(§5.2/§5.8) rather than forking them — `enrollment.create`/`certificate.*`
keep meaning what they already meant; Learners' own mutation IDs below are
additive, targeting `queryKeys.learners.*`, not a replacement for §5.2/§5.8.

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `learner.create` | `['learners']` `['learners', id]` `['users']` `['dashboard','user-analytics']` | Learners table · Users table (same AppUser row) |
| `learner.update` | `['learners']` `['learners', id]` | Learners table row · side panel |
| `learner.suspend` / `.reactivate` (delegates to users.service, same as instructor.suspend) | `['learners']` `['learners', id]` `['users']` `['dashboard','user-analytics']` | Status badge · Users table · suspension history entry |
| `learner.delete` (soft archive, 409 while active enrollments exist) | `['learners']` `['users']` `['dashboard','user-analytics']` | Row leaves the table · Users table shows ARCHIVED |
| `learner.resetPassword` (no Instructors equivalent) | `['users']` | Sessions revoked — no visible table change beyond a toast |
| `learner.enroll` / `.unenroll` (thin wrapper over `enrollments.service` — §5.2's `enrollment.create`/`.cancel` NOT reused, they target dead `queryKeys.students.*`) | `['learners']` `['learners', id]` `['enrollments', id\|courseId]` `['courses']` `['dashboard','course-analytics']` | Courses tab in side panel · coursesCount stat · course enrolledCount |
| `learner.bulkEnroll` (thin wrapper over `enrollments.service`, one call/many learners — partial success per learner, same shape as the learning-path expansion) | `['learners']` `['enrollments', courseId]` `['courses']` `['dashboard','course-analytics']` `['learners', id]` per affected learner | Learners table · each enrolled learner's Courses tab |
| `learner.progressReset` | `['learners', id]` `['dashboard','course-analytics']` | Progress bar resets to 0% in Courses tab |
| `learner.assessmentReopen` / `.assessmentReset` / `.assessmentGrade` (`QuizAttempt`, brand new — no prior consumer to collide with) | `['learners', id]` (+ `['dashboard','course-analytics']` on grade) | Assessments tab row status/score |
| `learnerDoc.upload` / `.verify` / `.reject` / `.archive` (mirrors `instructorDoc.*`, own model `LearnerDocument`) | `['learners', id, 'documents']` (+ `['learners', id]` on upload, `['approvals']` on verify/reject) | Documents tab (More) list |
| `certificate.reissue` / `.revoke` (REUSED from §5.8, not forked — `revokeCertificate` gained an optional `reason` param, additive) | `['certificates']` `['dashboard','course-analytics']` | Certificates tab in side panel |
| `ticket.respond` / `.resolve` / `.escalate` (REUSED from §5.14 — see that section's note) | `['support-tickets']` | Tickets tab (More) status |

### 5.19 REPORTS & ANALYTICS (blueprint 08 — shipped 2026-08-09, see `REPORTS_CONTRACT.md`)

Almost entirely read-only aggregation (`GET /export` writes a
`REPORT_EXPORTED` audit-log row as a side-effect but changes no displayed
number, so it carries no mutation ID). **Scheduled Reports** (shipped
2026-08-09, `ScheduledReport` — the module's first owned table) is the one
real CRUD surface, living in the Export Center tab:

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `reportSchedule.create` / `.update` / `.delete` / `.pause` / `.resume` | `['report-schedules']` | Export Center tab's "Scheduled Reports" list — New Schedule / Edit / Pause / Resume / Delete, Active/Paused/Cancelled badges, Last Run/Next Run |
| `reportTemplate.save` (dead — no Custom Report Builder exists) | `['report-templates']` | Custom Reports tab's future saved-templates list |

An hourly background sweep (`setInterval` in `server.js`, no node-cron in
this codebase) sends due reports itself — that's a system-authored
`SCHEDULED_REPORT_RUN` audit row, not a frontend mutation, so it carries no
mutation ID either.

Every tab that reads live data (all except Export Center and Custom
Reports) self-fetches on mount. As of the 2026-09-02 granular-events pass
(see §6), most tabs listen for the specific domain event matching their own
data (`LearnerAnalyticsTab`/`LearningProgressTab` → `learnersUpdated` (+
`coursesUpdated` for the latter), `InstructorAnalyticsTab` →
`instructorsUpdated`, `CourseAnalyticsTab`/`AssessmentReportsTab` →
`coursesUpdated`, `CertificateReportsTab` → `certificatesUpdated`,
`AttendanceReportsTab` → `attendanceUpdated`, `ComplianceReportsTab` →
`userDataChanged` + `learnersUpdated`, `ScheduledReportsSection` →
`reportsUpdated`) instead of the old catch-all. Three tabs deliberately keep
listening to the broad `analyticsUpdated` event because they genuinely
aggregate across nearly every module and narrowing them would mean going
stale rather than going faster: `ReportsOverviewTab` (users/learners/
instructors/courses/certificates/live-sessions/audit), `AuditLogsTab`
(records admin actions across every module), `EngagementAnalyticsTab`
(logins + course progress + attendance).

---

## 6. FRONTEND ENFORCEMENT (how the map becomes code)

- `src/lib/queryKeys.ts` — key factory; the ONLY place key arrays exist.
- `src/lib/invalidation.ts` — `INVALIDATION_MAP: Record<MutationName, () => QueryKey[]>` that mirrors §5 1:1, plus `invalidateFor(queryClient, mutationName, ctx)` which applies the row + §2 defaults.
- Every `useMutation.onSuccess` calls `invalidateFor(...)`. Ad-hoc `queryClient.invalidateQueries` calls outside `invalidation.ts` are forbidden (lint/review check).
- Adding a mutation = one row here (§5) + one entry in `INVALIDATION_MAP`. They must match; drift between file and map is a review blocker.

**Bridge events (2026-09-02 update — perf pass Priority 2).** `invalidation.ts`'s `dispatchBridgeEvents` used to receive `allKeys` (the mutation's own keys PLUS the §2 defaults — `activity`/`notifications`/`dashboard.stats`, added to nearly every mutation), which meant an else-bucket domain — and therefore the `analyticsUpdated` catch-all — fired on literally every mutation regardless of what it actually was: 44 components listened to that one event, so one button click fanned out into 5-12 unrelated refetches. Fixed two ways:
1. `invalidateFor` now passes `dispatchBridgeEvents` the mutation's own `extraKeys` only, never the defaults-merged `allKeys` — a domain only counts as "touched" if the mutation's OWN `INVALIDATION_MAP` row actually names it.
2. `DOMAIN_EVENTS` (replacing the old 4-branch if/else) now maps every major domain to its own event: `financeUpdated`, `competenciesUpdated`, `instructorsUpdated`, `integrationsUpdated`, `learnersUpdated`, `notificationsUpdated`, `reportsUpdated`, `coursesUpdated`, `certificatesUpdated`, `attendanceUpdated`, `settingsUpdated` — alongside the pre-existing `organizationUpdated`/`groupsUpdated`/`rolesUpdated`/`userDataChanged`. A domain with no dedicated event still falls through to `analyticsUpdated` (dashboard/activity/approvals/tasks/security/live-sessions — no narrow consumer needed one yet).

All 41 of the 44 listening components were repointed to the narrow event matching their own data; 3 (`ReportsOverviewTab`, `AuditLogsTab`, `EngagementAnalyticsTab`, all in §5.11b above) deliberately kept the broad catch-all since they're genuinely cross-cutting. Adding a new domain: add a row to `DOMAIN_EVENTS`, then point the consuming component(s) at the new event name instead of `analyticsUpdated` — don't add a component to the catch-all unless it genuinely needs to react to almost anything.

## 7. PLAYWRIGHT REFLECTION TESTS (extends stats-consistency suite)

Template — one per mutation that touches a dashboard number:
1. Read KPI/widget value on Dashboard Overview.
2. Perform mutation through the UI (e.g., Add User happy path).
3. Navigate back to Dashboard (no manual reload).
4. Assert value reflects the mutation (old ± delta) **without hard refresh**.
5. Use `waitForResponse` on the invalidated endpoints before asserting (established pattern from bulk-action fixes).

Minimum coverage set: `user.create` → Total Users · `course.approve` → Published Courses + Pending Approvals · `instructorApplication.approve` → Active Instructors · `enrollment.create` → Active Students · `certificate.issue` → Certificates Issued · `liveSession.create`/`.delete` → Live Sessions Running (v1 has no manual start/end mutation — status is schedule-derived and self-corrects on every read, so "Live Sessions Running" moves with real time, not just with a create/cancel event) · `refund.request` → Pending Approvals.

## 8. BACKEND CONTRACT PRINCIPLES (Hassan)

- **B1:** Every §4a endpoint computes aggregates live from source tables (Prisma `count`/`aggregate`). No stored counters (R3).
- **B2:** One field, one owner: each displayed number is produced by exactly ONE endpoint field (R4). Dashboard stats endpoint is the owner of all 9 KPIs.
- **B3:** Every mutation endpoint writes `activity_log` + `audit_log` in the same transaction (single AuditAction enum source — see past enum bug).
- **B4:** Pending items live in queryable states, not copies: "pending approvals count" = COUNT over the union of pending states, same source as the approvals list.
- **B5:** Permission changes bump a permissions version so active sessions re-evaluate (5.5 `role.edit`).
- **B6:** Mock parity: `lmApi.ts` mock responses must match contract shapes field-by-field, so swapping mock→real changes zero frontend code.

## 9. MAINTENANCE PROTOCOL

- New widget/page/dropdown → add to §4 with key + endpoint.
- New mutation → add row in §5 + entry in `INVALIDATION_MAP` (same PR).
- New KPI → add to §4a, confirm endpoint field owner with Hassan, add reflection test (§7).
- Renamed/removed anything → update here first, then code.
- Monthly (or when things feel off): run the full Playwright reflection suite (`npx playwright test --workers=1`) and diff §5 against `INVALIDATION_MAP` keys.

*Generated 2026-07-03 from the FULL Admin System documentation, all 13 modules: Login, Dashboard Overview, User Management, Roles & Permissions, Learning Management, Instructors, Students, Competencies, Reports & Analytics, Finance, Notifications, Integrations, System Settings, Audit & Security. Companion blueprint: `docs/blueprint/`.*

*Last updated: 2026-08-09 — Competencies module (§4d, §5.11) shipped: 7 new models, full Skills/Frameworks/Categories/Assessments/Skill-Gaps/User-Progress backend + frontend. See `COMPETENCIES_CONTRACT.md`.*

*Same-day follow-up: Import/Export and Settings tabs (previously stubs) built out — 8th model `CompetencySettings`, `skill.import`/`competencySettings.update` mutation IDs, `['competencies','settings']` query key. See the Addendum in `COMPETENCIES_CONTRACT.md`.*

*Same-day follow-up #2: Reports & Analytics module (§4e, §5.19) shipped —
9 core endpoints + Export Center + Compliance, all read-only aggregation
over existing tables (zero new models). 13 frontend tabs at
`/reports-analytics` (sidebar link was dead, now wired). Two real bugs
caught by live-testing against the real dev DB (not just `tsc`/review) and
fixed before ship: an instructor completion-rate formula that measured the
wrong population, and an audit-search branch that threw on Prisma's strict
`AuditAction` enum and got silently swallowed into false empty results. See
`REPORTS_CONTRACT.md`.*

*2026-08-17 — Dashboard & Reports deferred-items pass (see `DEFERRED_ITEMS.md`
for the full list this closes). No new Prisma models; all reads over
existing tables, zero schema change.*

- **Dashboard admin-widgets** (`GET /api/admin/dashboard/admin-widgets`,
  `dashboard.service.getDashboardAdminWidgets`): `tasksAndReminders`,
  `recentTransactions`, `reportsSnapshot` were hardcoded empty — now real.
  Tasks = pending user verifications/refunds/instructor-applications/course-
  approvals, each read from its owning module's queue (§4a's B4 discipline —
  no separate copy). Transactions = merged `Payment`/`Refund`/
  `InstructorPayout`, most recent 8. Reports snapshot links into the real
  `/reports-analytics` tabs; `lastGeneratedAt` reads `ScheduledReport.lastRunAt`.
  `TaskItem`'s shape changed (`count`/`link` replace a fake `status`/`dueAt`
  no completion-tracking model backs) — any future dashboard consumer of
  `queryKeys.dashboard` widgets should read the new shape.
- **Reports proxies unblocked** (`reports.service.js`): `Overview.engagementScore`
  (active/total learner ratio), `Engagement.avgSessionDuration` (from
  `SessionAttendance.durationMin`), `Compliance.complianceViolations`
  (`USER_SUSPENDED` audit-log count) all flipped from permanently-unavailable
  to real proxies — labeled as proxies, not exact metrics. `Certificate`
  still has no `expiresAt` field, so `expired`/`expiredCertifications` stay
  correctly unavailable (not stale — confirmed against schema, not assumed).
- **Stale gap found + fixed**: `instructors.service.getStats().avgRating` was
  still `unavailable("No Review/Rating model exists yet")` even though
  `InstructorReview` shipped 2026-08-07 — now a real average over `APPROVED`
  reviews. This cascades into Reports' Instructor Analytics tab (same field,
  reused verbatim, R4) with zero changes needed there. `totalRevenue` on the
  same endpoint stays unavailable but with a corrected reason (blocked on a
  real payment gateway, not "Finance module doesn't exist" — Finance shipped).
- **Learning Progress tab** (`/reports-analytics?tab=progress`) extended
  `reports.service.getLearnerAnalytics()` (not a new endpoint — same
  `enrollmentWhere`/`userWhere` every other field on it already shares) with
  `learningSpeedDays`, `slowLearners`, `highPerformers`, `completedEnrollments`.
  `inactiveUsers`/`topPerformers` were already being fetched by this tab and
  silently discarded — now rendered.
- **Audit & Security** (`/trusted-devices`, nav-labeled "Audit & Security"):
  gained a real "Audit Logs" tab. Deliberately reuses `AuditLogsTab` +
  `GET /reports/audit` AS-IS rather than forking a parallel `/audit-logs`
  endpoint with an identical query (R4) — `reports.service.getAuditReports`
  stays the one owner of that query.
- **Login → device verification** (`LoginPage.tsx` → `/verify-device`): new
  `GET /api/admin/devices/check` (`admin.service.checkDeviceTrust`). Root
  cause was deeper than the missing redirect — `POST /otp/verify`'s
  `trustDevice` flag was validated-away and never reached the service, so no
  `TrustedDevice` row was ever written even when the checkbox was checked.
  Fixed the write path first (`adminAuth.validator` → `admin.controller` →
  `admin.service.verifyAdminOtp`), then added the check + redirect. Device
  identity = sha256(ipAddress::userAgent) — no client-side device-id exists
  anywhere in this codebase to key off instead. Known remaining gap
  (unchanged, not closed by this pass): the login token issued at password-
  auth time is a normal `AdminSession` regardless of device-check outcome —
  this is a client-side UX gate, not server-enforced. See the header comment
  in `VerifyDevicePage.tsx`.

*2026-08-17 — Notifications & Automations deferred-items pass (see
`DEFERRED_ITEMS.md` for the full list this closes). One additive schema
change: `AuditAction` gained `SUBSCRIPTION_EXPIRED` (system-authored, written
by the new subscription-expiry sweep) — `npx prisma generate` run, `db push`
still needed against the target DB.*

- **Automation triggers wired for real** (`automationTriggers.service.js`,
  new file — `fireAutomationTrigger(triggerType, userId, metadata)`,
  best-effort, called from 6 source services). §5.12's own note that
  `NotificationAutomation` was "CRUD-only, not wired to real events" is now
  true for `USER_REGISTRATION`, `COURSE_ENROLLMENT`, `COURSE_COMPLETION`,
  `QUIZ_FAILURE`, `LIVE_SESSION_START`, `SUBSCRIPTION_EXPIRY` (new hourly
  sweep in `finance.service.js` — nothing ever flipped a `Subscription` to
  `EXPIRED` before this). `PAYMENT_SUCCESS` and `ASSIGNMENT_DEADLINE` stay
  unwired — confirmed no real event exists for either (no checkout flow, no
  Assignment model), not a missed wiring. `SECURITY_EVENT` fires from
  `users.service.suspendUser`, not the task's literal
  admin-login-failure ask — that event has no `AppUser` recipient
  (`NotificationLog`/automations are `AppUser`-scoped; `AdminUser` logins are
  a different table entirely), so it would have silently no-op'd forever.
- **Email delivery: retry + quiet hours** (`notifications.service.js`):
  `retryPendingDeliveries()` (5-min sweep, `server.js`) drains PENDING EMAIL
  rows for both the pre-existing `EMAIL_BLAST_CAP` overflow reason and a new
  `QUIET_HOURS` reason — same PENDING lane, one retry mechanism for both.
  Quiet hours enforced against UTC only (no timezone field exists on
  `UserNotificationPreference` — documented gap, not assumed away), EMAIL
  channel only (IN_APP stays immediate — passive inbox row, not a push),
  exempt for URGENT/EMERGENCY/SECURITY_EVENT.
- **Feature toggles now gate real things** (`settings.service.js`
  `getCachedFeatureFlags()`, 60s cache): `liveSessions.service.createSession`
  and `certificates.service.issueCertificate` (the one entry point every
  auto-issue trigger already funnels through) 403 when their toggle is off.
  New `GET /api/admin/system-settings/features`. Frontend `FeatureFlagsContext`
  mounted in `ProtectedRoute.tsx` (a true ancestor of every page component,
  and never fires unauthenticated) gates `LmTabs.tsx`'s Live Sessions/
  Certificates tabs — corrected from the task's literal "hide the AdminLayout
  nav item" ask, since neither is a top-level nav item, both are Learning
  Management tabs. `FeatureTogglesTab.tsx` was calling `invalidateFor(...)` on
  save and nothing else — that call was always a no-op (confirmed: no
  `useQuery` consumer exists anywhere in this codebase, so the whole
  `appQueryClient` layer §6 describes has never actually been wired to a
  screen) — added the real `analyticsUpdated` event dispatch every other
  settings-driven panel in this app already relies on.
- **Bell "Mark all read"** (`AdminLayout.tsx`) had no `onClick` at all — now
  calls the real `PATCH /notifications/read-all` and zeroes the topbar badge
  (which already read a real count from an earlier pass). The panel's item
  list stays the pre-existing `recentActivities` feed by design (§0's own
  decision #1) — a different, intentionally-kept feature, not touched.

*2026-08-18 — Integrations/Roles & Permissions/Reports/UI-UX deferred-items
pass (see `DEFERRED_ITEMS.md` for the full list this closes — Parts 5-8 of
one combined session, continuing straight on from the Finance/Competencies/
Instructors/Notifications pass above). Several additive schema changes —
`npx prisma generate` run after each; **`npx prisma db push` still needed
against the target DB** for all of them (new models `CompanyRole`,
`DelegatedAdmin`, `FeatureWaitlist`; new fields on `SystemSettings`
(`zoomDefaultDuration`, `zoomRecordingEnabled`, `roleInheritanceEnabled`,
`maxRolesPerUser`) and `Certificate` (`expiresAt`); several new `AuditAction`
enum values). See the chat transcript's final summary for the complete list.*

- **Integrations**: `triggerSync()` no longer fakes a `COMPLETED` `DataSync`
  after a `setTimeout` — none of `REAL_PROVIDERS` (zoom/supabase/smtp-email)
  is an actual sync destination for users/courses/departments records, so it
  now records an honest `FAILED` row with the real reason instead. Zoom's
  meeting-duration/recording-default moved from `ZoomCard`'s local state to
  real `SystemSettings` fields via the existing generic `PATCH
  /system-settings`. Decorative MS Teams/Google Meet cards now name the real
  blocker (API credentials) instead of a generic description.
- **Roles & Permissions §4/§5.5**: the four placeholder tabs are real now.
  `CompanyRole` (console-operator roles — distinct from the LMS-side `Role`
  model in §5.5, which is assigned to `AppUser` via `UserRoleAssignment`) +
  full CRUD at `/company-roles`. `DelegatedAdmin` (time-boxed console access
  grants) + CRUD/revoke at `/delegated-admins` — audit trail only, no
  auth-middleware enforcement wired to it yet (flagged as a separate,
  security-sensitive follow-up, not silently assumed). Audit & Tracking
  reuses `GET /reports/audit` (R4) via a new `actions` (CSV) filter param —
  no parallel log. Settings tab adds two `SystemSettings` fields, same
  generic PATCH path every other settings tab uses.
- **Reports**: `Certificate.expiresAt` added — `status` now derives
  `'expired'` alongside `'active'`/`'revoked'`; new `PATCH
  /certificates/:id/expiry`; public verify (`GET /verify/:code`) returns
  `status:'expired'` instead of falsely saying valid; Certificate Reports
  tab's `expired`/`expiringSoon` flipped from `unavailable(...)` to real
  counts. Live Sessions attendance (`SessionAttendance`) finally has a real
  writer — `PATCH /live-sessions/:id/attendance` (bulk upsert, roster from
  course enrollment) — which also completes certificate Trigger 4
  (attendance threshold), the one trigger left unwired from the earlier
  Notifications pass. `users.service.getUsersAnalytics()` gained `userGrowth`
  (12 zero-filled weekly signup buckets) for the Users Analytics page's
  real "coming soon" chart slot — its "Users by Department" chart turned out
  to already be real, live data (a bar chart, not a donut) — that half of
  the original deferred-item claim was stale, not a gap.
- **UI/UX**: Users' role chip now navigates to `/roles-permissions?tab=roles
  &role=<name>`, which pre-fills the roles table's search on mount — a real
  filtered landing, not just the tab. Real per-admin TOTP MFA (`otplib` +
  `qrcode`, no 3rd party) — `POST /auth/mfa/setup|verify|disable` plus a
  login-time challenge (`POST /auth/mfa/login-verify`, in-memory single-use
  pending-token map keyed off a random token, never the raw adminId) wired
  into `loginAdmin()`'s existing flow via a new shared `issueSession()` tail.
  Setup/disable UI lives in `ProfilePage.tsx`'s Two-Factor Authentication row
  (not `SecurityTab.tsx`'s toggle, which is a distinct, still-unbuilt
  org-wide *enforcement* policy — copy corrected to point at the real
  per-admin control instead of reading as an oversight). New generic
  `FeatureWaitlist` model (feature key + adminId, reusable for the next
  not-built-yet feature) backs Custom Reports' "Notify me" button — the
  report-builder itself is still the real, unchanged stub.
- **Stale docs corrected in the same pass** (not just code): `IMPACT_MAP.md`
  §4c (this file, above — Reviews/Documents already had real endpoints,
  Earnings correctly still doesn't); `LIVE_SESSIONS_CONTRACT.md`'s "no
  attendance" scope note; `COURSE_WIZARD_AND_CATEGORIES_CONTRACT.md`'s "no
  quiz system yet" reasoning (quizzes shipped — the real, narrower fact is
  `getPreview()` was never extended to include quiz data) and its stale
  "no push-notification system" reject-workflow note.

*2026-08-18 (same-day follow-up) — Content reuse / Competency Certifications /
Custom Reports builder (see `DEFERRED_ITEMS.md` for the full list this
closes). Four new models — `npx prisma generate` run; **`npx prisma db push`
still needed** against the target DB: `CourseContentUsage`, `CompetencyCertification`,
`SavedReport`, plus `AppUser` gained a `competencyCertifications` back-relation
and `AuditAction` gained 11 new values (`CONTENT_LINKED_TO_COURSE`/
`_UNLINKED_FROM_COURSE`, `COMPETENCY_CERTIFICATION_ASSIGNED`/`_VERIFIED`/
`_REVOKED`/`_DELETED`, `SAVED_REPORT_CREATED`/`_UPDATED`/`_DELETED`/`_RUN`).*

- **Content Library reuse across courses** (`CourseContentUsage`, additive
  alongside `CourseContent.courseId` — the item's own originating course,
  unchanged): `GET/POST/DELETE /content/:id/courses[/:courseId]`. Shows a
  real "Used in X courses" count + link/unlink dialog in `ContentLibraryTab.tsx`;
  Course Builder's video-lesson form gained a "From Library" input mode
  (alongside Paste URL / Upload File) that sets the lesson URL from an
  existing item and records the usage. New `content.linkCourse`/
  `.unlinkCourse` mutation IDs.
- **Competency Certifications** (`CompetencyCertification` — own service
  file, `competencyCertifications.service.js`, competencies.controller/
  routes stay shared per that module's own convention): `userId` is a real
  `AppUser` relation; `skillId`/`frameworkId` stay plain cross-domain refs
  (same contract as `SkillCourseMapping.courseId`); `issuedById`/`revokedById`
  are the ADMIN actor, plain string — the task spec asked for "FK → AppUser"
  on these two, which doesn't match this codebase's auth model (no AppUser
  ever authenticates against `/api/admin/*`), corrected the same way
  ProfilePage's principal was corrected earlier in this engagement. `EXPIRED`
  is never a stored status — a `VERIFIED` cert past `expiresAt` reads as
  `EXPIRED` only at read time (`effectiveStatus`, same lazy-derive pattern as
  `DelegatedAdmin.effectiveStatus`). New Certifications tab + a Certifications
  section in `CompetencySidePanel.tsx`. `competencyCert.assign/.verify/.revoke`
  (already reserved in `invalidation.ts`, per COMPETENCIES_CONTRACT.md) are
  wired for real; added `.delete`.
- **Custom Reports builder** (`SavedReport` — own service file,
  `savedReports.service.js`; reports.controller/routes stay shared):
  the query ENGINE is reused, not forked — running/exporting a saved report
  calls `reports.service.getExportData(dataSource, dateRange)`, the exact
  function `GET /reports/export` (Export Center) already uses (R4). Real
  column set per data source is therefore whatever that function already
  returns, not an invented spec. `schedule` is stored but NOT run
  automatically (no cron scheduler wired — an honest gap, distinct from
  `ScheduledReport.frequency`'s real sweep). Frontend: 4-step wizard (Data
  Source → Columns & Filters → Visualization → Save & Run) replaces the
  "Coming Soon" placeholder; results render as a table or a best-effort
  chart/KPI view (columns are generic per source — first column = label,
  first numeric column = value). `reportTemplate.save` (already reserved)
  wired for real; added `.update`/`.delete`/`.run`.
- **Known gap, not closed by this pass:** no Playwright coverage was added
  for any of the three features above — `frontend/CLAUDE.md §3` calls this
  CRITICAL and it was skipped for scope/time reasons this pass, not silently
  forgotten. Flag before considering this fully done.

*2026-08-27 — Instructor Dashboard Phase 1: instructor authentication
shipped (see `INSTRUCTOR_DASHBOARD_BLUEPRINT.docx` Section 0 for the full
spec this closes — "no instructor login exists anywhere" was the single
largest gap identified there). Zero schema changes — `AppUserSession`
already existed and was unused by any writer; wired up for real for the
first time. Zero new `AuditAction` enum values — reused the existing
generic `SESSION_CREATED`/`SESSION_REVOKED`/`FAILED_LOGIN` values with
`adminId:null, targetUserId:<instructor id>` (both `AuditLog` and
`LoginAttempt` were already actor-agnostic). This pass touches ONLY the new
`/api/instructor/*` surface — zero admin-side query keys, mutations, or
`INVALIDATION_MAP` rows changed, so §3–§6 of this file are unaffected.*

- **New backend**: `POST/GET /api/instructor/auth/{login,me,logout}` —
  `instructorAuth.{service,controller,routes}.js`. Mirrors
  `admin.service.js`'s `loginAdmin()` shape (lockout window, generic
  non-leaking error messages, LoginAttempt/AuditLog trail) with one
  deliberate improvement: `AppUserSession.tokenHash` is stored as a SHA-256
  hash of the bearer token, not the raw token — `AdminSession.sessionToken`
  stores it raw; the instructor table's own column name signalled the
  intended (stronger) design, followed rather than the weaker precedent.
- **New middleware**: `requireInstructorAuth`
  (`instructorAuth.middleware.js`), mirrors `requireAdminAuth` (60s
  in-memory session cache, same revoked/expired checks) plus two instructor-
  specific checks: `AppUser.role === 'INSTRUCTOR'` and — critically —
  `AppUser.status === 'ACTIVE'` re-checked on every request. This is the
  entire mechanism behind "admin suspends an instructor → they're logged
  out" (Section 3.1 of the blueprint) — no separate session-revocation step
  was needed, just this live status check. Verified end-to-end with real
  curl calls against a throwaway instructor: suspend a still-logged-in
  instructor's session → their existing (non-revoked, non-expired) token
  gets `403 Access denied` on the next request once the 60s cache entry
  naturally expires (same staleness ceiling `requireAdminAuth` already
  accepts for admins — not instantaneous, bounded by the cache TTL).
- **New reusable guards, not yet wired into any route** (Phase 3+ work):
  `ownershipGuard.js` (`assertOwnsCourse/LiveSession/Document/Certification`
  — 403 if the caller isn't the owning row's `instructorId`, 404 if the row
  doesn't exist; every admin write endpoint these will eventually guard has
  ZERO ownership check today, confirmed by code read) and `selfScope.js`
  (`forceOwnInstructorId` — overwrites a request body's `instructorId` to
  the caller's own id, for the future instructor-facing `POST /courses` /
  `POST /live-sessions` equivalents, which today accept an arbitrary
  client-supplied `instructorId`). Both verified against real/throwaway data
  via `scripts/verify-ownership-guard.js` and `scripts/verify-self-scope.js`
  (5/5 and 5/5 passing) — no test framework exists on the backend, so these
  follow the project's existing `scripts/` convention (real dev DB,
  throwaway rows, cleanup) rather than introducing Jest for one file.
- **New frontend**: `/instructor/login` (real login form) and
  `/instructor/dashboard` (stub — "Coming Soon", proves the full flow) —
  `InstructorAuthContext.tsx`, `InstructorProtectedRoute.tsx`,
  `api/instructorAuth.ts`. Separate `mn_instructor_token` localStorage key
  from the admin's `mn_admin_token`, so an admin and an instructor session
  coexist in the same browser without collision. `InstructorAuthProvider`
  is deliberately NOT global in `main.tsx` like the admin `AuthProvider` —
  scoped to just the `/instructor/*` subtree via a layout `Route` in
  `App.tsx`, so no existing admin page pays the cost of an extra `GET
  /api/instructor/auth/me` call on every load.
- **Corrected a stale row in this file** (§5.3, `instructor.suspend`, above)
  while building this — the row claimed courses "do NOT unpublish in v1",
  contradicted by the actual `instructors.service.js` code, which has
  called `unpublishInstructorCourses()` on every suspend for some time.
  Fixed in place with a dated correction note rather than silently editing
  the history.
- **`DEFERRED_ITEMS.md` referenced throughout this file does not exist in
  this repository** — confirmed by a full-repo glob before writing this
  entry, not assumed. Every "see DEFERRED_ITEMS.md" pointer elsewhere in
  this file predates this pass and was left as-is (not this pass's gap to
  close), but flagging it here since the task that produced this entry
  explicitly asked for a DEFERRED_ITEMS.md update and none could be made.
- **Known gap, not closed by this pass**: `ownershipGuard.js`/`selfScope.js`
  are built and verified in isolation but not yet wired into any real route
  — every existing admin course/live-session/document/certification write
  endpoint remains exactly as open as it was before this pass. Phase 3 (see
  blueprint Section 2.3/2.4) is what actually closes that exposure.

*2026-08-29 — Instructor Dashboard build complete, Phases 2–6 (Phase 1 above
was auth). Documentation gap found while writing this entry: Phases 2 and 3
(My Profile, My Courses/Course Builder/My Live Sessions) were built in prior
sessions but never got their own IMPACT_MAP rows — confirmed by grepping this
file for "Phase 2"/"Phase 3" before writing this paragraph, not assumed. What
follows summarizes them from what's verifiable in the current codebase
(existence + shape), and documents Phases 4–6 first-hand in full — those were
built and verified live in this pass. Full spec: INSTRUCTOR_DASHBOARD_BLUEPRINT.docx.*

- **Phase 2 (My Profile, verified present, not re-documented in depth)**:
  `instructorProfile.{service,controller,routes}.js` at `/api/instructor/profile`
  — self-scoped profile read/update, Documents tab (`instructorDocuments.service.js`,
  sign→PUT→confirm), Certifications tab (`instructorCertifications.service.js`,
  same upload pattern). All confirmed self-scoped via `req.instructor.id`, no
  `:id` param trusted from the client.
- **Phase 3 (My Courses, verified present, not re-documented in depth)**:
  `instructorCourses.service.js` + `instructorQuizzes.service.js` at
  `/api/instructor/courses` — full course builder (sections/lessons/quizzes/
  questions/reorder) reusing the admin `courseBuilder.service.js`/
  `quizzes.service.js` write paths with `ownershipGuard.js`'s
  `assertOwnsCourse/Section/Lesson/Quiz` guards wired in (the Phase 1 entry
  above notes these guards were built but NOT yet wired — confirmed now
  wired). `instructorLiveSessions.service.js` at `/api/instructor/live-sessions`
  similarly guarded via `assertOwnsLiveSession`. `instructorSelf.service.js`
  backs the Dashboard KPIs/enrollment-trend/activity feed, reusing
  `instructorsService.getInstructor()` wholesale per R4 rather than
  reimplementing its aggregates.
- **Phase 4 (My Students + Learning Paths visibility — Appendix A #6/#7)**:
  new `instructorStudents.service.js` — "my students" computed by
  `getOwnedCourses(instructorId)` (new helper added to `ownershipGuard.js`,
  reused by every phase after this one) → `CourseEnrollment WHERE courseId
  IN (ownIds)`. Detail/assessments/attendance are separately-scoped reads
  (own courses/quizzes/sessions only), never the student's full
  cross-instructor history — this is the exact leak blueprint 2.5 warned
  reusing the learner-scoped admin endpoints as-is would cause. **Real bug
  found + fixed during this pass**: the list query had no `role: LEARNER`
  filter while the detail endpoint did, so a non-learner `AppUser` with a
  stray `CourseEnrollment` row (test/seed data) appeared in the list but
  404'd on click — fixed by aligning both queries' definition of "a student."
  New `instructorLearningPaths.service.js` (Appendix A gap not numbered —
  built per explicit task spec, not in the blueprint) reuses
  `learningPaths.service.resolveItems()` verbatim; visibility = path
  contains ≥1 owned course, detail shows the full sequence with `isMine`
  flagged per item (other instructors' items expose title/status only, the
  same minimal shape admin's own view already returns).
- **Phase 5 (Reviews/Competencies/Earnings/Reports — Appendix A #10/#11, part
  of #8)**: `instructorReviews.service.js` gained `listMyReviews`/
  `getMyReviewStats` (reused `listReviews` in place, added the "REMOVED
  always hidden" rule the admin console legitimately doesn't need). New
  `instructorCompetencies.service.js` closes gap #10 (reverse skill→course
  lookup never existed in either direction before this). New
  `instructorEarnings.service.js` closes the read half of gap #8 (summary +
  payout history, self-scoped `InstructorPayout.instructorId` — the
  per-payout breakdown recompute sub-gap is still open, see below). New
  `instructorReports.service.js` closes gap #11, reusing the same
  completion-rate/attendance-rate formulas `reports.service.getInstructorAnalytics`
  and `instructorSelf.service.js` already established, scoped to one
  instructor instead of a global top-N array. **Real bug found + fixed**:
  `LearningPathDetailModal` and (separately, in a later bug-report pass)
  `QuestionEditor` were both rendered as children of a `.mn-db-card` div —
  that card's entrance animation (`animation: mn-slide-up ... both`) leaves a
  permanent non-`none` `transform`, which makes it a CSS containing block for
  any `position: fixed` descendant, trapping both modals inside the card's
  small box instead of the viewport. Fixed by rendering both as siblings
  instead — the same pattern `LessonModal`/`StudentPanel` already used
  correctly elsewhere in this phase's own pages.
- **Phase 6 FINAL (Messages & Notifications + Account Settings — Appendix A
  #5/#14/#15)**: `messages.service.js` gained `markMyMessageRead` (closes gap
  #14 — `MessageStatus.READ` existed on the model, nothing ever wrote it,
  admin console included). `notifications.service.js` gained
  `markMyNotificationRead` (ownership-checked wrapper — the admin-console
  `markNotificationRead` has none, correct for a trusted operator, not for
  instructor self-service). `instructorAuth.service.js` gained
  `changeInstructorPassword` (closes gap #5, mirrors `admin.service.js`'s
  `changeAdminPassword` exactly: bcrypt-verify current, hash+store new,
  revoke every `AppUserSession` for the account including the one making the
  call, clear the session cache). New `instructorSessions.service.js` closes
  gap #15 (list/revoke own sessions; revoking the CURRENT session is blocked
  server-side — "use Sign Out instead" — a different rule from the password-
  change revoke-all, which intentionally includes the current session).
  **Schema change**: `AuditAction` gained `INSTRUCTOR_PASSWORD_CHANGED` (no
  existing value fit — mirrors `ADMIN_PASSWORD_CHANGED`'s own dedicated-value
  precedent). `npx prisma db push` still needed against the target DB for
  this audit row to persist; the password-change feature itself works
  regardless (see next point). **Real bug found + fixed**: that schema edit,
  before being pushed, exposed a real pre-existing defect —
  `instructorAuth.service.js`'s `createAuditLog` had no try/catch, unlike
  every other service's audit helper in this codebase, so the not-yet-valid
  enum value crashed the whole password-change request with a 500 even
  though the password/session mutations had already committed. Fixed the
  actual inconsistency (added the same best-effort try/catch every other
  audit helper already has) rather than avoiding the new enum value.
  MFA and Avatar (gaps #16/#17) are deliberate "Coming Soon" placeholders —
  no backend exists for either, for any actor, confirmed by code read; not
  built here per explicit scope decision, not a missed gap.
- **All 12 sidebar pages now real** (`InstructorLayout.tsx` NAV_ITEMS,
  `App.tsx` routes) — including `/instructor/certifications`, which was
  *not* explicitly scoped to any phase's task text but was found still
  showing "Coming Soon" during Phase 6's final wiring pass despite its
  underlying feature (teaching-credential upload/list) already existing as a
  tab inside `/instructor/profile` since Phase 2. Exposed as its own page
  (`InstructorCertificationsPage.tsx`) reusing that exact tab component
  rather than forking it, so the sidebar link finally matches reality.
- **Appendix A status after this pass** (18-item gap list): #1–7, #9–11,
  #14–15 resolved. #8 partially resolved (summary + list shipped; per-payout
  breakdown recompute still open — no per-course/per-payment line-item is
  persisted anywhere for `InstructorPayout`, same gap the blueprint
  documented). #12 (Content Library owner-scoping) and #13 (instructor-facing
  quiz-grading endpoint) remain fully open — no phase touched either. #16
  (MFA) and #17 (Avatar) are deliberate scope-out decisions, not bugs. #18
  (the two documented UI/copy discrepancies — `Instructor.rating` hard-null
  vs live `avgRating`; the admin Suspend dialog's stale "courses stay
  published" copy) are both ADMIN-side display issues, not instructor-
  dashboard endpoints — neither was in scope for any of Phases 1–6 and both
  remain open.
- **Admin-side reply loop (2026-08-31)**: the loop admin→instructor was
  one-way in the UI even after instructor replies started persisting
  (`AdminMessageReply`, previous change) — nothing on the admin side
  surfaced them beyond a count+preview in the topbar outbox dropdown
  (`AdminLayout.tsx` `MessagesPanel`). Added `GET
  /api/admin/messages/:id/thread` (`messages.service.getMessageThread`,
  scoped to `senderAdminId` like every other ownership check in that file)
  returning the original message + its replies chronologically, and made it
  the "read" action for replies (mirrors `markMyMessageRead`: viewing =
  reading, no separate endpoint). New surface: `MessageThreadModal`
  (`frontend/src/components/messages/`), opened by clicking a row in the
  existing outbox dropdown — conversation view, "N new reply" indicator,
  "Reply" button that reuses `SendMessageModal` to send a fresh
  `AdminMessage` to the same recipient (not a write into
  `AdminMessageReply` — that model stays instructor-only by the schema's
  own explicit one-way design, see messages.prisma:30-38). **Schema
  change**: `AdminMessageReply` gained `readAt DateTime?` to back the
  unread indicator — `npx prisma generate` + `npx prisma db push` still
  needed against the target DB (same pre-existing gap this repo already
  flags for every new Prisma field; the rest of the feature degrades
  safely via `repliesFor`'s existing try/catch until then). Not wired
  through `invalidation.ts` — this whole panel was already plain
  `fetch`/local `useState`, not react-query, before this change; kept
  consistent with that, not a new inconsistency. No §5 entity table exists
  for Messages (none of §5.1–§5.14 cover it) — this entry is the only
  record of the mutation/surface per the "keep the maps alive" rule, not a
  new formal entity section.
