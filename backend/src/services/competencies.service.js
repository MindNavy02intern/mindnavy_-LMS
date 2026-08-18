const prisma = require("../config/prisma");
const { parse } = require("csv-parse/sync");
const {
  IMPORT_MAX_ROWS,
  IMPORT_MAX_ERRORS,
  validateSkillCsvHeaders,
  validateSkillCsvRow,
} = require("../validators/competencies.validator");

// ── Competencies service — Part 1 (Skills + Stats + Analytics) ─────────────────
//
// Conventions match instructors.service: safe() so reads render empty instead
// of 500ing before `prisma db push`; aggregates (linkedCoursesCount,
// assignedUsersCount, stats, analytics) are ALWAYS computed live (R3/B1),
// never stored columns.
//
// computeSkillGaps() is exported because it is the ONE definition of "skill
// gap" in this module — the stats `skillGaps` card, the analytics
// `skillGapOverview` donut and Part 2's `GET /skill-gaps` all call it, so none
// of the three can ever disagree (same reasoning as instructors.service's
// getTopInstructorIds being the one "top instructor" definition).

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[competencies.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

// Best-effort audit — never breaks the primary write (mirrors instructors.service).
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, details: details ?? null },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const LEVEL_RANK = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4, CERTIFIED: 5 };
const IMPORTANCE_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const CHART_MONTHS = 12;
const UNSPECIFIED = "Uncategorized";

// ── Skills — mapping ─────────────────────────────────────────────────────────

const SKILL_SELECT = {
  id: true,
  name: true,
  description: true,
  categoryId: true,
  level: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { name: true } },
};

function mapSkill(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    categoryName: row.category?.name ?? null,
    level: row.level,
    status: row.status,
    linkedCoursesCount: extra.linkedCoursesCount ?? 0,
    assignedUsersCount: extra.assignedUsersCount ?? 0,
    createdById: row.createdById ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// Batched per-page aggregates (one grouped query instead of N per-row counts) —
// same pattern as instructors.service.courseCountsFor.
async function courseMappingCountsFor(skillIds) {
  if (skillIds.length === 0) return new Map();
  const groups = await safe(
    () => prisma.skillCourseMapping.groupBy({ by: ["skillId"], where: { skillId: { in: skillIds } }, _count: { _all: true } }),
    [],
  );
  return new Map(groups.map((g) => [g.skillId, g._count._all]));
}

async function userProfileCountsFor(skillIds) {
  if (skillIds.length === 0) return new Map();
  const groups = await safe(
    () => prisma.userSkillProfile.groupBy({ by: ["skillId"], where: { skillId: { in: skillIds } }, _count: { _all: true } }),
    [],
  );
  return new Map(groups.map((g) => [g.skillId, g._count._all]));
}

function buildSkillWhere({ search, categoryId, level, status }) {
  const where = {};
  if (status)     where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (level)      where.level = level;
  if (search) {
    where.OR = [
      { name:        { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

// ── Skills — reads ───────────────────────────────────────────────────────────

async function listSkills(query) {
  const { page, limit, search, categoryId, level, status } = query;
  const where = buildSkillWhere({ search, categoryId, level, status });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.skill.count({ where }), 0),
    safe(() => prisma.skill.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select: SKILL_SELECT }), []),
  ]);

  const ids = rows.map((r) => r.id);
  const [courseCounts, userCounts] = await Promise.all([courseMappingCountsFor(ids), userProfileCountsFor(ids)]);

  const skills = rows.map((r) => mapSkill(r, {
    linkedCoursesCount: courseCounts.get(r.id) ?? 0,
    assignedUsersCount: userCounts.get(r.id) ?? 0,
  }));

  return {
    skills,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function assertSkillExists(id) {
  const row = await prisma.skill.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw domainError("SKILL_NOT_FOUND");
  return row;
}

// Detail read: skill + its linked courses. `Course` is joined manually
// (SkillCourseMapping.courseId has no db-level FK — see the schema header
// note), so a course deleted out from under a mapping surfaces as
// `missing: true` instead of silently vanishing or 500ing.
async function getSkill(id) {
  const row = await prisma.skill.findUnique({ where: { id }, select: SKILL_SELECT });
  if (!row) throw domainError("SKILL_NOT_FOUND");

  const [courseCount, userCount, mappings] = await Promise.all([
    prisma.skillCourseMapping.count({ where: { skillId: id } }),
    prisma.userSkillProfile.count({ where: { skillId: id } }),
    safe(() => prisma.skillCourseMapping.findMany({ where: { skillId: id }, orderBy: { createdAt: "desc" }, select: { id: true, courseId: true, createdAt: true } }), []),
  ]);

  const courseIds = mappings.map((m) => m.courseId);
  const courses = courseIds.length
    ? await safe(() => prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true, status: true } }), [])
    : [];
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return {
    ...mapSkill(row, { linkedCoursesCount: courseCount, assignedUsersCount: userCount }),
    linkedCourses: mappings.map((m) => {
      const c = courseById.get(m.courseId);
      return c
        ? { mappingId: m.id, courseId: c.id, title: c.title, status: c.status, createdAt: iso(m.createdAt), missing: false }
        : { mappingId: m.id, courseId: m.courseId, title: null, status: null, createdAt: iso(m.createdAt), missing: true };
    }),
  };
}

// ── Skills — writes ──────────────────────────────────────────────────────────

async function createSkill(data, adminId) {
  if (data.categoryId) {
    const cat = await prisma.skillCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!cat) throw domainError("CATEGORY_NOT_FOUND");
  }

  let created;
  try {
    created = await prisma.skill.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        level: data.level,
        status: data.status,
        createdById: adminId ?? null,
      },
      select: SKILL_SELECT,
    });
  } catch (err) {
    if (err.code === "P2003") throw domainError("CATEGORY_NOT_FOUND");
    throw err;
  }

  await auditLog(adminId, "SKILL_CREATED", { skillId: created.id, name: created.name });
  return mapSkill(created, { linkedCoursesCount: 0, assignedUsersCount: 0 });
}

async function updateSkill(id, data, adminId) {
  await assertSkillExists(id);

  if (data.categoryId) {
    const cat = await prisma.skillCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!cat) throw domainError("CATEGORY_NOT_FOUND");
  }

  const updated = await prisma.skill.update({ where: { id }, data, select: SKILL_SELECT });
  await auditLog(adminId, "SKILL_UPDATED", { skillId: id, fields: Object.keys(data) });

  const [courseCount, userCount] = await Promise.all([
    prisma.skillCourseMapping.count({ where: { skillId: id } }),
    prisma.userSkillProfile.count({ where: { skillId: id } }),
  ]);
  return mapSkill(updated, { linkedCoursesCount: courseCount, assignedUsersCount: userCount });
}

