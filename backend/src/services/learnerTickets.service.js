const prisma = require("../config/prisma");

// ── Learner tickets service (support ticket moderation, Part 7) ─────────────────
//
// SupportTicket/TicketMessage (learners.prisma) are brand new — nothing else
// in the codebase audits or invalidates them, so LEARNER_TICKET_RESPONDED/
// RESOLVED/ESCALATED (added Part 1) are real, not a duplicate-audit risk
// (unlike enrollments/certificates, which delegate to a service that already
// audits the same write).
//
// NO create endpoint — see learnerTickets.validator's header note.

function domainError(code) { return Object.assign(new Error(code), { code }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[learnerTickets.service] query failed:", err.message);
    return fallback;
  }
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.learnerId === "string" ? details.learnerId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function assertIsLearner(id) {
  const user = await prisma.appUser.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || user.role !== "LEARNER") throw domainError("LEARNER_NOT_FOUND");
  return user;
}

async function assertTicketOf(learnerId, ticketId) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId: learnerId } });
  if (!ticket) throw domainError("TICKET_NOT_FOUND");
  return ticket;
}

const TICKET_SELECT = {
  id: true, subject: true, body: true, category: true, status: true, priority: true,
  assignedToId: true, resolvedAt: true, resolution: true, createdAt: true, updatedAt: true,
  _count: { select: { messages: true } },
};

function mapTicket(t) {
  return {
    id: t.id,
    subject: t.subject,
    body: t.body,
    category: t.category,
    status: t.status,
    priority: t.priority,
    assignedToId: t.assignedToId ?? null,
    resolvedAt: iso(t.resolvedAt),
    resolution: t.resolution ?? null,
    messageCount: t._count?.messages ?? 0,
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

async function listLearnerTickets(learnerId, { page = 1, limit = 20, status } = {}) {
  await assertIsLearner(learnerId);

  const where = { userId: learnerId, ...(status ? { status } : {}) };
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.supportTicket.count({ where }), 0),
    safe(() => prisma.supportTicket.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit, select: TICKET_SELECT,
    }), []),
  ]);

  return {
    tickets: rows.map(mapTicket),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// Respond = admin composes a reply. status advances OPEN -> IN_PROGRESS on the
// first response; a ticket already IN_PROGRESS/ESCALATED stays as-is (a
// response doesn't downgrade urgency).
async function respondToTicket(learnerId, ticketId, body, adminId) {
  const current = await assertTicketOf(learnerId, ticketId);

  const [, updated] = await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId, authorAdminId: adminId ?? null, body } }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: current.status === "OPEN" ? { status: "IN_PROGRESS" } : {},
      select: TICKET_SELECT,
    }),
  ]);

  await auditLog(adminId, "LEARNER_TICKET_RESPONDED", { learnerId, ticketId });
  return mapTicket(updated);
}

async function resolveTicket(learnerId, ticketId, resolution, adminId) {
  await assertTicketOf(learnerId, ticketId);

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolution: resolution ?? null },
    select: TICKET_SELECT,
  });

  await auditLog(adminId, "LEARNER_TICKET_RESOLVED", { learnerId, ticketId });
  return mapTicket(updated);
}

async function escalateTicket(learnerId, ticketId, priority, adminId) {
  await assertTicketOf(learnerId, ticketId);

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "ESCALATED", ...(priority ? { priority } : {}) },
    select: TICKET_SELECT,
  });

  await auditLog(adminId, "LEARNER_TICKET_ESCALATED", { learnerId, ticketId, priority: priority ?? null });
  return mapTicket(updated);
}

module.exports = {
  listLearnerTickets,
  respondToTicket,
  resolveTicket,
  escalateTicket,
};
