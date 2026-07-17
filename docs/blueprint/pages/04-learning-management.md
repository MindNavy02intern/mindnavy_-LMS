# 04 · Learning Management — `/learning-management`
Doc: LMS §1–§18 · Entities: COURSE (IMPACT §5.4), CERTIFICATE (§5.8), STUDENT/ENROLLMENT (§5.2) · Status: `[partial]` — `LearningManagementPage.tsx` `[built]`; tabs are URL-driven via `useTabParam` (default `?tab=overview`). Overview tab `[built]` (`?tab=overview` — KPI cards, distribution donut, progress chart, top courses, courses table, activities, live sessions — wired to real backend via `lmApi.ts`); Courses tab `[built]` (`?tab=courses` — list + status filters + CRUD basic info + archive + Phase 1 thumbnail upload, via `coursesApi.ts`). Thumbnail upload `[built]` 2026-07-05: `ThumbnailUpload.tsx` replaces the old URL text input in `CourseForm.tsx`; uses sign → XHR PUT → confirm pipeline (`uploadsApi.ts`). LmGuide "Create New Course" button `[built]` 2026-07-11: wired to switch to Courses tab and open create form via `openCreateOnMount` prop on `CoursesTab`; other 4 guide buttons disabled (coming soon). Course quick-view modal `[built]` 2026-07-14: eye icon in Courses table row opens `CourseQuickViewModal.tsx` (GET /courses/:id/preview, read-only, all statuses); Escape/X/backdrop all close; `LessonRow` exported from `CoursePreview.tsx` for reuse. Video lesson upload `[built]` 2026-07-11: `VideoUpload.tsx` added to Course Builder lesson form; MIME allowlist mp4/webm/mov, 50 MB client cap, sign → XHR PUT → confirm pipeline (kind=`video`), lessonId required for confirm (create-mode shows disabled state), Cancel mid-upload, `invalidateFor('lesson.update')` after confirm. Categories tab `[built]`, Learning Paths tab `[built]` 2026-07-15, Assessments tab `[built]` 2026-07-17, Certificates tab `[built]` 2026-07-17 (see their own sections below — this summary sentence predates those and was not otherwise reconciled). Remaining tabs (Content, Enrollments, Live Sessions, Analytics) `[planned]`.

**GAP (report, do not fix silently):** actual LM_TABS in code (`Overview`, `Courses`, `Learning Paths`, `Content`, `Assessments`, `Enrollments`, `Live Sessions`, `Certificates`, `Analytics`) differ from blueprint tab names (`Categories`, `Quizzes & Exams`, `Assignments`, `Content Library`, `SCORM / Media`). URL keys used by current implementation: `overview`, `courses`, `paths`, `content`, `assessments`, `enrollments`, `live`, `certificates`, `analytics`.

## Module sections (doc §1)
Courses · Course Approval · Categories · Learning Paths · Quizzes & Exams · Certificates · Assignments · Content Library · Live Sessions · SCORM/Media

---

## Tab: Courses (`?tab=courses`) — `['courses', filters]` (doc §2)
**Status sections (filter chips):** All · Draft · Pending Review · Published · Archived · Deleted — all read the SAME `['courses',{status}]` key family; counts come from `['dashboard','course-analytics']`, never computed client-side.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Create course | nav | — | → wizard below |
| Open course | nav | — | → `/admin/learning/courses/:id` |
| Approve course | mut | `course.approve` | → IMPACT §5.4 |
| Reject course | dlg→mut | `course.reject` | → §5.4 (reason required) |
| Request changes | dlg→mut | `course.requestChanges` | → §5.4 reject row |
| Unpublish course | mut | `course.unpublish` | → §5.4 archive row semantics |
| Archive course | mut | `course.archive` | → §5.4 |
| Restore course | mut | `course.restore` | → §5.4; Archived-only; POST /courses/:id/restore; sets status=Draft `[built]` 2026-07-15 |
| Delete course | dlg→mut | `course.delete` | → §5.4 + enrollments cascade check |

## Course Creation Wizard (doc §3) — 6 steps, autosave draft = `course.createDraft`/`course.update`
1. **Basic information:** title, subtitle, description, category→`['categories']`, tags, language, difficulty, thumbnail upload.
2. **Course builder:** sections → lessons → topics → modules → learning outcomes. Lesson types: video, text, PDF, assignment, quiz, live session, SCORM, downloadable resource.
3. **Content upload:** videos, PDFs, ZIP, images, audio, attachments → backend pipeline (file validation, video encoding, virus scan, compression, verification) → job status `['uploads', jobId]`.
4. **Settings:** free/paid, pricing, enrollment limit, visibility, certificate enabled, drip content, access rules, SEO.
5. **Preview:** desktop, mobile, student experience, quiz preview, video playback test (read).
6. **Save or submit:** Save draft→`course.update` (→ §5.4 draft row) · Submit for approval→`course.submitForApproval` (→ §5.4; system validation: thumbnail, lessons, videos, quiz, description, settings).

