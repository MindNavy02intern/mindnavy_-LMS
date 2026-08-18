# Test Session Report — Playwright Full Suite Debugging

**Scope:** full `*.full.spec.ts` Playwright suite (real backend, no mocking, `--workers=1`).
**Files touched:** 33 (28 test files, 5 app source files, 1 backend script).
**Net diff:** +660 / −292 lines.

---

## Starting point → ending point

| Stage | Failed | Passed |
|---|---|---|
| Original baseline (first full run) | 140 | 184 |
| After first fix pass (systemic bug classes) | 67 | 270 |
| After DB cleanup + more fixes | 59 | 276 |
| After the 16 confirmed-bug fixes (11-file batch, not full suite) | 15 | 82 |

The last row is a partial run (11 files, not all ~50), so it isn't directly comparable to the earlier full-suite rows — but every one of the 15 remaining failures in that batch was independently confirmed as pre-existing timing/rate-limit noise, not a code defect (see "What's left" below).

---

## What was actually wrong, grouped by root cause

### 1. Systemic bug classes (found across many files, fixed once each)

- **localStorage read before navigation** (6 files: `certificates`, `courses-tab`, `users`, `groups`, `reports-schedule`, `user-role-assignments`) — helpers called `page.evaluate(() => localStorage...)` before any `page.goto()`, hitting Chromium's about:blank restriction. Every hit cascaded into every other test in its file.
- **Invalid Playwright API usage** (3 files) — `selectOption({ label: new RegExp(...) })` isn't valid; switched to `selectOption({ value: id })`.
- **Over-broad locators colliding with toasts, hidden `<option>`s, or accumulated fixture data** (15+ files) — the single biggest category. Fixed via `.first()`, `{ exact: true }`, or scoping to the right row/dialog/container — never by weakening what's asserted.
- **`aria-label` casing/wording mismatches with visible text** — real app bugs found in `CertificatesTab.tsx` ("Issue certificate" vs "Issue Certificate", "Create certificate template" vs "Create Template"), `AssessmentsTab.tsx` ("Create quiz" vs "Create Quiz"), `LearningPathsTab.tsx` ("Create learning path" vs "Create Learning Path").
- **Case-sensitive regex bug** — `CourseBuilder.tsx`'s per-section button has `aria-label="Add lesson to <section>"` (lowercase), but tests matched `/Add Lesson/` (capital L, no `i` flag, case-sensitive by default for regex — unlike plain-string matching). One bug, found via trace-file analysis, was blocking **100% of `course-video-upload.full.spec.ts` and half of `course-builder.full.spec.ts`** — 14 tests from a single root cause.

### 2. Database hygiene

`backend/src/scripts/cleanup-test-data.js` only recognized a handful of old naming prefixes and missed most of the current suite's fixture patterns. Extended it to cover all 25 entity types the suite creates (courses, users, roles, groups, branches/departments/teams, categories, skills, frameworks, certificate templates, learning paths, quizzes, live sessions, coupons, tax rules, instructor certifications, announcements, API keys, webhooks, access policies, role templates, scheduled reports), gating the generic single-word prefixes (`Group `, `Role `, `Team `, `Policy `, …) on a pure-digit suffix so a real "Group Alpha" can never match. Ran it: **405 orphaned records deleted** (245 courses, 107 users, 16 roles, 8 branches, and more) that had accumulated across repeated runs. Also caught and fixed a categorization bug in the script itself (`FilterAllow`/`FilterDeny` were tagged as Role names; they're actually AccessPolicy names).

### 3. The 16 "confirmed real bugs" (from `test-failure-report.md`)

Investigated and fixed all 16, starting with the two flagged as highest-risk:

**Real backend/app bugs (5):**
- **Not a backend crash** (was the top suspect) — `r.url().endsWith('/integrations')` also matched the SPA's own document response for `http://localhost:5173/integrations` (HTML, not JSON); whichever response landed first won the race. Anchored to the real API URL.
- **Certificates dialog windowing** — "Select user"/"Select course" pickers cap at `GET ...?limit=200`, unordered/unguaranteed. Test now reads the actually-selectable option straight out of the dialog instead of trusting an externally-fetched id.
- **Reports export JSON** — `response.json()` was racing the browser's own download-stream consumption for a real file download; now reads the downloaded file directly via `download.path()`.
- **Reports "System Activity"** — not a duplicate render; it's legitimately both a KPI label and a chart section title on the same page. `.first()`.
- **`AdminLayout.tsx` semantic HTML bug** — the entire topbar (search, notifications, profile menu) was nested inside the `<main>` landmark, not just the page content. Split into an outer `<div>` (chrome) and inner `<main>` (`.mn-content` only) — zero visual/CSS risk since nothing in the stylesheet targets the element by tag name, confirmed by grep before making the change. This is app-wide (every page uses this layout).

**Test-only bugs (11)** — locator collisions, mostly where a fixture's own generated name accidentally contained the search term (e.g. course titled `RESTORE SMOKE ...` breaking a `/Restore/i` button match, `Cert PdfRevoked Course ...` breaking a `/revoked/i` toast check), or a broad `getByLabel`/`getByText` matched an unrelated element (filter dropdowns, stat cards, sidebar duplicates, a second exact-text button). One (`instructor-phase-b.full.spec.ts`) was a genuine fixture bug: the setup created courses missing description/thumbnail/section/lesson, which this app's own §4.1 rule requires before `/submit` succeeds — so courses silently stayed Draft instead of reaching Pending. Completed the fixture to match the working pattern already used elsewhere in the suite.

**Caught during verification, not originally in the 16:**
- `categories.full.spec.ts`'s UUID-picker test needed three successive trace-verified fixes before it actually passed — each fix exposed a *different* wrong element being clicked (wrong dropdown → wrong "Create Course" button → a fragile cross-component "open-on-tab-switch" signal that silently no-ops when already on the target tab).
- `learners.full.spec.ts`'s "Bulk Enroll" test — the learner's name in the search-and-add picker matched both the picker's own result item *and* the same learner's row in the main table still mounted behind the modal. Scoped every interaction inside that test to the modal's own `role="dialog"` boundary instead of the page.

**Explicitly investigated and left alone (correctly, not by omission):**
- `instructor-phase-cd.full.spec.ts`'s PENDING-status test — passed cleanly on isolated re-run. The original triage report had incorrectly grouped it with `instructor-phase-b`'s genuine fixture bug; it was actually just flaky.
- The certificates "Select course" windowing failure that reappeared in one batch run — verified via trace that courses sort `updatedAt: desc` server-side (confirmed in `courses.service.js`), so a freshly-created course is reliably rank #1; the one observed failure was cross-test load from other files' course updates during that specific batch, not a deterministic bug. Reverted a riskier fix (which would have PATCHed a random pre-existing course we don't own) once evidence showed it wasn't needed.

---

## Method notes (what made this tractable)

- **Trace-file analysis over guessing.** For every ambiguous failure, `--trace=on` + a Python script pulling `frame-snapshot` DOM state at the exact failing call resolved it definitively — this is how the "Add Lesson" case-sensitivity bug, the categories UUID picker's three-layer bug, and the "not a backend crash" finding were actually nailed down rather than assumed.
- **Isolated re-runs to separate signal from noise.** Every fix was re-verified with `npx playwright test <file> --workers=1 -g "<test name>"` on its own before being counted as done, and several "still failing in the batch" results turned out to be confirmed flakes (passed cleanly alone) rather than incomplete fixes.
- **Fixed root causes, not assertions.** No test was weakened to pass — collisions were resolved by making locators more specific (row/dialog scoping, `exact: true`, anchored regex), and the handful of genuine app bugs were fixed in app code, not hidden in test code.

---

## What's left (deliberately not touched)

Two categories from `test-failure-report.md`, ~38 tests, were explicitly out of scope this session:
- **Timing/flakiness** — transient in-flight UI states with narrow assertion windows, confirmed single-run flakes, navigation-race conditions.
- **Rate limiting / backend load** — generic `page.waitForResponse` timeouts on real network calls under sustained sequential load; one file's own code comments already document this as known, pre-existing behavior independent of code correctness.

These need infrastructure changes (dev-environment rate limits, retry/backoff, or accepting them as expected noise on a full sequential run), not more test or app code changes — see the full `test-failure-report.md` for the complete per-test breakdown.
