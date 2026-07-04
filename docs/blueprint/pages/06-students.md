# 06 · Students — `/students`
Doc: Students §1–§15 · Entities: STUDENT/ENROLLMENT (IMPACT §5.2), CERTIFICATE (§5.8), FINANCE (§5.7), USER (§5.1) · Status: `[planned]`

## Module sections (doc overview)
All Students · Profiles · Enrollment · Learning Progress · Course Activity · Assignments & Exams · Certificates · Attendance · Analytics · Support · Communication · Groups & Cohorts · Billing & Subscriptions · Documents · Suspension & Compliance

---

## Tab: All Students (`?tab=all`) — `['students', filters]` (doc §1)
**Filters:** Course→`['courses']` · Status (enum) · Progress (range) · Cohort→`['groups']`
**Table columns:** Name · Profile image · Email · Enrolled courses · Learning progress · Certificates count · Enrollment date · Subscription status · Account status · Last activity
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| View student profile | nav | — | → `/admin/students/:id` |
| Edit student | dlg→mut | `student.update` | local: `['students']`, `['students', id]` |
| Enroll in course | dlg→mut | `enrollment.create` | → IMPACT §5.2 |
| Assign learning path | dlg→mut | `enrollment.create` (path variant) | → §5.2 |
| Send message | dlg→mut | `message.send` | local: `['notifications']` |
| Reset password | mut | `user.resetPassword` | local |
| Suspend student | dlg→mut | `student.suspend` | → §5.2 suspend row |
| Delete account | dlg→mut | `user.delete` | → §5.1 + §5.2 cascades |

## Page: Student Profile (`/admin/students/:id`) — `['students', id]` (doc §2)
**Sections:** Personal info · Contact · Enrolled courses (`['enrollments', studentId]`) · Learning progress (`['students',id,'progress']`) · Quiz results · Assignment submissions · Certificates (`['students',id,'certificates']`) · Attendance history · Payment history (`['billing', studentId]`) · Activity timeline · Support tickets (`['support-tickets',{studentId}]`)
**UI tabs example (doc):** Overview | Courses | Exams | Billing
**Controls:** Edit profile→`student.update` · Change enrollment→`enrollment.change` (→ §5.2) · Reset progress→`progress.reset` (→ §5.2 progress row, confirm dialog) · Assign certificate→`certificate.issue` (→ §5.8) · View analytics (nav) · Suspend access→`student.suspend` (→ §5.2) · Export student data (read)

## Tab: Enrollment Management (`?tab=enrollment`) (doc §3)
Types: manual, self, bulk, department, cohort.
**Enroll flow:** select student→`['students']` → select course/path→`['courses']`/`['learning-paths']` → config (enrollment date, expiration, access rules, cohort→`['groups']`, schedule) → confirm → `enrollment.create` (→ §5.2; student notified; logs updated). Bulk/department/cohort = ×N same row.
Cancel/withdraw → `enrollment.cancel` (→ §5.2).

## Tab: Learning Progress (`?tab=progress`) — `['students',id,'progress']` + `['dashboard','student-engagement']` (doc §4)
Metrics (read): completion %, completed/remaining lessons, watch time, quiz scores, assignment completion, streak, course status (Not Started / In Progress / Completed / Failed / Expired). Progress events come from student app → backend → surfaces refetch; admin-side `progress.reset` is the only mutation here.

## Tab: Course Activity (`?tab=activity`) — read-only timeline (doc §5)
Logins, viewed lessons, watched videos, downloads, quiz attempts, assignment uploads, forum activity, session attendance. Log details: timestamp, device, IP, session duration. Filter/search/export = read.