## Approval & Admin Review (doc §4–§5)
Submit → status Pending Approval → admin notification + task → review queue → open details.
Review areas: title, lessons, videos, quizzes, assignments, resources, attachments, certificate settings, accessibility, copyright.
Decision: Approve→`course.approve` (publish, live, visible) · Reject→`course.reject` (reason, notify instructor) · Request changes→`course.requestChanges` (return to instructor). All → audit.

## Tab: Categories (`?tab=categories`) — `['categories']` (doc §6)
Structure: main categories → subcategories → tags.
Actions: `category.create` / `category.update` / `category.delete` (→ §5.4 category row) · Assign courses→`category.assignCourses` (→ §5.4) · Manage hierarchy→`category.reorder` (local: `['categories']`).

## Tab: Learning Paths (`?tab=paths`) — `['learning-paths']` (doc §7)
**Status: `[built]` 2026-07-15 — v1 (COURSE + LIVE_SESSION items only)**. `LearningPathsTab.tsx` + `learningPathsApi.ts` + types `learningPaths.ts`. List → create/edit form → detail view with items (add, remove, reorder via up/down). `sequential` toggle (path-level only — no per-item rules, no prerequisites/deadlines). `itemCount` always server-derived (never computed from items.length). `missing: true` renders as "Unavailable" row. Invalidation entries added for `learningPath.create/update/delete` and `learningPath.item.add/remove/reorder`. **v2 scope (not built):** quiz/assignment/certificate pickers, per-item completion rules, prerequisites, deadlines.
Mutations: `learningPath.create` / `learningPath.update` / `learningPath.delete` (→ §5.4 + `['dashboard','course-analytics']`) · `learningPath.item.add` / `learningPath.item.remove` / `learningPath.item.reorder` (→ `['learning-paths']`).

## Tab: Assessments (`?tab=assessments`, blueprint calls it "Quizzes & Exams") — `['quizzes', courseId?]` (doc §8)
**Status: `[built]` 2026-07-17 — v1 (4 question types only)**. `AssessmentsTab.tsx` + `quizzesApi.ts` + types `quizzes.ts`. List → create/edit form → detail view with question builder (add, edit, delete, reorder via up/down — same pattern as Learning Paths). No QUIZZES_CONTRACT.md exists in the repo; shapes were reverse-engineered from `backend/src/{routes,controllers,services,validators}/quizzes.*.js` and verified live against a running server.
**GAP (documented, not fixed):** URL key is `assessments` (matches `LM_TAB_KEYS` in code), not `quizzes` as this heading's anchor implies — same class of tab-name/URL-key mismatch already noted at the top of this file for other tabs.
Question types **v1 (built): MULTIPLE_CHOICE, TRUE_FALSE, MULTI_SELECT, ESSAY only** — matching/fill-in-blank exist in the Prisma enum for forward-compat but the backend 400s them and no editor exists for them (v2 scope). Settings: passing grade, attempts allowed (nullable = unlimited), time limit (nullable = none), randomize questions. `questionCount` (list+detail) / `totalPoints` / `autoGradable` (detail only) are always server-derived, never computed client-side (IMPACT_MAP R1/R4) — mirrors Learning Paths' `itemCount` handling: a locally-appended/removed question leaves these fields at their last-loaded value until the next real GET, rather than summing/counting them in the browser. Grading UI (attempts/submissions/manual grading) ships with the learner runtime, not here. **Not wired to the LM Overview "Content Statistics" quizzes count** — that stat has a different owner (CourseContent type=QUIZ) and intentionally excludes this table.
Mutations: `quiz.create` / `quiz.update` / `quiz.delete` (local: `['quizzes']` + `['quizzes',courseId]` + `['courses', courseId]` when the quiz is attached to a course) · `question.create` / `question.update` / `question.delete` / `question.reorder` (same invalidation set as `quiz.update` — question writes change quiz-derived counts).

