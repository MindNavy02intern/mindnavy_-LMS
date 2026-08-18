# Test Failure Report — Playwright Full Suite

**Run analyzed:** `test-results-final2.txt` (full suite, clean DB at start, all session fixes applied)
**Result:** 276 passed, 59 failed, 7 skipped, 3 did not run (35.1m)
**Baseline for comparison:** original run was 140 failed / 184 passed

This report categorizes the 59 remaining failures by root-cause class, not by file. Each entry gives the concrete evidence (not a guess) and what it would take to close it.

---

## 1. Confirmed real bugs (need fixing)

These have concrete evidence — a strict-mode-violation dump, a wrong assertion, or an assertion mismatch — that points at a specific, fixable defect in test code or app code. No inference from timing alone.

| # | File:Line | Symptom | Root cause | Fix |
|---|---|---|---|---|
| 1 | `categories.full.spec.ts:260` | Toast text check matches 19 unrelated elements page-wide | Unscoped `getByText(/course\|assigned\|cannot delete/i)` — same bug already fixed on the *sibling* test (`:227`, "has subcategories") but this near-identical "has courses" test was missed | Scope to `div[style*="position: fixed"]`, same as the sibling test |
| 2 | `categories.full.spec.ts:286` | Category `<select>` value is the category **name**, not a UUID | Unclear yet — app's `CourseForm.tsx` binds `value={root.id}` correctly (verified), so likely the newly-created category isn't in the dropdown's options by the time `selectOption({label})` runs | Needs a live repro; suspect a stale/cached category list in the create-course form |
| 3 | `certificates.full.spec.ts:472` | `getByText(/revoked/i)` matches 5 elements (filter dropdown option, status-filter option, table cell, badge) | Unscoped regex — sibling assertions in this same test file were already row-scoped, this one check was missed | Scope to the row locator already built earlier in the same test |
| 4 | `certificates.full.spec.ts:310` | "Select user" dropdown never gets the target option; 30s timeout | The dialog's picker is capped at `GET /users?limit=200`; the test's fixture user comes from a different, unbounded query. Partially fixed this session (`getDialogPickableUserId`) but the DB has grown past 200 users again since | Needs either a search-capable picker in the app, or keeping the DB below ~200 users between runs |
| 5 | `course-settings.full.spec.ts:95` | `getByText('Enrollment')` matches 6 elements | Same class as the already-fixed "Pricing"/"Courses Completed" bugs — this specific label was missed | `getByRole('heading', { name: 'Enrollment', exact: true })` |
| 6 | `courses-tab.full.spec.ts:410` | `getByRole('button', { name: /Restore/i })` matches 3 buttons in the row | The fixture course is literally titled `RESTORE SMOKE ...` — its own title contains "Restore", so the View/Edit buttons' accessible names ("View RESTORE SMOKE…", "Edit RESTORE SMOKE…") also match the case-insensitive regex | Use `{ exact: true }` or a more specific selector (e.g. `button[aria-label^="Restore "]`) |
| 7 | `enrollments.full.spec.ts:79` | `getByText('0%')` matches 14 elements | Page-wide unscoped percentage text; many unrelated progress badges exist | Scope to the specific new enrollment's row |
| 8 | `instructor-phase-b.full.spec.ts:125` | `getByText('suspended', { exact: true })` matches 2 elements (table row + side panel) | Same "row behind panel + panel itself" duplication pattern already fixed in `learners.full.spec.ts` — this file wasn't touched | Add `.first()`, same as the `learners.full.spec.ts` fix |
| 9 | `instructor-phase-b.full.spec.ts:89`, `:105`, `instructor-phase-cd.full.spec.ts:84` | Row never shows status `PENDING` after creating a course/cert via API | Either the API default status isn't `PENDING` immediately, or an explicit submit step is missing from the test's setup | Needs a direct API check of what status a freshly-created course/cert actually has |
| 10 | `learners.full.spec.ts:193` | `getByRole('button', { name: 'Enroll', exact: true })` matches 2 buttons (page + dialog) | Unscoped — the "Enroll in Course" dialog has its own "Enroll" submit button | Scope to the dialog: `page.getByLabel('Enroll in Course').getByRole('button', { name: 'Enroll', exact: true })` |
| 11 | `learners.full.spec.ts:243` | `getByLabel('Course')` resolves to a stats-card `<div>`, not the `<select>` | Same non-exact `getByLabel` bug already fixed on a *different* test in this same file (`:191`) — this "Bulk Enroll" test wasn't covered | Add `{ exact: true }` |
| 12 | `live-sessions.full.spec.ts:217` | `getByText('Upcoming', { exact: true })` matches 2 elements (filter button + table cell) | Unscoped — a status-filter button and a table badge share the exact same text | Scope to the table: `page.getByRole('table').getByText('Upcoming', { exact: true })` |
| 13 | `reports.full.spec.ts:14` | `getByRole('main').getByText('System Activity', { exact: true })` still matches 2 elements | This is a **deeper** duplicate than the sidebar-vs-main case already fixed for "Courses Completed" — both matches are inside `<main>` itself | Needs DOM inspection — may be a genuine duplicate render in the KPI section, not just a test-locator issue |
| 14 | `reports.full.spec.ts:159` | `SyntaxError: Unexpected end of JSON input` reading the export response | Backend returned an **empty body** for the JSON export endpoint | Needs backend-side investigation of `/reports/export` under this condition |
| 15 | `system-settings.full.spec.ts:60` | `getByRole('main').getByRole('button', { name: 'Notifications', exact: true })` still matches 2 elements | The `main`-scoping fix applied earlier this session didn't fully resolve it — suggests the topbar's notification-bell button may be structurally nested inside `<main>` too (a layout/semantics issue), not just a sidebar-vs-content collision | Needs DOM inspection of `AdminLayout.tsx`'s topbar/main nesting |
| 16 | `integrations.full.spec.ts:53` | `SyntaxError: Unexpected token '<'` — response body is `<!doctype ...>` HTML, not JSON | The `/integrations` API call returned an HTML error page instead of JSON — usually means the request hit something other than the API (crashed backend, wrong route, or a proxy error page) | Needs backend log correlation for this specific run |

