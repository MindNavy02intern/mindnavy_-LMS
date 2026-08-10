# Competencies — Skills / Categories / Frameworks / Profiles / Assessments / Skill Gaps — API Contract v1

Source of truth for the Competencies module, mirroring `INSTRUCTORS_CONTRACT.md`
/ `LEARNERS_CONTRACT.md`'s format exactly. If anything here conflicts with a
task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/competencies`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string, "data"?: object }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min · `/stats`, `/analytics`, `/skill-gaps` 30/min (300 dev) · writes 60/10min (600 dev)

---

## ⚠️ Read before building against this

> **1. Seven new Prisma models, zero reuse of existing ones.** `Skill`,
> `SkillCategory`, `CompetencyFramework`, `FrameworkSkill`, `UserSkillProfile`,
> `SkillAssessment`, `SkillCourseMapping` (competencies.prisma) — confirmed by
> a Step 0 audit that nothing competency-shaped existed anywhere before this
> module. `SkillCategory` is deliberately **not** the existing `Category`
> model (learning.prisma) — that one is course taxonomy only (no `color`, no
> `status`, feeds `Course.categoryId`) and reusing it would make Courses and
> Competencies fight over one model's meaning.

> **2. Cross-domain references are plain strings, not DB-level FKs**, the same
> pattern `LearningPathItem.itemId` already uses: `Skill.createdById` /
> `CompetencyFramework.createdById` (actor id, like `Course.createdBy`),
> `SkillAssessment.assessedById` (like `InstructorDocument.verifiedById`), and
> `SkillCourseMapping.courseId` (existence verified in the service on insert;
> reads flag a deleted course as `missing: true` instead of failing). Only
> `UserSkillProfile.userId` / `SkillAssessment.userId` are real relations
> (`AppUser.userSkillProfiles` / `.skillAssessments`) — those need real joins
> for skill-gap analysis and per-user skill lists.

> **3. `DELETE /skills/:id` is a guarded HARD delete, not the archive path.**
> `409 SKILL_IN_USE` while it has any `UserSkillProfile`, `SkillAssessment`,
> `FrameworkSkill`, or `SkillCourseMapping` row (blockers counted in the
> response `data`). Archiving (the everyday deactivation action) is
> `PATCH { status: 'ARCHIVED' }` — DELETE is for a skill that was never
> actually used. `DELETE /frameworks/:id` has no such guard: `FrameworkSkill`
> is the only thing that references a framework and cascades at the DB level,
> so deleting one only removes the *association*, never the underlying skills.

> **4. Skill gaps have no "who's expected to have this skill" data source.**
> This schema has no user/department↔framework assignment relation. A gap is
> therefore **only** surfaced for a `(user, skill)` pair where the user
> *already* has a `UserSkillProfile` row for a skill some framework requires,
> ranked below `requiredLevel`. Users with zero profile rows for that skill
> are invisible to gap detection — inventing an "expected to have it"
> population would be fabricated data. `computeSkillGaps()` in
> `competencies.service.js` is the **one** implementation — the `skillGaps`
> stats card, the `skillGapOverview` analytics donut, and `GET /skill-gaps`
> all call it, so none of the three can ever disagree.

> **5. `POST /assessments` auto-upserts `UserSkillProfile` in the same
> transaction.** `passed` is server-derived (`score >= maxScore * 0.6`, same
> 60% default as `Quiz.passingGrade`), and `currentLevel` is derived from the
> resulting percent via a fixed ladder (`levelFromPercent` —
> 0–24 Beginner · 25–49 Intermediate · 50–74 Advanced · 75–89 Expert · 90–100
> Certified). Neither is client-supplied.

> **6. `GET /users/:userId/skills` returns the FULL active skill catalog**,
> not just the skills the user happens to have a profile for — every
> `Skill{status:ACTIVE}` is cross-referenced against the user, `missing: true`
> for ones with no `UserSkillProfile` row. This is the literal "missing
> skills" surface the product spec describes for a user's skill profile.

> **7. Documented judgment calls in the analytics response** (flagged to the
> user, accepted as-is): `skillGapOverview` buckets are Critical/High/Medium/Low
> (4, not 5 — a 5-level ladder only produces 4 possible positive gap sizes).
> `competencyMatrix` rows are `AppUser.role` (LEARNER/INSTRUCTOR/MANAGER/
> ADMIN_ASSISTANT) — the only real per-user role dimension this schema has —
> not framework-as-role-name; cells are the org-wide avg proficiency for that
> (role, skill) pair, not filtered to a "this role owns this framework"
> relation that doesn't exist. `proficiencyTrend.targetProficiency` is derived
> from the average `requiredLevel` across all `FrameworkSkill` rows (flat
> across months, `null` if zero frameworks exist) — not a fabricated constant.

---

## Types

```ts
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'CERTIFIED';
export type SkillStatus = 'ACTIVE' | 'ARCHIVED';
export type FrameworkStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type FrameworkImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SkillCategoryStatus = 'ACTIVE' | 'ARCHIVED';
export type AssessmentType = 'QUIZ' | 'PRACTICAL' | 'ASSIGNMENT' | 'LIVE_EVALUATION' | 'CERTIFICATION_EXAM';

