# 01 · Dashboard Overview — `/dashboard`
Doc: Dashboard Overview §1–§22 · Entities: ALL (read surfaces) · Status: `[partial]` — `DashboardPage.tsx` at `/dashboard` is `[built]`; all 9 KPI cards render (2026-07). 6 cards show live data (Total Users, Active Learners, Courses, Active Instructors, Pending Approvals, Live Sessions). 3 cards show `—` pending Phase 2 backend tables: Completions (`certificatesIssued`), Revenue (`totalRevenue`), Active Subscriptions (`activeSubscriptions`) — confirm with Hassan. Analytics rows, charts, quick actions, admin widgets wired to real backend. Not all doc §2 sub-sections complete.

## Widgets (render order per doc §2)
Each widget = one card, one query key, one endpoint field-owner (IMPACT §4a). No widget keeps local copies or does client-side math (R1).

| # | Widget | Query key | Contents / notes |
|---|---|---|---|
| 1 | Welcome section | `['dashboard','stats']` (same payload) | Admin name, role, org, date/time, last login, system status |
| 2 | Quick Statistics — 9 KPI cards | `['dashboard','stats']` | Total Users · Active Students · Active Instructors · Published Courses · Pending Approvals · Total Revenue · Active Subscriptions · Certificates Issued · Live Sessions Running |
| 3 | Revenue Overview | `['dashboard','revenue']` | Daily/Monthly/Annual revenue, subscription revenue, refund stats, payouts, growth + charts: revenue trend, best-selling courses, subscription growth, payment success rate |
| 4 | User Analytics | `['dashboard','user-analytics']` | New registrations, active users, retention, roles distribution, verification status, suspended, geo distribution |
| 5 | Course Analytics | `['dashboard','course-analytics']` | Total/active/draft/pending courses, completion rates, most popular, quiz performance, path progress |
| 6 | Learning Activity Feed | `['activity']` | New course published · quiz completed · certificate issued · assignment submitted · live session started · content uploaded · new registration. Features: real-time refresh, user filter, department filter, search |
| 7 | Pending Approvals | `['approvals']` | Categories: course, instructor, user verification, refund, certification, content moderation |
| 8 | Live Sessions Overview | `['dashboard','live-overview']` | Active, upcoming, attendance, recording status, instructor activity, technical issues |
| 9 | Instructor Performance | `['dashboard','instructor-performance']` | Ratings, engagement, revenue, completion, session attendance, reviews, upload activity |
| 10 | Student Engagement | `['dashboard','student-engagement']` | Progress, DAU, quiz participation, assignment/course completion, learning time, drop-off + insights: high-engagement, at-risk, inactive, interventions |
| 11 | Notifications Center | `['notifications']` | Categories: security, registrations, course approvals, payments, session reminders, system, AI |
| 12 | Tasks & Reminders | `['tasks']` | Review pending courses · approve instructors · resolve security alerts · refund requests · maintenance · compliance deadlines |
| 13 | Recent Transactions | `['transactions','recent']` | Latest financial activity |
| 14 | System Health | `['system','health']` | Infra status levels |
| 15 | Security Alerts | `['security','alerts']` | Security monitoring feed |
| 16 | Calendar & Events | `['calendar']` | Sessions, events, deadlines |
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
| Live overview: end session | mut | `liveSession.end` | → IMPACT §5.4 |
| Notifications: mark as read / archive / pin | mut | `notification.markRead` / `.archive` / `.pin` | local: `['notifications']` |
| Notifications: open notification | nav | — | → linked resource |
| Notifications: configure preferences | nav | — | → `/admin/notifications?tab=preferences` |
| Tasks: complete task | mut | `task.complete` | local: `['tasks']` |
| Quick actions (add user, create course, …) | nav/dlg | — | shortcuts into modules 02/04/… |

## Reflection guarantees (what Playwright asserts here)
Any mutation anywhere in the app that maps to a §5 row must be visible on this page after navigation **without hard reload** — that is the definition of done for this page. Reflection test template: IMPACT §7.
