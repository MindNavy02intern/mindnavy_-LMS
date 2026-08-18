const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const prisma = require("../config/prisma");
const {
  MAX_IMPORT_ROWS,
  MAX_RETURNED_ERRORS,
  validateHeaders,
  validateImportRows,
} = require("../validators/usersImport.validator");
const { normalizeViolationType } = require("../validators/users.validator");
const { sendInAppNotification } = require("./notifications.service");
const { fireAutomationTrigger } = require("./automationTriggers.service");
const { deleteEnrollment } = require("./enrollments.service");
const { sendMail } = require("../utils/mailer");

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

// Safe fields returned for every AdminMessage — no sender credentials exposed
const MESSAGE_SELECT = {
  id:             true,
  receiverUserId: true,
  subject:        true,
  body:           true,
  status:         true,
  readAt:         true,
  createdAt:      true,
};

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
  suspendedAt: true,
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
    suspendedAt: u.suspendedAt ? u.suspendedAt.toISOString() : null,
    enrollmentCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Fire-and-forget audit log — errors must never crash the main request.
// Dual-write: `details.userId` stays for existing readers, and is promoted to
// the indexed `targetUserId` column for fast per-user activity queries.
async function createUserAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.userId === "string" ? details.userId : null,
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
  const rawBranch = typeof query.branch === "string"
    ? query.branch.trim()
    : "";

  const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);

  const roleFilter              = VALID_ROLES.has(rawRole)              ? rawRole              : null;
  const statusFilter            = VALID_STATUSES.has(rawStatus)         ? rawStatus            : null;
  const verificationStateFilter = VALID_VERIFICATION_STATES.has(rawVerificationState) ? rawVerificationState : null;
  const departmentFilter        = rawDepartment || null;
  const branchFilter            = rawBranch     || null;

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
  // Exclude ARCHIVED by default; only show them when explicitly filtered with status=ARCHIVED
  if (statusFilter) {
    where.status = statusFilter;
  } else {
    where.status = { not: "ARCHIVED" };
  }
  if (verificationStateFilter) where.verificationState = verificationStateFilter;
  if (departmentFilter)        where.department        = { equals: departmentFilter, mode: "insensitive" };
  if (branchFilter)            where.branch            = { equals: branchFilter,     mode: "insensitive" };
  if (createdAfterDate && !isNaN(createdAfterDate.getTime()))  where.createdAt = { ...where.createdAt, gte: createdAfterDate };
  if (createdBeforeDate && !isNaN(createdBeforeDate.getTime())) where.createdAt = { ...where.createdAt, lte: createdBeforeDate };

  const skip = (page - 1) * limit;

  // Month boundaries for KPI change calculations
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [
    globalStatusCounts,
    pendingVerification,
    invitationsPending,
    total,
    rawUsers,
    thisMonthCounts,
    lastMonthCounts,
  ] = await Promise.all([
    prisma.appUser.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.appUser.count({ where: { verificationState: "PENDING", status: { not: "ARCHIVED" } } }),
    prisma.invitation.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: USER_SELECT,
    }),
    prisma.appUser.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: startOfThisMonth } } }),
    prisma.appUser.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
  ]);

  function pickCount(groups, status) {
    return groups.find((g) => g.status === status)?._count._all ?? 0;
  }

  const totalUsers      = globalStatusCounts.filter((g) => g.status !== "ARCHIVED").reduce((s, g) => s + g._count._all, 0);
  const activeUsers     = pickCount(globalStatusCounts, "ACTIVE");
  const suspendedUsers  = pickCount(globalStatusCounts, "SUSPENDED");

  const totalThisMonth     = thisMonthCounts.filter((g) => g.status !== "ARCHIVED").reduce((s, g) => s + g._count._all, 0);
  const totalLastMonth     = lastMonthCounts.filter((g) => g.status !== "ARCHIVED").reduce((s, g) => s + g._count._all, 0);
  const activeThisMonth    = pickCount(thisMonthCounts,  "ACTIVE");
  const activeLastMonth    = pickCount(lastMonthCounts,  "ACTIVE");
  const suspendedThisMonth = pickCount(thisMonthCounts,  "SUSPENDED");
  const suspendedLastMonth = pickCount(lastMonthCounts,  "SUSPENDED");

  function calcChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  return {
    kpiSummary: {
      totalUsers,
      totalUsersChange:          calcChange(totalThisMonth,     totalLastMonth),
      activeUsers,
      activeUsersChange:         calcChange(activeThisMonth,    activeLastMonth),
      pendingVerification,
      pendingVerificationChange: 0,
      suspendedUsers,
      suspendedUsersChange:      calcChange(suspendedThisMonth, suspendedLastMonth),
      invitationsPending,
      invitationsPendingChange:  0,
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

// ─── Export: all matching users, no pagination cap ────────────────────────────

async function exportUsers(query = {}, admin = {}) {
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
  const rawBranch = typeof query.branch === "string"
    ? query.branch.trim()
    : "";

  const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);

  const roleFilter              = VALID_ROLES.has(rawRole)    ? rawRole    : null;
  const statusFilter            = VALID_STATUSES.has(rawStatus) ? rawStatus : null;
  const verificationStateFilter = VALID_VERIFICATION_STATES.has(rawVerificationState) ? rawVerificationState : null;
  const departmentFilter        = rawDepartment || null;
  const branchFilter            = rawBranch     || null;

  const rawCreatedAfter  = typeof query.createdAfter  === "string" ? query.createdAfter.trim()  : "";
  const rawCreatedBefore = typeof query.createdBefore === "string" ? query.createdBefore.trim() : "";
  const createdAfterDate  = rawCreatedAfter  ? new Date(rawCreatedAfter)  : null;
  const createdBeforeDate = rawCreatedBefore ? new Date(rawCreatedBefore) : null;

  const where = {};

  if (search) {
    const searchConditions = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email:    { contains: search, mode: "insensitive" } },
    ];
    if (!roleFilter) {
      const normalizedForRole = search.toUpperCase().replace(/[\s-]+/g, "_");
      if (VALID_ROLES.has(normalizedForRole)) searchConditions.push({ role: normalizedForRole });
    }
    where.OR = searchConditions;
  }

  if (roleFilter)              where.role              = roleFilter;
  if (statusFilter)            where.status            = statusFilter;
  if (verificationStateFilter) where.verificationState = verificationStateFilter;
  if (departmentFilter)        where.department        = { equals: departmentFilter, mode: "insensitive" };
  if (branchFilter)            where.branch            = { equals: branchFilter,     mode: "insensitive" };
  if (createdAfterDate  && !isNaN(createdAfterDate.getTime()))  where.createdAt = { ...where.createdAt, gte: createdAfterDate };
  if (createdBeforeDate && !isNaN(createdBeforeDate.getTime())) where.createdAt = { ...where.createdAt, lte: createdBeforeDate };

  const EXPORT_ROW_CAP = 5000;
  const rawUsers = await prisma.appUser.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_CAP,
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USERS_EXPORTED", {
    filters: { search: search || null, role: roleFilter, status: statusFilter },
    count: rawUsers.length,
  });

  return { users: rawUsers.map(mapUser), total: rawUsers.length };
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

  const activityRows = await prisma.auditLog.findMany({
    where:   { details: { path: ["userId"], equals: sanitizedId } },
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  { id: true, action: true, ipAddress: true, createdAt: true },
  }).catch(() => []);

  const ACTIVITY_LABEL = {
    USER_CREATED:        "Account created",
    USER_UPDATED:        "Profile updated",
    USER_STATUS_CHANGED: "Status changed",
    USER_PASSWORD_RESET: "Password reset",
    USER_ROLE_ASSIGNED:  "Role assigned",
    USER_DELETED:        "Account archived",
    USER_SUSPENDED:      "Account suspended",
    USER_REACTIVATED:    "Account reactivated",
    USER_DETAILS_VIEWED: "Profile viewed by admin",
    USERS_IMPORTED:      "Account created via CSV import",
  };

  const recentActivity = activityRows.map(row => ({
    id:        row.id,
    action:    ACTIVITY_LABEL[row.action] ?? row.action.replace(/_/g, " ").toLowerCase(),
    timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    ipAddress: row.ipAddress ?? null,
  }));

  // Convert riskScore Int (0–100) to a risk level string
  const rs = user.riskScore ?? null;
  const riskScore = rs == null ? "low"
    : rs <= 30 ? "low"
    : rs <= 60 ? "medium"
    : rs <= 80 ? "high"
    : "critical";

  await createUserAuditLog(admin.id, "USER_DETAILS_VIEWED", { userId: sanitizedId });

  return {
    user: {
      ...mapUser(user),
      updatedAt: user.updatedAt.toISOString(),
    },
    roles: [],
    securityOverview: {
      mfaEnabled:     false,
      activeSessions: 0,
      lastIpAddress:  null,
      lastLocation:   null,
      riskScore,
    },
    recentActivity,
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

  // Automation trigger (NOTIFICATIONS_CONTRACT.md #5) — best-effort (never
  // throws internally), same pattern as certificateTriggers in
  // enrollments.service.js.
  await fireAutomationTrigger("USER_REGISTRATION", user.id, { role: user.role });

  return {
    success: true,
    message: "User created successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function updateUser(id, body, admin = {}) {
  const existing = await assertUserExists(id);

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

  if (body.role !== undefined && body.role !== null) {
    const normalizedRole = body.role.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (VALID_ROLES.has(normalizedRole)) {
      updateData.role = normalizedRole;
      changedFields.push("role");
    }
    // Custom role names don't map to AppUserRole enum — skip silently
  }

  // Nothing to persist (e.g. only a custom role name was sent, which doesn't map to the enum)
  if (Object.keys(updateData).length === 0) {
    return {
      success: true,
      message: "User updated successfully.",
      user: { ...mapUser(existing), updatedAt: existing.updatedAt.toISOString() },
    };
  }

  let user;
  try {
    user = await prisma.appUser.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  } catch (err) {
    console.error("UPDATE USER SERVICE ERROR:", err.message);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR META:", JSON.stringify(err.meta));
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
    // Invariant: suspendedAt is set exactly while status is SUSPENDED.
    data: { status: newStatus, suspendedAt: newStatus === "SUSPENDED" ? new Date() : null },
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

  // Password change and session revocation succeed or fail together — a reset
  // triggered by a compromise must never leave the attacker's session alive.
  const revokedSessionsCount = await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id },
      data: { passwordHash },
    });

    const result = await tx.appUserSession.updateMany({
      where: { userId: id, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    return result.count;
  });

  await createUserAuditLog(admin.id, "USER_PASSWORD_RESET", { userId: id, revokedSessionsCount });

  return {
    success: true,
    message: "User password has been reset successfully.",
  };
}