## Tab: Assignments & Exams (`?tab=assessments`) — `['assignments',{studentId}]`, `['quizzes',{studentId}]` (doc §6)
Data: submissions, exam attempts, quiz results, scores, feedback, dates, instructor comments.
| Action | Mutation ID | Impact |
|---|---|---|
| Reopen exam | `exam.reopen` | local: assessments + `['students',id]` |
| Reset attempt | `attempt.reset` | local + `['dashboard','course-analytics']` (quiz stats) |
| Override grade | `grade.override` | → §5.2 quiz row (course analytics + engagement) |
| View submission / download files | read | — |

## Tab: Certificates (`?tab=certificates`) — `['students',id,'certificates']` (doc §7)
Tracking: issued, pending, revoked, expiration, verification status.
Actions: Download/Verify/Share (read) · Reissue→`certificate.reissue` (→ §5.8) · Revoke→`certificate.revoke` (→ §5.8).

## Tab: Attendance (`?tab=attendance`) — `['attendance', filters]` (doc §8)
Metrics: session attendance, join/leave time, duration, missed sessions, attendance %, participation score. Status: Present/Late/Absent/Excused.
Manual correction → `attendance.record` (→ §5.2 attendance row); otherwise events flow from live sessions.

## Tab: Analytics (`?tab=analytics`) — read-only (doc §9)
Engagement, retention, completion, learning speed, weak/strong topics, assessment performance, trends. Filters: course, department, cohort, date range, path. Deep analytics live in file 08 — this tab embeds the same queries, no duplicates.

## Tab: Support (`?tab=support`) — `['support-tickets']` (doc §10)
Features: help tickets, technical issues, enrollment problems, payment issues, access requests, learning assistance.
Workflow: student creates ticket → assigned → admin reviews → respond/resolve/escalate → student notified → status updated.
Mutations: `ticket.respond` / `ticket.resolve` / `ticket.escalate` / `ticket.assign` (local: `['support-tickets']` + `['notifications']`).

## Communication Center (doc §11) — shared with file 10
Direct messages, email broadcasts, course announcements, reminders, exam alerts. `message.send` / `announcement.send` (file 10 IDs) + delivery tracking (read).

## Tab: Groups & Cohorts (`?tab=cohorts`) — `['groups']` (doc §12)
Types: department, team, batch cohorts, learning cohorts, custom.
Actions: Create group→`group.create` (→ §5.6) · Add students→`group.members.add` (→ §5.6) · Assign courses→`group.assignCourses` (→ §5.2 ×N) · Track progress / generate reports (read).

## Tab: Billing & Subscriptions (`?tab=billing`) — `['billing', studentId]` (doc §13)
Tracking: plans, payments, invoices, refunds, failed payments, renewal dates.
Actions: Approve refund→`refund.approve` (→ §5.7) · Extend subscription→`subscription.extend` (→ §5.7) · Cancel plan→`subscription.cancel` (→ §5.7) · Generate invoice→`invoice.generate` (→ §5.7) · Export report (read). **Same mutation IDs as file 09** — single finance vocabulary.

## Tab: Documents (`?tab=documents`) (doc §14)
Stored: IDs, certificates, enrollment agreements, uploaded assignments, compliance forms, academic records.
Actions: `studentDoc.upload/replace/verify/archive` (local) · Download (read).

## Tab: Suspension & Compliance (`?tab=compliance`) (doc §15)
Violations: cheating, policy, inappropriate behavior, account abuse, payment fraud, security.
| Action | Mutation ID | Impact |
|---|---|---|
| Warn student | `student.warn` | local + `['notifications']` |
| Restrict course access | `student.restrictAccess` | local: `['students',id]`, `['enrollments',…]` |
| Suspend account | `student.suspend` | → §5.2 (restrictions → notify → permissions updated → audit) |
| Block exam access | `student.examBlock` | local: assessments |
| Freeze certificate | `certificate.freeze` | local: `['students',id,'certificates']` |
| Permanent ban | `student.ban` | → §5.2 suspend row, irreversible flag |

## `[phase-later]`: AI recommendations, gamification, badges, adaptive paths, leaderboards, offline learning, peer collaboration, risk detection.
