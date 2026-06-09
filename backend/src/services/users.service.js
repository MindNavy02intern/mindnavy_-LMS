const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const prisma = require("../config/prisma");
const {
  MAX_IMPORT_ROWS,
  MAX_RETURNED_ERRORS,
  validateHeaders,
  validateImportRows,
} = require("../validators/usersImport.validator");

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
  emailVerified: true,
  phoneVerified: true,
  phone: true,
  department: true,
  branch: true,
  groupId: true,
  accessLevel: true,
  managerId: true,
  skills: true,
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
    emailVerified: u.emailVerified ?? false,
    phoneVerified: u.phoneVerified ?? false,
    phone: u.phone ?? null,
    department: u.department ?? null,
    branch: u.branch ?? null,
    groupId: u.groupId ?? null,
    accessLevel: u.accessLevel ?? null,
    managerId: u.managerId ?? null,
    skills: u.skills ?? [],
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
  const rawVerificationState = typeof query.verificationState === "string"
    ? query.verificationState.trim().toUpperCase()
    : "";
  const rawDepartment = typeof query.department === "string"
    ? query.department.trim()
    : "";

  const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);

  const roleFilter              = VALID_ROLES.has(rawRole)              ? rawRole              : null;
  const statusFilter            = VALID_STATUSES.has(rawStatus)         ? rawStatus            : null;
  const verificationStateFilter = VALID_VERIFICATION_STATES.has(rawVerificationState) ? rawVerificationState : null;
  const departmentFilter        = rawDepartment || null;

  const rawCreatedAfter  = typeof query.createdAfter  === "string" ? query.createdAfter.trim()  : "";
  const rawCreatedBefore = typeof query.createdBefore === "string" ? query.createdBefore.trim() : "";
  const createdAfterDate  = rawCreatedAfter  ? new Date(rawCreatedAfter)  : null;
  const createdBeforeDate = rawCreatedBefore ? new Date(rawCreatedBefore) : null;

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

  if (roleFilter)              where.role              = roleFilter;
  if (statusFilter)            where.status            = statusFilter;
  if (verificationStateFilter) where.verificationState = verificationStateFilter;
  if (departmentFilter)        where.department        = { equals: departmentFilter, mode: "insensitive" };
  if (createdAfterDate && !isNaN(createdAfterDate.getTime()))  where.createdAt = { ...where.createdAt, gte: createdAfterDate };
  if (createdBeforeDate && !isNaN(createdBeforeDate.getTime())) where.createdAt = { ...where.createdAt, lte: createdBeforeDate };

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
        phone: true,
        department: true,
        branch: true,
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
    roles: [],
    securityOverview: {
      mfaEnabled: false,
      activeSessions: 0,
      lastIpAddress: null,
      lastLocation: null,
      riskScore: "low",
    },
    recentActivity: [],
    enrolledCourses: [],
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
        fullName:          normalizedFullName,
        email:             normalizedEmail,
        passwordHash,
        role:              normalizedRole,
        status:            normalizedStatus,
        verificationState: normalizedVerificationState,
        phone:       body.phone       ? body.phone.trim()       : null,
        department:  body.department  ? body.department.trim()  : null,
        branch:      body.branch      ? body.branch.trim()      : null,
        groupId:     body.groupId     ? body.groupId.trim()     : null,
        accessLevel: body.accessLevel ? body.accessLevel.trim() : null,
        managerId:   body.managerId   ? body.managerId.trim()   : null,
        skills:      Array.isArray(body.skills) ? body.skills   : [],
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

  if (body.phone !== undefined) {
    updateData.phone = body.phone ? body.phone.trim() : null;
    changedFields.push("phone");
  }

  if (body.department !== undefined) {
    updateData.department = body.department ? body.department.trim() : null;
    changedFields.push("department");
  }

  if (body.branch !== undefined) {
    updateData.branch = body.branch ? body.branch.trim() : null;
    changedFields.push("branch");
  }

  if (body.groupId !== undefined) {
    updateData.groupId = body.groupId ? body.groupId.trim() : null;
    changedFields.push("groupId");
  }

  if (body.accessLevel !== undefined) {
    updateData.accessLevel = body.accessLevel ? body.accessLevel.trim() : null;
    changedFields.push("accessLevel");
  }

  if (body.managerId !== undefined) {
    updateData.managerId = body.managerId ? body.managerId.trim() : null;
    changedFields.push("managerId");
  }

  if (body.skills !== undefined) {
    updateData.skills = Array.isArray(body.skills) ? body.skills : [];
    changedFields.push("skills");
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

async function suspendUser(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const reason = body.reason.trim();
  const notes = body.notes ? body.notes.trim() : null;

  const user = await prisma.appUser.update({
    where: { id },
    data: { status: "SUSPENDED" },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_SUSPENDED", {
    userId: id,
    oldStatus: existing.status,
    newStatus: "SUSPENDED",
    reason,
    notes,
  });

  return {
    success: true,
    message: "User suspended successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function reactivateUser(id, admin = {}) {
  const existing = await assertUserExists(id);

  const user = await prisma.appUser.update({
    where: { id },
    data: { status: "ACTIVE" },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_REACTIVATED", {
    userId: id,
    oldStatus: existing.status,
    newStatus: "ACTIVE",
  });

  return {
    success: true,
    message: "User reactivated successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function assignUserRole(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const newRole = body.roleId.trim().toUpperCase();
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

// ─── Task 6D: User Analytics ──────────────────────────────────────────────────

async function getUsersAnalytics(admin = {}) {
  const now = new Date();

  // Time boundaries
  const startOfToday     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last7d           = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const last30d          = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),     1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [
    totalUsers,
    roleGroups,
    departmentGroups,
    verificationGroups,
    thisMonthCount,
    lastMonthCount,
    activeToday,
    activeLast7d,
    activityLast30d,
  ] = await Promise.all([
    prisma.appUser.count(),
    prisma.appUser.groupBy({ by: ["role"],             _count: { _all: true } }),
    prisma.appUser.groupBy({ by: ["department"],       _count: { _all: true }, where: { department: { not: null } } }),
    prisma.appUser.groupBy({ by: ["verificationState"], _count: { _all: true } }),
    prisma.appUser.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.appUser.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: startOfToday } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: last7d } } }),
    prisma.appUser.findMany({ where: { lastActivityAt: { gte: last30d } }, select: { lastActivityAt: true } }),
  ]);

  // usersByRole — uppercase names + percentage
  const ALL_ROLES = ["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"];
  const roleCountMap = {};
  for (const g of roleGroups) roleCountMap[g.role] = g._count._all;
  const usersByRole = ALL_ROLES.map((r) => {
    const count = roleCountMap[r] ?? 0;
    return { role: r, count, percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0 };
  });

  // usersByDepartment — top 10, descending count, no nulls
  const usersByDepartment = departmentGroups
    .filter((g) => g.department)
    .map((g) => ({ department: g.department, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // newUsersThisMonth — % change vs last month
  const changePercentage =
    lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 1000) / 10
      : thisMonthCount > 0 ? 100 : 0;
  const newUsersThisMonth = { count: thisMonthCount, changePercentage };

  // userActivity — 30-day dailyTrend based on lastActivityAt
  const activityMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    activityMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of activityLast30d) {
    if (u.lastActivityAt) {
      const key = u.lastActivityAt.toISOString().slice(0, 10);
      if (key in activityMap) activityMap[key]++;
    }
  }
  const dailyTrend = Object.entries(activityMap).map(([date, count]) => ({ date, count }));
  const userActivity = { activeToday, activeThisWeek: activeLast7d, dailyTrend };

  // verificationStatus — lowercase status names + percentage
  const ALL_VERIFICATION = ["VERIFIED", "PENDING", "REJECTED", "EXPIRED"];
  const verificationCountMap = {};
  for (const g of verificationGroups) verificationCountMap[g.verificationState] = g._count._all;
  const verificationStatus = ALL_VERIFICATION.map((v) => {
    const count = verificationCountMap[v] ?? 0;
    return {
      status:     VERIFICATION_MAP[v] ?? v.toLowerCase(),
      count,
      percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0,
    };
  });

  // Audit log — failure must not crash the request
  try {
    await prisma.auditLog.create({
      data: { adminId: admin.id ?? null, action: "USER_ANALYTICS_VIEWED", details: null },
    });
  } catch (err) {
    console.error("Audit log error (USER_ANALYTICS_VIEWED):", err.message);
  }

  return {
    usersByRole,
    usersByDepartment,
    newUsersThisMonth,
    userActivity,
    verificationStatus,
  };
}