// Hard delete, guarded: refuses (409) while the skill has any real usage
// (profiles, assessment history, framework requirements, course mappings) —
// same "blocked while it owns content" shape as instructor.delete, chosen over
// a silent cascade because a cascade would erase assessment history no admin
// asked to erase. "Archive" (status: ARCHIVED via PATCH) is the everyday
// deactivation path; this DELETE is for a skill that was never actually used.
async function deleteSkill(id, adminId) {
  await assertSkillExists(id);

  const [userProfiles, assessments, frameworkSkills, courseMappings] = await Promise.all([
    prisma.userSkillProfile.count({ where: { skillId: id } }),
    prisma.skillAssessment.count({ where: { skillId: id } }),
    prisma.frameworkSkill.count({ where: { skillId: id } }),
    prisma.skillCourseMapping.count({ where: { skillId: id } }),
  ]);
  if (userProfiles > 0 || assessments > 0 || frameworkSkills > 0 || courseMappings > 0) {
    throw Object.assign(domainError("SKILL_IN_USE"), {
      blockers: { userProfiles, assessments, frameworks: frameworkSkills, courseMappings },
    });
  }

  await prisma.skill.delete({ where: { id } });
  await auditLog(adminId, "SKILL_DELETED", { skillId: id });
  return { id };
}

async function assignCourseToSkill(skillId, courseId, adminId) {
  await assertSkillExists(skillId);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) throw domainError("COURSE_NOT_FOUND");

  let mapping;
  try {
    mapping = await prisma.skillCourseMapping.create({
      data: { skillId, courseId },
      select: { id: true, courseId: true, createdAt: true },
    });
  } catch (err) {
    if (err.code === "P2002") throw domainError("COURSE_ALREADY_ASSIGNED");
    throw err;
  }

  await auditLog(adminId, "SKILL_COURSE_ASSIGNED", { skillId, courseId });
  return { mappingId: mapping.id, courseId: mapping.courseId, title: course.title, missing: false, createdAt: iso(mapping.createdAt) };
}

async function removeCourseFromSkill(skillId, courseId, adminId) {
  await assertSkillExists(skillId);
  const mapping = await prisma.skillCourseMapping.findUnique({ where: { skillId_courseId: { skillId, courseId } } });
  if (!mapping) throw domainError("MAPPING_NOT_FOUND");

  await prisma.skillCourseMapping.delete({ where: { id: mapping.id } });
  await auditLog(adminId, "SKILL_COURSE_UNASSIGNED", { skillId, courseId });
  return { id: mapping.id };
}

// ── Skills — export / import (Import/Export tab) ────────────────────────────
//
// Export reuses the same filter/select/aggregate shape as listSkills, just
// uncapped (row-capped, not paginated) — same "GET the resource, no separate
// endpoint shape" reasoning as users.service.exportUsers. CSV generation
// itself happens client-side (ImportExportTab.tsx), this only returns rows.

const EXPORT_ROW_CAP = 5000;

async function exportSkills(query, adminId) {
  const { search, categoryId, level, status } = query;
  const where = buildSkillWhere({ search, categoryId, level, status });

  const rows = await safe(
    () => prisma.skill.findMany({ where, orderBy: { createdAt: "desc" }, take: EXPORT_ROW_CAP, select: SKILL_SELECT }),
    [],
  );
  const ids = rows.map((r) => r.id);
  const [courseCounts, userCounts] = await Promise.all([courseMappingCountsFor(ids), userProfileCountsFor(ids)]);
  const skills = rows.map((r) => mapSkill(r, {
    linkedCoursesCount: courseCounts.get(r.id) ?? 0,
    assignedUsersCount: userCounts.get(r.id) ?? 0,
  }));

  await auditLog(adminId, "SKILLS_EXPORTED", { count: skills.length });
  return { skills, total: skills.length };
}

// Bulk-create from CSV. `Category` in the sheet is a NAME (human-entered),
// resolved to `categoryId` via one batched lookup — a name that doesn't match
// an existing SkillCategory fails that row (never silently auto-creates a
// category, same "don't fabricate data" reasoning as the rest of this
// module). `Linked Courses`/`Assigned Users` columns are accepted (a
// re-imported export file must not error) but ignored — they're computed
// aggregates, not skill-settable data.
async function importSkillsFromCsv(file, adminId) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw Object.assign(new Error("Empty CSV file."), { statusCode: 400 });
  }

  const csvContent = file.buffer.toString("utf8").replace(/^﻿/, "");

  let rawRows;
  try {
    rawRows = parse(csvContent, { skip_empty_lines: true, relax_column_count: true });
  } catch {
    throw Object.assign(new Error("Invalid CSV file."), { statusCode: 400 });
  }
  if (!rawRows || rawRows.length < 1) {
    throw Object.assign(new Error("Empty CSV file."), { statusCode: 400 });
  }

  const headers = rawRows[0].map((h) => (typeof h === "string" ? h.trim() : String(h)));
  const headerError = validateSkillCsvHeaders(headers);
  if (headerError) throw Object.assign(new Error(headerError), { statusCode: 400 });

  const dataRows = rawRows.slice(1);
  const totalRows = dataRows.length;

  if (totalRows === 0) {
    return { success: true, message: "Import completed.", summary: { totalRows: 0, created: 0, failed: 0, skipped: 0 }, errors: [] };
  }
  if (totalRows > IMPORT_MAX_ROWS) {
    throw Object.assign(new Error(`CSV exceeds the maximum of ${IMPORT_MAX_ROWS} rows.`), { statusCode: 400 });
  }

  const rowObjects = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });

  const returnedErrors = [];
  let failedCount = 0;
  const validRows = [];
  for (let i = 0; i < rowObjects.length; i++) {
    const rowNumber = i + 2; // row 1 is the header
    const result = validateSkillCsvRow(rowObjects[i]);
    if (result.valid) {
      validRows.push({ ...result.normalized, rowIndex: rowNumber });
    } else {
      failedCount++;
      if (returnedErrors.length < IMPORT_MAX_ERRORS) {
        returnedErrors.push({ row: rowNumber, name: result.displayName, message: result.errors[0] });
      }
    }
  }

  // Batch-resolve every distinct category name once (case-insensitive) rather
  // than a query per row.
  const categories = await safe(() => prisma.skillCategory.findMany({ select: { id: true, name: true } }), []);
  const categoryIdByLowerName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const rowsToCreate = [];
  for (const r of validRows) {
    if (!r.categoryName) {
      rowsToCreate.push({ name: r.name, categoryId: null, level: r.level, status: r.status, createdById: adminId ?? null });
      continue;
    }
    const categoryId = categoryIdByLowerName.get(r.categoryName.toLowerCase());
    if (!categoryId) {
      failedCount++;
      if (returnedErrors.length < IMPORT_MAX_ERRORS) {
        returnedErrors.push({ row: r.rowIndex, name: r.name, message: `Category "${r.categoryName}" does not exist.` });
      }
      continue;
    }
    rowsToCreate.push({ name: r.name, categoryId, level: r.level, status: r.status, createdById: adminId ?? null });
  }

  let created = 0;
  if (rowsToCreate.length > 0) {
    const result = await prisma.skill.createMany({ data: rowsToCreate });
    created = result.count;
  }

  const failed = failedCount;
  const skipped = failed;
  const message = failed === 0 ? "Import completed." : "Import completed with errors.";

  await auditLog(adminId, "SKILLS_IMPORTED", { totalRows, created, failed, skipped });

  return { success: true, message, summary: { totalRows, created, failed, skipped }, errors: returnedErrors };
}