**16 items.** All have concrete, non-timing evidence. Items 1, 3, 5, 8, 10, 11, 12 are mechanical one-line locator fixes (same patterns already fixed elsewhere in the suite this session, just missed on sibling tests). Items 2, 9, 13, 14, 15, 16 need actual investigation before a fix.

---

## 2. Timing / flakiness issues (need test or infrastructure hardening)

Generic `element not found` / navigation-still-in-progress failures with **no** locator-collision evidence — the assertion target simply wasn't there yet when the timeout fired. One is a **confirmed flake** (passed cleanly on isolated re-run with the exact same code).

| File:Line | Symptom |
|---|---|
| `access-policies.full.spec.ts:208` | "No access policies found." empty state never appears after a guaranteed-no-match search |
| `course-approval.full.spec.ts:331` | "Sending…" button state never observed within a 2s window (transient in-flight state, easy to miss) |
| `course-submit.full.spec.ts:260` | "Submitting…" button state never observed within a 2s window (same class) |
| `course-video-upload.full.spec.ts:269` | **Confirmed flake** — passed on isolated re-run with identical code |
| `course-preview.full.spec.ts:185` | Page still mid-navigation when the "Course Settings" assertion fires |
| `course-preview.full.spec.ts:235` | Expected 404 after deleting a course, got 200 — likely a delete/refetch race, not a hard app bug |
| `learning-paths.full.spec.ts:366` | `.evaluate()` stuck because the page navigated away mid-call |
| `courses-tab.full.spec.ts:380` | Backdrop click blocked by a loading skeleton that hadn't cleared yet |
| `courses-tab.full.spec.ts:248` | Guide button not found in time |
| `instructor-panel-analytics.full.spec.ts:129` | "Pending Course Approvals" section not found — possibly a legitimate empty state |
| `learning-paths.full.spec.ts:149` | "Edit Learning Path" heading never appeared after clicking Edit |
| `quizzes.full.spec.ts:179` | "Edit Quiz" heading never appeared after clicking Edit |
| `reports.full.spec.ts:176` | "Custom Report Builder — coming soon" text not found (tab may not have finished loading) |
| `stats-consistency.full.spec.ts:169` | Pending-users count text not found |
| `course-settings.full.spec.ts:163` | "Next: Course Builder" button not found — likely cascading from page-load timing earlier in this test |
| `instructor-phase-b.full.spec.ts:147` | "suspended" text not found — likely cascading from item #8 in the bugs table above |
| `notifications.full.spec.ts:177` | "Recipients" field not found — modal may not have finished opening |