// ─── Task 6E: Bulk User Import ────────────────────────────────────────────────

async function importUsersFromCsv(file, admin = {}) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    const err = new Error("Empty CSV file.");
    err.statusCode = 400;
    throw err;
  }

  // Strip BOM that Windows CSV exports sometimes prepend
  const csvContent = file.buffer.toString("utf8").replace(/^﻿/, "");

  let rawRows;
  try {
    rawRows = parse(csvContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch {
    const err = new Error("Invalid CSV file.");
    err.statusCode = 400;
    throw err;
  }

  if (!rawRows || rawRows.length < 1) {
    const err = new Error("Empty CSV file.");
    err.statusCode = 400;
    throw err;
  }

  // First row is the header row; trim each header name
  const headers = rawRows[0].map((h) => (typeof h === "string" ? h.trim() : String(h)));
  const headerError = validateHeaders(headers);
  if (headerError) {
    const err = new Error(headerError);
    err.statusCode = 400;
    throw err;
  }

  const dataRows = rawRows.slice(1);
  const totalRows = dataRows.length;

  if (totalRows === 0) {
    return {
      success: true,
      message: "Import completed.",
      summary: { totalRows: 0, created: 0, failed: 0, skipped: 0 },
      errors: [],
    };
  }

  if (totalRows > MAX_IMPORT_ROWS) {
    const err = new Error(`CSV exceeds the maximum of ${MAX_IMPORT_ROWS} rows.`);
    err.statusCode = 400;
    throw err;
  }

  // Map each raw row array to an object keyed by header name
  const rowObjects = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });

  // Validate all rows — passwords are never logged inside this call
  const {
    validRows: initialValidRows,
    failedCount: validationFailed,
    returnedErrors,
  } = validateImportRows(rowObjects);

  let finalValidRows = initialValidRows;
  let dbDuplicateFailed = 0;

  // Check for emails that already exist — one DB round-trip for the whole batch
  if (finalValidRows.length > 0) {
    const emailsToCheck = finalValidRows.map((r) => r.email);
    const existingUsers = await prisma.appUser.findMany({
      where: { email: { in: emailsToCheck } },
      select: { email: true },
    });

    if (existingUsers.length > 0) {
      const existingSet = new Set(existingUsers.map((u) => u.email));
      const duplicates = finalValidRows.filter((r) => existingSet.has(r.email));
      dbDuplicateFailed = duplicates.length;

      for (const dup of duplicates) {
        if (returnedErrors.length < MAX_RETURNED_ERRORS) {
          returnedErrors.push({
            row: dup.rowIndex,
            email: dup.email,
            message: "Email already exists in the system.",
          });
        }
      }

      finalValidRows = finalValidRows.filter((r) => !existingSet.has(r.email));
    }
  }

  // Hash passwords for every row that passed all checks — never log or return plain password
  const usersToCreate = await Promise.all(
    finalValidRows.map(async ({ rowIndex, password, ...fields }) => {
      const passwordHash = await bcrypt.hash(password, 12);
      return { ...fields, passwordHash };
    })
  );

  let created = 0;
  if (usersToCreate.length > 0) {
    const batchResult = await prisma.appUser.createMany({
      data: usersToCreate,
      skipDuplicates: true,
    });
    created = batchResult.count;
  }

  const failed = totalRows - created;
  const skipped = failed;
  const message = failed === 0 ? "Import completed." : "Import completed with errors.";

  await createUserAuditLog(admin.id, "USERS_IMPORTED", { totalRows, created, failed, skipped });

  return {
    success: true,
    message,
    summary: { totalRows, created, failed, skipped },
    errors: returnedErrors,
  };
}

