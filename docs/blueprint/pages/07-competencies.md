# 07 · Competencies — `/competencies`
Doc: Competencies §1–§12 · Entity: COMPETENCY/SKILL (IMPACT §4d, §5.11) · Status: `[built]` (2026-08-09)

Contract: `backend/contact md files/COMPETENCIES_CONTRACT.md`.

> **Deviation from this file's original `[planned]` draft, logged not silently
> fixed:** the original draft below named 12 sections (Skills Library, Skill
> Categories, Frameworks, Skill Levels, Assessments, Competency Mapping,
> Learning Path Mapping, Skill Profiles, Certifications, Skill Gap Analysis,
> Compliance Skills, Analytics). The actual build task specified a different
> 10-tab structure (Overview, Competency List, Frameworks, Categories,
> Assessments, Skill Gaps, Proficiency Levels, User Progress, Import/Export,
> Settings) and was built to that spec — the newer, explicit instruction, per
> CLAUDE.md precedence taking priority over a pre-build placeholder doc. This
> file now describes what was actually built.

## Module sections (as built)
Overview · Competency List · Frameworks · Categories · Assessments · Skill Gaps · Proficiency Levels · User Progress · Import/Export · Settings

Sidebar link `/competencies` — already existed in `AdminLayout.tsx`, wired to the route in this pass.

## Header
Title "Competencies" · subtitle "Define, manage and track competencies and skills across your organization" · buttons: "Competency Matrix" (switches to Overview and scrolls to / briefly highlights the matrix card — `id="matrix"`, via a bump-token passed down to `CompetenciesOverviewTab`, not a URL hash) / "+ Create Competency" / "More Actions" (Create Framework, Import Competencies, Export Report — both "More Actions" shortcuts still just switch to the Import/Export tab, same as before).

