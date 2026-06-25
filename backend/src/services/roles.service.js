
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

// Best-effort audit log — never breaks the primary operation (mirrors users.service).
async function createRoleAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, details: details ?? null },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
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
        _count: { select: { rolePermissions: true } },
      },
    }),
    getUserCountByEnum(),
  ]);

  const data = rows.map((r) => {
    const enumVal = roleNameToEnum(r.name);
    const { _count, ...rest } = r;
    return {
      ...rest,
      permissionCount: _count.rolePermissions,
      userCount: enumVal ? (countByEnum[enumVal] ?? 0) : 0,
      isCustomRole: !enumVal,
    };
  });
  return { data, pagination: buildPagination(total, p, l) };
}

async function getRole(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, status: true,
      createdAt: true, updatedAt: true,
      rolePermissions: {
        orderBy: { assignedAt: "asc" },
        select: {
          permission: {
            select: { id: true, name: true, description: true, category: true },
          },
        },
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
    permissionCount: role.rolePermissions.length,
    isCustomRole: !enumVal,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissions: role.rolePermissions.map((rp) => rp.permission),
  };
}

async function createRole({ name, description, status }, adminId) {
  const role = await prisma.role.create({
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
  await createRoleAuditLog(adminId, "ROLE_CREATED", { roleId: role.id, name: role.name });
  return role;
}

async function updateRole(id, { name, description, status }, adminId) {
  const data = {};
  if (name      !== undefined) data.name        = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (status    !== undefined) data.status       = status;

  const role = await prisma.role.update({
    where: { id },
    data,
    select: {
      id: true, name: true, description: true,
      status: true, createdAt: true, updatedAt: true,
    },
  });
  await createRoleAuditLog(adminId, "ROLE_UPDATED", { roleId: id, fields: Object.keys(data) });
  return role;
}

async function deleteRole(id, adminId) {
  const role = await prisma.role.findUnique({ where: { id }, select: { name: true } });
  if (role) {
    const enumVal = roleNameToEnum(role.name);
    if (enumVal) {
      const userCount = await prisma.appUser.count({ where: { role: enumVal } });
      if (userCount > 0) {
        throw Object.assign(new Error('ROLE_HAS_USERS'), { code: 'ROLE_HAS_USERS', userCount, roleName: role.name });
      }
    }
  }
  await prisma.role.delete({ where: { id } });
  await createRoleAuditLog(adminId, "ROLE_DELETED", { roleId: id, name: role?.name ?? null });
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

async function assignPermissionsToRole(roleId, permissionIds, adminId) {
  // 1. Role must exist (clean 404 instead of a raw FK error).
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throw Object.assign(new Error("ROLE_NOT_FOUND"), { code: "ROLE_NOT_FOUND" });

  // 2. Every permissionId must exist — fail BEFORE touching existing assignments.
  if (permissionIds.length > 0) {
    const found = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });
    if (found.length !== permissionIds.length) {
      const foundSet = new Set(found.map((p) => p.id));
      const missing  = permissionIds.filter((id) => !foundSet.has(id));
      throw Object.assign(new Error("INVALID_PERMISSIONS"), { code: "INVALID_PERMISSIONS", missing });
    }
  }

  // 3. Atomic replace — old permissions are only removed if the new set is valid.
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
  });

  await createRoleAuditLog(adminId, "ROLE_PERMISSIONS_UPDATED", { roleId, count: permissionIds.length });
  return getRolePermissions(roleId);
}

// ── Permission Matrix ────────────────────────────────────────────────────────

// One compact payload for the matrix tab: roles, permissions, and the cells
// (assignments) connecting them. Three queries total — no per-role/per-permission
// loops. Caps are applied by the caller (validator) so the payload stays bounded.
async function getPermissionMatrix({ roleStatus, category, search, maxRoles, maxPermissions } = {}) {
  const roleWhere = {};
  if (roleStatus && roleStatus !== "ALL") roleWhere.status = roleStatus;

  const permWhere = {};
  if (category) permWhere.category = category;

  if (search) {
    const term = { contains: search, mode: "insensitive" };
    // "Search roles or permissions" implies OR, not AND — applying the same
    // term to both independently (the previous behavior) meant searching a
    // role name with no identically-named permission (e.g. "Content Manager")
    // returned that role with zero permission rows, hiding every cell for it.
    // Only filter a dimension by the term if something on that dimension
    // actually matches; if neither matches, keep both filters so the result
    // is legitimately empty (typo/no-match search).
    const [roleMatchCount, permMatchCount] = await Promise.all([
      prisma.role.count({ where: { ...roleWhere, name: term } }),
      prisma.permission.count({ where: { ...permWhere, name: term } }),
    ]);
    if (roleMatchCount > 0 || permMatchCount > 0) {
      if (roleMatchCount > 0) roleWhere.name = term;
      if (permMatchCount > 0) permWhere.name = term;
    } else {
      roleWhere.name = term;
      permWhere.name = term;
    }
  }

  // Roles, permissions, and the user-count map fetched in parallel.
  const [roles, permissions, countByEnum] = await Promise.all([
    prisma.role.findMany({
      where: roleWhere,
      take: maxRoles,
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, description: true, status: true,
        _count: { select: { rolePermissions: true } },
      },
    }),
    prisma.permission.findMany({
      where: permWhere,
      take: maxPermissions,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true, category: true },
    }),
    getUserCountByEnum(),
  ]);

  const roleIds       = roles.map((r) => r.id);
  const permissionIds = permissions.map((p) => p.id);

  // Scope assignments to the returned roles AND permissions so the matrix never
  // contains a cell referencing something outside the (capped/filtered) lists.
  const assignments = roleIds.length && permissionIds.length
    ? await prisma.rolePermission.findMany({
        where: { roleId: { in: roleIds }, permissionId: { in: permissionIds } },
        select: { roleId: true, permissionId: true },
      })
    : [];

  const rolesOut = roles.map((r) => {
    const { _count, ...rest } = r;
    const enumVal = roleNameToEnum(r.name);
    return {
      ...rest,
      userCount: enumVal ? (countByEnum[enumVal] ?? 0) : 0,
      permissionCount: _count.rolePermissions,
    };
  });

  return {
    roles: rolesOut,
    permissions,
    assignments,
    summary: {
      totalRoles: rolesOut.length,
      totalPermissions: permissions.length,
      totalAssignments: assignments.length,
    },
  };
}