## Tab: Certificates (`?tab=certificates`) — `['certificates']` + `['certificate-templates']` (doc §9)
**Status: `[built]` 2026-07-17 — v1 (manual issuance only; auto-trigger rules below are NOT wired yet)**.
`CertificatesTab.tsx` (sub-tabs: Issued Certificates / Templates) + `certificatesApi.ts` + `certificateTemplatesApi.ts` + `publicCertificatesApi.ts` + types `certificates.ts`. No CERTIFICATES_CONTRACT.md exists in the repo (checked root/docs/git history, same as Quizzes) — shapes reverse-engineered from backend source, verified live against a running server.
Builder: templates (name + layout: title/body/primaryColor/accentColor/signatureName/signatureTitle — NO logo field, v1 scope explicitly excludes it, SSRF risk deferred to the existing uploads sign→confirm flow in v2), insertable `{{studentName}}`/`{{courseTitle}}`/`{{date}}` chips in the body editor, PDF download (blob+Bearer fetch, never a plain `<a href>`), QR verification via `/verify/:code`.
**Template edit is the one PATCH in this app that does NOT diff** — `layout` REPLACES the whole object server-side (missing keys reset to defaults), so the edit form always sends the complete current layout, never just the changed fields.
`studentName`/`courseTitle` on a certificate are issue-time snapshots (rendered exactly as received, never re-joined against the live user/course record); `templateName` is NOT a snapshot — it's read live off the relation, so a template rename or delete changes what already-issued certificates display.
Trigger rules (course completion · passing grade · path completion · session attendance → fire `certificate.issue`) are a documented v2 decision, not code — v1 issuance is manual only via the "Issue Certificate" dialog, but `issueCertificate()` on the backend is already the single entry point future auto-triggers will call (→ IMPACT §5.8).
Public verify page: `/verify/:code`, standalone route (no `ProtectedRoute`, no `AdminLayout`) — `PublicVerifyPage.tsx`, mobile-first, zero auth dependency. Always renders one of three states from `data.status`: valid (✅ studentName/courseTitle/issuedAt) / revoked (⚠️, no details) / not_found (❌).
Mutations: `certificateTemplate.create` / `certificateTemplate.update` / `certificateTemplate.delete` (local: `['certificate-templates']`, `.update`/`.delete` also invalidate `['certificates']` since `templateName` is live not snapshotted) · `certificate.issue` / `certificate.revoke` / `certificate.reissue` (→ §5.8). The `certificate.reissue` + `certificateTemplate.*` mutation IDs were already named in this blueprint doc, but their IMPACT_MAP §5.8 rows and invalidation.ts entries did not actually exist yet — added in this change, not merely mirrored from a pre-existing row (flagging per the "verify before trusting a claimed pre-existing artifact" pattern from this session).

## Tab: Assignments (`?tab=assignments`) — `['assignments', courseId?]` (doc §10)
Types: file upload, essay, project, external link. Settings: deadline, max score, rubrics, peer review, instructor feedback.
Mutations: `assignment.create` / `assignment.update` / `assignment.delete` (local + `['courses',courseId]`). Student submissions → §5.2.

## Tab: Content Library (`?tab=library`) — `['content-library']` (doc §11)
Media: videos, PDFs, images, audio, documents, SCORM. Features: search, filters, tags, reusable content, versioning, folders.
Mutations: `contentLibrary.upload` (→ §5.4 content row) · `contentLibrary.update` / `.delete` / `.move` (local: `['content-library']` + any `['courses', id]` using the asset).

## Tab: Live Sessions (`?tab=live`) — `['live-sessions', filters]` (doc §12–§15)
Create form: title, description, related course→`['courses']`, instructor→`['instructors']`, date, time, duration, timezone, max participants. Providers: Zoom, Google Meet, MS Teams, built-in.
Automation (backend): meeting link, notifications, calendar sync, course timeline update.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Schedule session | dlg→mut | `liveSession.schedule` | → IMPACT §5.4 |
| Edit session | mut | `liveSession.update` | local: `['live-sessions']`, `['calendar']` |
| Start session | mut | `liveSession.start` | → §5.4 |
| End session | mut | `liveSession.end` | → §5.4; triggers recording flow |
| Recording upload (post-session) | backend | `liveSession.recording.attach` | local: `['live-sessions']`, `['courses', courseId]` |
Classroom features (video, chat, screen share, whiteboard, raise hand, polls, attendance, recording) `[phase-later]` — attendance events → §5.2 attendance row.

## Tab: SCORM / Media (`?tab=scorm`) — (doc §16)
Upload → validation (compatibility, manifest, tracking support, integrity) → `scorm.upload` (→ §5.4 content row). Tracking/progress sync feeds §5.2 progress.

## `[phase-later]` (doc §17): auto-save versioning, AI content validation, accessibility checker, copyright detection, SEO, gamification, collaborative instructors, multi-language, recommendations.