// ── Competency Settings — single row, mirrors organization.service's
// HierarchySettings (lazy-create-on-read, flat config fields). Backs the
// Settings tab; consumed by bucketGapSeverity/createAssessment below.

const SETTINGS_DEFAULTS = {
  passingThresholdPercent: 60,
  gapSeverityCritical: 4,
  gapSeverityHigh: 3,
  gapSeverityMedium: 2,
  autoUpdateLevelOnAssess: true,
  defaultAssessmentType: "QUIZ",
};

async function getCompetencySettings() {
  let settings = await prisma.competencySettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) settings = await prisma.competencySettings.create({ data: SETTINGS_DEFAULTS });
  return settings;
}

async function updateCompetencySettings(data, adminId) {
  let settings = await prisma.competencySettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) settings = await prisma.competencySettings.create({ data: SETTINGS_DEFAULTS });

  const update = {};
  const intFields = ["passingThresholdPercent", "gapSeverityCritical", "gapSeverityHigh", "gapSeverityMedium"];
  intFields.forEach((f) => { if (f in data && Number.isInteger(data[f])) update[f] = data[f]; });
  if ("autoUpdateLevelOnAssess" in data && typeof data.autoUpdateLevelOnAssess === "boolean") {
    update.autoUpdateLevelOnAssess = data.autoUpdateLevelOnAssess;
  }
  if ("defaultAssessmentType" in data && typeof data.defaultAssessmentType === "string") {
    update.defaultAssessmentType = data.defaultAssessmentType.trim().toUpperCase();
  }

  const result = await prisma.competencySettings.update({ where: { id: settings.id }, data: update });
  await auditLog(adminId, "COMPETENCY_SETTINGS_UPDATED", { fields: Object.keys(update) });
  return result;
}

// ── Proficiency Levels — per-level display config for the fixed SkillLevel
// ladder (see ProficiencyLevel's schema comment) ────────────────────────────

// Same values ProficiencyLevelsTab.tsx used to hardcode — the seed on first
// read, not a re-invented default (lazy-create-on-read, same shape as
// CompetencySettings above).
const PROFICIENCY_LEVEL_DEFAULTS = [
  { level: "BEGINNER",     minPercent: 0,  maxPercent: 24,  color: "#94a3b8", description: "Just starting out — little to no demonstrated proficiency yet." },
  { level: "INTERMEDIATE", minPercent: 25, maxPercent: 49,  color: "#3b82f6", description: "Can perform core tasks with some guidance." },
  { level: "ADVANCED",     minPercent: 50, maxPercent: 74,  color: "#6366f1", description: "Works independently and reliably in most situations." },
  { level: "EXPERT",       minPercent: 75, maxPercent: 89,  color: "#f59e0b", description: "Deep, consistent mastery — able to guide others." },
  { level: "CERTIFIED",    minPercent: 90, maxPercent: 100, color: "#16a34a", description: "Top-tier, verified proficiency." },
];

async function getProficiencyLevels() {
  const existing = await prisma.proficiencyLevel.findMany();
  const byLevel = new Map(existing.map((l) => [l.level, l]));
  const missing = PROFICIENCY_LEVEL_DEFAULTS.filter((d) => !byLevel.has(d.level));
  if (missing.length > 0) {
    await prisma.proficiencyLevel.createMany({ data: missing, skipDuplicates: true });
  }
  const rows = missing.length > 0 ? await prisma.proficiencyLevel.findMany() : existing;
  return rows.sort((a, b) => a.minPercent - b.minPercent);
}

async function updateProficiencyLevels(levels, adminId) {
  await getProficiencyLevels(); // ensure all 5 rows exist before updating
  const validLevels = new Set(PROFICIENCY_LEVEL_DEFAULTS.map((d) => d.level));

  for (const row of levels) {
    if (!validLevels.has(row.level)) throw domainError("INVALID_LEVEL");
    if (!Number.isInteger(row.minPercent) || !Number.isInteger(row.maxPercent)) throw domainError("INVALID_RANGE");
    if (row.minPercent < 0 || row.maxPercent > 100 || row.minPercent > row.maxPercent) throw domainError("INVALID_RANGE");
  }

  await Promise.all(levels.map((row) => prisma.proficiencyLevel.update({
    where: { level: row.level },
    data: { minPercent: row.minPercent, maxPercent: row.maxPercent, color: row.color, description: row.description ?? null },
  })));
  await auditLog(adminId, "PROFICIENCY_LEVELS_UPDATED", { levels: levels.map((l) => l.level) });
  return getProficiencyLevels();
}

// ── Proficiency Distribution — CompetencySidePanel's donut ─────────────────
//
// Groups UserSkillProfile.currentLevel for one skill — the ONE per-skill
// level-breakdown query this module has (CompetencySidePanel's own header
// comment flagged this as genuinely missing before this fix).
const ALL_SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "CERTIFIED"];

async function getSkillDistribution(skillId) {
  await assertSkillExists(skillId);
  const groups = await safe(
    () => prisma.userSkillProfile.groupBy({ by: ["currentLevel"], where: { skillId }, _count: { _all: true } }),
    [],
  );
  const countByLevel = Object.fromEntries(groups.map((g) => [g.currentLevel, g._count._all]));
  return Object.fromEntries(ALL_SKILL_LEVELS.map((lvl) => [lvl, countByLevel[lvl] ?? 0]));
}