async function suspendUser(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const reason = body.reason.trim();
  const notes = body.notes ? body.notes.trim() : null;
  // Re-normalized here rather than trusted from the caller: this service is the
  // single writer of the suspension audit row, and both the Users route and
  // instructors.service reach it. An unrecognised value becomes null — the
  // validators are what turn it into a 400.
  const violationType = normalizeViolationType(body.violationType);

  const user = await prisma.appUser.update({
    where: { id },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
    select: USER_SELECT,
  });

  // These details ARE the suspension record — there is no suspensions table, and
  // AppUser.suspendedAt holds only the latest timestamp. GET
  // /instructors/:id/suspension-history reads these rows back, so any field
  // dropped here is gone from compliance history for good.
  await createUserAuditLog(admin.id, "USER_SUSPENDED", {
    userId: id,
    oldStatus: existing.status,
    newStatus: "SUSPENDED",
    reason,
    notes,
    violationType,
  });

  // SECURITY_EVENT automation trigger — wired here, not to admin.service.js's
  // failed-ADMIN-login lockout as the task literally named. That event has no
  // AppUser to notify (NotificationLog/automations are AppUser-recipient only,
  // AdminUser is a completely separate table — see [[adminuser_vs_appuser_split]]-
  // style note) — a suspension IS a real security event on a real AppUser, the
  // closest fit that actually has a valid recipient. Decision made explicit,
  // not silently swapped.
  await fireAutomationTrigger("SECURITY_EVENT", id, { eventType: "ACCOUNT_SUSPENDED", reason });

  return {
    success: true,
    message: "User suspended successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

// Signature is (id, body, admin) to match suspendUser — the two are always read
// and changed together, and mirrored argument orders are how an `admin` object
// ends up silently parsed as a `body`.
async function reactivateUser(id, body = {}, admin = {}) {
  const existing = await assertUserExists(id);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  const user = await prisma.appUser.update({
    where: { id },
    data: { status: "ACTIVE", suspendedAt: null },
    select: USER_SELECT,
  });

  // Paired with the USER_SUSPENDED details above: both actions are replayed by
  // GET /instructors/:id/suspension-history as one timeline.
  await createUserAuditLog(admin.id, "USER_REACTIVATED", {
    userId: id,
    oldStatus: existing.status,
    newStatus: "ACTIVE",
    notes,
  });

  return {
    success: true,
    message: "User reactivated successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

async function approveVerification(id, admin = {}) {
  const existing = await assertUserExists(id);

  const user = await prisma.appUser.update({
    where: { id },
    data: { verificationState: "VERIFIED", status: "ACTIVE" },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_VERIFICATION_APPROVED", {
    userId: id,
    oldVerificationState: existing.verificationState,
    newVerificationState: "VERIFIED",
    oldStatus: existing.status,
    newStatus: "ACTIVE",
  });

  return {
    success: true,
    message: "User verification approved successfully.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
  };
}

// Maps a Role display name (from the roles table) to an AppUserRole enum value.
const ROLE_NAME_TO_ENUM_ALIAS = { ADMINISTRATOR: "ADMIN_ASSISTANT", ADMIN: "ADMIN_ASSISTANT" };

function roleNameToAppEnum(name) {
  const upper = String(name).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (VALID_ROLES.has(upper)) return upper;
  return ROLE_NAME_TO_ENUM_ALIAS[upper] ?? null;
}

async function assignUserRole(id, body, admin = {}) {
  const existing = await assertUserExists(id);
  const reason = body.reason ? body.reason.trim() : null;

  let newRole;

  if (UUID_REGEX.test(body.roleId)) {
    // roleId is a real UUID from the roles table — look up and convert to enum
    const roleRecord = await prisma.role.findUnique({ where: { id: body.roleId } });
    if (!roleRecord) throw makeError("Role not found.", 404);
    newRole = roleNameToAppEnum(roleRecord.name);
    if (!newRole) {
      throw makeError(
        `Role "${roleRecord.name}" has no matching system role. Valid roles: ${[...VALID_ROLES].join(", ")}.`,
        400
      );
    }
  } else {
    // Legacy path: caller sent an enum string like "LEARNER" directly
    newRole = body.roleId.trim().toUpperCase();
    if (!VALID_ROLES.has(newRole)) {
      throw makeError(`Invalid role value: ${body.roleId}`, 400);
    }
  }

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

async function permanentDeleteUser(id, admin = {}) {
  const existing = await assertUserExists(id);

  if (existing.status !== "ARCHIVED") {
    throw makeError("Only archived users can be permanently deleted.", 400);
  }

  await prisma.appUser.delete({ where: { id } });

  await createUserAuditLog(admin.id, "USER_PERMANENTLY_DELETED", {
    userId: id,
    email:  existing.email,
  });

  return {
    success: true,
    message: "User permanently deleted.",
  };
}

async function rejectVerification(id, admin = {}) {
  const existing = await assertUserExists(id);

  const user = await prisma.appUser.update({
    where: { id },
    data: { verificationState: "REJECTED", status: "SUSPENDED" },
    select: USER_SELECT,
  });

  await createUserAuditLog(admin.id, "USER_VERIFICATION_REJECTED", {
    userId: id,
    oldVerificationState: existing.verificationState,
    newVerificationState: "REJECTED",
    oldStatus: existing.status,
    newStatus: "SUSPENDED",
  });

  return {
    success: true,
    message: "User verification rejected.",
    user: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
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
  // User Growth chart — 12 calendar weeks (not "last 84 days") so bucket
  // boundaries land on the same Monday a calendar shows, matching how an
  // admin reading week labels would expect them to line up.
  const currentWeekStart = new Date(startOfToday.getTime() - ((startOfToday.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000);
  const growthWindowStart = new Date(currentWeekStart.getTime() - 11 * 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    roleGroups,
    departmentGroups,
    verificationGroups,
    thisMonthCount,
    lastMonthCount,
    activeToday,
    activeLast7d,
    rawDailyTrend,
    rawWeeklyGrowth,
  ] = await Promise.all([
    prisma.appUser.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.appUser.groupBy({ by: ["role"], _count: { _all: true }, where: { status: { not: "ARCHIVED" } } }),
    prisma.appUser.groupBy({ by: ["department"],       _count: { _all: true }, where: { department: { not: null } } }),
    prisma.appUser.groupBy({ by: ["verificationState"], _count: { _all: true } }),
    prisma.appUser.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.appUser.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: startOfToday } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: last7d } } }),
    // SQL GROUP BY: aggregates in DB instead of loading all rows into Node.js memory
    prisma.$queryRaw`
      SELECT
        DATE("lastActivityAt") AS date,
        COUNT(*)::int           AS count
      FROM "app_users"
      WHERE "lastActivityAt" >= ${last30d}
        AND "lastActivityAt" IS NOT NULL
      GROUP BY DATE("lastActivityAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw`
      SELECT
        DATE_TRUNC('week', "createdAt")::date AS week,
        COUNT(*)::int                         AS count
      FROM "app_users"
      WHERE "createdAt" >= ${growthWindowStart}
        AND "status" <> 'ARCHIVED'
      GROUP BY week
      ORDER BY week ASC
    `,
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

  // userActivity — 30-day dailyTrend: build zero-filled map then merge SQL results
  const activityMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    activityMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rawDailyTrend) {
    // Prisma returns PostgreSQL DATE columns as JS Date objects
    const key = row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10);
    if (key in activityMap) activityMap[key] = Number(row.count);
  }
  const dailyTrend = Object.entries(activityMap).map(([date, count]) => ({ date, count }));
  const userActivity = { activeToday, activeThisWeek: activeLast7d, dailyTrend };

  // userGrowth — 12 zero-filled weekly buckets of NEW signups (createdAt),
  // distinct from userActivity.dailyTrend (that's lastActivityAt-based).
  const growthMap = {};
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    growthMap[weekStart.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rawWeeklyGrowth) {
    const key = row.week instanceof Date
      ? row.week.toISOString().slice(0, 10)
      : String(row.week).slice(0, 10);
    if (key in growthMap) growthMap[key] = Number(row.count);
  }
  const userGrowth = Object.entries(growthMap).map(([weekStart, count]) => ({ weekStart, count }));

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
    userGrowth,
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

  // Hash passwords in batches of 10 to avoid saturating the CPU with concurrent bcrypt calls
  const usersToCreate = [];
  for (let i = 0; i < finalValidRows.length; i += 10) {
    const hashed = await Promise.all(
      finalValidRows.slice(i, i + 10).map(async ({ rowIndex, password, ...fields }) => ({
        ...fields,
        passwordHash: await bcrypt.hash(password, 12),
      }))
    );
    usersToCreate.push(...hashed);
  }

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
  const VALID_ACTIONS = new Set(["suspend", "reactivate", "archive", "delete", "assign_role", "notify"]);

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  if (!VALID_ACTIONS.has(action)) {
    throw Object.assign(
      new Error(`Invalid action: "${action}". Must be one of: suspend, reactivate, archive, assign_role, notify.`),
      { statusCode: 400 }
    );
  }

  const BULK_ACTION_MAX_IDS = 500;
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id) => typeof id === "string" && id.trim())
    : [];
  if (userIds.length === 0) {
    throw Object.assign(new Error("userIds must be a non-empty array of strings."), { statusCode: 400 });
  }
  if (userIds.length > BULK_ACTION_MAX_IDS) {
    throw Object.assign(
      new Error(`Bulk action is limited to ${BULK_ACTION_MAX_IDS} users at a time. Received ${userIds.length}.`),
      { statusCode: 400 }
    );
  }

  const params = body.params && typeof body.params === "object" ? body.params : {};
  const label  = action === "delete" ? "archive" : action;

  // Status-change actions — single updateMany instead of N individual updates
  if (action === "suspend" || action === "reactivate" || action === "archive" || action === "delete") {
    const newStatus   = action === "reactivate" ? "ACTIVE" : action === "suspend" ? "SUSPENDED" : "ARCHIVED";
    const auditAction = action === "reactivate" ? "USER_REACTIVATED" : action === "suspend" ? "USER_SUSPENDED" : "USER_DELETED";
    const statusData =
      action === "suspend"    ? { status: newStatus, suspendedAt: new Date() }
      : action === "reactivate" ? { status: newStatus, suspendedAt: null }
      : { status: newStatus };
    const result      = await prisma.appUser.updateMany({ where: { id: { in: userIds } }, data: statusData });
    createUserAuditLog(admin.id, auditAction, { userIds, count: result.count, reason: params.reason || "Bulk action" });
    return {
      success:   true,
      message:   `Bulk ${label}: ${result.count} succeeded, ${userIds.length - result.count} failed`,
      succeeded: result.count,
      failed:    userIds.length - result.count,
      errors:    [],
    };
  }

  if (action === "assign_role") {
    const roleId = params.roleId || params.role;
    if (!roleId) throw Object.assign(new Error("params.roleId is required for assign_role."), { statusCode: 400 });

    let newRole;
    if (UUID_REGEX.test(String(roleId).trim())) {
      const roleRecord = await prisma.role.findUnique({ where: { id: String(roleId).trim() } });
      if (!roleRecord) throw Object.assign(new Error("Role not found."), { statusCode: 404 });
      newRole = roleNameToAppEnum(roleRecord.name);
      if (!newRole) throw Object.assign(new Error(`Role "${roleRecord.name}" has no matching system role.`), { statusCode: 400 });
    } else {
      newRole = String(roleId).trim().toUpperCase();
      if (!VALID_ROLES.has(newRole)) throw Object.assign(new Error(`Invalid role: ${roleId}`), { statusCode: 400 });
    }

    const result = await prisma.appUser.updateMany({ where: { id: { in: userIds } }, data: { role: newRole } });
    createUserAuditLog(admin.id, "USER_ROLE_ASSIGNED", { userIds, newRole, count: result.count, reason: params.reason || "Bulk role assignment" });
    return {
      success:   true,
      message:   `Bulk assign_role: ${result.count} succeeded, ${userIds.length - result.count} failed`,
      succeeded: result.count,
      failed:    userIds.length - result.count,
      errors:    [],
    };
  }

  // notify — real send via notifications.service's in-app notification path
  const message = typeof params.message === "string" ? params.message.trim() : "";
  if (!message) throw Object.assign(new Error("params.message is required for notify."), { statusCode: 400 });

  let sentCount = 0;
  try {
    const result = await sendInAppNotification(
      {
        userIds,
        title:    typeof params.subject === "string" && params.subject.trim() ? params.subject.trim() : "Notification from Admin",
        body:     message,
        type:     "system",
        priority: "NORMAL",
      },
      admin.id,
    );
    sentCount = result.sentCount;
  } catch (err) {
    if (err.code !== "USERS_NOT_FOUND") throw err;
  }

  createUserAuditLog(admin.id, "USER_MESSAGE_SENT", { userIds, count: sentCount, reason: params.reason || "Bulk notification" });
  return {
    success:   true,
    message:   `Bulk notify: ${sentCount} succeeded, ${userIds.length - sentCount} failed`,
    succeeded: sentCount,
    failed:    userIds.length - sentCount,
    errors:    [],
  };
}

// ─── Send Message to User ─────────────────────────────────────────────────────

async function sendMessageToUser(userId, body, admin = {}) {
  const receiver = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!receiver) throw makeError("User not found.", 404);

  const trimmedBody    = body.message.trim();
  const trimmedSubject = body.subject && typeof body.subject === "string"
    ? body.subject.trim() || null
    : null;

  const adminMessage = await prisma.adminMessage.create({
    data: {
      senderAdminId:  admin.id,
      receiverUserId: userId,
      subject:        trimmedSubject,
      body:           trimmedBody,
      status:         "SENT",
    },
    select: MESSAGE_SELECT,
  });

  // Fire-and-forget audit — matches project-wide pattern
  await createUserAuditLog(admin.id, "USER_MESSAGE_SENT", {
    userId,
    email:     receiver.email,
    messageId: adminMessage.id,
    subject:   trimmedSubject,
  });

  return {
    success:      true,
    message:      "Message sent successfully.",
    adminMessage: mapAdminMessage(adminMessage),
  };
}

// ─── List Messages for a User ─────────────────────────────────────────────────

async function getUserMessages(userId, query = {}, admin = {}) {
  const receiver = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!receiver) throw makeError("User not found.", 404);

  const page     = Math.max(1, parseInt(query.page) || 1);
  const rawLimit = parseInt(query.limit);
  const limit    = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 50 ? 10 : rawLimit;
  const skip     = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.adminMessage.count({ where: { receiverUserId: userId } }),
    prisma.adminMessage.findMany({
      where:   { receiverUserId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
      select:  MESSAGE_SELECT,
    }),
  ]);

  return {
    success:    true,
    messages:   rows.map(mapAdminMessage),
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

function mapAdminMessage(m) {
  return {
    id:             m.id,
    receiverUserId: m.receiverUserId,
    subject:        m.subject ?? null,
    body:           m.body,
    status:         m.status.toLowerCase(),
    readAt:         m.readAt  ? m.readAt.toISOString()   : null,
    createdAt:      m.createdAt.toISOString(),
  };
}

// ─── Force Logout ─────────────────────────────────────────────────────────────

async function forceLogoutUser(userId, body, admin = {}) {
  const reason = body?.reason != null ? String(body.reason).trim() || null : null;

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, status: true },
  });
  if (!user) throw makeError("User not found.", 404);

  const revokedSessionsCount = await prisma.$transaction(async (tx) => {
    const result = await tx.appUserSession.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        adminId: admin.id ?? null,
        targetUserId: user.id,
        action:  "USER_FORCE_LOGOUT",
        details: {
          userId:               user.id,
          email:                user.email,
          fullName:             user.fullName,
          revokedSessionsCount: result.count,
          ...(reason && { reason }),
        },
      },
    });

    return result.count;
  });

  return {
    success: true,
    message: "User sessions revoked successfully.",
    data:    { userId: user.id, revokedSessionsCount },
  };
}

// ─── User Details Drawer: Courses tab ─────────────────────────────────────────
// Any AppUser can HAVE enrollments (the model isn't role-restricted), but only
// role=LEARNER can be newly enrolled — enrollmentsService.createEnrollment is
// reached exclusively through POST /learners/:id/enrollments, which asserts
// LEARNER. This read + the unenroll below are intentionally role-agnostic so
// the tab still shows/lets-go of enrollments a user already has.

async function getUserCourses(id) {
  await assertUserExists(id);

  const rows = await prisma.courseEnrollment.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      progress: true,
      status: true,
      completedAt: true,
      createdAt: true,
      course: { select: { id: true, title: true, thumbnail: true } },
    },
  });

  return rows.map((r) => ({
    enrollmentId: r.id,
    courseId: r.course?.id ?? null,
    title: r.course?.title ?? "(deleted course)",
    thumbnail: r.course?.thumbnail ?? null,
    progress: r.progress,
    status: r.status,
    enrolledAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));
}

async function unenrollUserCourse(id, enrollmentId, admin = {}) {
  await assertUserExists(id);

  // Scope to THIS user — same rule as learners.service's deleteLearnerEnrollment:
  // an enrollment id belonging to someone else answers 404, not a cross-user unenroll.
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, userId: id },
    select: { id: true },
  });
  if (!enrollment) throw makeError("Enrollment not found.", 404);

  // Delegates to enrollments.service, which already writes the ENROLLMENT_DELETED
  // audit row for this exact write — no second audit call here (same rule
  // learners.service's deleteLearnerEnrollment follows).
  await deleteEnrollment(enrollmentId, admin.id);

  return { success: true, message: "User unenrolled from course successfully." };
}

// ─── User Details Drawer: More tab — Devices & Sessions ───────────────────────
// AppUserSession (not TrustedDevice — that model belongs to AdminUser, the
// admin console's own login devices, a different table entirely) is the real
// per-AppUser login-session log; forceLogoutUser already revokes all of them,
// this adds list + single-session revoke.

async function getUserSessions(id) {
  await assertUserExists(id);

  const rows = await prisma.appUserSession.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    ipAddress: r.ipAddress ?? null,
    userAgent: r.userAgent ?? null,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    expiresAt: r.expiresAt.toISOString(),
    revoked: r.revokedAt != null,
  }));
}

async function revokeUserSession(id, sessionId, admin = {}) {
  await assertUserExists(id);

  const session = await prisma.appUserSession.findFirst({
    where: { id: sessionId, userId: id, revokedAt: null },
    select: { id: true },
  });
  if (!session) throw makeError("Active session not found.", 404);

  await prisma.appUserSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  await createUserAuditLog(admin.id, "USER_SESSION_REVOKED", { userId: id, sessionId });

  return { success: true, message: "Session revoked successfully." };
}

// ─── User Details Drawer: More tab — Notes ─────────────────────────────────────

async function getUserNotes(id) {
  await assertUserExists(id);

  const rows = await prisma.userNote.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.fullName ?? "Unknown admin",
  }));
}

async function addUserNote(id, body, admin = {}) {
  await assertUserExists(id);
  const content = body.content.trim();

  const note = await prisma.userNote.create({
    data: { userId: id, content, createdById: admin.id },
    select: { id: true, content: true, createdAt: true, createdBy: { select: { fullName: true } } },
  });

  await createUserAuditLog(admin.id, "USER_NOTE_ADDED", { userId: id, noteId: note.id });

  return {
    success: true,
    message: "Note added successfully.",
    note: {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      createdByName: note.createdBy?.fullName ?? "Unknown admin",
    },
  };
}

async function deleteUserNote(id, noteId, admin = {}) {
  await assertUserExists(id);

  const note = await prisma.userNote.findFirst({ where: { id: noteId, userId: id }, select: { id: true } });
  if (!note) throw makeError("Note not found.", 404);

  await prisma.userNote.delete({ where: { id: noteId } });

  await createUserAuditLog(admin.id, "USER_NOTE_DELETED", { userId: id, noteId });

  return { success: true, message: "Note deleted successfully." };
}

// ─── User Details Drawer: More tab — Consent & Privacy ────────────────────────

async function exportUserData(id, admin = {}) {
  const user = await assertUserExists(id);

  const [enrollments, certificates] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { userId: id },
      select: { id: true, progress: true, status: true, completedAt: true, createdAt: true, course: { select: { title: true } } },
    }),
    prisma.certificate.findMany({
      where: { userId: id },
      select: { id: true, issuedAt: true, revokedAt: true, course: { select: { title: true } } },
    }).catch(() => []),
  ]);

  await createUserAuditLog(admin.id, "USER_DATA_EXPORTED", { userId: id });

  return {
    exportedAt: new Date().toISOString(),
    profile: { ...mapUser(user), updatedAt: user.updatedAt.toISOString() },
    enrollments: enrollments.map((e) => ({
      courseTitle: e.course?.title ?? null,
      progress: e.progress,
      status: e.status,
      enrolledAt: e.createdAt.toISOString(),
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    })),
    certificates: certificates.map((c) => ({
      courseTitle: c.course?.title ?? null,
      issuedAt: c.issuedAt.toISOString(),
      revoked: c.revokedAt != null,
    })),
  };
}

async function requestAccountDeletion(id, admin = {}) {
  const user = await assertUserExists(id);

  const recipients = await prisma.adminUser.findMany({
    where: { status: "ACTIVE" },
    select: { email: true },
  });

  const requestedBy = admin.fullName ?? admin.email ?? "An administrator";
  const subject = `Account deletion requested: ${user.fullName}`;
  const text =
    `${requestedBy} requested account deletion for ${user.fullName} (${user.email}).\n\n` +
    `User ID: ${user.id}\nRequested at: ${new Date().toISOString()}\n\n` +
    `This is a notification only — no data has been deleted. Review and action this request manually.`;

  // Best-effort, matches the mailer's own "never throws" contract — a delivery
  // failure must not block the audit trail or the admin's confirmation.
  await Promise.all(
    recipients.map((r) => sendMail({ to: r.email, subject, text }).catch(() => {})),
  );

  await createUserAuditLog(admin.id, "USER_DELETION_REQUESTED", {
    userId: id,
    notifiedAdmins: recipients.length,
  });

  return {
    success: true,
    message: `Deletion request sent to ${recipients.length} admin${recipients.length === 1 ? "" : "s"}.`,
  };
}

module.exports = {
  // Exported so other modules that surface the SAME AppUser rows (Instructors)
  // render status/verification identically instead of re-declaring the maps
  // and drifting from this one.
  STATUS_MAP,
  VERIFICATION_MAP,
  getUsersList,
  exportUsers,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  approveVerification,
  rejectVerification,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  permanentDeleteUser,
  getUsersAnalytics,
  importUsersFromCsv,
  bulkActionUsers,
  sendMessageToUser,
  getUserMessages,
  forceLogoutUser,
  getUserCourses,
  unenrollUserCourse,
  getUserSessions,
  revokeUserSession,
  getUserNotes,
  addUserNote,
  deleteUserNote,
  exportUserData,
  requestAccountDeletion,
};