export interface Skill {
  id: string; name: string; description: string | null;
  categoryId: string | null; categoryName: string | null;
  level: SkillLevel; status: SkillStatus;
  linkedCoursesCount: number; assignedUsersCount: number; // both computed live, never stored
  createdById: string | null; createdAt: string; updatedAt: string;
}
export interface SkillDetail extends Skill {
  linkedCourses: { mappingId: string; courseId: string; title: string | null; status: string | null; createdAt: string; missing: boolean }[];
}
```

`Metric` envelope (stats cards) is identical to Instructors'/Learners':
`{ value: number|null, changePercent: number|null, available: boolean, reason?: string }`.

---

## Skills (Part 1)

### `GET /skills`
Query: `search` (name/description) · `categoryId` · `level` · `status` · `page` · `limit` (max 100). No tabs — this is a flat filtered list, not a tab-scoped one.
```jsonc
{ "success": true, "data": {
  "skills": [ /* Skill[] */ ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
}}
```

### `GET /skills/:id` → `SkillDetail`
`404 SKILL_NOT_FOUND` for an unknown id.

### `POST /skills`
Body: `name (required, 2-150 chars), description?, categoryId?, level? (default BEGINNER), status? (default ACTIVE)`. `201` → `Skill`. `400` if `categoryId` doesn't reference an existing `SkillCategory`.

### `PATCH /skills/:id`
Same fields, all optional. `400 "No valid fields provided to update."` if body is empty after parsing.

### `DELETE /skills/:id`
Guarded hard delete — see note 3. `200 { id }` on success, `409 SKILL_IN_USE` with `data: { userProfiles, assessments, frameworks, courseMappings }` otherwise.

### `POST /skills/:id/assign-course`
Body: `{ courseId (required) }`. `201` → `{ mappingId, courseId, title, missing:false, createdAt }`. `400 COURSE_NOT_FOUND` if the course doesn't exist. `409 COURSE_ALREADY_ASSIGNED` on a duplicate mapping.

### `DELETE /skills/:id/courses/:courseId`
`200 { id }`. `404 MAPPING_NOT_FOUND` if this course isn't assigned to this skill.

---

## Stats (Part 1) — `GET /stats`, 6 cards

`totalCompetencies · competencyFrameworks · assessedUsers · proficiencyAchieved · skillGaps · inProgress`.

- `assessedUsers` is owned by `SkillAssessment` (the assessment EVENT), not `UserSkillProfile` — one field, one owner; `changePercent` compares distinct assessed users this vs. last month.
- `proficiencyAchieved` = avg `UserSkillProfile.proficiencyPercent` across ALL profiles (0 when none exist yet — a real "0% achieved so far", not `available:false`, since the source table genuinely exists).
- `skillGaps` / `inProgress` are live snapshots (`computeSkillGaps({})` count / count of profiles with `0 < proficiencyPercent < 100`) — `changePercent` always `null`, no historical snapshot table to diff against (same reasoning as Learners' `avgProgress`/`atRiskLearners`).

---

## Analytics (Part 1) — `GET /analytics`, 6 sections

`competenciesByCategory` (donut, `Category.name` grouped, `Uncategorized` fallback) ·
`skillGapOverview` (donut, 4 severity buckets — see note 7) ·
`proficiencyTrend` (12-month line, `avgProficiency` + `targetProficiency` — see note 7) ·
`topCompetencies` (top 10 by distinct assessed users, `importance` = highest importance across any framework requiring it, `null` if none) ·
`competencyMatrix` (rows = `AppUser.role`, columns = top 8 competencies — see note 7) ·
`recentActivities` (merges Skill/Framework created + Assessment recorded, newest 10).

---

## Frameworks (Part 2)

### `GET /frameworks`
Query: `search · status · page · limit`. Each row carries live `competenciesCount` (# required skills) and `usersMapped` (distinct users profiled on any of them — see note 4's caveat, same "no assignment relation" gap).
```jsonc
{ "success": true, "data": { "frameworks": [ /* Framework[] */ ], "pagination": {...} } }
```

### `GET /frameworks/:id` → `FrameworkDetail`
Adds `skills: [{ frameworkSkillId, skillId, skillName, category, requiredLevel, importance, createdAt }]`.

### `POST /frameworks`
Body: `name (required), description?, status? (default DRAFT)`. `201` → `Framework`.

### `PATCH /frameworks/:id` — same fields, all optional.

### `DELETE /frameworks/:id`
Unguarded — see note 3. `200 { id }`.

### `POST /frameworks/:id/skills`
Body: `{ skillId (required), requiredLevel (required), importance? (default MEDIUM) }`. `201` → `FrameworkSkillRow`. `400 SKILL_NOT_FOUND` · `409 SKILL_ALREADY_IN_FRAMEWORK`.

### `DELETE /frameworks/:id/skills/:skillId`
`200 { id }`. `404 FRAMEWORK_SKILL_NOT_FOUND`.

---

## Skill Categories (Part 2)

Mirrors `categories.service` exactly (2-level hierarchy, parent-must-be-root,
sibling name uniqueness, blocked delete) plus `description`/`color`/`status`
that the Courses `Category` model doesn't carry.

### `GET /categories` → `SkillCategory[]`
Full tree: root nodes carry a `children` array, subcategory nodes don't. `skillCount` per node is live (`Skill.groupBy` by `categoryId`).

### `POST /categories`
Body: `name (required), description?, color? (hex, e.g. #2563eb), parentId?`. `201`. `404 PARENT_NOT_FOUND` · `400 MAX_DEPTH` (parent is itself a subcategory) · `400 DUPLICATE_SKILL_CATEGORY` (same name, same parent scope).

### `PATCH /categories/:id`
Adds `status?` (`ACTIVE|ARCHIVED` — the "Archive" action). `400 SELF_PARENT` · `400 HAS_CHILDREN_MOVE` (has children, can't become a subcategory itself).

### `DELETE /categories/:id`
Hard delete, genuinely exists alongside the archive path. `400 HAS_CHILDREN_DELETE` · `400 HAS_SKILLS`.

---

## User Skill Profiles (Part 2)

### `GET /users/:userId/skills`
See note 6. `404` if the user doesn't exist.
```jsonc
{ "success": true, "data": [
  { "skillId": "…", "skillName": "React", "category": "Frontend",
    "currentLevel": "ADVANCED", "proficiencyPercent": 62, "assessedAt": "…", "missing": false },
  { "skillId": "…", "skillName": "Kubernetes", "category": "DevOps",
    "currentLevel": null, "proficiencyPercent": null, "assessedAt": null, "missing": true }
]}
```

---

## Assessments (Part 2)

### `GET /assessments`
Query: `userId? · skillId? · type? · passed? (true|false) · page · limit`.
```jsonc
{ "success": true, "data": { "assessments": [ /* Assessment[] */ ], "pagination": {...} } }
```

### `POST /assessments`
Body: `{ userId (required), skillId (required), score (required, int ≥0), maxScore (required, int >0, ≥ score), type (required), assessedById? }`. See note 5. `201`:
```jsonc
{ "success": true, "data": {
  "assessment": { "id":"…", "userId":"…", "skillId":"…", "skillName":"…", "score":30, "maxScore":100, "passed":false, "type":"QUIZ", "assessedById":"…", "createdAt":"…" },
  "profile":    { "userId":"…", "skillId":"…", "currentLevel":"INTERMEDIATE", "proficiencyPercent":30, "assessedAt":"…" }
}}
```
`404 USER_NOT_FOUND` · `404 SKILL_NOT_FOUND` · `400` if `score > maxScore`.

---

## Skill Gaps (Part 2)

### `GET /skill-gaps`
Query: `departmentId? (AppUser.department, free text) · frameworkId? · userId?`. See note 4.
```jsonc
{ "success": true, "data": { "gaps": [
  { "userId":"…", "userName":"…", "skillId":"…", "skillName":"…",
    "frameworkId":"…", "frameworkName":"…", "requiredLevel":"CERTIFIED", "currentLevel":"INTERMEDIATE", "gapSize":3 }
]}}
```

---

## Error codes

| Status | When |
|---|---|
| 400 | validation · unknown `categoryId`/`courseId` on write · empty PATCH body · `score > maxScore` · category `MAX_DEPTH`/`SELF_PARENT`/`HAS_CHILDREN_*`/`DUPLICATE_SKILL_CATEGORY`/`HAS_SKILLS` |
| 401 | missing/invalid admin token |
| 404 | unknown skill/framework/category/user id · unknown course-mapping · unknown framework-skill |
| 409 | `SKILL_IN_USE` (delete blocked) · `COURSE_ALREADY_ASSIGNED` · `SKILL_ALREADY_IN_FRAMEWORK` |
| 429 | rate limited |
| 503 | `prisma db push` not run yet |

No known error path returns 500.

---

## Mutation IDs (frontend `invalidation.ts`)

Extends the `§5.11 COMPETENCY / SKILL` rows IMPACT_MAP.md already carried
(written ahead of this backend, same pattern as `ticket.*` before Learners
shipped) — these are additive, not a rewrite:

| Mutation ID | New/Extended | Invalidate (extra) |
|---|---|---|
| `skill.create` / `.update` / `.delete` | extended | + `competencyDetail(id)`, `competenciesStats()`, `competenciesAnalytics()` |
| `skill.assignToCourse` / `.removeCourse` | **new** | `competencies()`, `competencyDetail(id)`, `courses.detail(courseId)` |
| `skillCategory.create` / `.update` / `.archive` | extended | + `competenciesStats()` (create only), `competenciesAnalytics()` |
| `skillCategory.delete` | **new** | `competenciesCategories()`, `competencies()`, `competenciesStats()` |
| `framework.create` / `.update` / `.delete` | extended | + `frameworkDetail(id)`, `competenciesStats()`, `competenciesAnalytics()` |
| `framework.addSkill` / `.removeSkill` | **new** | `competenciesFrameworks()`, `frameworkDetail(frameworkId)`, `competenciesStats()`, `competenciesAnalytics()`, `competenciesSkillGaps()` |
| `assessment.create` | **new** | `competenciesAssessments()`, `userSkills(userId)`, `competenciesStats()`, `competenciesAnalytics()`, `competenciesSkillGaps()` |

`skillLevel.configure` / `competencyMap.link`/`.unlink` / `competencyCert.*`
remain dead (documented, unbuilt — no config-levels endpoint, no course/path
skill-mapping UI, no certification-tracking entity in this v1 task spec).

---

*Backend built 2026-08-09 across Parts 1-2 (Skills+Stats+Analytics, then
Frameworks+Categories+Profiles+Assessments+Gaps). Frontend built same window
across Parts 3-4 (page shell+Overview, then the remaining 6 working tabs +
1 read-only reference tab). `Proficiency Levels` tab is intentionally
read-only (no config endpoint exists); `Import/Export` and `Settings` tabs
were stubs at that point — see the Addendum below, same day.*

---

## Addendum — Import/Export + Settings (2026-08-09, same-day follow-up)

Both tabs were "coming soon" stubs when this contract was first written
("never specified in the v1 task spec"). Built out same-day once the work
was actually scoped — additive, nothing above this line changed.

### `GET /skills/export`
Same query params as `GET /skills` (`search · categoryId · level · status`),
no `page`/`limit` — row-capped at 5000, not paginated, same "uncapped read"
shape as `USERS_CONTRACT.md`'s `GET /users/export`.
```jsonc
{ "success": true, "data": { "skills": [ /* Skill[] */ ], "total": 1 } }
```
CSV generation happens **client-side** (`ImportExportTab.tsx`), same split as
Users' export — this endpoint returns JSON rows only. Columns: Name,
Category, Level, Status, Linked Courses, Assigned Users.

### `POST /skills/import`
Multipart, field name `file`, CSV only, max 1MB, max 500 rows — reuses
Users' generic `uploadUsersCsv` multer middleware verbatim (memoryStorage,
CSV mimetype/extension filter), nothing user-specific in it despite the name.
Required column: `Name`. Optional: `Category` (a NAME, resolved against
existing `SkillCategory` rows case-insensitively — a name that matches
nothing fails that row with `Category "X" does not exist.`, never
auto-creates a category), `Level` (default `BEGINNER`), `Status` (default
`ACTIVE`). `Linked Courses`/`Assigned Users` columns are accepted but ignored
if present, so re-importing a file this same endpoint exported never errors
on "unknown header".

Response is the **flat** shape (not the `{success,data}` envelope — matches
`POST /users/import` exactly):
```jsonc
{ "success": true, "message": "Import completed with errors.",
  "summary": { "totalRows": 10, "created": 8, "failed": 2, "skipped": 2 },
  "errors": [ { "row": 4, "name": "Kubernetes", "message": "Category \"DevOps\" does not exist." } ] }
```
`400` for: missing/unknown CSV headers, empty file, >500 rows. No 500 path
for a well-formed-but-invalid CSV (row failures are collected, not thrown).

### `GET /settings` / `PATCH /settings`
Single `CompetencySettings` row, lazy-created on first read — identical
shape to Organization's `GET/PATCH /hierarchy/settings`. No `POST .../reset`
was requested, so none exists (unlike hierarchy settings, which has one).

```ts
export interface CompetencySettings {
  id: string;
  passingThresholdPercent: number; // 1-100, default 60
  gapSeverityCritical: number;     // gap-size threshold, 1-4, default 4
  gapSeverityHigh: number;         // 1-4, default 3
  gapSeverityMedium: number;       // 1-4, default 2 — below this is always "Low"
  autoUpdateLevelOnAssess: boolean; // default true
  defaultAssessmentType: AssessmentType; // default QUIZ
  createdAt: string; updatedAt: string;
}
```
`PATCH` body: any subset of the above (minus `id`/timestamps). `400` if
`gapSeverityCritical/High/Medium` aren't strictly descending, or any field is
out of range/wrong type.

**These four fields are wired into real behavior, not stored-and-ignored:**
1. `passingThresholdPercent` replaces `createAssessment`'s previously
   hardcoded 60% (`PASSING_RATIO`) — `passed = score >= maxScore * (pct/100)`.
2. `gapSeverityCritical/High/Medium` replace `bucketGapSeverity`'s previously
   hardcoded `>=4 / ===3 / ===2` cutoffs with `>= critical / >= high / >= medium`
   (defaults reproduce the exact original behavior). Only `skillGapOverview`
   (the analytics donut) reads these live — `computeSkillGaps()` itself
   (the shared gap DEFINITION used by the stats card, the donut, and
   `GET /skill-gaps`) is untouched; only how a gap SIZE is labeled changed.
3. `autoUpdateLevelOnAssess` gates whether `createAssessment` also upserts
   `UserSkillProfile`. When off, only the `SkillAssessment` row is written;
   the response's `profile` field is the user's EXISTING profile row if one
   already existed, else `null` — `CreateAssessmentResponse.profile` is now
   `{...} | null` (was always non-null before this addendum).
4. `defaultAssessmentType` prefills `RecordAssessmentModal`'s Type dropdown
   on open (fetched best-effort, never overwrites a value the user already
   picked) — does not affect the API contract itself, `type` is still
   required in `POST /assessments`.

### New `AuditAction` values
`SKILLS_EXPORTED`, `SKILLS_IMPORTED`, `COMPETENCY_SETTINGS_UPDATED`.

### New mutation IDs (frontend `invalidation.ts`)
| Mutation ID | Invalidate (extra) |
|---|---|
| `skill.import` | `competencies()`, `competenciesStats()`, `competenciesAnalytics()` |
| `competencySettings.update` | `competenciesSettings()`, `competenciesAnalytics()`, `competenciesSkillGaps()`, `competenciesStats()` |

### Requires a migration
`CompetencySettings` is a new model and `AuditAction` gained 3 values —
`npx prisma generate` was run (local codegen, safe); **`npx prisma db push`
was NOT run** (shared DB) and still needs to happen before `/settings`,
`/skills/export`'s audit log, or `/skills/import`'s audit log will work
against a live database. Until then, `getCompetencySettings()` will throw on
the missing table (503-mapped by the existing `P2021`/`P2022` handler in
`competencies.controller.serverError`) and the two new audit-log writes will
silently no-op (caught by the existing best-effort `auditLog()` try/catch) —
neither blocks the underlying skill create/export/import from working.
