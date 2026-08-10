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
| Earnings / Reviews / Documents tabs | `['instructors', id, 'earnings' \| 'reviews' \| 'documents']` | *(no endpoint — no Finance/Review/Document model exists)* | — |

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
| `instructor.suspend` (§14 — delegates to users.service) | `['instructors']` `['instructors', id]` `['users']` `['courses']` (their courses do NOT unpublish in v1 — open decision) `['dashboard','instructor-performance']` | Instructors table · Users table status chip · **Active Instructors KPI** |
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
| `learningPath.item.add` / `.remove` / `.reorder` (§7 — reorder is ONE bulk call, replace state from response like Course Builder) | `['learning-paths']` | Path detail item list · `itemCount` on the paths list |
| `quiz.create` / `.update` / `.delete` (§8 — `/api/admin/quizzes`, contract `QUIZZES_CONTRACT.md`) | `['quizzes']` + `['quizzes', courseId]` `['courses', courseId]` when attached | Assessments tab quiz list · course detail (attached quizzes) |
| `quiz.question.add` / `.update` / `.delete` / `.reorder` (§8 — reorder is ONE bulk call, replace state from response; question writes change server-derived `questionCount`/`totalPoints`/`autoGradable` — next real GET, never computed client-side, R1/R4) | `['quizzes']` | Quiz builder question list · derived counts on the quiz list |
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
| `certificate.issue` (§9 — `POST /api/admin/certificates`, contract `CERTIFICATES_CONTRACT.md`; v1 MANUAL only — auto-triggers wait for the learner runtime; requires `Course.certificateEnabled`) | `['certificates']` `['students', id, 'certificates']` `['dashboard','course-analytics']` | **Certificates Issued KPI** (counts non-revoked only) · student profile · Activity "Certificate Issued" |
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
Reports) self-fetches on mount and listens for the app-wide
`analyticsUpdated` bridge event — the Overview tab in particular aggregates
too many domains (users/learners/instructors/courses/certificates/
live-sessions/audit) for any single mutation ID to name them all, so it
rides the same catch-all event every other module's mutations already
dispatch rather than needing a bespoke invalidation list.

---

## 6. FRONTEND ENFORCEMENT (how the map becomes code)

- `src/lib/queryKeys.ts` — key factory; the ONLY place key arrays exist.
- `src/lib/invalidation.ts` — `INVALIDATION_MAP: Record<MutationName, () => QueryKey[]>` that mirrors §5 1:1, plus `invalidateFor(queryClient, mutationName, ctx)` which applies the row + §2 defaults.
- Every `useMutation.onSuccess` calls `invalidateFor(...)`. Ad-hoc `queryClient.invalidateQueries` calls outside `invalidation.ts` are forbidden (lint/review check).
- Adding a mutation = one row here (§5) + one entry in `INVALIDATION_MAP`. They must match; drift between file and map is a review blocker.

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
