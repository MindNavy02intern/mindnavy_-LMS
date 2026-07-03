# 08 · Reports & Analytics — `/reports-analytics`
Doc: Reports & Analytics §1–§14 · Entities: ALL (read-only module) · Status: `[planned]`

**Module nature: 100% read surfaces.** No mutations here change domain data — the only writes are report templates/schedules (local). Every number MUST reuse the owning endpoint/key from IMPACT §4 — this module never introduces a second source for an existing metric (R4). If a report needs a number that has no owner yet, define the owner in IMPACT §4 first.

## Sections (each = tab/sub-route, all read-only unless noted)
| Tab | Reads | Contents |
|---|---|---|
| Dashboard Overview (`?tab=overview`) | `['dashboard','stats']` + `['reports','snapshot']` | KPI widgets: total users, active students, active instructors, courses completed, learning progress, live sessions today, revenue overview, certificates issued, engagement score, system activity. Controls: date range, filter by department→`['org','departments']`/course→`['courses']`, export, open detailed reports |
| Student Analytics (`?tab=students`) | `['dashboard','student-engagement']` + detail endpoints | Activity, progress, completion, quiz scores, assignments, attendance, engagement, streaks, dropout risk, retention. Views: individual / group / cohort / department / company-wide |
| Instructor Analytics (`?tab=instructors`) | `['dashboard','instructor-performance']` | Ratings, feedback, course performance, completion, satisfaction, session attendance, revenue, activity, response time. Actions: compare, export, **flag low performance→`instructor.flagPerformance` (mut, local + `['tasks']`)**, open profile (nav) |
| Course Analytics (`?tab=courses`) | `['dashboard','course-analytics']` | Enrollment, completion, avg scores, ratings, watch time, drop-off points, assignment completion, engagement, revenue + insights: popular, weak, high-dropout, trending, best categories |
| Learning Progress (`?tab=progress`) | engagement + progress endpoints | Completed/remaining lessons, speed, %, time spent, skill development, path completion. Detects: slow learners, inactive, high performers, risks |
| Quiz & Exam Reports (`?tab=assessments`) | `['quizzes',…]` aggregates | Attempts, scores, pass/fail, difficult questions, averages, cheating detection `[phase-later]`, time per question, retakes. Actions: review failed (read), analyze weak questions (read), **reset attempts→`attempt.reset` (mut → file 06 row)**, export |
| Certificates Reports (`?tab=certificates`) | `['certificates', filters]` | Issued, expired, revoked, verification requests, completion/compliance certs. Actions: verify (read), **reissue→`certificate.reissue` (→ §5.8)**, export, trends |
| Attendance Reports (`?tab=attendance`) | `['attendance', filters]` | Session attendance, presence/late/absence rates, participation, duration, instructor attendance, trends |
| Revenue Reports (`?tab=revenue`) | `['dashboard','revenue']` | Total, course sales, subscription revenue, refunds, payouts, pending, by course, by instructor, trends. Actions: generate/export/compare (read) |
| Engagement Analytics (`?tab=engagement`) | engagement endpoints | DAU/WAU, session duration, watch time, discussion activity, assignment participation, notification engagement, retention. Detects low/high engagement, inactive groups |
| Compliance Reports (`?tab=compliance`) | competencies + enrollments | Mandatory training completion, expired certs, violations, security training, department compliance, audit readiness + alerts |
| Audit Reports (`?tab=audit`) | `['audit', filters]` | User activity, logins, permission changes, course changes, financial activity, security events, content updates. Actions: filter, search, export, investigate (nav → file 13) |
| Export Center (`?tab=export`) | — | Formats: PDF, Excel, CSV, JSON, scheduled. Options: date range, department, user, course, analytics type. **Scheduled report→`reportSchedule.create/delete` (mut, local: `['report-schedules']`)** |
| Custom Reports (`?tab=custom`) | — | Builder: data source → metrics → filters → visualization (tables, line, bar, pie, heatmap, KPI cards) → **save template→`reportTemplate.save` (mut, local: `['report-templates']`)** → schedule |

## `[phase-later]`: AI predictive analytics, risk detection, forecasting, benchmarks, executive summaries.