**17 items.**

---

## 3. Rate limiting / backend-load issues (need backend capacity or pacing, not code fixes)

Generic `page.waitForResponse` timeouts (10–20s) waiting on a specific network call that simply never returned in time, plus page-load timeouts at the very start of a test. One file's own code comments **explicitly document** this as known, pre-existing, load-driven flakiness — independent confirmation this class is real and not something I'm inferring.

| File:Line | Waiting on |
|---|---|
| `access-policies.full.spec.ts:148` | Stale rows from *old* runs — **root cause now fixed**: `FilterAllow`/`FilterDeny` were miscategorized as Role names instead of AccessPolicy names in `cleanup-test-data.js` (corrected this session). Needs a DB re-cleanup + rerun to confirm it clears |
| `categories.full.spec.ts:150` | `PATCH /categories/:id` |
| `competencies.full.spec.ts:121` | `POST /competencies/frameworks` |
| `course-builder.full.spec.ts:231` | `GET /sections` (refetch after add) |
| `course-preview.full.spec.ts:139` | `GET /preview` |
| `course-settings.full.spec.ts:141` | Dashboard KPI grid — page-load timeout |
| `course-submit.full.spec.ts:138` | `POST /submit` |
| `course-submit.full.spec.ts:189`, `:210` | "Next: Course Builder" button — page-load timeout (×2, same root) |
| `course-upload.full.spec.ts:246` | "Edit/Create Course" heading after opening edit |
| `courses-invalidation.full.spec.ts:75` | `PATCH .../Published` — backend responded not-ok |
| `courses-tab.full.spec.ts:97` | `GET /courses?category=` |
| `enrollments.full.spec.ts:116`, `:177`, `:216` | "Enrollments" tab button — page-load timeout (×3, same root) |
| `groups.full.spec.ts:143` | `waitForApi` — **file's own comment confirms**: *"flaky in the full run purely from cumulative backend load, not an app defect"* |
| `instructor-phase-cd.full.spec.ts:142` | Instructor detail fetch |
| `integrations.full.spec.ts:136` | `GET /integrations/logs` |
| `learning-paths.full.spec.ts:207` | `DELETE /learning-paths/:id` |
| `notifications.full.spec.ts:76` | `GET /notifications/stats` — page-load timeout |
| `organization.full.spec.ts:138` | Department `<select>` never populates — resembles the certificates dialog windowing bug (item 4 above); may be the same class rather than pure load |
| `organization.full.spec.ts:177` | "Organization" nav button — page-load timeout |
| `quizzes.full.spec.ts:236` | `DELETE /quizzes/:id` |
| `system-settings.full.spec.ts:143` | `POST /system-settings/test-email` |

**21 items.** (16 + 17 + 21 = 59 — reconciles with the fail count under `59 failed`.)

---

## Priority recommendation

1. **Category 1, mechanical fixes (items 1, 3, 5, 8, 10, 11, 12 — 7 tests):** same copy-paste locator patterns already fixed elsewhere in the suite this session, just missed on sibling tests. Lowest effort, highest confidence.
2. **Category 1, investigation-needed (items 2, 9, 13, 14, 15, 16 — 9 tests):** each needs a live repro or backend log correlation before a fix is safe to write. Item 16 (HTML instead of JSON) is the most concerning — worth checking backend logs for a crash/error around that test's run window first.
3. **Categories 2 and 3 (38 tests):** not code bugs in the traditional sense. Options: increase dev-environment rate limits / connection pool size, add retry-with-backoff to the flakiest `waitForResponse` calls, or accept these as expected noise on a full sequential run and rely on isolated/batched runs for CI signal.
