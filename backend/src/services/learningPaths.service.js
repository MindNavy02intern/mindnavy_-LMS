const prisma = require("../config/prisma");

// ── Learning Paths service (paths + polymorphic items + reorder) ────────────────
//
// Same conventions as courseBuilder.service: reads use safe() so the tab renders
// empty (never 500s) before `npx prisma db push` has created the tables; writes
// verify references first so a bad request is a clean 400/404. Items reference
// courses/live-sessions WITHOUT a db-level FK, so:
//   - addItem verifies the referenced row exists before inserting,
//   - reads resolve title/status in bulk and mark dangling refs `missing: true`
//     (a course hard-deleted from the DB must degrade gracefully, never 500).
// Deleting a path cascades to its items at the DB level (schema relation).

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[learningPaths.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

// Status presentation matches what the frontend already consumes per entity:
// courses.service labels ("Draft"/"Published"/…), lm.service live sessions
// lowercase ("upcoming"/"live"/"ended").
const COURSE_STATUS_LABEL = { DRAFT: "Draft", PENDING: "Pending", PUBLISHED: "Published", ARCHIVED: "Archived" };

function refStatus(itemType, ref) {
  if (!ref?.status) return null;
  if (itemType === "COURSE") return COURSE_STATUS_LABEL[ref.status] ?? ref.status;
  return String(ref.status).toLowerCase();
}

const PATH_SELECT = {
  id: true, title: true, description: true, sequential: true,
  createdAt: true, updatedAt: true,
  _count: { select: { items: true } },
};

const ITEM_SELECT = {
  id: true, pathId: true, itemType: true, itemId: true, order: true, createdAt: true,
};

function mapPath(p) {
  return {
    id:          p.id,
    title:       p.title,
    description: p.description ?? null,
    sequential:  p.sequential,
    itemCount:   p._count?.items ?? 0,
    createdAt:   iso(p.createdAt),
    updatedAt:   iso(p.updatedAt),
  };
}

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function pathAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Existence guards (clean 404 instead of a raw Prisma error) ─────────────────────

async function getPathOrThrow(id) {
  const p = await prisma.learningPath.findUnique({ where: { id }, select: { id: true } });
  if (!p) throw domainError("PATH_NOT_FOUND");
  return p;
}

// ── Polymorphic reference resolution (bulk — two queries max, never per-item) ──────

async function resolveItems(items) {
  const courseIds  = items.filter((i) => i.itemType === "COURSE").map((i) => i.itemId);
  const sessionIds = items.filter((i) => i.itemType === "LIVE_SESSION").map((i) => i.itemId);
  const quizIds     = items.filter((i) => i.itemType === "QUIZ").map((i) => i.itemId);

  const [courses, sessions, quizzes] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true, status: true } })
      : [],
    sessionIds.length
      ? prisma.liveSession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, title: true, status: true, startTime: true } })
      : [],
    quizIds.length
      ? prisma.quiz.findMany({ where: { id: { in: quizIds } }, select: { id: true, title: true } })
      : [],
  ]);

  const courseMap  = new Map(courses.map((c) => [c.id, c]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const quizMap     = new Map(quizzes.map((q) => [q.id, q]));

  function refFor(it) {
    if (it.itemType === "COURSE") return courseMap.get(it.itemId);
    if (it.itemType === "LIVE_SESSION") return sessionMap.get(it.itemId);
    return quizMap.get(it.itemId);
  }

  return items.map((it) => {
    const ref = refFor(it);
    return {
      id:        it.id,
      itemType:  it.itemType,
      itemId:    it.itemId,
      order:     it.order,
      createdAt: iso(it.createdAt),
      // Resolved view of the referenced entity. `missing: true` = the row no longer
      // exists (dangling polymorphic ref) — the UI shows it flagged, never hides it.
      title:     ref?.title ?? null,
      // Quiz has no status concept (unlike Course/LiveSession) — stays null.
      status:    it.itemType === "QUIZ" ? null : refStatus(it.itemType, ref),
      startTime: it.itemType === "LIVE_SESSION" ? iso(ref?.startTime) : null,
      missing:   !ref,
    };
  });
}

// ── Paths ────────────────────────────────────────────────────────────────────────

async function listPaths() {
  const rows = await safe(
    () => prisma.learningPath.findMany({ orderBy: { createdAt: "desc" }, select: PATH_SELECT }),
    [],
  );
  return rows.map(mapPath);
}

async function getPath(id) {
  const p = await prisma.learningPath.findUnique({
    where: { id },
    select: {
      ...PATH_SELECT,
      items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: ITEM_SELECT },
    },
  });
  if (!p) throw domainError("PATH_NOT_FOUND");
  return { ...mapPath(p), items: await resolveItems(p.items) };
}

