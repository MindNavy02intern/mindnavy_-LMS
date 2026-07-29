# 01 · Dashboard Overview — `/dashboard`
Doc: Dashboard Overview §1–§22 · Entities: ALL (read surfaces) · Status: `[partial]` — `DashboardPage.tsx` at `/dashboard` is `[built]`; all 9 KPI cards render (2026-07). 6 cards show live data (Total Users, Active Learners, Courses, Active Instructors, Pending Approvals, Live Sessions). 3 cards show `—` pending Phase 2 backend tables: Completions (`certificatesIssued`), Revenue (`totalRevenue`), Active Subscriptions (`activeSubscriptions`) — confirm with Hassan. Analytics rows, charts, quick actions, admin widgets wired to real backend. Not all doc §2 sub-sections complete.

**Real-data audit + fixes `[built]` 2026-07-27** (`dashboard.service.js` + `DashboardPage.tsx`): the "Live Sessions" KPI and widget were counting app-user LOGIN sessions, unrelated to real live classes — now reads the real `LiveSession` table (same status-derivation service as `GET /live-sessions`). Pending Approvals' item list was hardcoded empty despite a real badge count — both now share one query, can't drift apart. Learning Activity Overview was a hardcoded `[]` stub — now a real enrolled-vs-completed daily trend from `course_enrollments`. Calendar & Events now shows real upcoming/live sessions (partial — no other event types have a backend source yet). Mixed real/fake fields in the same card (User Analytics `retentionRate`, Course Analytics `averageCompletionRate`/`mostPopularCourse`, Course Completion `averageCompletion`/`categories`) are now computed from real Enrollment data where the data genuinely supports it; `averageQuizScore` stays `null` (no quiz-attempt/submission system exists anywhere in the schema — a different unbuilt system, not a stub of THIS data). Every field that's genuinely unmeasurable now returns `null` and renders as "Not available yet" / "—", never a fake `0` next to real numbers. Revenue Overview, Instructor Performance, Tasks & Reminders, Recent Transactions, Reports Snapshot, AI Insights are confirmed still fully stub (no backend system exists) — only their frontend empty-state copy was made honestly "Coming soon"-labeled, no backend logic touched.

**GAP (pre-existing, not fixed — report only):** the widget table below lists a distinct dashboard-scoped query key per widget (`['dashboard','revenue']`, `['dashboard','live-overview']`, etc., implying ~19 separate endpoints/keys). Reality is 3 endpoints only — `GET /dashboard/core`, `GET /dashboard/analytics`, `GET /dashboard/admin-widgets` (`api/dashboard.ts`) — and `DashboardPage.tsx` uses raw fetch, not this codebase's `queryKeys.ts`/`invalidateFor` registry at all (predates that convention). This mismatch predates 2026-07-27 and was not introduced or reconciled by this fix — flagging per "blueprint vs reality disagree → report, don't silently fix either side." The widget table below also doesn't 1:1 match the real component list (e.g. row 6 "Learning Activity Feed" is actually `RecentActivities`/Recent Activity in code; the real enrolled-vs-completed "Learning Activity Overview" chart this fix touched, plus Users by Role, Course Completion Rate, Top Departments, and Performance Overview, have no dedicated rows at all) — same pre-existing gap, only the rows this specific fix touched were reconciled above, a full table rewrite is a separate task.

## Widgets (render order per doc §2)
Each widget = one card, one query key, one endpoint field-owner (IMPACT §4a). No widget keeps local copies or does client-side math (R1).

