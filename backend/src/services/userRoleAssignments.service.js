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
async function createAssignmentAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, details: details ?? null },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// Explicit select — joins user + role in ONE query (no N+1), never leaks secrets.
const ASSIGNMENT_SELECT = {
  id: true, assignmentType: true, status: true, expiresAt: true,
  assignedBy: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, fullName: true, email: true, avatar: true } },
  role: { select: { id: true, name: true } },
};

// ── Auto-expire (Invitations pattern) ─────────────────────────────────────────

// Flip ACTIVE assignments whose expiry has passed to EXPIRED. One bounded
// updateMany — safe to call from the background interval AND lazily on reads.
async function expireNow() {
  try {
    const { count } = await prisma.userRoleAssignment.updateMany({
      where: { status: "ACTIVE", expiresAt: { not: null, lt: new Date() } },
      data:  { status: "EXPIRED" },
    });
    return count;
  } catch (err) {
    console.error("[userRoleAssignments] expireNow error:", err.message);
    return 0;
  }
}

// Throttled wrapper for read paths — runs expireNow at most once every 5 minutes
// so list/stats never hammer the DB while still showing fresh numbers.
let lastAutoExpireAt = 0;
const AUTO_EXPIRE_INTERVAL_MS = 5 * 60 * 1000;
async function autoExpire() {
  const now = Date.now();
  if (now - lastAutoExpireAt < AUTO_EXPIRE_INTERVAL_MS) return;
  lastAutoExpireAt = now;
  await expireNow();
}

// ── Stats ──────────────────────────────────────────────────────────────────────

async function getAssignmentStats() {
  await autoExpire();

  const [distinctUsers, multiRoleGroups, temporaryAssignments, expiredAssignments] = await Promise.all([
    // Distinct users that currently hold at least one active role.
    prisma.userRoleAssignment.groupBy({ by: ["userId"], where: { status: "ACTIVE" } }),
    // Users holding more than one active role.
    prisma.userRoleAssignment.groupBy({
      by: ["userId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
      having: { userId: { _count: { gt: 1 } } },
    }),
    prisma.userRoleAssignment.count({ where: { status: "ACTIVE", assignmentType: "TEMPORARY" } }),
    prisma.userRoleAssignment.count({ where: { status: "EXPIRED" } }),
  ]);

  return {
    totalUsersWithRoles:    distinctUsers.length,
    usersWithMultipleRoles: multiRoleGroups.length,
    temporaryAssignments,
    expiredAssignments,
  };
}

// ── List ─────────────────────────────────────────────────────────────────────

async function listAssignments({ search, assignmentType, status, page, limit } = {}) {
  await autoExpire();
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (status && status !== "ALL") where.status = status;
  if (assignmentType)             where.assignmentType = assignmentType;
  if (search) {
    where.user = {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email:    { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [total, rows] = await Promise.all([
    prisma.userRoleAssignment.count({ where }),
    prisma.userRoleAssignment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: ASSIGNMENT_SELECT,
    }),
  ]);

  return { data: rows, pagination: buildPagination(total, p, l) };
}

// ── Create / reactivate ────────────────────────────────────────────────────────

async function createAssignment({ userId, roleId, assignmentType, expiresAt }, adminId) {
  // Both the user and the role must exist → clean 404 instead of a raw FK error.
  const [user, role, existing] = await Promise.all([
    prisma.appUser.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
    prisma.userRoleAssignment.findUnique({
      where: { userId_roleId: { userId, roleId } },
      select: { id: true, status: true },
    }),
  ]);
  if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { code: "USER_NOT_FOUND" });
  if (!role) throw Object.assign(new Error("ROLE_NOT_FOUND"), { code: "ROLE_NOT_FOUND" });

  // Same (user, role) already live → conflict. If it had EXPIRED, reactivate it
  // (so an expired temporary role can be re-granted without a manual delete).
  if (existing) {
    if (existing.status === "ACTIVE") {
      throw Object.assign(new Error("ALREADY_ASSIGNED"), { code: "ALREADY_ASSIGNED" });
    }
    const reactivated = await prisma.userRoleAssignment.update({
      where: { id: existing.id },
      data:  { assignmentType, expiresAt, status: "ACTIVE", assignedBy: adminId ?? "system" },
      select: ASSIGNMENT_SELECT,
    });
    await createAssignmentAuditLog(adminId, "USER_ROLE_ASSIGNMENT_CREATED", {
      assignmentId: reactivated.id, userId, roleId, assignmentType, reactivated: true,
    });
    return reactivated;
  }

  const created = await prisma.userRoleAssignment.create({
    data: { userId, roleId, assignmentType, expiresAt, status: "ACTIVE", assignedBy: adminId ?? "system" },
    select: ASSIGNMENT_SELECT,
  });
  await createAssignmentAuditLog(adminId, "USER_ROLE_ASSIGNMENT_CREATED", {
    assignmentId: created.id, userId, roleId, assignmentType,
  });
  return created;
}

// ── Update (Edit) ──────────────────────────────────────────────────────────────

async function updateAssignment(id, data, adminId) {
  // Re-activate if the new expiry is in the future (or expiry is cleared).
  const patch = { ...data };
  if (Object.prototype.hasOwnProperty.call(data, "expiresAt")) {
    patch.status = "ACTIVE"; // a future/null expiry means the role is live again
  }

  const updated = await prisma.userRoleAssignment.update({
    where: { id },
    data: patch,
    select: ASSIGNMENT_SELECT,
  });
  await createAssignmentAuditLog(adminId, "USER_ROLE_ASSIGNMENT_UPDATED", {
    assignmentId: id, fields: Object.keys(data),
  });
  return updated;
}

// ── Delete ─────────────────────────────────────────────────────────────────────

async function deleteAssignment(id, adminId) {
  await prisma.userRoleAssignment.delete({ where: { id } });
  await createAssignmentAuditLog(adminId, "USER_ROLE_ASSIGNMENT_DELETED", { assignmentId: id });
}

module.exports = {
  expireNow,
  getAssignmentStats,
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