async function createPath(data, adminId) {
  const path = await prisma.learningPath.create({
    data: { title: data.title, description: data.description, sequential: data.sequential },
    select: PATH_SELECT,
  });
  await pathAuditLog(adminId, "LEARNING_PATH_CREATED", { pathId: path.id, title: path.title });
  return mapPath(path);
}

async function updatePath(id, data, adminId) {
  await getPathOrThrow(id);
  const path = await prisma.learningPath.update({ where: { id }, data, select: PATH_SELECT });
  await pathAuditLog(adminId, "LEARNING_PATH_UPDATED", { pathId: id, fields: Object.keys(data) });
  return mapPath(path);
}

async function deletePath(id, adminId) {
  await getPathOrThrow(id);
  // Items are removed by the DB cascade (onDelete: Cascade on LearningPathItem.path).
  await prisma.learningPath.delete({ where: { id } });
  await pathAuditLog(adminId, "LEARNING_PATH_DELETED", { pathId: id });
  return { id };
}

// ── Items ────────────────────────────────────────────────────────────────────────

async function addItem(pathId, data, adminId) {
  await getPathOrThrow(pathId);

  // The polymorphic ref has no db FK — verify the target exists for a clean 400.
  const ref = data.itemType === "COURSE"
    ? await prisma.course.findUnique({ where: { id: data.itemId }, select: { id: true } })
    : data.itemType === "LIVE_SESSION"
    ? await prisma.liveSession.findUnique({ where: { id: data.itemId }, select: { id: true } })
    : await prisma.quiz.findUnique({ where: { id: data.itemId }, select: { id: true } });
  if (!ref) throw domainError("REF_NOT_FOUND");

  // Default order = end of the current list, so a new item lands at the bottom.
  const order = data.order ?? (await prisma.learningPathItem.count({ where: { pathId } }));

  let item;
  try {
    item = await prisma.learningPathItem.create({
      data: { pathId, itemType: data.itemType, itemId: data.itemId, order },
      select: ITEM_SELECT,
    });
  } catch (err) {
    // @@unique([pathId, itemType, itemId]) — same item added twice.
    if (err.code === "P2002") throw domainError("DUPLICATE_ITEM");
    throw err;
  }

  await pathAuditLog(adminId, "LEARNING_PATH_ITEM_ADDED", { pathId, itemId: item.id, itemType: item.itemType, refId: item.itemId });
  const [resolved] = await resolveItems([item]);
  return resolved;
}

async function removeItem(pathId, itemId, adminId) {
  await getPathOrThrow(pathId);
  const item = await prisma.learningPathItem.findUnique({ where: { id: itemId }, select: { id: true, pathId: true } });
  if (!item || item.pathId !== pathId) throw domainError("ITEM_NOT_FOUND");

  await prisma.learningPathItem.delete({ where: { id: itemId } });
  await pathAuditLog(adminId, "LEARNING_PATH_ITEM_REMOVED", { pathId, itemId });
  return { id: itemId };
}

// ── Reorder (one atomic bulk write after drag-and-drop) ────────────────────────────

async function reorder(pathId, { items }, adminId) {
  await getPathOrThrow(pathId);

  // Every referenced item must belong to THIS path.
  const owned = await prisma.learningPathItem.findMany({ where: { pathId }, select: { id: true } });
  const ownedIds = new Set(owned.map((i) => i.id));
  for (const it of items) {
    if (!ownedIds.has(it.id)) throw domainError("ITEM_NOT_IN_PATH");
  }

  // One transaction: all order updates apply together or none do.
  await prisma.$transaction(
    items.map((it) => prisma.learningPathItem.update({ where: { id: it.id }, data: { order: it.order } })),
  );

  await pathAuditLog(adminId, "LEARNING_PATH_REORDERED", { pathId, items: items.length });
  return getPath(pathId);
}

module.exports = {
  listPaths,
  getPath,
  createPath,
  updatePath,
  deletePath,
  addItem,
  removeItem,
  reorder,
};