// ── Skill gaps — the ONE shared definition ──────────────────────────────────
//
// Judgment call (flagged in the Part 1 report, not silently assumed): this
// schema has no "user/department is targeted by this framework" relation, so
// there is no data source that says WHO is expected to hold a given required
// skill. A gap is therefore only surfaced for a (user, skill) pair where the
// user ALREADY has a `UserSkillProfile` row for a skill some framework
// requires, and their currentLevel ranks below requiredLevel. Users with no
// profile row for that skill are not flagged — inventing a "should have it"
// population would be fabricated data (IMPACT_MAP R3), not a real gap.
async function computeSkillGaps({ departmentId, frameworkId, userId } = {}) {
  const frameworkSkills = await safe(
    () => prisma.frameworkSkill.findMany({
      where: frameworkId ? { frameworkId } : {},
      select: {
        skillId: true, requiredLevel: true, frameworkId: true,
        skill:     { select: { name: true } },
        framework: { select: { name: true } },
      },
    }),
    [],
  );
  if (frameworkSkills.length === 0) return [];

  const skillIds = [...new Set(frameworkSkills.map((fs) => fs.skillId))];
  const profileWhere = { skillId: { in: skillIds } };
  if (userId)       profileWhere.userId = userId;
  if (departmentId) profileWhere.user = { department: departmentId };

  const profiles = await safe(
    () => prisma.userSkillProfile.findMany({
      where: profileWhere,
      select: { userId: true, skillId: true, currentLevel: true, user: { select: { fullName: true } } },
    }),
    [],
  );

  const gaps = [];
  for (const fs of frameworkSkills) {
    const requiredRank = LEVEL_RANK[fs.requiredLevel] ?? 0;
    for (const p of profiles) {
      if (p.skillId !== fs.skillId) continue;
      const currentRank = LEVEL_RANK[p.currentLevel] ?? 0;
      const gapSize = requiredRank - currentRank;
      if (gapSize > 0) {
        gaps.push({
          userId: p.userId,
          userName: p.user?.fullName ?? null,
          skillId: fs.skillId,
          skillName: fs.skill?.name ?? null,
          frameworkId: fs.frameworkId,
          frameworkName: fs.framework?.name ?? null,
          requiredLevel: fs.requiredLevel,
          currentLevel: p.currentLevel,
          gapSize,
        });
      }
    }
  }
  return gaps;
}

// ── Stats ────────────────────────────────────────────────────────────────────

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function metric(value, changePercent = null) {
  return { value, changePercent, available: true };
}
function unavailable(reason) {
  return { value: null, changePercent: null, available: false, reason };
}

async function getStats() {
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thisMonth = { gte: startOfThisMonth };
  const lastMonth = { gte: startOfLastMonth, lt: startOfThisMonth };

  const liveSkill = { status: { not: "ARCHIVED" } };
  const liveFramework = { status: { not: "ARCHIVED" } };

  const [
    totalSkills, skillsThisMonth, skillsLastMonth,
    totalFrameworks, frameworksThisMonth, frameworksLastMonth,
    assessedAllRows, assessedThisRows, assessedLastRows,
    profileAgg, profileAggThisMonth, profileAggLastMonth,
    inProgressCount,
    gaps,
  ] = await Promise.all([
    safe(() => prisma.skill.count({ where: liveSkill }), 0),
    safe(() => prisma.skill.count({ where: { ...liveSkill, createdAt: thisMonth } }), 0),
    safe(() => prisma.skill.count({ where: { ...liveSkill, createdAt: lastMonth } }), 0),

    safe(() => prisma.competencyFramework.count({ where: liveFramework }), 0),
    safe(() => prisma.competencyFramework.count({ where: { ...liveFramework, createdAt: thisMonth } }), 0),
    safe(() => prisma.competencyFramework.count({ where: { ...liveFramework, createdAt: lastMonth } }), 0),

    // "Assessed users" is owned by SkillAssessment (the assessment EVENT), not
    // UserSkillProfile (the derived current-state row) — one field, one owner.
    safe(() => prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS c FROM "skill_assessments"`, [{ c: 0 }]),
    safe(() => prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS c FROM "skill_assessments" WHERE "createdAt" >= ${startOfThisMonth}`, [{ c: 0 }]),
    safe(() => prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS c FROM "skill_assessments" WHERE "createdAt" >= ${startOfLastMonth} AND "createdAt" < ${startOfThisMonth}`, [{ c: 0 }]),

    safe(() => prisma.userSkillProfile.aggregate({ _avg: { proficiencyPercent: true } }), { _avg: { proficiencyPercent: null } }),
    safe(() => prisma.userSkillProfile.aggregate({ _avg: { proficiencyPercent: true }, where: { assessedAt: thisMonth } }), { _avg: { proficiencyPercent: null } }),
    safe(() => prisma.userSkillProfile.aggregate({ _avg: { proficiencyPercent: true }, where: { assessedAt: lastMonth } }), { _avg: { proficiencyPercent: null } }),

    safe(() => prisma.userSkillProfile.count({ where: { proficiencyPercent: { gt: 0, lt: 100 } } }), 0),

    computeSkillGaps({}),
  ]);

  const assessedUsers      = Number(assessedAllRows[0]?.c ?? 0);
  const assessedThisMonth  = Number(assessedThisRows[0]?.c ?? 0);
  const assessedLastMonth  = Number(assessedLastRows[0]?.c ?? 0);

  const avgProficiency = Math.round(profileAgg._avg.proficiencyPercent ?? 0);
  const avgThis = profileAggThisMonth._avg.proficiencyPercent;
  const avgLast = profileAggLastMonth._avg.proficiencyPercent;

  return {
    totalCompetencies:    metric(totalSkills, calcChange(skillsThisMonth, skillsLastMonth)),
    competencyFrameworks: metric(totalFrameworks, calcChange(frameworksThisMonth, frameworksLastMonth)),
    assessedUsers:        metric(assessedUsers, calcChange(assessedThisMonth, assessedLastMonth)),
    proficiencyAchieved:  metric(avgProficiency, (avgThis != null && avgLast != null) ? calcChange(Math.round(avgThis), Math.round(avgLast)) : null),
    // Live snapshots, not monthly cohorts — no historical snapshot table to
    // diff against, same reasoning as Learners' avgProgress/atRiskLearners.
    skillGaps:            metric(gaps.length),
    inProgress:            metric(inProgressCount),
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────

// Largest-remainder rounding so a donut's slices add to exactly 100.0 — copied
// verbatim from instructors.service (same contract, same reasoning).
function withPercentages(items) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return items.map((i) => ({ ...i, percentage: 0 }));

  const tenths = items.map((i) => (i.count / total) * 1000);
  const floors = tenths.map(Math.floor);
  const missing = 1000 - floors.reduce((sum, v) => sum + v, 0);
  const byRemainder = tenths
    .map((v, idx) => ({ idx, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let k = 0; k < missing; k++) floors[byRemainder[k % byRemainder.length].idx] += 1;
  return items.map((item, idx) => ({ ...item, percentage: floors[idx] / 10 }));
}

async function competenciesByCategory() {
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT COALESCE(NULLIF(TRIM(sc."name"), ''), ${UNSPECIFIED}) AS name, COUNT(*)::int AS count
      FROM "skills" s
      LEFT JOIN "skill_categories" sc ON sc."id" = s."categoryId"
      WHERE s."status" <> 'ARCHIVED'
      GROUP BY 1
      ORDER BY count DESC, name ASC`,
    [],
  );
  return withPercentages(rows.map((r) => ({ name: r.name, count: Number(r.count) || 0 })));
}

// Judgment call: the task spec named 5 severity buckets (Critical/High/Medium/
// Low/Very Low) but a 5-level ladder only produces 4 possible positive gap
// sizes (1-4) — bucketed to the 4 that actually occur; `items` simply omits a
// bucket with zero gaps rather than forcing a fabricated 5th slice.
// Thresholds are configurable (Settings tab) — `thresholds` defaults to
// SETTINGS_DEFAULTS' 4/3/2 cutoffs, reproducing the original hardcoded
// behavior exactly until an admin changes them.
function bucketGapSeverity(gapSize, thresholds) {
  if (gapSize >= thresholds.critical) return "Critical";
  if (gapSize >= thresholds.high) return "High";
  if (gapSize >= thresholds.medium) return "Medium";
  return "Low";
}

async function skillGapOverview() {
  const [gaps, settings] = await Promise.all([
    computeSkillGaps({}),
    safe(() => getCompetencySettings(), SETTINGS_DEFAULTS),
  ]);
  const thresholds = {
    critical: settings.gapSeverityCritical,
    high: settings.gapSeverityHigh,
    medium: settings.gapSeverityMedium,
  };
  const counts = new Map();
  for (const g of gaps) {
    const label = bucketGapSeverity(g.gapSize, thresholds);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const order = ["Critical", "High", "Medium", "Low"];
  const items = order.filter((l) => counts.has(l)).map((l) => ({ level: l, count: counts.get(l) }));
  return withPercentages(items);
}

// Target line is derived from real data (avg required level across all
// FrameworkSkill rows, as a % of the 5-level ladder) — not a fabricated
// constant. Flat across months (no time-series target-setting feature exists
// yet); null when zero frameworks exist rather than a guessed number.
async function proficiencyTrend() {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (CHART_MONTHS - 1), 1));

  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT to_char(date_trunc('month', "assessedAt"), 'YYYY-MM') AS month,
             AVG("proficiencyPercent")::float AS avg
      FROM "user_skill_profiles"
      WHERE "assessedAt" IS NOT NULL AND "assessedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [],
  );
  const byMonth = new Map(rows.map((r) => [r.month, Math.round(Number(r.avg) || 0)]));

  const frameworkSkills = await safe(() => prisma.frameworkSkill.findMany({ select: { requiredLevel: true } }), []);
  const targetPct = frameworkSkills.length
    ? Math.round(frameworkSkills.reduce((sum, fs) => sum + ((LEVEL_RANK[fs.requiredLevel] ?? 0) / 5) * 100, 0) / frameworkSkills.length)
    : null;

  const labels = [];
  const avgProficiency = [];
  const targetProficiency = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    avgProficiency.push(byMonth.get(key) ?? 0);
    targetProficiency.push(targetPct);
  }
  return { available: true, labels, avgProficiency, targetProficiency };
}

