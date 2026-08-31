const prisma = require("../config/prisma");
const { getOwnedCourses } = require("../utils/ownershipGuard");
// Reused, not forked — the exact same certifications-by-user read the admin
// console uses at GET /competencies/users/:userId/certifications, just
// called with userId=self instead of an arbitrary admin-supplied id.
const { listUserCertifications } = require("./competencyCertifications.service");

// ── Instructor Competencies & Skills (Phase 5, blueprint 2.8) ───────────────────
//
// "Skills in My Courses" has no reverse-lookup endpoint anywhere today —
// SkillCourseMapping.courseId is a plain string with no DB-level FK (Step 0
// audit), and the only existing read direction is skill -> its courses
// (GET /competencies/skills/:id), never courses -> their skills. Built fresh
// here: getOwnedCourses(instructorId) -> ownIds, then SkillCourseMapping
// WHERE courseId IN ownIds, joined to Skill.
//
// missing:true (the admin pattern for a dangling courseId ref) does not apply
// here by construction: ownIds only ever contains courses that currently
// exist and are owned by this instructor, so a mapping can only match this
// query if its course is real — there is no "my course was deleted" case to
// flag.

async function getMySkills(instructorId) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = ownCourses.map((c) => c.id);
  if (ownIds.length === 0) return [];

  const titleOf = new Map(ownCourses.map((c) => [c.id, c.title]));

  const mappings = await prisma.skillCourseMapping.findMany({
    where: { courseId: { in: ownIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, courseId: true, createdAt: true,
      skill: { select: { id: true, name: true, description: true, level: true, status: true } },
    },
  });

  return mappings
    .filter((m) => m.skill) // skill delete is onDelete:Cascade on the mapping, so this is just defensive
    .map((m) => ({
      mappingId:  m.id,
      skillId:    m.skill.id,
      skillName:  m.skill.name,
      description: m.skill.description ?? null,
      level:      m.skill.level,
      status:     m.skill.status,
      courseId:   m.courseId,
      courseTitle: titleOf.get(m.courseId) ?? null,
    }));
}

async function getMyCertifications(instructorId) {
  return listUserCertifications(instructorId);
}

module.exports = {
  getMySkills,
  getMyCertifications,
};
