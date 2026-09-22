const prisma = require("../config/prisma");

const MESSAGE_SELECT = {
  id:             true,
  receiverUserId: true,
  subject:        true,
  body:           true,
  messageType:    true,
  priority:       true,
  status:         true,
  readAt:         true,
  createdAt:      true,
};

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function createUserAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        // Dual-write: details.userId stays for readers, indexed column for queries.
        targetUserId: typeof details?.userId === "string" ? details.userId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function mapMessage(m) {
  return {
    id:             m.id,
    receiverUserId: m.receiverUserId,
    subject:        m.subject ?? null,
    body:           m.body,
    messageType:    m.messageType,
    priority:       m.priority,
    status:         m.status.toLowerCase(),
    readAt:         m.readAt ? m.readAt.toISOString() : null,
    createdAt:      m.createdAt.toISOString(),
  };
}

async function sendAdminMessage(body, admin = {}) {
  const recipientId   = body.recipientId.trim();
  const trimmedBody   = body.body.trim();
  const trimmedSubject = body.subject && typeof body.subject === "string"
    ? body.subject.trim() || null
    : null;
  const messageType = body.type
    ? String(body.type).trim().toUpperCase()
    : "DIRECT";
  const priority = body.priority
    ? String(body.priority).trim().toUpperCase()
    : "NORMAL";

  const receiver = await prisma.appUser.findUnique({
    where:  { id: recipientId },
    select: { id: true, email: true },
  });
  if (!receiver) throw makeError("User not found.", 404);

  const adminMessage = await prisma.adminMessage.create({
    data: {
      senderAdminId:  admin.id,
      receiverUserId: recipientId,
      subject:        trimmedSubject,
      body:           trimmedBody,
      messageType,
      priority,
      status:         "SENT",
    },
    select: MESSAGE_SELECT,
  });

  // Fire-and-forget audit — consistent with project-wide pattern
  await createUserAuditLog(admin.id, "USER_MESSAGE_SENT", {
    userId:    recipientId,
    email:     receiver.email,
    messageId: adminMessage.id,
    subject:   trimmedSubject,
    type:      messageType,
    priority,
  });

  return {
    success:      true,
    message:      "Message sent successfully.",
    adminMessage: mapMessage(adminMessage),
  };
}

function mapReply(r) {
  return {
    id:        r.id,
    messageId: r.messageId,
    userId:    r.userId,
    body:      r.body,
    createdAt: r.createdAt.toISOString(),
    readAt:    r.readAt ? r.readAt.toISOString() : null,
  };
}

