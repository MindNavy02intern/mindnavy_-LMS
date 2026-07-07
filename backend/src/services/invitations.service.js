const prisma = require("../config/prisma");

const VALID_STATUSES = new Set(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]);
const VALID_ROLES    = new Set(["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"]);

const ROLE_MAP = {
  LEARNER:         "learner",
  INSTRUCTOR:      "instructor",
  MANAGER:         "manager",
  ADMIN_ASSISTANT: "admin_assistant",
};

const STATUS_MAP = {
  PENDING:  "pending",
  ACCEPTED: "accepted",
  EXPIRED:  "expired",
  REVOKED:  "revoked",
};

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function mapInvitation(inv) {
  return {
    id:              inv.id,
    email:           inv.email,
    role:            ROLE_MAP[inv.role] ?? inv.role.toLowerCase(),
    department:      inv.department ?? null,
    status:          STATUS_MAP[inv.status] ?? inv.status.toLowerCase(),
    expiresAt:       inv.expiresAt instanceof Date ? inv.expiresAt.toISOString() : String(inv.expiresAt),
    invitedBy:       inv.invitedBy,
    personalMessage: inv.personalMessage ?? null,
    createdAt:       inv.createdAt instanceof Date ? inv.createdAt.toISOString() : String(inv.createdAt),
    updatedAt:       inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : String(inv.updatedAt),
  };
}

// Auto-expire PENDING invitations — rate-limited to once every 5 minutes
let lastAutoExpireAt = 0;
const AUTO_EXPIRE_INTERVAL_MS = 5 * 60 * 1000;

async function autoExpire() {
  const now = Date.now();
  if (now - lastAutoExpireAt < AUTO_EXPIRE_INTERVAL_MS) return;
  lastAutoExpireAt = now;
  try {
    await prisma.invitation.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data:  { status: "EXPIRED" },
    });
  } catch (err) {
    console.error("[invitations] autoExpire error:", err.message);
  }
}

async function listInvitations(query = {}) {
  await autoExpire();

  const page     = Math.max(1, parseInt(query.page) || 1);
  const rawLimit = parseInt(query.limit);
  const limit    = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 100 ? 10 : rawLimit;
  const search   = typeof query.search === "string" ? query.search.trim() : "";
  const rawStatus = typeof query.status === "string" ? query.status.trim().toUpperCase() : "";
  const statusFilter = VALID_STATUSES.has(rawStatus) ? rawStatus : null;

  const where = {};
  if (search)       where.email  = { contains: search, mode: "insensitive" };
  if (statusFilter) where.status = statusFilter;

  const [total, rows, pendingCount] = await Promise.all([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({
      where,
      skip:    (page - 1) * limit,
      take:    limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitation.count({ where: { status: "PENDING" } }),
  ]);

  // Look up admin full names for each invitedBy ID
  const invitedByIds = [...new Set(rows.map(r => r.invitedBy).filter(id => id && id !== "system"))];
  const admins = invitedByIds.length > 0
    ? await prisma.adminUser.findMany({
        where:  { id: { in: invitedByIds } },
        select: { id: true, fullName: true },
      }).catch(() => [])
    : [];
  const adminMap = Object.fromEntries(admins.map(a => [a.id, a.fullName]));
  adminMap["system"] = "System";

  return {
    invitations: rows.map(inv => ({
      ...mapInvitation(inv),
      invitedByName: adminMap[inv.invitedBy] ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
    pendingCount,
  };
}

async function sendInvitation(body, admin = {}) {
  const email     = typeof body.email     === "string" ? body.email.trim().toLowerCase()     : "";
  const role      = typeof body.role      === "string" ? body.role.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  const department      = typeof body.department      === "string" ? body.department.trim()      || null : null;
  const personalMessage = typeof body.personalMessage === "string" ? body.personalMessage.trim() || null : null;
  const expiresInDays   = Number.isFinite(Number(body.expiresInDays)) && Number(body.expiresInDays) > 0
    ? Math.min(Number(body.expiresInDays), 90) : 7;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw makeError("Valid email address is required.", 400);
  }
  if (!VALID_ROLES.has(role)) {
    throw makeError("Invalid role. Must be one of: LEARNER, INSTRUCTOR, MANAGER, ADMIN_ASSISTANT.", 400);
  }

  // Reject if a pending invitation already exists for this email
  const existing = await prisma.invitation.findFirst({
    where: { email, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw makeError("A pending invitation already exists for this email address.", 409);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      department,
      status:          "PENDING",
      expiresAt,
      invitedBy:       admin.id ?? "system",
      personalMessage,
    },
  });

  // Event log only — never log the personal message content (PII).
  console.log(`[invitations] SENT → ${email} | role: ${role} | expires: ${expiresAt.toISOString()}`);

  return {
    success:    true,
    message:    `Invitation sent to ${email}`,
    invitation: mapInvitation(invitation),
  };
}

async function resendInvitation(id, admin = {}) {
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv)                        throw makeError("Invitation not found.", 404);
  if (inv.status === "REVOKED")    throw makeError("Cannot resend a revoked invitation.", 400);
  if (inv.status === "ACCEPTED")   throw makeError("This invitation has already been accepted.", 400);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const updated = await prisma.invitation.update({
    where: { id },
    data:  { status: "PENDING", expiresAt },
  });

  console.log(`[invitations] RESENT → ${inv.email} | new expiry: ${expiresAt.toISOString()}`);

  return {
    success:    true,
    message:    `Invitation resent to ${inv.email}`,
    invitation: mapInvitation(updated),
  };
}

async function cancelInvitation(id, admin = {}) {
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv)                        throw makeError("Invitation not found.", 404);
  if (inv.status === "REVOKED")    throw makeError("Invitation is already revoked.", 400);
  if (inv.status === "ACCEPTED")   throw makeError("Cannot revoke an accepted invitation.", 400);

  const updated = await prisma.invitation.update({
    where: { id },
    data:  { status: "REVOKED" },
  });

  return {
    success:    true,
    message:    "Invitation cancelled",
    invitation: mapInvitation(updated),
  };
}

async function updateExpiration(id, body, admin = {}) {
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv)                        throw makeError("Invitation not found.", 404);
  if (inv.status === "REVOKED")    throw makeError("Cannot update a revoked invitation.", 400);
  if (inv.status === "ACCEPTED")   throw makeError("Cannot update an accepted invitation.", 400);

  const rawDate = body.expiresAt;
  if (!rawDate) throw makeError("expiresAt is required.", 400);
  const expiresAt = new Date(rawDate);
  if (isNaN(expiresAt.getTime())) throw makeError("Invalid date format for expiresAt.", 400);
  if (expiresAt <= new Date())    throw makeError("Expiration date must be in the future.", 400);

  const updated = await prisma.invitation.update({
    where: { id },
    data:  { status: "PENDING", expiresAt },
  });

  return {
    success:    true,
    message:    "Expiration date updated",
    invitation: mapInvitation(updated),
  };
}

async function countPendingInvitations() {
  await autoExpire();
  return prisma.invitation.count({ where: { status: "PENDING" } });
}

module.exports = {
  listInvitations,
  sendInvitation,
  resendInvitation,
  cancelInvitation,
  updateExpiration,
  countPendingInvitations,
};