| # | Widget | Query key | Contents / notes |
|---|---|---|---|
| 1 | Welcome section | `['dashboard','stats']` (same payload) | Admin name, role, org, date/time, last login, system status |
| 2 | Quick Statistics — 9 KPI cards | `['dashboard','stats']` | Total Users · Active Students · Active Instructors · Published Courses · Pending Approvals · Total Revenue · Active Subscriptions · Certificates Issued · Live Sessions Running |
| 3 | Revenue Overview | `['dashboard','revenue']` | Daily/Monthly/Annual revenue, subscription revenue, refund stats, payouts, growth + charts: revenue trend, best-selling courses, subscription growth, payment success rate |
| 4 | User Analytics | `['dashboard','user-analytics']` | New registrations, active users, retention (real 2026-07-27: % of the 30+-day-old cohort active in the last 30 days — one specific definition, see code comment), roles distribution, verification status, suspended, geo distribution `[planned]` |
| 5 | Course Analytics | `['dashboard','course-analytics']` | Total/active/draft/pending courses (real), completion rates + most popular course (real 2026-07-27, from `course_enrollments`), quiz performance (`averageQuizScore` — genuinely `null`, no quiz-attempt/submission system exists), path progress `[planned]` |
| 6 | Learning Activity Feed | `['activity']` | New course published · quiz completed · certificate issued · assignment submitted · live session started · content uploaded · new registration. Features: real-time refresh, user filter, department filter, search |
| 7 | Pending Approvals | `['approvals']` | Only `user_verification` is real (2026-07-27: badge + item list both from the same pending-verification-users query — was badge-only before). course/instructor/refund/certification/content-moderation approval types are `[planned]`, not wired here |
| 8 | Live Sessions Overview | `['dashboard','live-overview']` | Active/upcoming counts + session list are real (2026-07-27, from the real `LiveSession` table — were counting app-login sessions before). Attendance and technical-issues are `null`/"not tracked" (no attendance or monitoring system exists) — never a fake 0. Recording status `[planned]` |
| 9 | Instructor Performance | `['dashboard','instructor-performance']` | Ratings, engagement, revenue, completion, session attendance, reviews, upload activity |
| 10 | Student Engagement | `['dashboard','student-engagement']` | Progress, DAU, quiz participation, assignment/course completion, learning time, drop-off + insights: high-engagement, at-risk, inactive, interventions |
| 11 | Notifications Center | `['notifications']` | Categories: security, registrations, course approvals, payments, session reminders, system, AI |
| 12 | Tasks & Reminders | `['tasks']` | Review pending courses · approve instructors · resolve security alerts · refund requests · maintenance · compliance deadlines |
| 13 | Recent Transactions | `['transactions','recent']` | Latest financial activity |
| 14 | System Health | `['system','health']` | Infra status levels |
| 15 | Security Alerts | `['security','alerts']` | Security monitoring feed |
| 16 | Calendar & Events | `['calendar']` | Real upcoming/live sessions (2026-07-27, reuses the same query as widget #8 — one fetch, can't show a different session list than the Live Sessions widget). Deadlines/other event types `[planned]`, no backend source yet |
| 17 | Quick Actions panel | — | Nav shortcuts only (see actions) |
| 18 | Reports Snapshot | `['reports','snapshot']` | Aggregate mini-report |
| 19 | AI Insights & Recommendations `[phase-later]` | `['ai','insights']` | Recommendations feed |

## Actions
| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| KPI card click → detailed analytics | nav | — | → `/admin/reports` matching section |
| Stats: filter / date range / export / historical | read | — | export = audit backend-side |
| User Analytics: open user management | nav | — | → `/admin/users` |
| Approvals: approve request | mut | *(underlying entity)* | → IMPACT §5.9 → cascades to §5.x of the item type |
| Approvals: reject request | mut | *(underlying entity)* | → IMPACT §5.9 |
| Approvals: request modifications / assign reviewer | mut | `approval.requestChanges` / `approval.assignReviewer` | local: `['approvals']`, `['tasks']` |
| Approvals: view full details | nav | — | → owning module page |
| Live overview: join / monitor / view chat / export report | read | — | — |
| ~~Live overview: end session~~ | — | — | **Removed 2026-07-27**: no `end` mutation exists in `LIVE_SESSIONS_CONTRACT.md` v1 — status is 100% schedule-derived (UPCOMING→LIVE→ENDED from startTime+durationMin), there is no manual end action anywhere in the real contract. The dashboard's dead "End" button (disabled, stale "coming in Learning Mgmt" copy) was removed rather than wired, since wiring it to `DELETE` would have been semantically wrong (delete ≠ end — deletes the real Zoom meeting) and duplicated the Live Sessions tab's own proper cancel-with-confirm flow |
| Notifications: mark as read / archive / pin | mut | `notification.markRead` / `.archive` / `.pin` | local: `['notifications']` |
| Notifications: open notification | nav | — | → linked resource |
| Notifications: configure preferences | nav | — | → `/admin/notifications?tab=preferences` |
| Tasks: complete task | mut | `task.complete` | local: `['tasks']` |
| Quick actions (add user, create course, …) | nav/dlg | — | shortcuts into modules 02/04/… |

## Reflection guarantees (what Playwright asserts here)
Any mutation anywhere in the app that maps to a §5 row must be visible on this page after navigation **without hard reload** — that is the definition of done for this page. Reflection test template: IMPACT §7.