// Toggle a single matrix cell. Idempotent both ways, and the write + audit log
// happen together in one transaction.
async function togglePermissionMatrixCell({ roleId, permissionId, enabled }, adminId) {
  // Existence checks (parallel) → clean 404s instead of a raw FK error.
  const [role, permission] = await Promise.all([
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
    prisma.permission.findUnique({ where: { id: permissionId }, select: { id: true } }),
  ]);
  if (!role)       throw Object.assign(new Error("ROLE_NOT_FOUND"), { code: "ROLE_NOT_FOUND" });
  if (!permission) throw Object.assign(new Error("PERMISSION_NOT_FOUND"), { code: "PERMISSION_NOT_FOUND" });

  await prisma.$transaction(async (tx) => {
    if (enabled) {
      // skipDuplicates makes the create idempotent (no error if the cell exists).
      await tx.rolePermission.createMany({
        data: [{ roleId, permissionId }],
        skipDuplicates: true,
      });
    } else {
      // deleteMany is idempotent (no error if the cell is already absent).
      await tx.rolePermission.deleteMany({ where: { roleId, permissionId } });
    }
    await tx.auditLog.create({
      data: {
        adminId: adminId ?? null,
        action: "ROLE_PERMISSIONS_UPDATED",
        details: { roleId, permissionId, enabled, source: "matrix" },
      },
    });
  });

  return { roleId, permissionId, enabled };
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

// ── Stats & duplicate ────────────────────────────────────────────────────────

// Real aggregate numbers for the Roles & Permissions page header.
async function getRolesStats() {
  const [totalRoles, statusGroups, totalPermissions, countByEnum] = await Promise.all([
    prisma.role.count(),
    prisma.role.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.permission.count(),
    getUserCountByEnum(),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.status]));
  const usersWithRoles = Object.values(countByEnum).reduce((sum, n) => sum + n, 0);

  return {
    totalRoles,
    activeRoles:     byStatus.ACTIVE   ?? 0,
    inactiveRoles:   byStatus.INACTIVE ?? 0,
    totalPermissions,
    usersWithRoles,
  };
}

// Clone a role (and its permission set) under a unique "<name> (Copy[ n])" name.
async function duplicateRole(id, adminId) {
  const source = await prisma.role.findUnique({
    where: { id },
    select: {
      name: true, description: true, status: true,
      rolePermissions: { select: { permissionId: true } },
    },
  });
  if (!source) throw Object.assign(new Error("ROLE_NOT_FOUND"), { code: "ROLE_NOT_FOUND" });

  // Find a free name (unique constraint on Role.name).
  let newName = `${source.name} (Copy)`;
  let suffix  = 2;
  while (await prisma.role.findUnique({ where: { name: newName }, select: { id: true } })) {
    newName = `${source.name} (Copy ${suffix++})`;
  }

  const created = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { name: newName, description: source.description, status: source.status },
      select: {
        id: true, name: true, description: true,
        status: true, createdAt: true, updatedAt: true,
      },
    });
    if (source.rolePermissions.length > 0) {
      await tx.rolePermission.createMany({
        data: source.rolePermissions.map((rp) => ({ roleId: role.id, permissionId: rp.permissionId })),
        skipDuplicates: true,
      });
    }
    return role;
  });

  await createRoleAuditLog(adminId, "ROLE_DUPLICATED", {
    sourceRoleId: id, newRoleId: created.id, name: created.name,
  });

  return {
    ...created,
    permissionCount: source.rolePermissions.length,
    userCount: 0,
    isCustomRole: !roleNameToEnum(created.name),
  };
}

module.exports = {
  listRoles, getRole, createRole, updateRole, deleteRole,
  getRolePermissions, assignPermissionsToRole,
  listPermissions, getPermission, createPermission, updatePermission, deletePermission,
  getRolesStats, duplicateRole,
  getPermissionMatrix, togglePermissionMatrixCell,
};
