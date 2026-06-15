const prisma = require("../config/prisma");

// ── Role name → AppUserRole enum mapping ──────────────────────────────────────
// AppUser.role is a plain enum (LEARNER | INSTRUCTOR | MANAGER | ADMIN_ASSISTANT),
// not a FK to the Role table. Map display names to enum values so we can count users.

const APP_USER_ROLES = ["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"];
const ROLE_NAME_ALIAS = { ADMINISTRATOR: "ADMIN_ASSISTANT", ADMIN: "ADMIN_ASSISTANT" };

function roleNameToEnum(name) {
  const upper = String(name).toUpperCase().replace(/[\s-]+/g, "_");
  if (APP_USER_ROLES.includes(upper)) return upper;
  return ROLE_NAME_ALIAS[upper] ?? null;
}

// Returns a { LEARNER: N, INSTRUCTOR: N, ... } count map from one groupBy query.
async function getUserCountByEnum() {
  const rows = await prisma.appUser.groupBy({
    by: ["role"],
    _count: { role: true },
  });
  return Object.fromEntries(rows.map((r) => [r.role, r._count.role]));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

// ── Roles ─────────────────────────────────────────────────────────────────────

async function listRoles({ search, status, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status && status !== "ALL") where.status = status;

  const [total, rows, countByEnum] = await Promise.all([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, description: true,
        status: true, createdAt: true, updatedAt: true,
      },
    }),
    getUserCountByEnum(),
  ]);

  const data = rows.map((r) => {
    const enumVal = roleNameToEnum(r.name);
    return { ...r, userCount: enumVal ? (countByEnum[enumVal] ?? 0) : 0, isCustomRole: !enumVal };
  });
  return { data, pagination: buildPagination(total, p, l) };
}

async function getRole(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  if (!role) return null;

  const enumVal = roleNameToEnum(role.name);
  const userCount = enumVal
    ? await prisma.appUser.count({ where: { role: enumVal } })
    : 0;

  return {
    id: role.id,
    name: role.name,
    description: role.description ?? null,
    status: role.status,
    userCount,
    isCustomRole: !enumVal,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissions: role.rolePermissions.map((rp) => rp.permission),
  };
}

async function createRole({ name, description, status }) {
  return prisma.role.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      status: status || "ACTIVE",
    },
    select: {
      id: true, name: true, description: true,
      status: true, createdAt: true, updatedAt: true,
    },
  });
}

async function updateRole(id, { name, description, status }) {
  const data = {};
  if (name      !== undefined) data.name        = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (status    !== undefined) data.status       = status;

  return prisma.role.update({
    where: { id },
    data,
    select: {
      id: true, name: true, description: true,
      status: true, createdAt: true, updatedAt: true,
    },
  });
}

async function deleteRole(id) {
  await prisma.role.delete({ where: { id } });
}

// ── Role Permissions ───────────────────────────────────────────────────────────

async function getRolePermissions(roleId) {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
    orderBy: { assignedAt: "asc" },
  });
  return rows.map((r) => r.permission);
}

async function assignPermissionsToRole(roleId, permissionIds) {
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });
  }

  return getRolePermissions(roleId);
}

// ── Permissions ────────────────────────────────────────────────────────────────

async function listPermissions({ search, category, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search)   where.name     = { contains: search, mode: "insensitive" };
  if (category && category !== "ALL") where.category = category;

  const [total, rows] = await Promise.all([
    prisma.permission.count({ where }),
    prisma.permission.findMany({
      where,
      skip,
      take,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, description: true,
        category: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);

  return { data: rows, pagination: buildPagination(total, p, l) };
}

async function getPermission(id) {
  return prisma.permission.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true,
      category: true, createdAt: true, updatedAt: true,
    },
  });
}

async function createPermission({ name, description, category }) {
  return prisma.permission.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      category,
    },
    select: {
      id: true, name: true, description: true,
      category: true, createdAt: true, updatedAt: true,
    },
  });
}

async function updatePermission(id, { name, description, category }) {
  const data = {};
  if (name        !== undefined) data.name        = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (category    !== undefined) data.category    = category;

  return prisma.permission.update({
    where: { id },
    data,
    select: {
      id: true, name: true, description: true,
      category: true, createdAt: true, updatedAt: true,
    },
  });
}

async function deletePermission(id) {
  await prisma.permission.delete({ where: { id } });
}

module.exports = {
  listRoles, getRole, createRole, updateRole, deleteRole,
  getRolePermissions, assignPermissionsToRole,
  listPermissions, getPermission, createPermission, updatePermission, deletePermission,
};