// Best-effort — a table that doesn't exist yet (db push not run) must degrade
// to "no replies" rather than 500ing every message list, same safe() pattern
// every other service in this codebase uses for pre-migration reads.
async function repliesFor(messageIds) {
  if (messageIds.length === 0) return [];
  try {
    return await prisma.adminMessageReply.findMany({
      where: { messageId: { in: messageIds } },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    console.error("[messages.service] repliesFor query failed:", err.message);
    return [];
  }
}

// Outbox — messages this admin has sent, across all recipients. Distinct from
// getAdminMessages below (one recipient's inbox): there is no admin-facing
// "inbox" concept in this schema (AdminMessage is one-way admin→user), so a
// personal admin message feed can only ever be "what I sent", not "what I
// received". Each row carries a reply COUNT + latest reply preview (not the
// full thread — this feeds the topbar's compact outbox dropdown, not a full
// Messages page, which doesn't exist yet).
async function getSentMessages(adminId, query = {}) {
  const page     = Math.max(1, parseInt(query.page) || 1);
  const rawLimit = parseInt(query.limit);
  const limit    = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 50 ? 10 : rawLimit;
  const skip     = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.adminMessage.count({ where: { senderAdminId: adminId } }),
    prisma.adminMessage.findMany({
      where:   { senderAdminId: adminId },
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
      select:  { ...MESSAGE_SELECT, receiverUser: { select: { fullName: true } } },
    }),
  ]);

  const replies = await repliesFor(rows.map((m) => m.id));
  const repliesByMessage = new Map();
  for (const r of replies) {
    const list = repliesByMessage.get(r.messageId) ?? [];
    list.push(r);
    repliesByMessage.set(r.messageId, list);
  }

  return {
    success:    true,
    messages:   rows.map((m) => {
      const forThisMessage = repliesByMessage.get(m.id) ?? [];
      const last = forThisMessage[forThisMessage.length - 1] ?? null;
      return {
        ...mapMessage(m),
        receiverName:    m.receiverUser?.fullName ?? null,
        repliesCount:    forThisMessage.length,
        lastReply:       last ? mapReply(last) : null,
        hasUnreadReply:  forThisMessage.some((r) => !r.readAt),
      };
    }),
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getAdminMessages(recipientId, query = {}) {
  const receiver = await prisma.appUser.findUnique({
    where:  { id: recipientId },
    select: { id: true },
  });
  if (!receiver) throw makeError("User not found.", 404);

  const page     = Math.max(1, parseInt(query.page) || 1);
  const rawLimit = parseInt(query.limit);
  const limit    = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 50 ? 10 : rawLimit;
  const skip     = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.adminMessage.count({ where: { receiverUserId: recipientId } }),
    prisma.adminMessage.findMany({
      where:   { receiverUserId: recipientId },
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
      select:  MESSAGE_SELECT,
    }),
  ]);

  // Every message here already belongs to `recipientId` (the where clause
  // above), so attaching replies to them leaks nothing — a reply can only
  // ever exist on a message this same instructor received.
  const replies = await repliesFor(rows.map((m) => m.id));
  const repliesByMessage = new Map();
  for (const r of replies) {
    const list = repliesByMessage.get(r.messageId) ?? [];
    list.push(mapReply(r));
    repliesByMessage.set(r.messageId, list);
  }

  return {
    success:    true,
    messages:   rows.map((m) => ({ ...mapMessage(m), replies: repliesByMessage.get(m.id) ?? [] })),
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ── Thread view (admin outbox → single message + its replies) ──────────────────
//
// Scoped to senderAdminId, same indistinguishable-404 rule every other
// ownership check in this file uses — an admin can only open the thread for
// a message they themselves sent. Opening the thread is also the "read"
// action for any unread replies on it (mirrors markMyMessageRead: view =
// read, no separate endpoint), which is what clears the outbox's "N new
// reply" badge.
async function getMessageThread(adminId, messageId) {
  const message = await prisma.adminMessage.findUnique({
    where:  { id: messageId },
    select: { ...MESSAGE_SELECT, senderAdminId: true, receiverUser: { select: { fullName: true } } },
  });
  if (!message || message.senderAdminId !== adminId) throw makeError("Message not found.", 404);

  const replies = await repliesFor([messageId]);

  const now = new Date();
  const unreadIds = replies.filter((r) => !r.readAt).map((r) => r.id);
  if (unreadIds.length > 0) {
    await prisma.adminMessageReply.updateMany({
      where: { id: { in: unreadIds } },
      data:  { readAt: now },
    });
  }

  return {
    success: true,
    message: { ...mapMessage(message), receiverName: message.receiverUser?.fullName ?? null },
    replies: replies.map((r) => mapReply(unreadIds.includes(r.id) ? { ...r, readAt: now } : r)),
  };
}

// ── Instructor reply (this task) ────────────────────────────────────────────────
//
// AdminMessage stays strictly one-way (admin->user) by design — senderAdminId
// is a REQUIRED relation to AdminUser, not something a reply can repurpose.
// AdminMessageReply is a separate child model instead (messages.prisma),
// mirroring TicketMessage's shape. Scoped to receiverUserId so an instructor
// can only reply to a message actually addressed to them — same
// indistinguishable-404 rule markMyMessageRead uses just below.
async function createReply(userId, { originalMessageId, body }) {
  const trimmedBody = body.trim();

  const message = await prisma.adminMessage.findUnique({
    where: { id: originalMessageId },
    select: { id: true, receiverUserId: true },
  });
  if (!message || message.receiverUserId !== userId) throw makeError("Message not found.", 404);

  const reply = await prisma.adminMessageReply.create({
    data: { messageId: originalMessageId, userId, body: trimmedBody },
  });

  return mapReply(reply);
}

// ── Self-service mark-as-read (Phase 6, blueprint 2.10 / Appendix A #14) ────────
//
// Genuinely new — MessageStatus.READ exists on the model but nothing in the
// codebase (admin or instructor side) ever writes it today. Scoped to
// receiverUserId so a message belonging to someone else answers "not found",
// same indistinguishable-404 rule instructorReviews.service's assertReviewOf
// uses. No audit log: read-state toggles are high-frequency, low-value
// entries — matches the existing precedent that notifications.service's own
// markNotificationRead/markAllRead don't audit-log either.
function makeNotFound() { return makeError("Message not found.", 404); }

async function markMyMessageRead(userId, messageId) {
  const msg = await prisma.adminMessage.findUnique({
    where: { id: messageId },
    select: { id: true, receiverUserId: true, status: true },
  });
  if (!msg || msg.receiverUserId !== userId) throw makeNotFound();

  if (msg.status === "READ") {
    const existing = await prisma.adminMessage.findUnique({ where: { id: messageId }, select: MESSAGE_SELECT });
    return mapMessage(existing);
  }

  const updated = await prisma.adminMessage.update({
    where: { id: messageId },
    data: { status: "READ", readAt: new Date() },
    select: MESSAGE_SELECT,
  });
  return mapMessage(updated);
}

module.exports = { sendAdminMessage, getAdminMessages, getSentMessages, getMessageThread, markMyMessageRead, createReply };