// Ranked by distinct assessed users (groupBy'd, then sorted in JS — safer
// across Prisma versions than ordering a groupBy by an aggregate field).
// `importance` is the HIGHEST importance among the frameworks that require
// this skill (worst case), null for a skill no framework requires yet.
async function topCompetencies(limit = 10) {
  const grouped = await safe(
    () => prisma.userSkillProfile.groupBy({ by: ["skillId"], _count: { _all: true }, _avg: { proficiencyPercent: true } }),
    [],
  );
  grouped.sort((a, b) => b._count._all - a._count._all);
  const top = grouped.slice(0, limit);
  const skillIds = top.map((g) => g.skillId);
  if (skillIds.length === 0) return [];

  const [skills, importanceRows] = await Promise.all([
    safe(() => prisma.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true, name: true, category: { select: { name: true } } } }), []),
    safe(() => prisma.frameworkSkill.findMany({ where: { skillId: { in: skillIds } }, select: { skillId: true, importance: true } }), []),
  ]);
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const importanceBySkill = new Map();
  for (const row of importanceRows) {
    const cur = importanceBySkill.get(row.skillId);
    if (!cur || IMPORTANCE_RANK[row.importance] > IMPORTANCE_RANK[cur]) importanceBySkill.set(row.skillId, row.importance);
  }

  return top
    .map((g) => {
      const s = skillById.get(g.skillId);
      if (!s) return null;
      return {
        id: g.skillId,
        name: s.name,
        category: s.category?.name ?? null,
        usersAssessed: g._count._all,
        proficiencyAvg: Math.round(g._avg.proficiencyPercent ?? 0),
        importance: importanceBySkill.get(g.skillId) ?? null,
      };
    })
    .filter(Boolean);
}

