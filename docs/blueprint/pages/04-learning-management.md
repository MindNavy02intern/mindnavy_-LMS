# 04 · Learning Management — `/learning-management`
Doc: LMS §1–§18 · Entities: COURSE (IMPACT §5.4), CERTIFICATE (§5.8), STUDENT/ENROLLMENT (§5.2) · Status: `[partial]` — `LearningManagementPage.tsx` `[built]`; tabs are URL-driven via `useTabParam` (default `?tab=overview`). Overview tab `[built]` (`?tab=overview` — KPI cards, distribution donut, progress chart, top courses, courses table, activities, live sessions — wired to real backend via `lmApi.ts`); Courses tab `[built]` (`?tab=courses` — list + status filters + CRUD basic info + archive + Phase 1 thumbnail upload, via `coursesApi.ts`). Thumbnail upload `[built]` 2026-07-05: `ThumbnailUpload.tsx` replaces the old URL text input in `CourseForm.tsx`; uses sign → XHR PUT → confirm pipeline (`uploadsApi.ts`). LmGuide "Create New Course" button `[built]` 2026-07-11: wired to switch to Courses tab and open create form via `openCreateOnMount` prop on `CoursesTab`; other 4 guide buttons disabled (coming soon). Video lesson upload `[built]` 2026-07-11: `VideoUpload.tsx` added to Course Builder lesson form; MIME allowlist mp4/webm/mov, 50 MB client cap, sign → XHR PUT → confirm pipeline (kind=`video`), lessonId required for confirm (create-mode shows disabled state), Cancel mid-upload, `invalidateFor('lesson.update')` after confirm. Remaining 7 tabs `[planned]`.

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
Components: courses→`['courses']`, quizzes, certificates, assignments, live sessions. Config: order, completion rules, prerequisites, deadlines, skill mapping→`['competencies']` (file 07).
Mutations: `learningPath.create` / `learningPath.update` / `learningPath.delete` (→ §5.4 path row).

## Tab: Quizzes & Exams (`?tab=quizzes`) — `['quizzes', courseId?]` (doc §8)
Question types: MCQ, true/false, essay, matching, multi-select, fill-in-blank. Settings: passing grade, attempts, time limit, random questions, auto grading, manual review.
Mutations: `quiz.create` / `quiz.update` / `quiz.delete` (local: `['quizzes',courseId]` + `['courses', courseId]`).

## Tab: Certificates (`?tab=certificates`) — `['certificates']` (doc §9)
Builder: templates, dynamic user data, QR verification, auto generation, PDF download, share.
Trigger rules: course completion · passing grade · path completion · session attendance → fire `certificate.issue` (→ IMPACT §5.8).
Mutations: `certificateTemplate.create/update` (local: `['certificate-templates']`) · `certificate.issue` / `certificate.revoke` / `certificate.reissue` (→ §5.8).

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
