const prisma = require("../config/prisma");

// ── Categories service (Category Management Center) ─────────────────────────────
//
// 2-level hierarchy: root categories + subcategories. Rules enforced here:
// - a parent must itself be a root (depth is never more than 2)
// - a category can never be its own parent
// - names are unique (case-insensitive) among siblings — checked app-side because
//   Postgres treats NULL parentId values as distinct in the composite unique
// - deleting is blocked while subcategories or assigned courses exist (no cascades)
// - courseCount is derived at read time (IMPACT_MAP R3), never stored
//
// Renames also resync the legacy `Course.category` string on linked courses (in
// the same transaction), so both representations stay consistent mid-migration.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[categories.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function categoryAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const NODE_SELECT = { id: true, name: true, parentId: true, createdAt: true, updatedAt: true };

function mapNode(c, courseCount = 0, children) {
  const node = {
    id:          c.id,
    name:        c.name,
    parentId:    c.parentId ?? null,
    courseCount,
    createdAt:   iso(c.createdAt),
    updatedAt:   iso(c.updatedAt),
  };
  if (children !== undefined) node.children = children;
  return node;
}

async function getCategoryOrThrow(id) {
  const c = await prisma.category.findUnique({ where: { id }, select: NODE_SELECT });
  if (!c) throw domainError("CATEGORY_NOT_FOUND");
  return c;
}

// Case-insensitive duplicate-name check among siblings (same parent scope).
async function assertNameFree(name, parentId, excludeId) {
  const dupe = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      parentId: parentId ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw domainError("DUPLICATE_CATEGORY");
}

// A valid parent exists AND is a root (2-level cap).
async function assertValidParent(parentId) {
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
  if (!parent) throw domainError("PARENT_NOT_FOUND");
  if (parent.parentId) throw domainError("MAX_DEPTH");
}

// ── Read: full tree with derived course counts ────────────────────────────────────

async function listCategories() {
  const [rows, counts] = await Promise.all([
    safe(() => prisma.category.findMany({ orderBy: { name: "asc" }, select: NODE_SELECT }), []),
    safe(() => prisma.course.groupBy({ by: ["categoryId"], where: { categoryId: { not: null } }, _count: { _all: true } }), []),
  ]);
  const countById = new Map(counts.map((g) => [g.categoryId, g._count._all]));

  const childrenByParent = new Map();
  for (const row of rows) {
    if (!row.parentId) continue;
    if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
    childrenByParent.get(row.parentId).push(mapNode(row, countById.get(row.id) ?? 0));
  }

  return rows
    .filter((row) => !row.parentId)
    .map((row) => mapNode(row, countById.get(row.id) ?? 0, childrenByParent.get(row.id) ?? []));
}

// ── Writes ────────────────────────────────────────────────────────────────────────

async function createCategory({ name, parentId }, adminId) {
  if (parentId) await assertValidParent(parentId);
  await assertNameFree(name, parentId);

  const category = await prisma.category.create({
    data: { name, parentId: parentId ?? null },
    select: NODE_SELECT,
  });

  await categoryAuditLog(adminId, "CATEGORY_CREATED", { categoryId: category.id, name, parentId: parentId ?? null });
  return mapNode(category, 0, parentId ? undefined : []);
}

async function updateCategory(id, data, adminId) {
  const current = await getCategoryOrThrow(id);

  const nextParentId = data.parentId !== undefined ? data.parentId : current.parentId;
  const nextName     = data.name     !== undefined ? data.name     : current.name;

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) throw domainError("SELF_PARENT");
    await assertValidParent(data.parentId);
    // Becoming a subcategory while having children would create depth 3.
    const childCount = await prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) throw domainError("HAS_CHILDREN_MOVE");
  }

  await assertNameFree(nextName, nextParentId, id);

  // Rename + the legacy Course.category string resync succeed or fail together.
  const [category] = await prisma.$transaction([
    prisma.category.update({ where: { id }, data, select: NODE_SELECT }),
    ...(data.name !== undefined && data.name !== current.name
      ? [prisma.course.updateMany({ where: { categoryId: id }, data: { category: data.name } })]
      : []),
  ]);

  await categoryAuditLog(adminId, "CATEGORY_UPDATED", { categoryId: id, fields: Object.keys(data) });
  const courseCount = await safe(() => prisma.course.count({ where: { categoryId: id } }), 0);
  return mapNode(category, courseCount);
}

async function deleteCategory(id, adminId) {
  const current = await getCategoryOrThrow(id);

  const [childCount, courseCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.course.count({ where: { categoryId: id } }),
  ]);
  if (childCount > 0)  throw domainError("HAS_CHILDREN_DELETE");
  if (courseCount > 0) throw domainError("HAS_COURSES");

  await prisma.category.delete({ where: { id } });
  await categoryAuditLog(adminId, "CATEGORY_DELETED", { categoryId: id, name: current.name });
  return { id };
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
