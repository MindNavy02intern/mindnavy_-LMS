const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const VALID_ROLES = new Set(["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"]);
const VALID_STATUSES = new Set(["ACTIVE", "SUSPENDED", "PENDING", "ARCHIVED", "INVITED"]);

const ROLE_MAP = {
  LEARNER: "learner",
  INSTRUCTOR: "instructor",
  MANAGER: "manager",
  ADMIN_ASSISTANT: "admin_assistant",
};

const STATUS_MAP = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  PENDING: "pending",
  ARCHIVED: "archived",
  INVITED: "invited",
};

const VERIFICATION_MAP = {
  VERIFIED: "verified",
  PENDING: "pending",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Select fields used on every AppUser query — passwordHash intentionally excluded
const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  role: true,
  status: true,
  verificationState: true,
  lastActivityAt: true,
  riskScore: true,
  createdAt: true,
  updatedAt: true,
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function mapUser(u) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    avatar: u.avatar ?? null,
    role: ROLE_MAP[u.role] ?? u.role.toLowerCase(),
    status: STATUS_MAP[u.status] ?? u.status.toLowerCase(),
    verificationState: VERIFICATION_MAP[u.verificationState] ?? u.verificationState.toLowerCase(),
    lastActivityAt: u.lastActivityAt ? u.lastActivityAt.toISOString() : null,
    riskScore: u.riskScore ?? null,
    enrollmentCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Fire-and-forget audit log — errors must never crash the main request
async function createUserAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function assertUserExists(id) {
  const user = await prisma.appUser.findUnique({
    where: { id },
    select: USER_SELECT,
  });
  if (!user) throw makeError("User not found.", 404);
  return user;
}

async function ensureEmailAvailable(email, excludeId = null) {
  const where = { email };
  if (excludeId) where.id = { not: excludeId };
  const existing = await prisma.appUser.findFirst({ where, select: { id: true } });
  if (existing) throw makeError("A user with this email already exists.", 409);
}

// ─── Task 6A: User List ───────────────────────────────────────────────────────

async function getUsersList(query = {}, admin = {}) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const rawLimit = parseInt(query.limit);
  const limit = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 100 ? 10 : rawLimit;
  const search = typeof query.search === "string" ? query.search.trim() : "";

  const rawRole = typeof query.role === "string"
    ? query.role.trim().toUpperCase().replace(/[\s-]+/g, "_")
    : "";
  const rawStatus = typeof query.status === "string"
    ? query.status.trim().toUpperCase()
    : "";

  const roleFilter = VALID_ROLES.has(rawRole) ? rawRole : null;
  const statusFilter = VALID_STATUSES.has(rawStatus) ? rawStatus : null;

  const where = {};

  if (search) {
    const searchConditions = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    if (!roleFilter) {
      const normalizedForRole = search.toUpperCase().replace(/[\s-]+/g, "_");
      if (VALID_ROLES.has(normalizedForRole)) {
        searchConditions.push({ role: normalizedForRole });
      }
    }
    where.OR = searchConditions;
  }

  if (roleFilter) where.role = roleFilter;
  if (statusFilter) where.status = statusFilter;

  const skip = (page - 1) * limit;

  const [
    totalUsers,
    activeUsers,
    pendingVerification,
    suspendedUsers,
    invitationsPending,
    total,
    rawUsers,
  ] = await Promise.all([
    prisma.appUser.count(),
    prisma.appUser.count({ where: { status: "ACTIVE" } }),
    prisma.appUser.count({ where: { verificationState: "PENDING" } }),
    prisma.appUser.count({ where: { status: "SUSPENDED" } }),
    prisma.appUser.count({ where: { status: "INVITED" } }),
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        verificationState: true,
        lastActivityAt: true,
        riskScore: true,
        createdAt: true,
        // passwordHash intentionally excluded — must never be exposed
      },
    }),
  ]);

  await createUserAuditLog(admin.id, "USERS_LIST_VIEWED", {
    page,
    limit,
    search: search || null,
    role: roleFilter,
    status: statusFilter,
  });

  return {
    kpiSummary: {
      totalUsers,
      totalUsersChange: 0,
      activeUsers,
      activeUsersChange: 0,
      pendingVerification,
      pendingVerificationChange: 0,
      suspendedUsers,
      suspendedUsersChange: 0,
      invitationsPending,
      invitationsPendingChange: 0,
    },
    users: rawUsers.map(mapUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ─── Task 6B: User Details ────────────────────────────────────────────────────

async function getUserDetails(id, admin = {}) {
  if (!id || typeof id !== "string" || !id.trim()) {
    throw makeError("Invalid user id.", 400);
  }

  const sanitizedId = id.trim();

  if (!UUID_REGEX.test(sanitizedId)) {
    throw makeError("Invalid user id.", 400);
  }

  const user = await prisma.appUser.findUnique({
    where: { id: sanitizedId },
    select: USER_SELECT,
  });

  if (!user) {
    throw makeError("User not found.", 404);
  }

  await createUserAuditLog(admin.id, "USER_DETAILS_VIEWED", { userId: sanitizedId });

  return {
    user: {
      ...mapUser(user),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

// ─── Task 6C: User Actions ────────────────────────────────────────────────────

async function createUser(body, admin = {}) {
  const normalizedEmail = body.email.trim().toLowerCase();
  const normalizedFullName = body.fullName.trim();
  const normalizedRole = body.role.trim().toUpperCase();
  const normalizedStatus = body.status ? body.status.trim().toUpperCase() : "PENDING";
  const normalizedVerificationState = body.verificationState
    ? body.verificationState.trim().toUpperCase()
    : "PENDING";

  await ensureEmailAvailable(normalizedEmail);

  let passwordHash = null;
  if (body.password && normalizedStatus !== "INVITED") {
    passwordHash = await bcrypt.hash(body.password, 12);
  }

  let user;
  try {
    user = await prisma.appUser.create({
      data: {
        fullName: normalizedFullName,
        email: normalizedEmail,
        passwordHash,
        role: normalizedRole,
        status: normalizedStatus,
        verificationState: normalizedVerificationState,
      },
      select: USER_SELECT,
    });
  } catch (err) {
    // DB-level unique constraint as a last-resort guard
    if (err.code === "P2002") {
      throw makeError("A user with this email already exists.", 409);
    }
    throw err;
  }

  await createUserAuditLog(admin.id, "USER_CREATED", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    success: true,
    message: "User created successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function updateUser(id, body, admin = {}) {
  await assertUserExists(id);

  const updateData = {};
  const changedFields = [];

  if (body.fullName !== undefined) {
    updateData.fullName = body.fullName.trim();
    changedFields.push("fullName");
  }

  if (body.email !== undefined) {
    const normalizedEmail = body.email.trim().toLowerCase();
    await ensureEmailAvailable(normalizedEmail, id);
    updateData.email = normalizedEmail;
    changedFields.push("email");
  }

  if (body.avatar !== undefined) {
    updateData.avatar = body.avatar ? body.avatar.trim() : null;
    changedFields.push("avatar");
  }

  if (body.verificationState !== undefined) {
    updateData.verificationState = body.verificationState.trim().toUpperCase();
    changedFields.push("verificationState");
  }

  if (body.riskScore !== undefined) {
    updateData.riskScore = body.riskScore;
    changedFields.push("riskScore");
  }

  let user;
  try {
    user = await prisma.appUser.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw makeError("A user with this email already exists.", 409);
    }
    throw err;
  }

  await createUserAuditLog(admin.id, "USER_UPDATED", {
    userId: id,
    changedFields,
  });

  return {
    success: true,
    message: "User updated successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function updateUserStatus(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const newStatus = body.status.trim().toUpperCase();
  const reason = body.reason ? body.reason.trim() : null;

  const user = await prisma.appUser.update({
    where: { id },
    data: { status: newStatus },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_STATUS_CHANGED", {
    userId: id,
    oldStatus: existing.status,
    newStatus,
    reason,
  });

  return {
    success: true,
    message: "User status updated successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function resetUserPassword(id, body, admin = {}) {
  await assertUserExists(id);

  const passwordHash = await bcrypt.hash(body.newPassword, 12);

  await prisma.appUser.update({
    where: { id },
    data: { passwordHash },
  });

  await createUserAuditLog(admin.id, "USER_PASSWORD_RESET", { userId: id });

  return {
    success: true,
    message: "User password has been reset successfully.",
  };
}

async function assignUserRole(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const newRole = body.role.trim().toUpperCase();
  const reason = body.reason ? body.reason.trim() : null;

  const user = await prisma.appUser.update({
    where: { id },
    data: { role: newRole },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_ROLE_ASSIGNED", {
    userId: id,
    oldRole: existing.role,
    newRole,
    reason,
  });

  return {
    success: true,
    message: "User role assigned successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function deleteUser(id, admin = {}) {
  await assertUserExists(id);

  await prisma.appUser.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  await createUserAuditLog(admin.id, "USER_DELETED", {
    userId: id,
    reason: "ARCHIVED_BY_ADMIN",
  });

  return {
    success: true,
    message: "User archived successfully.",
  };
}

module.exports = {
  getUsersList,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  assignUserRole,
  deleteUser,
};