// ── bulkActionUsers (Task 6E) ─────────────────────────────────────────────────

async function bulkActionUsers(body, admin) {
  const VALID_ACTIONS = new Set(["suspend", "reactivate", "delete", "assign_role", "notify"]);

  const action =
    typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  if (!VALID_ACTIONS.has(action)) {
    const err = new Error(
      `Invalid action: "${action}". Must be one of: ${[...VALID_ACTIONS].join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id) => typeof id === "string" && id.trim())
    : [];
  if (userIds.length === 0) {
    const err = new Error("userIds must be a non-empty array of strings.");
    err.statusCode = 400;
    throw err;
  }

  const params =
    body.params && typeof body.params === "object" ? body.params : {};

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const id of userIds) {
    try {
      if (action === "suspend") {
        await suspendUser(id, { reason: params.reason || "Bulk action", notes: null }, admin);
      } else if (action === "reactivate") {
        await reactivateUser(id, admin);
      } else if (action === "delete") {
        await deleteUser(id, admin);
      } else if (action === "assign_role") {
        const roleId = params.role || params.roleId;
        await assignUserRole(id, { roleId, type: "primary", expiresAt: null }, admin);
      } else if (action === "notify") {
        console.log(`[bulk:notify] user=${id} message=${params.message || "(none)"}`);
      }
      succeeded++;
    } catch (err) {
      failed++;
      errors.push({ id, message: err.message || "Unknown error" });
    }
  }

  return {
    success: true,
    message: `Bulk ${action}: ${succeeded} succeeded, ${failed} failed`,
    succeeded,
    failed,
    errors,
  };
}

module.exports = {
  getUsersList,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  getUsersAnalytics,
  importUsersFromCsv,
  bulkActionUsers,
};
