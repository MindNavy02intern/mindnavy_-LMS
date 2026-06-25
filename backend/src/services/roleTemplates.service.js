const prisma = require("../config/prisma");

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

// Best-effort audit log — never breaks the primary operation (mirrors roles.service).
async function createTemplateAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, details: details ?? null },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// `permissions` is stored as a JSON value; normalise it to a string[] of IDs.
function permissionIdsOf(template) {
  return Array.isArray(template?.permissions) ? template.permissions : [];
}

// Verify every permission ID still exists. Throws INVALID_PERMISSIONS (with the
// missing IDs) so the caller returns a clean 400 instead of a raw error / 500.
async function assertPermissionsExist(ids) {
  if (ids.length === 0) return;
  const found = await prisma.permission.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    const foundSet = new Set(found.map((p) => p.id));
    const missing  = ids.filter((id) => !foundSet.has(id));
    throw Object.assign(new Error("INVALID_PERMISSIONS"), { code: "INVALID_PERMISSIONS", missing });
  }
}

// ── Role Templates ───────────────────────────────────────────────────────────

// List templates with a permission COUNT only — the raw ID array is never shipped
// to the list view, keeping the payload small. One count + one findMany, no N+1.
async function listRoleTemplates({ search, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.roleTemplate.count({ where }),
    prisma.roleTemplate.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, description: true,
        permissions: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);

  const data = rows.map(({ permissions, ...rest }) => ({
    ...rest,
    permissionCount: permissionIdsOf({ permissions }).length,
  }));

  return { data, pagination: buildPagination(total, p, l) };
}

// One template + its RESOLVED permission bundle (so the UI can show what's inside
// without N calls). Single findMany to resolve all IDs — no per-permission query.
async function getRoleTemplate(id) {
  const template = await prisma.roleTemplate.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true,
      permissions: true, createdAt: true, updatedAt: true,
    },
  });
  if (!template) return null;

  const ids = permissionIdsOf(template);
  const permissions = ids.length
    ? await prisma.permission.findMany({
        where: { id: { in: ids } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, category: true },
      })
    : [];

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? null,
    permissionCount: permissions.length,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    permissions,
  };
}

async function createRoleTemplate({ name, description, permissions }, adminId) {
  // Reject unknown permission IDs BEFORE writing — keeps the JSON bundle valid.
  await assertPermissionsExist(permissions);

  const template = await prisma.roleTemplate.create({
    data: { name, description, permissions },
    select: {
      id: true, name: true, description: true,
      permissions: true, createdAt: true, updatedAt: true,
    },
  });

  await createTemplateAuditLog(adminId, "ROLE_TEMPLATE_CREATED", {
    templateId: template.id, name: template.name, count: permissions.length,
  });

  const { permissions: perms, ...rest } = template;
  return { ...rest, permissionCount: permissionIdsOf({ permissions: perms }).length };
}

// Apply a template's bundle to an existing Role (MERGE — additive & idempotent).
// Returns how many NEW permission rows were added.
async function applyRoleTemplate(id, roleId, adminId) {
  const [template, role] = await Promise.all([
    prisma.roleTemplate.findUnique({ where: { id }, select: { id: true, name: true, permissions: true } }),
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
  ]);
  if (!template) throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  if (!role)     throw Object.assign(new Error("ROLE_NOT_FOUND"),     { code: "ROLE_NOT_FOUND" });

  const ids = permissionIdsOf(template);
  if (ids.length === 0) {
    await createTemplateAuditLog(adminId, "ROLE_TEMPLATE_APPLIED", { templateId: id, roleId, applied: 0 });
    return { templateId: id, roleId, applied: 0 };
  }

  // Every ID must still exist (the bundle is JSON, not an FK) → clean 400 if not.
  await assertPermissionsExist(ids);

  // skipDuplicates makes this a non-destructive merge; result.count = rows added.
  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.rolePermission.createMany({
      data: ids.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
    await tx.auditLog.create({
      data: {
        adminId: adminId ?? null,
        action: "ROLE_TEMPLATE_APPLIED",
        details: { templateId: id, templateName: template.name, roleId, applied: r.count },
      },
    });
    return r;
  });

  return { templateId: id, roleId, applied: result.count };
}

async function deleteRoleTemplate(id, adminId) {
  await prisma.roleTemplate.delete({ where: { id } });
  await createTemplateAuditLog(adminId, "ROLE_TEMPLATE_DELETED", { templateId: id });
}

module.exports = {
  listRoleTemplates,
  getRoleTemplate,
  createRoleTemplate,
  applyRoleTemplate,
  deleteRoleTemplate,
};
