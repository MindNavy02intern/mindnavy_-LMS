# 03 · Roles & Permissions — `/roles-permissions`
Doc: Roles & Permissions §1–§42 · Entities: ROLE (IMPACT §5.5), USER (§5.1) · Status: `[partial]` — `RolesPermissionsStandalonePage.tsx` `[built]`; tabs are URL-driven via `useTabParam` (default `?tab=roles`). LMS Roles tab `[built]`, Access Policies tab `[built]`, Role Templates tab `[built]`, User Role Assignments tab `[built]` (all with Playwright tests). Permissions matrix tab `[partial]`.

## Module sections (doc §1)
LMS Roles · Company Roles · Permission Matrix · Access Policies · Role Templates `[built]` · User Role Assignments `[built]` · Delegated Administration · Dynamic Permissions `[phase-later]` · API Permissions · Compliance Restrictions · Audit & Tracking · Security Enforcement

---

## Tab: LMS Roles (`?tab=roles`) — `['roles']`
**Table columns:** Role name · Description · Permission count · Assigned users · Scope · Risk level · Created date · Status
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| View role | nav | — | → role details |
| Create role | dlg→mut | `role.create` | → IMPACT §5.5 |
| Edit role | dlg→mut | `role.edit` | → §5.5 (⚠️ permission-version bump, B5) |
| Duplicate role | mut | `role.duplicate` | → §5.5 |
| Archive role | mut | `role.archive` | local: `['roles']` + dropdowns lose option (R2) |
| Disable role | mut | `role.disable` | local: `['roles']` |
| Delete role | dlg→mut | `role.delete` | → §5.5 — dependency validation first (assigned users, linked policies, API deps, workflow deps); if unsafe → require reassignment |

## Create Role form (doc §3)
Fields: Name · Description · Role level · Department scope→`['org','departments']` · Branch scope→`['org','branches']` · Access scope (enum §10) · Priority level · Risk classification · Permission inheritance.
**Permission grid:** categories (Users, Courses, Learning Paths, Live Sessions, Quizzes, Certificates, Finance, Revenue, Reports, Analytics, Notifications, Integrations, Audit Logs, Security, API Access, System Settings) × types (View, Create, Edit, Delete, Manage, Approve, Export, Publish, Moderate, Assign, Override, Impersonate).
Save → validation (duplicate check, permission conflict, security risk, compliance) → `role.create`.

## Role Details page (doc §4) — `['roles', id]`
Sections: Overview · Assigned permissions · Permission inheritance · Assigned users · Access policies · Scope visibility · API permissions · Security restrictions · Activity logs · Compliance rules.

## Tab: Company Roles (`?tab=company`) — `['roles','company']` (doc §8–§9)
Examples: HR Manager, Finance Manager, Branch Manager, Regional Director, Sales Supervisor, Compliance Officer, Security Auditor.
Assign company role → config: Department · Branch · Team · Reporting manager→`['users',{role:'manager'}]` · Geographic scope · Access duration → `companyRole.assign` (→ §5.5 assign row).

## Scope types (doc §10) — enum used across forms
Global · Department · Team · Branch · Country · Course-level · Instructor-level · Student-level.

## Tab: Permission Matrix (`?tab=matrix`) — `['permission-matrix']` (doc §11–§13)
Rows = features/modules, columns = roles, cells = toggles (View/Create/Edit/Delete/Approve/Manage/Export/Publish/Moderate/Override).
Toggle change → real-time validation → conflict detection → dependency analysis → save → `role.edit` (same mutation ID; do NOT invent `matrix.toggle`) → sessions revalidated.
**Sensitive permissions (doc §14):** Delete Users, Manage Billing, Access Security Logs, Super Admin actions, Revenue Access, Audit Manipulation, API Administration → require MFA + secondary approval + confirmation + audit. Frontend: confirmation dialog flow; backend enforces.

## Tab: Access Policies (`?tab=policies`) — `['policies']` (doc §15–§20)
Policy builder conditions: user role, department, team, device type, IP, login time, country, branch, risk score, session type, compliance state.
Policy actions: Allow · Deny · Read-only · Temporary · Require approval · Require MFA · Trigger security review.
Includes time-based access (e.g., Finance managers → billing module, Mon–Fri 8–18) and IP/device restrictions (company IP only, approved devices, country restrictions, VPN blocking).
Mutations: `policy.create` / `policy.update` / `policy.delete` (→ §5.5 policy row). Policy execution engine = backend.

## Tab: Role Templates (`?tab=templates`) `[built]` — `['role-templates']` (doc §21–§23)
Examples: Instructor, HR, Finance, Branch Manager, Student Support, Compliance Officer templates.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Create template | dlg→mut | `template.create` | local: `['role-templates']` |
| Edit template | dlg→mut | `template.update` | local: `['role-templates']` |
| Apply template (select user/role → choose → preview → apply) | mut | `template.apply` | → IMPACT §5.5 assign row; sessions refreshed |

## Tab: User Role Assignments (`?tab=assignments`) `[built]` — `['role-assignments']` (doc §24–§27)
Entry points: this tab + User Profile → Roles & Access tab (file 02).
Assignment types: Primary · Secondary · Temporary · Emergency access. Optional expiration date.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Assign role to user | dlg→mut | `role.assignToUser` | → §5.5 |
| Remove assignment | mut | `role.unassignFromUser` | → §5.5 |
| Temporary access (start/end date, allowed modules) | mut | `role.assignToUser` (with expiry) | → §5.5; auto-expiry = backend job, surfaces refetch |
Multi-role engine: users may hold multiple roles/scopes — UI must render role *lists*, never a single-role field.

## API & Integration Permissions (doc §29) — `['api-permissions']`
Controls: API keys, webhooks, integration access, external systems, third-party permissions. Config UI lives in file 11 (Integrations); permission gating defined here.

## Domain restrictions (doc §30–§32) — behavior rules, not pages
Permissions gate: live sessions (join/publish), course publishing, SCORM uploads, certificate approval, path management, assignment moderation · Finance areas: revenue visibility, refund approvals, payouts, subscriptions, tax reports · Student privacy: data/grades/sensitive info visibility. Frontend rule: **gate by permission flags from session payload, never by role name string.**

## Emergency Access (doc §33) — `emergencyAccess.grant` (MFA + approval + time limit + audit) → §5.5 assign row. `[phase-later]` UI; backend contract first.

## Tab: Audit & Tracking (`?tab=audit`) — `['audit',{scope:'roles'}]` (doc §34–§35)
Read-only: permission changes, role assignments, failed access attempts, policy violations, security overrides, API usage. Entry fields: admin name, action type, timestamp, affected user, old value, new value, IP, device.

## Role notifications (doc §36) — backend sink: role assigned, permission changed, access revoked, policy updated, temp access expired, security violations → feeds `['notifications']` automatically.

## `[phase-later]`: AI permission intelligence (§37) · Multi-tenant isolation (§38) · Compliance & governance (§39) · Feature-flag permissions (§40 — overlaps file 12 §15; single source = file 12).