## Stats cards (6) — `['competencies','stats']` → `GET /competencies/stats`
Total Competencies · Competency Frameworks · Assessed Users · Proficiency Achieved (%) · Skill Gaps · In Progress. `available:false` → `—`, never `0`; `changePercent:null` → no arrow (see contract's stats note on which cards have real month-over-month deltas vs. live snapshots).

## Tab: Overview (`?tab=overview`, default) — `['competencies','analytics']` + `['competencies','frameworks']`
Left: Competency Frameworks mini-table (name/description, competencies count, users mapped, status, Edit/⋮ Delete) + "Add Framework" + "View All Frameworks →". Right: Top Competencies table (name, category, users assessed, proficiency avg, importance stars) + "View All →". Below: 3 charts — Competency Categories donut, Skill Gap Overview donut (4 severity buckets, not 5 — see contract note 7), Proficiency Trend line (avg vs. derived target). Bottom: full Competency Matrix (rows = `AppUser.role`, columns = top 8 competencies, green/yellow/red cells). Side panel on row click (`?competency=<id>`) — see below.

## Tab: Competency List (`?tab=list`) — `['competencies', filters]` → `GET /competencies/skills`
Filters: search, category, level, status. Table: Skill Name / Category / Level / Linked Courses / Assigned Users / Status / Actions (Edit, Assign to Course, Archive/Reactivate, Delete). "+ Create Competency" opens `AddEditSkillModal`.

## Tab: Frameworks (`?tab=frameworks`) — `['competencies','frameworks']` / `['competencies','frameworks', id]`
Split pane: framework list (left) + selected framework's detail (right) — Edit/Delete framework, required-skills table (skill/category/required level/importance/remove), inline "add skill" form (skill picker + required level + importance).

## Tab: Categories (`?tab=categories`) — `['competencies','categories']`
2-level tree (root → children), color swatch, skill count per node. Create/Add Subcategory/Edit/Archive/Delete — mirrors the Learning Management Categories UI's tree logic exactly, own model (`SkillCategory`, not `Category`).

## Tab: Assessments (`?tab=assessments`) — `['competencies','assessments']`
Filters: type, passed/failed. Table: User / Skill / Type / Score / Passed / Date. "+ New Assessment" opens `RecordAssessmentModal` (also reused by the side panel's "Assign to Users" quick action).

## Tab: Skill Gaps (`?tab=gaps`) — `['competencies','skill-gaps']`
Filters: framework, department (free-text `AppUser.department`). Table: User / Skill / Framework / Required Level / Current Level / Gap Size (severity-colored badge). See contract note 4 for the gap definition's documented scope limit.

## Tab: Proficiency Levels (`?tab=levels`) — no query key, static
Read-only reference of the fixed 5-level ladder + the percent thresholds `competencies.service` actually applies. No config endpoint exists — not built as an editable screen (would fabricate a save target).

## Tab: User Progress (`?tab=progress`) — `['users', id, 'skills']` → `GET /competencies/users/:userId/skills`
Search a user (reuses `GET /api/admin/users`), then shows their full active-skill catalog: assessed skills with level badge + proficiency bar, "Not Yet Assessed" chips for the rest.

## Tab: Import/Export (`?tab=import-export`) — built, see Addendum in `COMPETENCIES_CONTRACT.md`
Export card: `GET /competencies/skills/export` (JSON, same filters as the list, row-capped not paginated) → CSV built client-side (Name/Category/Level/Status/Linked Courses/Assigned Users), same "backend returns JSON, frontend builds the file" split as Users' export. Import card: drag/drop CSV → `POST /competencies/skills/import` (multipart, reuses Users' generic `uploadUsersCsv` multer middleware) → bulk-create, result screen shows Total Rows/Created/Failed/Skipped + per-row reasons, same UX as `ImportUsersModal` inlined as a tab instead of a modal. `Category` in the sheet is a name resolved against existing `SkillCategory` rows — an unmatched name fails that row, never auto-creates a category.

## Tab: Settings (`?tab=settings`) — built, see Addendum in `COMPETENCIES_CONTRACT.md`
`GET/PATCH /competencies/settings`, one `CompetencySettings` row (lazy-created on first read), same single-row pattern as Organization's Hierarchy Settings. Four fields, all wired into real behavior (not stored-and-ignored): assessment passing threshold % (`createAssessment`'s `passed` calc, was a hardcoded 60%), skill-gap severity thresholds Critical/High/Medium — Low is implicit (`bucketGapSeverity`, was hardcoded 4/3/2), auto-update skill level after assessment toggle (gates whether `createAssessment` also upserts `UserSkillProfile` — when off, `CreateAssessmentResponse.profile` is `null` unless a prior profile row already existed), default assessment type (prefills `RecordAssessmentModal`'s Type dropdown, never overwrites a value the user already picked). Save button PATCHes and shows a toast; defaults reproduce the pre-existing hardcoded behavior exactly until an admin changes them.

## Side panel (`?competency=<id>`) — `['competencies', id]` → `GET /competencies/skills/:id`
Name + status badge, Category / Level / Linked Courses / Assigned Users / Created / Updated, linked-courses list, Quick Actions (Create Competency, Create Framework, Assign to Users → `RecordAssessmentModal`, Bulk Assessment/Import/Export → "not available yet" toasts), Recent Activities section.

> **Two spec'd fields intentionally NOT built, flagged not faked:** a single
> "Framework" field (a skill can belong to many frameworks — no "primary"
> concept exists) and a "Proficiency Distribution donut" (no per-skill
> level-breakdown endpoint exists). Both would require inventing data or a new
> backend endpoint outside this task's Part 1/2 spec.

## Mutation IDs
See `IMPACT_MAP.md` §5.11 for the full table. New this build: `skill.assignToCourse`/`.removeCourse`, `skillCategory.delete`, `framework.addSkill`/`.removeSkill`, `assessment.create`. New from the Import/Export + Settings pass: `skill.import`, `competencySettings.update`. `skillLevel.configure` / `competencyMap.*` / `competencyCert.*` remain dead (documented, no endpoint).
