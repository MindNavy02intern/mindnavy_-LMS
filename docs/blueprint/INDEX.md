# MindNavy LMS · Project Blueprint — INDEX

**This folder is the complete UI map of the admin system**: every module, page, tab, section, table, filter, dropdown, and button — each action linked to its mutation ID and its reflection row in `IMPACT_MAP.md`.
**Companion files:** `IMPACT_MAP.md` (root) = what must update when something changes. `CLAUDE.md` = the protocol that makes both mandatory.

---

## AGENT ROUTING — read ONLY what the task touches

Do NOT read all blueprint files on every task. Route:

| Task mentions… | Read |
|---|---|
| Dashboard, KPIs, overview widgets | `pages/01-dashboard.md` |
| Users, add/import/invite, suspend, verify, org structure, groups, admins, tags | `pages/02-user-management.md` |
| Roles, permissions, matrix, policies, templates, assignments | `pages/03-roles-permissions.md` |
| Courses, categories, learning paths, quizzes, certificates, assignments, content library, live sessions, SCORM | `pages/04-learning-management.md` |
| Instructors, applications, payouts, reviews, instructor docs | `pages/05-instructors.md` |
| Students, enrollment, progress, attendance, support tickets, student billing | `pages/06-students.md` |
| Skills, competencies, frameworks, skill gaps | `pages/07-competencies.md` |
| Reports, analytics, export center, custom reports | `pages/08-reports-analytics.md` |
| Payments, subscriptions, invoices, refunds, payouts, coupons, taxes, gateways | `pages/09-finance.md` |
| Notification campaigns, templates, announcements, delivery | `pages/10-notifications.md` |
| Integrations, API keys, webhooks, sync | `pages/11-integrations.md` |
| Settings (general, branding, security, auth, storage, feature toggles…) | `pages/12-system-settings.md` |
| Audit logs, security dashboard, threats, devices, compliance | `pages/13-audit-security.md` |

**Always also read:** the IMPACT_MAP §5 rows for every entity the task touches. If a task spans modules (e.g. "enrolling a student affects revenue"), read both files.

---

## SIDEBAR / NAVIGATION REGISTRY (canonical module list)

Shared admin sidebar. Routes are **placeholders** — before using a route in code, verify against the actual router file and update here if different.

| # | Module | Route | Blueprint file |
|---|---|---|---|
| 1 | Dashboard Overview | `/dashboard` | 01 |
| 2 | User Management | `/users` | 02 |
| 3 | Roles & Permissions | `/roles-permissions` | 03 |
| 4 | Learning Management | `/learning-management` | 04 |
| 5 | Instructors | `/instructors` *(sidebar link; no Route/Page yet)* | 05 |
| 6 | Students | `/students` *(sidebar link; no Route/Page yet)* | 06 |
| 7 | Competencies | `/competencies` | 07 |
| 8 | Reports & Analytics | `/reports-analytics` | 08 |
| 9 | Finance | `/finance` | 09 |
| 10 | Notifications | `/notifications` *(sidebar link; no Route/Page yet — topbar bell opens a panel)* | 10 |
| 11 | Integrations | `/integrations` | 11 |
| 12 | System Settings | `/settings` | 12 |
| 13 | Audit & Security | `/trusted-devices` *(only trusted-devices section built; full audit suite planned)* | 13 |

Login flow (pre-app): login page → session check → credentials → account states (invalid/suspended/valid) → trusted device → OTP → session → dashboard. Auth surfaces live outside the sidebar; auth mutations are session-local (no IMPACT rows except audit backend-side).

---

## AUTH & UTILITY SURFACES (outside the sidebar registry)

These pages exist in the codebase but are not reachable from the main sidebar navigation. They are intentionally excluded from the 13-module registry above.

| Route | Component | Status | Entry point | Notes |
|---|---|---|---|---|
| `/profile` | `ProfilePage.tsx` | `[built]` | Topbar avatar dropdown → "Profile" | Admin profile view/edit; not linked from sidebar |
| `/login` | `LoginPage.tsx` | `[built]` | Unauthenticated redirect | Credentials → OTP → session |
| `/forgot-password` | `ForgotPasswordPage.tsx` | `[built]` | Login page link | Password reset request |
| `/reset-password` | `ResetPasswordPage.tsx` | `[built]` | Email link | Token-gated reset form |
| `/verify-device` | `VerifyDevicePage.tsx` | `[built]` | Post-login trusted-device check | OTP for new device |
| `/signup` | `SignupPage.tsx` | `[partial]` | Public link (stub) | Minimal; not wired to real flow yet |

---

## CONVENTIONS (apply to every page file)

1. **Status markers:** `[built]` = exists in codebase · `[partial]` = partially built · `[planned]` = spec only. Default is `[planned]`. Claude Code updates markers when it builds something — stale markers are bugs.
2. **Action tables** use columns: `Action / button` · `Kind` (nav = navigation, dlg = opens dialog/form, mut = mutation, read = read-only) · `Mutation ID` · `Impact` (IMPACT_MAP row ref, or `local:` + key, or `—` for pure reads).
3. **Mutation IDs** are canonical and shared 1:1 with `IMPACT_MAP.md §5` and `src/lib/invalidation.ts`. New button ⇒ new row here ⇒ new row in IMPACT_MAP ⇒ new entry in INVALIDATION_MAP — same change, always.
4. **Dropdowns/selects** are never listed with hardcoded options: each names its source query key (rule R2). "Filter: Role → `['roles']`".
5. **Every `mut` action implies §2 defaults** of IMPACT_MAP (`['activity']`, `['notifications']`, `['dashboard','stats']`) on top of its Impact ref.
6. **Exports/downloads** are `read` in the frontend (no invalidation) but backend writes an audit entry.
7. **Tabs are routes**: all tabs use URL-driven state via `?tab=` so deep links, browser back/forward, and Playwright selectors are stable. The `useTabParam` hook (`src/hooks/useTabParam.ts`) is the single implementation — read/write `?tab=` using `useSearchParams`. Playwright tests keep `getByRole('button', { name: 'Tab Name' })` interactions and add `toHaveURL(/[?&]tab=<key>/)` assertions. Both Roles & Permissions (`?tab=roles` default) and Learning Management (`?tab=overview` default) are migrated as of 2026-07.
8. **Enterprise/AI features** listed at the bottom of doc modules (AI insights, SIEM, gamification…) are marked `[phase-later]` — do not build unless a task explicitly asks; do not silently delete from the map either.
9. If a task conflicts with this blueprint or the doc, **stop and flag** (same rule as backend-contract conflicts). Backend contract > blueprint > task text.
10. Everything here derives from the Admin System documentation (13 modules). When the product doc changes, blueprint changes in the same commit.
