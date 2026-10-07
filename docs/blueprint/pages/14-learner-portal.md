# 14 · Learner Portal (`/learn/*`) — `[planned]`

> **Not part of the admin sidebar.** This is a separate, self-service app for learners (AppUser
> `role = LEARNER`), built the same way as the Instructor portal (`/instructor/*`).
> Terminology rule (LEARNERS_CONTRACT): **"Learner" everywhere — never "Student".**
> Spec agreed 2026-10-07. Nothing below is built yet — every marker is `[planned]` until the code lands.

**Decisions:** full scope (core learning, paths & live sessions, communication, catalog & skills,
payments & subscriptions, assignments, discussions/Q&A — gamification `[phase-later]`) ·
**English + Arabic with full RTL** · **desktop-first**, responsive.

**Why it matters:** many admin features already exist but have no real user driving them — auto
certificates (`certificateTriggers.service`), quiz grading, attendance, refunds, announcements to
learners. The portal is what finally makes them fire (see `DEFERRED_ITEMS.md`, "needs student app").

---

## 0. Prerequisites (nothing works without these)

| # | Prerequisite | Status | Notes |
|---|---|---|---|
| P1 | Learner authentication | `[planned]` | `requireLearnerAuth` (copy of `instructorAuth.middleware.js` with role `LEARNER`, sets `req.learner`); routes `/api/learner/auth/{login,me,logout,password}`; token key `mn_learner_token`. Inherits all security hardening: hashed tokens, lockout + inactivity timeout from System Settings, central cache-clear on suspend (`config/prisma.js`). |
| P2 | Account onboarding | `[planned]` | Forgot/reset password by email, accept invitation → set password, optional self-signup honoring `SystemSettings.registrationMode` / `allowedEmailDomains` / `emailVerificationRequired`. Needs working SMTP. |
| P3 | Enrollment guard | `[planned]` | `assertEnrolled(courseId, userId)` in `utils/ownershipGuard.js` — every course/lesson/quiz read for a learner goes through it. |
| P4 | Lesson progress | `[planned]` | **New model `LessonProgress`** (userId, lessonId, completedAt, lastPositionSec). Server recomputes `CourseEnrollment.progress/status` (contract: progress is learner-derived; admins can't write it). |
| P5 | i18n + RTL | `[planned]` | **react-i18next** (new dependency), `locales/en.json` + `locales/ar.json`, `<html dir lang>` switch, CSS logical properties, Arabic web font. Default language from `SystemSettings.defaultLanguage`. |

**Security rules for every learner endpoint:** use `req.learner.id` only (never a user id from the
client — spread forced values last, like `instructorNotifications.controller.js`); non-enrolled → 404;
quiz answer keys never in learner responses (QUIZZES_CONTRACT); live-session `startUrl` never exposed
(LIVE_SESSIONS_CONTRACT); learner A can never read learner B's data.

---

## 1. Layout (shell)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│  [Logo]      │  🔍 Search courses…        [EN|ع]  🔔3  ✉2  (Avatar ▾)   │
│  Learner     ├──────────────────────────────────────────────────────────┤
│  Portal      │   Page title                       [primary action]      │
│ ─────────    │   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│ 🏠 Home      │   │ KPI    │ │ KPI    │ │ KPI    │ │ KPI    │            │
│ 🧭 Explore   │   └────────┘ └────────┘ └────────┘ └────────┘            │
│ 📚 My Learning│                                                         │
│ 🛤 Paths     │   Main content (cards / tables / player)                 │
│ 📅 Live      │                                                          │
│ 📝 Assignments│                                                         │
│ 🏅 Certificates│                                                        │
│ 🎯 Skills    │                                                          │
│ 💬 Discussions│                                                         │
│ ✉ Inbox      │                                                          │
│ 💳 Billing   │                                                          │
│ ❓ Help      │                                                          │
│ ⚙ Settings  │                                                          │
│ ⏻ Sign out   │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

- Same visual family as admin/instructor (dark sidebar `mn-sidebar`, light content `mn-main mn-main-light`,
  Inter, brand color via `lib/theme.ts`) but learning-focused: large course cards, progress rings,
  a clear **Continue learning** call to action.
- **RTL (Arabic):** whole layout mirrors — sidebar on the right, chevrons flipped, progress fills
  right→left. One stylesheet for both directions (logical properties, no hard-coded left/right).
- Desktop-first; sidebar collapses to a drawer under ~1024px.
- Topbar: search (→ Explore), language toggle EN/ع, notifications bell + messages dropdown (same shape
  as `InstructorLayout.tsx`), avatar menu (Profile, Settings, Sign out).
- **Every page:** loading skeleton · empty state with a helpful action · error banner with retry ·
  EN and AR versions.

---

## 2. Navigation registry

| # | Item | Route | Section |
|---|---|---|---|
| — | Login / Forgot / Reset / Accept invite / Sign up | `/learn/login`, `/learn/forgot-password`, `/learn/reset-password`, `/learn/accept-invite`, `/learn/signup` | §3.0 |
| 1 | Home | `/learn` | §3.1 |
| 2 | Explore | `/learn/catalog`, `/learn/catalog/:id` | §3.2 |
| 3 | My Learning | `/learn/courses`, `/learn/courses/:id` (player) | §3.3 |
| 4 | Learning Paths | `/learn/paths`, `/learn/paths/:id` | §3.5 |
| 5 | Live Sessions | `/learn/live` | §3.6 |
| 6 | Assignments | `/learn/assignments`, `/learn/assignments/:id` | §3.7 |
| 7 | Certificates | `/learn/certificates` | §3.8 |
| 8 | Skills | `/learn/skills` | §3.12 |
| 9 | Discussions | `/learn/discussions` | §3.9 |
| 10 | Inbox (Messages & Notifications) | `/learn/inbox?tab=` | §3.10 |
| 11 | Billing | `/learn/billing?tab=` | §3.11 |
| 12 | Help | `/learn/help` | §3.13 |
| 13 | Profile & Settings | `/learn/settings?tab=` | §3.14 |

Routes are proposals — verify against `App.tsx` when built and correct this table.

---

## 3. Pages

Backend status per item: **[EXISTS]** ready · **[REUSE]** service exists, needs a learner route +
ownership check · **[NEW]** new endpoint · **[NEW MODEL]** new table (`npx prisma db push` — Hassan runs it).
Mutation IDs below are proposals; reconcile with `src/lib/invalidation.ts` `MutationName` and add the
IMPACT_MAP §5 rows **before** implementing (several revive the dead §5.2 rows: `progress.update`,
`course.complete`, `quiz.submit`, `assignment.submit`, `attendance.record`; and §5.14 `ticket.create`).

### 3.0 Auth pages `[planned]`

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Sign in | mut | `learner.auth.login` | local: session (backend: LoginAttempt + AuditLog) |
| Forgot password → send code | mut | `learner.auth.forgot` | — |
| Reset password | mut | `learner.auth.reset` | local: session |
| Accept invitation → set password | mut | `invitation.accept` | IMPACT row to add (invitations list, user status) |
| Sign up (only if registrationMode ≠ INVITE_ONLY) | mut | `learner.signup` | IMPACT row to add (users list, dashboard stats) |

Backend: all **[NEW]** (P1/P2).

### 3.1 Home (dashboard) `[planned]`

```
 Welcome back, Sara 👋                                   [Continue learning ▸]
 ┌ In progress 3 ┐┌ Completed 5 ┐┌ Certificates 4 ┐┌ Learning hours 26h ┐
 ┌─ Continue where you left off ──────────────┐ ┌─ Up next ─────────────────┐
 │ [thumb] React Basics  · Lesson 7 of 12     │ │ 📅 Live: Q&A  Tue 18:00 [Join]│
 │ ███████░░░ 62%                 [Resume ▸]  │ │ 📝 Assignment due in 2 days  │
 └────────────────────────────────────────────┘ │ 🧪 Quiz: Module 3            │
 ┌─ My courses (cards w/ progress) ───────────┐ └──────────────────────────────┘
 ┌─ Announcements ─┐ ┌─ Recommended courses ─┐ ┌─ Weekly activity chart ─┐
```

- KPIs: in progress · completed · certificates · learning hours — **[NEW]** `GET /api/learner/dashboard`
  (aggregate of CourseEnrollment, Certificate, LessonProgress — one call, computed server-side).
- Continue card = most recent `LessonProgress` (P4). Up next = upcoming live sessions + assignment due
  dates + pending quizzes. Announcements: `Announcement` audience LEARNERS **[REUSE]**.
- Recommended = courses mapped to the learner's skill gaps (`SkillCourseMapping`) or newest in category.
- Empty: "Start your first course" → Explore.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Continue learning / Resume | nav | — | — |
| Join live session | nav (external `joinUrl`) | — | — |
| Open announcement | read | `notification.read` | IMPACT row to add (bell count) |

### 3.2 Explore (catalog + course detail) `[planned]`

- Search · filters: category (source `['categories']`), level, language, free/paid, duration · sort:
  newest / popular / rating.
- Course card: thumbnail, title, instructor, level, duration, rating, price or **Free**, "Enrolled ✓".
- **Course detail:** hero (title, subtitle, instructor, rating, learners count) · what you'll learn ·
  curriculum (sections → lessons, 🔒 for not-enrolled) · instructor card · reviews ·
  side box: price + **Enroll** / **Buy** / **Go to course**.
- Only `status=PUBLISHED` and `visibility=PUBLIC`; respect `enrollmentLimit`. Never expose drafts,
  answer keys, other learners' data.
- Backend: **[NEW]** catalog list/detail (learner-safe fields) · **[NEW]** self-enroll reusing
  `enrollments.service.createEnrollment` (fires `COURSE_ENROLLMENT` automation). Paid → §3.11.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Enroll (free) | mut | `enrollment.self` | IMPACT row to add (enrollments, course counts, dashboard stats, learner profile) |
| Buy (paid) | mut | `payment.checkout` | `[phase-later]` — needs gateway |

### 3.3 My Learning + Course player `[planned]` — the core of the portal

- List tabs (`?tab=`): In progress · Not started · Completed · Overdue — progress bar + last activity.

```
 ┌ ◂ React Basics ──────────── 62% ████████░░░ ───────────── [Notes] [Q&A] ┐
 │ Curriculum (collapsible)   │                                             │
 │ ▾ 1 Getting started        │      ▶  VIDEO / TEXT LESSON                 │
 │   ✓ 1.1 Intro      4m      │                                             │
 │   ✓ 1.2 Setup      9m      │  Lesson 1.3 — JSX                            │
 │   ● 1.3 JSX        12m     │  description · resources · attachments      │
 │   🔒 1.4 Props (drip)      │                                             │
 │ ▸ 2 Components             │                                             │
 │   🧪 Quiz: Module 1        │  [◂ Previous]   [Mark complete ✓]   [Next ▸] │
 └────────────────────────────┴─────────────────────────────────────────────┘
```

- Lesson types today: `TEXT`, `VIDEO_URL` (+ content-library files). Video resumes at last position.
- Server-enforced: drip content, `accessRules`, enrollment `startDate`/`expiryDate`.
- Reaching 100% → enrollment COMPLETED → existing `certificateTriggers.onEnrollmentCompleted` issues
  the certificate automatically.
- Backend: **[NEW]** `GET /api/learner/courses/:id/content` (P3) · **[NEW]** lesson progress (P4).

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Mark complete / auto-complete on video end | mut | `progress.update` | revive IMPACT §5.2 (enrollment progress, dashboards, instructor students page) |
| Course reaches 100% | mut (server) | `course.complete` | revive IMPACT §5.2 (+ certificate issued, completion stats) |
| Rate course (after completion) | mut | `review.create` | IMPACT row to add (instructor reviews, rating) |

### 3.4 Quizzes & exams `[planned]` (inside courses and learning paths)

```
 Quiz: Module 1   ⏱ 14:32 left        Question 3 / 10   ●●●○○○○○○○
 What does JSX compile to?
   ○ HTML   ● React.createElement calls   ○ CSS   ○ JSON
 [◂ Back]                                   [Flag]  [Next ▸]   [Submit quiz]
```

- Start screen: questions, time limit, attempts left, passing grade. Result: score, pass/fail,
  per-question review (if allowed), retake.
- Types already modeled: multiple choice, true/false, multi-select, fill-in-blank, matching, essay.
- Backend: **[NEW]** start / questions **without answers** / submit / result; enforce `attemptsAllowed`,
  `timeLimit`, `randomizeQuestions`; auto-grade objective types; essays → instructor/admin grading
  (existing grade flow). **[NEW MODEL]** answer storage (`QuizAttempt` has none today). Pass → existing
  `onQuizGraded` trigger.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Start attempt | mut | `quiz.start` | IMPACT row to add |
| Submit | mut | `quiz.submit` | revive IMPACT §5.2 (assessments, grading queue, certificates) |

### 3.5 Learning Paths `[planned]`

- Path cards with % complete. Detail: ordered steps (course / live session / quiz), locked when
  `sequential = true`, **Start next step**, path certificate.
- Backend: **[NEW]** my paths + progress via existing `certificateTriggers.isItemComplete()` ·
  **[NEW MODEL]** path enrollment/assignment (nothing links a learner to a path today).

### 3.6 Live Sessions `[planned]`

- Tabs: Upcoming (calendar + list) · Past (attendance status).
- **Join** enabled ~10 min before start → `joinUrl` only, **never** `startUrl`. Add to calendar (.ics).
- Backend: **[NEW]** my sessions (sessions of enrolled courses — query exists in
  `liveSessions.service.js` ~l.98) · **[NEW]** self check-in → `SessionAttendance`.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Join / check in | mut | `attendance.record` | revive IMPACT §5.2 (attendance, instructor session page, path progress) |

### 3.7 Assignments `[planned]`

- List tabs: To do · Submitted · Graded (course, due date, status, grade).
- Detail: instructions, attachments, due date, upload file and/or text answer, submit, resubmit (if
  allowed), grade + instructor feedback.
- Backend: **[NEW MODEL]** `Assignment` (courseId, title, instructions, dueAt, maxScore, allowResubmit)
  + `AssignmentSubmission` (userId, files, text, submittedAt, score, feedback, gradedById). Files via
  the private-bucket sign → PUT → confirm flow (`learnerDocuments.service.js`). Needs instructor + admin
  authoring/grading screens too. Unlocks the existing `ASSIGNMENT_DEADLINE` automation.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Submit / resubmit | mut | `assignment.submit` | revive IMPACT §5.2 (instructor grading queue, progress) |

### 3.8 Certificates `[planned]`

- Grid: course, issue date, expiry · **Download PDF** · **Copy verify link** · share to LinkedIn.
- Backend: **[REUSE]** `certificates.service.getCertificateForPdf` + ownership check · public verify
  `GET /api/public/certificates/verify/:code` **[EXISTS]**.

### 3.9 Discussions / Q&A `[planned]`

- Course player Q&A tab per lesson: ask, upvote, "Instructor answered" badge. `/learn/discussions`: my
  threads across courses, unread replies.
- Backend: **[NEW MODEL]** `DiscussionThread` (courseId, lessonId?, authorId, title, body, resolved) +
  `DiscussionPost` (threadId, authorId, body, isInstructorAnswer) + instructor/admin moderation.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Ask question | mut | `discussion.create` | IMPACT row to add (instructor notifications) |
| Reply | mut | `discussion.reply` | IMPACT row to add |

### 3.10 Inbox — Messages & Notifications `[planned]`

- Tabs: Notifications (filters, mark read, mark all) · Messages (threads with admin/instructor, reply) ·
  Announcements. Same panels in the topbar.
- Backend: **[REUSE]** `notifications.service` (IN_APP by `userId`) and `messages.service`
  (`getMyMessageThread`, `createReply`, `markMyMessageRead` already take a user id;
  `startMyMessageThread` needs generic wording first).

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Mark notification(s) read | mut | `notification.read` | IMPACT row to add (bell count) |
| Reply to message | mut | `message.reply` | IMPACT row to add (admin message thread) |

### 3.11 Billing — Payments & Subscriptions `[planned]`

- Tabs: Plan (status, renewal, cancel) · Payments · Invoices (PDF) · Refund request.
- Backend: **[REUSE]** finance models keyed by `userId` + `invoicePdf.service` · **[NEW]** learner-scoped
  reads. **No payment gateway** → v1 is view-only + free enrollments; checkout `[phase-later]`.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Request refund | mut | `refund.request` | IMPACT row to add (finance refunds queue) |
| Cancel subscription | mut | `subscription.cancel` | IMPACT row to add (finance, dashboard revenue) |

### 3.12 Skills `[planned]`

- Skill profile (level/proficiency), gaps vs framework required levels, recommended courses per gap,
  competency certifications.
- Backend: **[REUSE]** `UserSkillProfile`, `CompetencyFramework`/`FrameworkSkill`,
  `SkillCourseMapping`, `CompetencyCertification` — learner read endpoints **[NEW]**.

### 3.13 Help — Support tickets `[planned]`

- My tickets, new ticket (category, priority, message), conversation thread.
- Backend: **[REUSE]** `SupportTicket` + `TicketMessage` · **[NEW]** learner create/list/reply.

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Open ticket | mut | `ticket.create` | revive IMPACT §5.14 (admin tickets queue) |
| Reply | mut | `ticket.reply` | IMPACT row to add |

### 3.14 Profile & Settings `[planned]`

- Tabs: Profile (name, avatar, phone) · Password · Language (EN/ع) · Notification preferences
  (`UserNotificationPreference` **[REUSE]**) · Sessions & devices (copy `instructorSessions` pattern).

| Action / button | Kind | Mutation ID | Impact |
|---|---|---|---|
| Save profile | mut | `learner.profile.update` | IMPACT row to add (admin learner detail) |
| Change password | mut | `learner.password.change` | local: session |
| Save notification preferences | mut | `learner.preferences.update` | local |
| Revoke a session | mut | `learner.session.revoke` | local |

---

## 4. Backend gap list (ranked)

| Priority | Item |
|---|---|
| CRITICAL | P1–P2 learner auth + onboarding |
| CRITICAL | P3–P4 course content + enrollment guard + LessonProgress + auto completion |
| CRITICAL | Quiz runtime (answer-stripped, submit, auto-grade, limits, answer storage) |
| HIGH | Catalog + free self-enroll · certificates list/PDF · live sessions + check-in · dashboard aggregate |
| HIGH | Notifications / messages / announcements learner routes (services exist) |
| MEDIUM | Assignments (2 models + 3 UIs) · Discussions (2 models + moderation) |
| MEDIUM | Path enrollment + progress · tickets · skills reads · billing reads · course reviews |
| LATER | Payment gateway checkout · Zoom attendance webhook · notes/bookmarks · gamification `[phase-later]` |

## 5. Reuse map (mirror the instructor portal)

- **Backend:** `instructorAuth.{routes,controller,service}.js` + `instructorAuth.middleware.js` →
  learner copies · `utils/{token,clientIp,ownershipGuard,selfScope}.js` · `settings.service.getSecurityPolicy`
  · rate limiters · `enrollments`, `certificates`, `certificateTriggers`, `notifications`, `messages`,
  `liveSessions` services.
- **Frontend:** `InstructorAuthContext` / `InstructorProtectedRoute` / `InstructorLayout` → learner
  versions · `src/api/instructor*Api.ts` pattern (`fetchWithRetry`, typed error class) ·
  `instructorUiKit.ts` → `learnerUiKit.ts` · recharts · `components/users/Toast.tsx` ·
  `components/ui/LoadingSpinner.tsx` · `.mn-skeleton` · `types/quizzes.ts` · `PublicVerifyPage.tsx`.
- **Build once, share:** `ProgressBar`, `CourseCard`, `VideoPlayer` (today duplicated / inline `<video>`).

## 6. Build phases

1. **Foundation** — P1, P2, P5 · Learner layout (EN/AR, RTL) · Profile & Settings · Home (basic KPIs).
2. **Learn** — Explore + detail + free enroll · My Learning · Course player · P3, P4 · auto-completion →
   certificate · Certificates page.
3. **Assess** — Quiz runtime + essay grading hook.
4. **Schedule** — Live sessions (join/check-in) · Learning paths.
5. **Communicate** — Inbox (notifications, messages, announcements) · Help tickets.
6. **Collaborate** — Assignments (learner + instructor + admin) · Discussions/Q&A.
7. **Grow & pay** — Skills · course reviews · Billing (view-only until a gateway is chosen).

Each phase ships with: endpoint contract in `backend/contact md files/LEARNER_PORTAL_CONTRACT.md`,
IMPACT_MAP + INVALIDATION_MAP rows, a smoke-test script, a Playwright `*.full.spec.ts` (Hassan runs
them), and these status markers flipped to `[built]`/`[partial]`.

## 7. Open decisions

1. **How learners get accounts:** admin-created/invite only (today) vs open self-signup vs approval.
2. **Arabic for course content:** UI only (recommended for v1) vs instructor-provided AR versions.
3. **Payments:** view-only + free courses in v1, or choose a gateway (Stripe / local) now.
4. **URL:** same app under `/learn/*` (recommended) vs separate subdomain later.
