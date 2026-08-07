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

**Competencies domain**
`['competencies']` · `['competencies','categories']` · `['competencies','frameworks']` · `['competencies','levels']` · `['competencies','analytics']` · `['users', id, 'skills']`

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
| Notifications Center | `['notifications']` | `GET /api/notifications` | notifications |
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
| `payout.execute` (§9) → see 5.7 FINANCE | | **no Payment model exists yet; revenue is null everywhere** |
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

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `transaction.purchase` (course/subscription) | `['transactions','recent']` `['dashboard','revenue']` `['billing',studentId]` + `['enrollments',…]` via chained enrollment (5.2) | **Total Revenue KPI** · **Active Subscriptions KPI** · Revenue charts · Recent Transactions · Payment Alerts notification |
| `refund.request` | `['approvals']` `['tasks']` | **Pending Approvals KPI** · Tasks "Review Refund Requests" |
| `refund.approve` | `['approvals']` `['transactions','recent']` `['dashboard','revenue']` `['billing',studentId]` + possibly `['enrollments',…]` revoke | Refund Statistics · Revenue down · enrollment status |
| `payout.execute` (instructor) | `['instructors', id, 'earnings']` `['dashboard','revenue']` `['transactions','recent']` | Instructor Payouts metric · earnings tab |
| `subscription.cancel` | `['dashboard','revenue']` `['billing',studentId]` | **Active Subscriptions KPI** · Subscription Growth chart |

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

### 5.11 COMPETENCY / SKILL (blueprint 07)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `skill.create` / `skill.update` / `skill.delete` | `['competencies']` | Skills library table · **Skills dropdown in Add User form** (R2) · course/path skill chips |
| `skillCategory.create/update/archive` | `['competencies','categories']` `['competencies']` | Category filter · hierarchy tree |
| `framework.create/update/delete` | `['competencies','frameworks']` | Frameworks list |
| `skillLevel.configure` | `['competencies','levels']` | Level ladders on all skill profiles |
| skill assessment completion (student side, backend chain) | `['users', id, 'skills']` `['competencies','analytics']` | User skill profile · competency analytics |
| `competencyMap.link/unlink` | `['competencies']` + target entity key (`['courses', id]` / `['learning-paths']` / `['quizzes',…]`) | Mapping views · skill chips on courses/paths |
| `competencyCert.assign/verify/revoke` | `['users', id, 'skills']` `['competencies']` | Certification tracking · profiles |

### 5.12 NOTIFICATION CAMPAIGNS (blueprint 10)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `emailCampaign.create` / `pushCampaign.send` / `smsCampaign.send` / `announcement.send` | `['campaigns']` `['notifications','stats']` (recipients' `['notifications']` update server-side) | Campaign lists · notification dashboard widgets · targeted users' feeds |
| `campaign.schedule/pause/cancel/duplicate` | `['campaigns']` `['calendar']` | Scheduled tab · delivery calendar |
| `template.create/update/duplicate` | `['notification-templates']` | Templates tab · **template pickers** (R2) |
| `notificationRule.create/update/delete/toggle` | `['notifications','rules']` | Automation tab · active-rules widget |
| `notification.markRead/.archive/.pin` | `['notifications']` only (skip §2 stats default — pure feed state) | Feed everywhere: dashboard widget + in-app tab |
| `emergencyAlert.send` | `['campaigns']` `['security','alerts']` | Emergency tab · Security Alerts widget (Dashboard §15) |
| `delivery.retry` | `['notifications','stats']` | Delivery logs · failed count |

### 5.13 FINANCE CONFIG (blueprint 09 — runtime money flows stay in §5.7)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `plan.create/update` | `['plans']` `['subscriptions']` | Plans table · **plan dropdowns** (R2) · checkout options |
| `invoice.generate` / `invoice.void` | `['invoices']` `['billing', studentId]` | Invoices table · student Billing tab |
| `invoice.update/send` | `['invoices']` | Invoice row/status · customer notified |
| `coupon.create/update/disable` | `['coupons']` | Coupons table · checkout coupon validation |
| `tax.configure` | `['tax','config']` `['invoices']` | Tax settings · future invoice/checkout totals |
| `billingSettings.update` | `['finance','settings']` — ⚠️ if currency changed: broad refetch of ALL money displays | Every money surface in the app |
| `gateway.connect/configure/testMode` | `['gateways']` `['integrations']` | Gateways tab · integrations dashboard · checkout methods |
| `commission.update` | `['payouts']` `['instructors', id, 'earnings']` `['dashboard','revenue']` | Payout calculations · earnings tabs |
| `payment.retry` | `['transactions','recent']` `['finance','dashboard']` | Payments table · finance KPIs |
| `payment.approve` | as §5.7 `transaction.purchase` | — |
| `refund.reject` | `['approvals']` | Refund queue (approve → §5.7) |
| `payout.hold` | `['payouts']` `['instructors', id, 'earnings']` | Payout status |

### 5.14 SUPPORT TICKETS (blueprint 06 §10)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `ticket.create` (student side) | `['support-tickets']` `['tasks']` | Support tab · Tasks widget |
| `ticket.assign/respond/resolve/escalate` | `['support-tickets']` | Ticket status · student notified via §2 defaults |

### 5.15 INTEGRATIONS (blueprint 11)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `integration.connect/disconnect` | `['integrations']` `['integrations','stats']` + downstream option lists (video providers → live-session form, gateways → checkout) | Integration cards · dashboard widgets · **provider dropdowns** (R2) |
| `integration.configure/testMode` | `['integrations']` | Config panels |
| `apiKey.generate/revoke` | `['api-keys']` | API management tab |
| `webhook.create/update/delete/toggle` | `['webhooks']` | Webhooks tab |
| `sync.run` (on completion) | `['integrations','sync']` + synced entity keys (HR sync → `['users']`) | Sync center · synced tables |

### 5.16 SYSTEM SETTINGS (blueprint 12)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `settings.<domain>.update` | `['settings', domain]` + downstream keys per blueprint 12 table | The settings form + every consumer of that domain |
| `featureToggle.set` | `['settings','features']` + all gated module keys | Sidebar items appear/disappear · routes gate · widgets hide — **most reflective mutation in the app** |
| `maintenance.enable/disable` | `['settings','maintenance']` | Global banner/lock · users notified |
| `backup.run/restore` | `['system','backups']` | Backup tab (restore = destructive confirm flow) |
| `retention.update` | `['security','retention']` | Retention rules · archived-user policy checks (blueprint 02 §12) |
| `settings.restoreVersion` | `['settings', affectedDomain]` + its downstream | Config logs → restored state everywhere |

### 5.17 SECURITY ACTIONS (blueprint 13)

| Mutation | Invalidate (extra) | Visible reflections |
|---|---|---|
| `securityAlert.resolve` | `['security','alerts']` `['security','threats']` `['security','stats']` | Security Alerts widget (Dashboard §15) + module tabs |
| `incident.create/update/close` | `['security','incidents']` `['tasks']` | Incidents tab · Tasks widget |
| `device.block/approve` | `['security','devices']` `['security','sessions']` | Devices tab · affected user sessions |
| `ip.block/unblock` | `['security','ip']` | IP tab · policy enforcement (03 §19) |

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

*Last updated: 2026-07-03 — generated from the FULL Admin System documentation, all 13 modules: Login, Dashboard Overview, User Management, Roles & Permissions, Learning Management, Instructors, Students, Competencies, Reports & Analytics, Finance, Notifications, Integrations, System Settings, Audit & Security. Companion blueprint: `docs/blueprint/`.*
