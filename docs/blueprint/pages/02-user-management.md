# 02 · User Management — `/users`
Doc: User Management §1–§26 · Entities: USER (IMPACT §5.1), ORG/GROUP (§5.6), ROLE (§5.5 via links) · Status: `[partial]` — `UserManagementPage.tsx` `[built]`; user list, add/edit/suspend/archive/restore, import CSV, invite, groups, departments, access policies tabs all built with Playwright tests.

## Module hub — sub-pages (doc §2)
Users · Organization Structure · Roles & Permissions (→ file 03) · Groups · Administrators · Competencies (→ file 07) · User Activity · Notifications (→ file 10) · Verification Center · Enterprise Infrastructure `[phase-later]`

---

## Page: All Users (`/admin/users?tab=all`)
**Filters** (each = query param + source key): Role→`['roles']` · Department→`['org','departments']` · Branch→`['org','branches']` · Status (enum) · Verification state (enum) · Learning progress (range) · Registration date (range) · Risk level (enum)
**Table columns:** Name · Email · Role · Department · Status · Last activity · Risk score · Enrollment count — reads `['users', filters]`
**Row actions:**
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| View profile | nav | — | → `/admin/users/:id` |
| Edit user | dlg→mut | `user.update` | → IMPACT §5.1 |
| Suspend user | mut | `user.suspend` | → §5.1 |
| Delete user | dlg→mut | `user.delete` | → §5.1 (confirm dialog; cascades) |
| Reset password | mut | `user.resetPassword` | local: `['users', id]` + notification to user |
| Assign role | dlg→mut | `role.assignToUser` | → §5.5 |
| Login as user (impersonate) | read/session | `user.loginAs` | audit backend-side; sensitive permission (03 §14) |
| Transfer ownership | dlg→mut | `user.transferOwnership` | → §5.1 + owned resources keys |

**Bulk operations** (selection bar): Bulk suspend→`user.suspend`×N · Bulk assign roles→`role.assignToUser`×N · Bulk enrollment→`enrollment.create`×N (→ §5.2) · Bulk notifications→`notification.send` · Bulk export→read. Bulk = same rows as single, applied per item; use `waitForResponse` pacing in tests (established pattern).
**Header buttons:** Add User (dlg/route below) · Import Users · Export Users · Invitations tab link

## Page: User Profile (`/admin/users/:id`) — reads `['users', id]`
**Tabs (12):** Overview · Personal Information · Roles & Access (assignment system lives here — 03 §24) · Activity Timeline (`['audit',{userId}]`) · Courses (`['enrollments', studentId]`) · Certificates (`['students',id,'certificates']`) · Competencies (`['users',id,'skills']` → file 07) · Security Logs · Devices & Sessions · Notes & Internal Comments · Preferences · Consent & Privacy
**Profile controls:**
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Force logout | mut | `user.forceLogout` | local: `['users', id]` |
| Revoke sessions | mut | `user.revokeSessions` | local: `['users', id]` |
| Reset MFA | mut | `user.resetMFA` | local: `['users', id]`; sensitive |
| Send message | dlg→mut | `message.send` | local: `['notifications']` |
| Add internal note | mut | `user.note.add` | local: `['users', id]` |

## Dialog/route: Add User (doc §6)
**Form fields:** Full name · Email · Phone · Role→`['roles']` · Department→`['org','departments']` · Branch→`['org','branches']` · Group→`['groups']` · Access level · Manager→`['users',{role:'manager'}]` · Skills→`['competencies']` · Custom attributes
**Validation engine:** required fields · duplicate user detection · email verification · domain policy · password policy
**Submit** → `user.create` → IMPACT §5.1 (workflow: create → assign roles/groups → credentials → invitation email → default permissions → audit → success screen)

## Page: Import Users (doc §7)
Upload CSV/Excel → validation (format, missing fields, duplicates, role validation, department mapping, group validation) → preview table.
Actions: Confirm import→`user.import` (→ §5.1, background queue, then import report: success count / failed rows / warnings / duplicate resolution → `['imports', jobId]`) · Edit rows (local) · Reject invalid rows (local) · Save import template→`importTemplate.save` (local: `['import-templates']`)

## Page: Export Users (doc §8)
Options: format (CSV/Excel/PDF) · selected fields · applied filters · scheduled export→`exportSchedule.create` (local: `['export-schedules']`). Generate/download = read + backend audit.

