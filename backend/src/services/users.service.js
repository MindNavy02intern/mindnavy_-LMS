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

async function getUsersList(query = {}, admin = {}) {
  // Normalize and sanitize query params
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

  // Build Prisma where clause
  const where = {};

  if (search) {
    const searchConditions = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    // Role is an enum — only add it if the search exactly matches a valid role value
    // (e.g. search="learner" matches LEARNER) and no explicit role filter is active
    if (!roleFilter) {
      const normalizedForRole = search.toUpperCase().replace(/[\s-]+/g, "_");
      if (VALID_ROLES.has(normalizedForRole)) {
        searchConditions.push({ role: normalizedForRole });
      }
    }
    where.OR = searchConditions;
  }

  if (roleFilter) {
    where.role = roleFilter;
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const skip = (page - 1) * limit;

  // Run KPI counts and paginated query in parallel
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
        // passwordHash is intentionally excluded — must never be exposed
      },
    }),
  ]);

  const users = rawUsers.map((u) => ({
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
  }));

  // Audit log — fire after successful query; errors must not crash the response
  try {
    await prisma.auditLog.create({
      data: {
        adminId: admin.id ?? null,
        action: "USERS_LIST_VIEWED",
        details: {
          page,
          limit,
          search: search || null,
          role: roleFilter,
          status: statusFilter,
        },
      },
    });
  } catch (auditError) {
    console.error("Audit log error (USERS_LIST_VIEWED):", auditError.message);
  }

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
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

module.exports = { getUsersList };
