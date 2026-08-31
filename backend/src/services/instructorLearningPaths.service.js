const prisma = require("../config/prisma");
const { getOwnedCourses } = require("../utils/ownershipGuard");
// Reused, not forked — the SAME title/status resolution admin's learning
// path detail view already uses for every polymorphic item.
const { resolveItems } = require("./learningPaths.service");

// ── Instructor Learning Paths visibility (Phase 4) ───────────────────────────────
//
// Read-only by design: instructors don't create/edit paths (admin-only concept,
// same as the blueprint's other [ADMIN-ONLY] markers), they only see which
// paths their own courses have been placed into, and where.
//
// No instructorId concept exists anywhere on LearningPath/LearningPathItem —
// "my paths" is computed by intersecting each path's COURSE items against
// getOwnedCourses(instructorId), same join-then-filter shape as
// instructorStudents.service.

function domainError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorLearningPaths.service] query failed:", err.message);
    return fallback;
  }
}

const PATH_WITH_ITEMS_SELECT = {
  id: true, title: true, description: true, sequential: true,
  createdAt: true, updatedAt: true,
  items: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, itemType: true, itemId: true, order: true, createdAt: true },
  },
};

// ── List: every path containing ≥1 of my courses ────────────────────────────────

async function listMyLearningPaths(instructorId) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = new Set(ownCourses.map((c) => c.id));
  const titleOf = new Map(ownCourses.map((c) => [c.id, c.title]));

  if (ownIds.size === 0) return [];

  const paths = await safe(
    () => prisma.learningPath.findMany({ orderBy: { createdAt: "desc" }, select: PATH_WITH_ITEMS_SELECT }),
    [],
  );

  const mine = [];
  for (const p of paths) {
    const myItems = p.items.filter((it) => it.itemType === "COURSE" && ownIds.has(it.itemId));
    if (myItems.length === 0) continue;

    mine.push({
      id:          p.id,
      title:       p.title,
      description: p.description ?? null,
      sequential:  p.sequential,
      itemCount:   p.items.length,
      createdAt:   iso(p.createdAt),
      updatedAt:   iso(p.updatedAt),
      // Which of THEIR courses are in this path, and at what position —
      // 1-based, human-facing (order is 0-based internally).
      myCourses: myItems.map((it) => ({
        courseId:    it.itemId,
        courseTitle: titleOf.get(it.itemId) ?? null,
        position:    it.order + 1,
      })),
    });
  }
  return mine;
}

// ── Detail: full sequence, own step(s) flagged ──────────────────────────────────

async function getMyLearningPath(instructorId, pathId) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = new Set(ownCourses.map((c) => c.id));

  const p = await prisma.learningPath.findUnique({ where: { id: pathId }, select: PATH_WITH_ITEMS_SELECT });
  if (!p) throw domainError("PATH_NOT_FOUND", 404);

  const hasOwnCourse = p.items.some((it) => it.itemType === "COURSE" && ownIds.has(it.itemId));
  if (!hasOwnCourse) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  // Full sequence is returned (an instructor needs to see what comes before/
  // after their own step to understand the path), but resolveItems already
  // caps every OTHER item to the same minimal {id,title,status} shape admin's
  // own path view exposes — no roster/enrollment/internal data for another
  // instructor's course leaks here, only its title and publish status.
  const resolved = await resolveItems(p.items);

  return {
    id:          p.id,
    title:       p.title,
    description: p.description ?? null,
    sequential:  p.sequential,
    itemCount:   p.items.length,
    createdAt:   iso(p.createdAt),
    updatedAt:   iso(p.updatedAt),
    items: resolved.map((it) => ({
      ...it,
      isMine: it.itemType === "COURSE" && ownIds.has(it.itemId),
    })),
  };
}

module.exports = {
  listMyLearningPaths,
  getMyLearningPath,
};