// Judgment call: "roles" maps to the real `AppUser.role` enum (LEARNER /
// INSTRUCTOR / MANAGER / ADMIN_ASSISTANT) — the only per-user role dimension
// that actually exists in this schema. Cell = avg proficiency among users of
// that role who have been profiled on that skill (real, live-computed); null
// when no such (role, skill) pair has any data, never a fabricated 0.
async function competencyMatrix() {
  const top = await topCompetencies(8);
  if (top.length === 0) return { available: true, roles: [], competencies: [], data: [] };

  const skillIds = top.map((s) => s.id);
  const roles = ["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"];
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT u."role" AS role, p."skillId" AS "skillId", AVG(p."proficiencyPercent")::float AS avg
      FROM "user_skill_profiles" p
      JOIN "app_users" u ON u."id" = p."userId"
      WHERE p."skillId" = ANY(${skillIds}::text[])
      GROUP BY 1, 2`,
    [],
  );
  const cellMap = new Map(rows.map((r) => [`${r.role}:${r.skillId}`, Math.round(Number(r.avg) || 0)]));

  const data = roles.map((role) => ({
    role,
    values: Object.fromEntries(top.map((s) => [s.name, cellMap.get(`${role}:${s.id}`) ?? null])),
  }));
  return { available: true, roles, competencies: top.map((s) => s.name), data };
}

async function recentActivities(limit = 10) {
  const [skills, frameworks, assessments] = await Promise.all([
    safe(() => prisma.skill.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, name: true, createdById: true, createdAt: true } }), []),
    safe(() => prisma.competencyFramework.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, name: true, createdById: true, createdAt: true } }), []),
    safe(() => prisma.skillAssessment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true, skill: { select: { name: true } }, user: { select: { fullName: true } } },
    }), []),
  ]);

  const items = [
    ...skills.map((s) => ({ id: `skill_${s.id}`, type: "skill_created", title: `Skill "${s.name}" was created`, by: s.createdById ?? null, createdAt: iso(s.createdAt) })),
    ...frameworks.map((f) => ({ id: `framework_${f.id}`, type: "framework_created", title: `Framework "${f.name}" was created`, by: f.createdById ?? null, createdAt: iso(f.createdAt) })),
    ...assessments.map((a) => ({ id: `assessment_${a.id}`, type: "assessment_recorded", title: `Assessment recorded for "${a.skill?.name ?? "a skill"}"`, by: a.user?.fullName ?? null, createdAt: iso(a.createdAt) })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);

  return { available: true, items };
}

async function getAnalytics() {
  const [byCategory, gapOverview, trend, top, matrix, activities] = await Promise.all([
    competenciesByCategory(),
    skillGapOverview(),
    proficiencyTrend(),
    topCompetencies(10),
    competencyMatrix(),
    recentActivities(10),
  ]);

  return {
    competenciesByCategory: { available: true, items: byCategory },
    skillGapOverview:       { available: true, items: gapOverview },
    proficiencyTrend:       trend,
    topCompetencies:        { available: true, items: top },
    competencyMatrix:       matrix,
    recentActivities:       activities,
  };
}

// ── Frameworks (Part 2) ──────────────────────────────────────────────────────

const FRAMEWORK_SELECT = { id: true, name: true, description: true, status: true, createdById: true, createdAt: true, updatedAt: true };

function mapFramework(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    competenciesCount: extra.competenciesCount ?? 0,
    usersMapped: extra.usersMapped ?? 0,
    createdById: row.createdById ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function frameworkSkillCountsFor(frameworkIds) {
  if (frameworkIds.length === 0) return new Map();
  const groups = await safe(
    () => prisma.frameworkSkill.groupBy({ by: ["frameworkId"], where: { frameworkId: { in: frameworkIds } }, _count: { _all: true } }),
    [],
  );
  return new Map(groups.map((g) => [g.frameworkId, g._count._all]));
}

// Distinct users who have a profile on ANY skill this framework requires —
// real, live-joined. Not "users assigned to this role/framework" (no such
// relation exists — same documented gap as computeSkillGaps).
async function frameworkUsersMappedFor(frameworkIds) {
  if (frameworkIds.length === 0) return new Map();
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT fs."frameworkId" AS id, COUNT(DISTINCT p."userId")::int AS users
      FROM "framework_skills" fs
      JOIN "user_skill_profiles" p ON p."skillId" = fs."skillId"
      WHERE fs."frameworkId" = ANY(${frameworkIds}::text[])
      GROUP BY fs."frameworkId"`,
    [],
  );
  return new Map(rows.map((r) => [r.id, Number(r.users) || 0]));
}

function buildFrameworkWhere({ search, status }) {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name:        { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

async function listFrameworks(query) {
  const { page, limit, search, status } = query;
  const where = buildFrameworkWhere({ search, status });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.competencyFramework.count({ where }), 0),
    safe(() => prisma.competencyFramework.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select: FRAMEWORK_SELECT }), []),
  ]);

  const ids = rows.map((r) => r.id);
  const [counts, users] = await Promise.all([frameworkSkillCountsFor(ids), frameworkUsersMappedFor(ids)]);
  const frameworks = rows.map((r) => mapFramework(r, { competenciesCount: counts.get(r.id) ?? 0, usersMapped: users.get(r.id) ?? 0 }));

  return { frameworks, pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
}

async function assertFrameworkExists(id) {
  const row = await prisma.competencyFramework.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw domainError("FRAMEWORK_NOT_FOUND");
  return row;
}

async function getFramework(id) {
  const row = await prisma.competencyFramework.findUnique({ where: { id }, select: FRAMEWORK_SELECT });
  if (!row) throw domainError("FRAMEWORK_NOT_FOUND");

  const [count, users, skillRows] = await Promise.all([
    prisma.frameworkSkill.count({ where: { frameworkId: id } }),
    frameworkUsersMappedFor([id]),
    safe(() => prisma.frameworkSkill.findMany({
      where: { frameworkId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, skillId: true, requiredLevel: true, importance: true, createdAt: true,
        skill: { select: { name: true, level: true, status: true, category: { select: { name: true } } } },
      },
    }), []),
  ]);

  return {
    ...mapFramework(row, { competenciesCount: count, usersMapped: users.get(id) ?? 0 }),
    skills: skillRows.map((fs) => ({
      frameworkSkillId: fs.id,
      skillId: fs.skillId,
      skillName: fs.skill?.name ?? null,
      category: fs.skill?.category?.name ?? null,
      requiredLevel: fs.requiredLevel,
      importance: fs.importance,
      createdAt: iso(fs.createdAt),
    })),
  };
}

async function createFramework(data, adminId) {
  const created = await prisma.competencyFramework.create({
    data: { name: data.name, description: data.description, status: data.status, createdById: adminId ?? null },
    select: FRAMEWORK_SELECT,
  });
  await auditLog(adminId, "FRAMEWORK_CREATED", { frameworkId: created.id, name: created.name });
  return mapFramework(created, { competenciesCount: 0, usersMapped: 0 });
}

async function updateFramework(id, data, adminId) {
  await assertFrameworkExists(id);
  const updated = await prisma.competencyFramework.update({ where: { id }, data, select: FRAMEWORK_SELECT });
  await auditLog(adminId, "FRAMEWORK_UPDATED", { frameworkId: id, fields: Object.keys(data) });

  const [count, users] = await Promise.all([
    prisma.frameworkSkill.count({ where: { frameworkId: id } }),
    frameworkUsersMappedFor([id]),
  ]);
  return mapFramework(updated, { competenciesCount: count, usersMapped: users.get(id) ?? 0 });
}

// No blocker check needed: FrameworkSkill is the only thing that references
// frameworkId and cascades at the DB level (competencies.prisma) — deleting a
// framework only removes the ASSOCIATION, never the underlying skills.
async function deleteFramework(id, adminId) {
  await assertFrameworkExists(id);
  await prisma.competencyFramework.delete({ where: { id } });
  await auditLog(adminId, "FRAMEWORK_DELETED", { frameworkId: id });
  return { id };
}

