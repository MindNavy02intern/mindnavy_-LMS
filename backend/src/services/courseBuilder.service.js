const prisma = require("../config/prisma");
const { isValidUrl } = require("../validators/courseBuilder.validator");

// ── Course Builder service (Sections + Lessons under a Course) ──────────────────
//
// Same conventions as courses.service: reads use safe() so the tab renders empty
// (never 500s) before `npx prisma db push` has created the tables; writes verify
// foreign keys first so a bad request is a clean 400/404, never an orphan row or a
// 500. Deleting a Section cascades to its Lessons at the DB level (schema relation).

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[courseBuilder.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

const LESSON_SELECT = {
  id: true, sectionId: true, title: true, type: true, content: true,
  durationMin: true, order: true, createdAt: true, updatedAt: true,
};

const SECTION_SELECT = {
  id: true, courseId: true, title: true, order: true, createdAt: true, updatedAt: true,
  lessons: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: LESSON_SELECT },
};

function mapLesson(l) {
  return {
    id:          l.id,
    sectionId:   l.sectionId,
    title:       l.title,
    type:        l.type,
    content:     l.content ?? null,
    durationMin: l.durationMin ?? null,
    order:       l.order,
    createdAt:   iso(l.createdAt),
    updatedAt:   iso(l.updatedAt),
  };
}

function mapSection(s) {
  return {
    id:        s.id,
    courseId:  s.courseId,
    title:     s.title,
    order:     s.order,
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
    lessons:   (s.lessons ?? []).map(mapLesson),
  };
}

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function builderAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Existence guards (clean 404 instead of a raw Prisma FK error) ─────────────────

async function assertCourseExists(courseId) {
  let c;
  try {
    c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  } catch (err) {
    console.error("[courseBuilder.service] assertCourseExists THREW — code:", err.code, "msg:", err.message, "\nstack:", err.stack);
    throw err;
  }
  if (!c) throw domainError("COURSE_NOT_FOUND");
}

async function getSectionOrThrow(id) {
  const s = await prisma.courseSection.findUnique({ where: { id }, select: { id: true, courseId: true } });
  if (!s) throw domainError("SECTION_NOT_FOUND");
  return s;
}

async function getLessonOrThrow(id) {
  const l = await prisma.lesson.findUnique({
    where: { id },
    select: { id: true, sectionId: true, type: true, content: true },
  });
  if (!l) throw domainError("LESSON_NOT_FOUND");
  return l;
}

// ── Sections ─────────────────────────────────────────────────────────────────────

async function listSections(courseId) {
  console.log("[courseBuilder.service] listSections called — courseId:", courseId);
  await assertCourseExists(courseId);
  console.log("[courseBuilder.service] course found — querying sections");
  const rows = await safe(
    () => prisma.courseSection.findMany({
      where: { courseId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: SECTION_SELECT,
    }),
    [],
  );
  return rows.map(mapSection);
}

async function createSection(courseId, data, adminId) {
  await assertCourseExists(courseId);

  // Default order = end of the current list, so a new section lands at the bottom.
  const order = data.order ?? (await prisma.courseSection.count({ where: { courseId } }));

  const section = await prisma.courseSection.create({
    data: { courseId, title: data.title, order },
    select: SECTION_SELECT,
  });

  await builderAuditLog(adminId, "COURSE_SECTION_CREATED", { courseId, sectionId: section.id, title: section.title });
  return mapSection(section);
}

async function updateSection(id, data, adminId) {
  await getSectionOrThrow(id);
  const section = await prisma.courseSection.update({ where: { id }, data, select: SECTION_SELECT });
  await builderAuditLog(adminId, "COURSE_SECTION_UPDATED", { sectionId: id, fields: Object.keys(data) });
  return mapSection(section);
}

async function deleteSection(id, adminId) {
  const existing = await getSectionOrThrow(id);
  // Lessons are removed by the DB cascade (onDelete: Cascade on Lesson.section).
  await prisma.courseSection.delete({ where: { id } });
  await builderAuditLog(adminId, "COURSE_SECTION_DELETED", { sectionId: id, courseId: existing.courseId });
  return { id };
}

// ── Lessons ──────────────────────────────────────────────────────────────────────

async function createLesson(sectionId, data, adminId) {
  await getSectionOrThrow(sectionId);

  const order = data.order ?? (await prisma.lesson.count({ where: { sectionId } }));

  const lesson = await prisma.lesson.create({
    data: {
      sectionId,
      title:       data.title,
      type:        data.type,
      content:     data.content ?? null,
      durationMin: data.durationMin ?? null,
      order,
    },
    select: LESSON_SELECT,
  });

  await builderAuditLog(adminId, "LESSON_CREATED", { sectionId, lessonId: lesson.id, type: lesson.type });
  return mapLesson(lesson);
}

async function updateLesson(id, data, adminId) {
  const current = await getLessonOrThrow(id);

  // Cross-field guard the validator can't do alone: a lesson that ends up VIDEO_URL
  // must have a valid URL in content — UNLESS content is null (pending upload state:
  // type has been saved but the video hasn't been uploaded yet, which is valid).
  const effectiveType    = data.type    !== undefined ? data.type    : current.type;
  const effectiveContent = data.content !== undefined ? data.content : current.content;
  if (effectiveType === "VIDEO_URL" && effectiveContent != null && !isValidUrl(effectiveContent)) {
    throw domainError("BAD_VIDEO_URL");
  }

  const lesson = await prisma.lesson.update({ where: { id }, data, select: LESSON_SELECT });
  await builderAuditLog(adminId, "LESSON_UPDATED", { lessonId: id, fields: Object.keys(data) });
  return mapLesson(lesson);
}

async function deleteLesson(id, adminId) {
  const existing = await getLessonOrThrow(id);
  await prisma.lesson.delete({ where: { id } });
  await builderAuditLog(adminId, "LESSON_DELETED", { lessonId: id, sectionId: existing.sectionId });
  return { id };
}

// ── Reorder (one atomic bulk write after drag-and-drop) ────────────────────────────

async function reorder(courseId, { sections, lessons }, adminId) {
  await assertCourseExists(courseId);

  // Every referenced section must belong to THIS course.
  const owned = await prisma.courseSection.findMany({ where: { courseId }, select: { id: true } });
  const ownedSectionIds = new Set(owned.map((s) => s.id));

  for (const s of sections) {
    if (!ownedSectionIds.has(s.id)) throw domainError("SECTION_NOT_IN_COURSE");
  }
  // A lesson may be moved to another section, but only within the same course.
  for (const l of lessons) {
    if (!ownedSectionIds.has(l.sectionId)) throw domainError("SECTION_NOT_IN_COURSE");
  }

  // Every referenced lesson must currently live in a section of this course.
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length) {
    const found = await prisma.lesson.findMany({
      where: { id: { in: lessonIds }, section: { courseId } },
      select: { id: true },
    });
    if (found.length !== new Set(lessonIds).size) throw domainError("LESSON_NOT_IN_COURSE");
  }

  // One transaction: all order (and section move) updates apply together or none do.
  await prisma.$transaction([
    ...sections.map((s) => prisma.courseSection.update({ where: { id: s.id }, data: { order: s.order } })),
    ...lessons.map((l) => prisma.lesson.update({ where: { id: l.id }, data: { order: l.order, sectionId: l.sectionId } })),
  ]);

  await builderAuditLog(adminId, "COURSE_REORDERED", { courseId, sections: sections.length, lessons: lessons.length });
  return listSections(courseId);
}

module.exports = {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  reorder,
};
