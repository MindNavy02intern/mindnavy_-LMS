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

  return {
    success:    true,
    messages:   rows.map(mapMessage),
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

module.exports = { sendAdminMessage, getAdminMessages };