async function addSkillToFramework(frameworkId, { skillId, requiredLevel, importance }, adminId) {
  await assertFrameworkExists(frameworkId);
  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { id: true, name: true } });
  if (!skill) throw domainError("SKILL_NOT_FOUND");

  let row;
  try {
    row = await prisma.frameworkSkill.create({
      data: { frameworkId, skillId, requiredLevel, importance },
      select: { id: true, skillId: true, requiredLevel: true, importance: true, createdAt: true },
    });
  } catch (err) {
    if (err.code === "P2002") throw domainError("SKILL_ALREADY_IN_FRAMEWORK");
    throw err;
  }

  await auditLog(adminId, "FRAMEWORK_SKILL_ADDED", { frameworkId, skillId });
  return {
    frameworkSkillId: row.id, skillId: row.skillId, skillName: skill.name,
    requiredLevel: row.requiredLevel, importance: row.importance, createdAt: iso(row.createdAt),
  };
}

async function removeSkillFromFramework(frameworkId, skillId, adminId) {
  await assertFrameworkExists(frameworkId);
  const row = await prisma.frameworkSkill.findUnique({ where: { frameworkId_skillId: { frameworkId, skillId } } });
  if (!row) throw domainError("FRAMEWORK_SKILL_NOT_FOUND");

  await prisma.frameworkSkill.delete({ where: { id: row.id } });
  await auditLog(adminId, "FRAMEWORK_SKILL_REMOVED", { frameworkId, skillId });
  return { id: row.id };
}

// ── Skill Categories (Part 2) — mirrors categories.service exactly, plus
// description/color/status which `Category` (learning.prisma) doesn't carry.

const SKILL_CATEGORY_SELECT = { id: true, name: true, description: true, color: true, parentId: true, status: true, createdAt: true, updatedAt: true };

function mapSkillCategoryNode(c, skillCount = 0, children) {
  const node = {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    color: c.color ?? null,
    parentId: c.parentId ?? null,
    status: c.status,
    skillCount,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
  if (children !== undefined) node.children = children;
  return node;
}

async function getSkillCategoryOrThrow(id) {
  const c = await prisma.skillCategory.findUnique({ where: { id }, select: SKILL_CATEGORY_SELECT });
  if (!c) throw domainError("SKILL_CATEGORY_NOT_FOUND");
  return c;
}

async function assertSkillCategoryNameFree(name, parentId, excludeId) {
  const dupe = await prisma.skillCategory.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      parentId: parentId ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw domainError("DUPLICATE_SKILL_CATEGORY");
}

async function assertValidSkillCategoryParent(parentId) {
  const parent = await prisma.skillCategory.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
  if (!parent) throw domainError("PARENT_NOT_FOUND");
  if (parent.parentId) throw domainError("MAX_DEPTH");
}

async function listSkillCategories() {
  const [rows, counts] = await Promise.all([
    safe(() => prisma.skillCategory.findMany({ orderBy: { name: "asc" }, select: SKILL_CATEGORY_SELECT }), []),
    safe(() => prisma.skill.groupBy({ by: ["categoryId"], where: { categoryId: { not: null } }, _count: { _all: true } }), []),
  ]);
  const countById = new Map(counts.map((g) => [g.categoryId, g._count._all]));

  const childrenByParent = new Map();
  for (const row of rows) {
    if (!row.parentId) continue;
    if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
    childrenByParent.get(row.parentId).push(mapSkillCategoryNode(row, countById.get(row.id) ?? 0));
  }

  return rows
    .filter((row) => !row.parentId)
    .map((row) => mapSkillCategoryNode(row, countById.get(row.id) ?? 0, childrenByParent.get(row.id) ?? []));
}

async function createSkillCategory(data, adminId) {
  if (data.parentId) await assertValidSkillCategoryParent(data.parentId);
  await assertSkillCategoryNameFree(data.name, data.parentId);

  const category = await prisma.skillCategory.create({
    data: { name: data.name, description: data.description, color: data.color, parentId: data.parentId ?? null },
    select: SKILL_CATEGORY_SELECT,
  });
  await auditLog(adminId, "SKILL_CATEGORY_CREATED", { categoryId: category.id, name: data.name, parentId: data.parentId ?? null });
  return mapSkillCategoryNode(category, 0, data.parentId ? undefined : []);
}

async function updateSkillCategory(id, data, adminId) {
  const current = await getSkillCategoryOrThrow(id);
  const nextParentId = data.parentId !== undefined ? data.parentId : current.parentId;
  const nextName     = data.name     !== undefined ? data.name     : current.name;

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) throw domainError("SELF_PARENT");
    await assertValidSkillCategoryParent(data.parentId);
    const childCount = await prisma.skillCategory.count({ where: { parentId: id } });
    if (childCount > 0) throw domainError("HAS_CHILDREN_MOVE");
  }
  await assertSkillCategoryNameFree(nextName, nextParentId, id);

  const category = await prisma.skillCategory.update({ where: { id }, data, select: SKILL_CATEGORY_SELECT });
  await auditLog(adminId, "SKILL_CATEGORY_UPDATED", { categoryId: id, fields: Object.keys(data) });

  const skillCount = await safe(() => prisma.skill.count({ where: { categoryId: id } }), 0);
  return mapSkillCategoryNode(category, skillCount);
}

async function deleteSkillCategory(id, adminId) {
  const current = await getSkillCategoryOrThrow(id);
  const [childCount, skillCount] = await Promise.all([
    prisma.skillCategory.count({ where: { parentId: id } }),
    prisma.skill.count({ where: { categoryId: id } }),
  ]);
  if (childCount > 0) throw domainError("HAS_CHILDREN_DELETE");
  if (skillCount > 0) throw domainError("HAS_SKILLS");

  await prisma.skillCategory.delete({ where: { id } });
  await auditLog(adminId, "SKILL_CATEGORY_DELETED", { categoryId: id, name: current.name });
  return { id };
}