## Tab: Invitations (doc §9) — `['users','invitations']`
States: Pending · Accepted · Expired · Revoked.
Actions: Resend→`invite.resend` · Cancel→`invite.cancel` · Change expiration→`invite.changeExpiry` (all local: `['users','invitations']`) · View delivery logs (read).

## Tab: Suspended Users (doc §10) — `['users','suspended']`
Shows: reason, date, trigger source, admin notes.
Actions: Reactivate→`user.reactivate` (→ §5.1) · Extend suspension→`user.suspend.extend` (local) · Delete permanently→`user.delete` (→ §5.1) · Export logs (read).

## Tab: Pending Verification (doc §11) — `['users','pending-verification']`
Requests: email · phone · identity review.
Actions: Resend verification→`user.verify.resend` (local) · Manual verification→`user.verify.approve` (→ §5.1) · Reject→`user.verify.reject` (→ §5.1) · Escalate review→`user.verify.escalate` (local + `['tasks']`).

## Tab: Archived Users (doc §12) — `['users','archived']`
Actions: Restore→`user.restore` (→ §5.1) · Export data (read) · Delete permanently→`user.delete` (→ §5.1) · Retention policy check (read).

## Tab: Guest / External Users (doc §13) — `['users','guests']`
Config per guest: expiration date · limited permissions · allowed courses→`['courses']` · restricted visibility. Mutations: `guest.create/update/revoke` (local: `['users','guests']` + `['users']`).

## Lifecycle / Delegation / Merge / Tags (doc §14–§17)
- Lifecycle states: Invited→Active→Suspended→Archived→Deleted; automations (auto-deactivate, auto-archive, auto-revoke) are backend jobs — surfaces refetch on focus. `[phase-later]` for automation config UI.
- Delegation & temporary access → handled in 03 (roles): `role.assignToUser` with expiry.
- Merge duplicates → `user.merge` (→ §5.1). Mergeable: progress, certificates, enrollments, activity logs.
- Tags & labels (VIP, High Risk, New Hire, Instructor Candidate, Compliance Pending): `user.tag.add/remove` (→ §5.1); tag filter reads `['users','tags']`.

## Page: Organization Structure (`/admin/users/org`) — doc §18
Sections: **Departments** (members, managers, teams, KPIs, budget, learning metrics) · **Branches** (location, users, departments, compliance) · **Teams** (members, leader, progress, assigned paths) · **Org Chart** (visual tree) · **Hierarchy Settings** (reporting, access hierarchy, permission flow, approval chains).
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Create/edit/delete department | mut | `org.department.create/update/delete` | → IMPACT §5.6 |
| Create/edit/delete branch | mut | `org.branch.*` | → §5.6 |
| Create/edit/delete team | mut | `org.team.*` | → §5.6 |
| Chart drag&drop: move user / reassign dept / change reporting | mut | `org.chart.moveUser` | → §5.6 |
| Hierarchy rules update | mut | `org.hierarchy.update` | local: `['org','chart']` + affected users |

## Page: Groups (`/admin/users/groups`) — doc §20 — `['groups']`
Types: static, dynamic, learning cohorts, automation rules, enrollment groups, compliance groups, department learning groups, smart AI segmentation `[phase-later]`.
Actions: `group.create/update/delete` (→ §5.6) · `group.members.add/remove` (→ §5.6) · `group.assignCourses`→ creates enrollments (→ §5.2).

## Page: Administrators (`/admin/users/admins`) — doc §21 — `['admins']`
Super admins, department admins, instructor managers, scoped access, delegated admins, emergency access (03 §33), audit tracking, session monitoring. Admin CRUD = `user.*` + `role.assignToUser` with admin roles; emergency access → 03.

## Page: User Activity (`/admin/users/activity`) — doc §23 — `['audit', filters]`
Read-only: login history, course activity, certificates, audit logs, timeline, devices, sessions, downloads, API activity, behavioral analytics `[phase-later]`. Actions: filter/search/export (read).

## Page: Verification Center (`/admin/users/verification`) — doc §25
Superset of Pending Verification tab + risk scoring, fraud detection, compliance verification `[phase-later]`. Same mutation IDs as §11 tab — same rows, do not fork new ones.