// ── User Skill Profiles (Part 2) ─────────────────────────────────────────────
//
// Returns the FULL active skill catalog cross-referenced against this user —
// not just the skills they happen to have a profile row for. `missing: true`
// is the literal "missing skills" surface the blueprint's Skill Profiles
// section describes. Scoped to status=ACTIVE skills (archived skills aren't
// something a user is expected to still be developing).
async function getUserSkills(userId) {
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw domainError("USER_NOT_FOUND");

  const [skills, profiles] = await Promise.all([
    safe(() => prisma.skill.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, category: { select: { name: true } } } }), []),
    safe(() => prisma.userSkillProfile.findMany({ where: { userId }, select: { skillId: true, currentLevel: true, proficiencyPercent: true, assessedAt: true } }), []),
  ]);
  const profileBySkill = new Map(profiles.map((p) => [p.skillId, p]));

  return skills.map((s) => {
    const p = profileBySkill.get(s.id);
    return {
      skillId: s.id,
      skillName: s.name,
      category: s.category?.name ?? null,
      currentLevel: p?.currentLevel ?? null,
      proficiencyPercent: p?.proficiencyPercent ?? null,
      assessedAt: iso(p?.assessedAt ?? null),
      missing: !p,
    };
  });
}

// ── Assessments (Part 2) ─────────────────────────────────────────────────────

// Derived level ladder from a raw percent — judgment call (task spec gives no
// explicit percent->level mapping): evenly-ish spaced bands topping out at
// CERTIFIED for a near-perfect score. Documented so it can be tuned later
// without hunting for where the mapping lives.
function levelFromPercent(pct) {
  if (pct >= 90) return "CERTIFIED";
  if (pct >= 75) return "EXPERT";
  if (pct >= 50) return "ADVANCED";
  if (pct >= 25) return "INTERMEDIATE";
  return "BEGINNER";
}

function buildAssessmentWhere({ userId, skillId, type, passed }) {
  const where = {};
  if (userId) where.userId = userId;
  if (skillId) where.skillId = skillId;
  if (type) where.type = type;
  if (passed !== undefined) where.passed = passed;
  return where;
}

async function listAssessments(query) {
  const { page, limit, userId, skillId, type, passed } = query;
  const where = buildAssessmentWhere({ userId, skillId, type, passed });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.skillAssessment.count({ where }), 0),
    safe(() => prisma.skillAssessment.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, userId: true, skillId: true, score: true, maxScore: true, passed: true,
        assessedById: true, type: true, createdAt: true,
        user: { select: { fullName: true } },
        skill: { select: { name: true } },
      },
    }), []),
  ]);

  const assessments = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user?.fullName ?? null,
    skillId: r.skillId,
    skillName: r.skill?.name ?? null,
    score: r.score,
    maxScore: r.maxScore,
    passed: r.passed,
    type: r.type,
    assessedById: r.assessedById ?? null,
    createdAt: iso(r.createdAt),
  }));

  return { assessments, pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
}

// Records the attempt AND upserts the derived UserSkillProfile in one
// transaction — "automatically updates UserSkillProfile after assessment" per
// the task spec. Both writes succeed or fail together so a profile can never
// silently drift from the assessment history that produced it.
async function createAssessment(data, adminId) {
  const [user, skill, settings] = await Promise.all([
    prisma.appUser.findUnique({ where: { id: data.userId }, select: { id: true } }),
    prisma.skill.findUnique({ where: { id: data.skillId }, select: { id: true, name: true } }),
    safe(() => getCompetencySettings(), SETTINGS_DEFAULTS),
  ]);
  if (!user) throw domainError("USER_NOT_FOUND");
  if (!skill) throw domainError("SKILL_NOT_FOUND");

  const passed = data.score >= data.maxScore * (settings.passingThresholdPercent / 100);
  const proficiencyPercent = Math.round((data.score / data.maxScore) * 100);
  const currentLevel = levelFromPercent(proficiencyPercent);
  const now = new Date();

  let assessment, profile;
  if (settings.autoUpdateLevelOnAssess) {
    [assessment, profile] = await prisma.$transaction([
      prisma.skillAssessment.create({
        data: {
          userId: data.userId,
          skillId: data.skillId,
          score: data.score,
          maxScore: data.maxScore,
          passed,
          type: data.type,
          assessedById: data.assessedById ?? adminId ?? null,
        },
      }),
      prisma.userSkillProfile.upsert({
        where: { userId_skillId: { userId: data.userId, skillId: data.skillId } },
        create: { userId: data.userId, skillId: data.skillId, currentLevel, proficiencyPercent, assessedAt: now },
        update: { currentLevel, proficiencyPercent, assessedAt: now },
      }),
    ]);
  } else {
    // Setting is off — record the attempt only, leave the user's tracked
    // level exactly where it was (whatever UserSkillProfile row already
    // exists, if any).
    assessment = await prisma.skillAssessment.create({
      data: {
        userId: data.userId,
        skillId: data.skillId,
        score: data.score,
        maxScore: data.maxScore,
        passed,
        type: data.type,
        assessedById: data.assessedById ?? adminId ?? null,
      },
    });
    profile = await safe(
      () => prisma.userSkillProfile.findUnique({ where: { userId_skillId: { userId: data.userId, skillId: data.skillId } } }),
      null,
    );
  }

  await auditLog(adminId, "SKILL_ASSESSMENT_RECORDED", {
    userId: data.userId, skillId: data.skillId, score: data.score, maxScore: data.maxScore, passed,
  });

  return {
    assessment: {
      id: assessment.id,
      userId: assessment.userId,
      skillId: assessment.skillId,
      skillName: skill.name,
      score: assessment.score,
      maxScore: assessment.maxScore,
      passed: assessment.passed,
      type: assessment.type,
      assessedById: assessment.assessedById ?? null,
      createdAt: iso(assessment.createdAt),
    },
    profile: profile ? {
      userId: profile.userId,
      skillId: profile.skillId,
      currentLevel: profile.currentLevel,
      proficiencyPercent: profile.proficiencyPercent,
      assessedAt: iso(profile.assessedAt),
    } : null,
  };
}

// ── Skill Gaps (Part 2) — thin wrapper over the shared definition ───────────

async function getSkillGaps(query) {
  return { gaps: await computeSkillGaps(query) };
}

module.exports = {
  LEVEL_RANK,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  assignCourseToSkill,
  removeCourseFromSkill,
  computeSkillGaps,
  getStats,
  getAnalytics,
  // Part 2
  listFrameworks,
  getFramework,
  createFramework,
  updateFramework,
  deleteFramework,
  addSkillToFramework,
  removeSkillFromFramework,
  listSkillCategories,
  createSkillCategory,
  updateSkillCategory,
  deleteSkillCategory,
  getUserSkills,
  listAssessments,
  createAssessment,
  getSkillGaps,
  // Import/Export
  exportSkills,
  importSkillsFromCsv,
  // Settings
  getCompetencySettings,
  updateCompetencySettings,
  // Proficiency Levels + Distribution
  getProficiencyLevels,
  updateProficiencyLevels,
  getSkillDistribution,
};
