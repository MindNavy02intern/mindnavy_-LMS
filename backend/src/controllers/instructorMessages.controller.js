const svc = require("../services/messages.service");
const { validateReplyInput, validateStartThreadInput } = require("../validators/messages.validator");

// Instructor self-service Messages (blueprint 2.10) — AdminMessage where
// receiverUserId = req.instructor.id. Read + mark-read, plus reply (this
// task) — a reply is stored in the separate AdminMessageReply model, never
// as a reversed AdminMessage row (see messages.service.js's createReply
// header comment for why).

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[InstructorMessagesController]", err);
  // <500 (validation/not-found) and the explicit 503 startMyMessageThread
  // throws when no admin account exists to receive messages — both are
  // deliberate domain errors with a real message worth surfacing verbatim,
  // unlike an actual unhandled crash.
  if (typeof err.statusCode === "number" && err.statusCode >= 400 && (err.statusCode < 500 || err.statusCode === 503)) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return serverError(res, err);
    }
  };
}

function validateId(id, label) {
  if (!id || typeof id !== "string" || !id.trim()) return `${label} is required.`;
  return null;
}

const listMessages = run(async (req, res) => {
  const { page, limit } = req.query;
  const result = await svc.getAdminMessages(req.instructor.id, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  // Nests pagination inside `data` — consistent with every other instructor
  // list endpoint this project built (students/reviews/payouts/etc.), even
  // though getAdminMessages' own OWN return shape (used by other callers)
  // keeps them as siblings.
  return res.json({ success: true, data: { messages: result.messages, pagination: result.pagination } });
});

const markRead = run(async (req, res) => {
  const idErr = validateId(req.params.id, "messageId");
  if (idErr) return notFound(res, idErr);
  const message = await svc.markMyMessageRead(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Message marked as read.", data: message });
});

const markAllRead = run(async (req, res) => {
  const result = await svc.markAllMyMessagesRead(req.instructor.id);
  return res.json({ success: true, message: "Marked all as read.", data: result });
});

const getThread = run(async (req, res) => {
  const idErr = validateId(req.params.id, "messageId");
  if (idErr) return notFound(res, idErr);
  const result = await svc.getMyMessageThread(req.instructor.id, req.params.id);
  return res.json({ success: true, data: result });
});

const startThread = run(async (req, res) => {
  const errors = validateStartThreadInput(req.body || {});
  if (errors.length > 0) return badRequest(res, errors[0]);

  const result = await svc.startMyMessageThread(req.instructor.id, {
    subject: req.body.subject,
    body:    req.body.body,
  });
  return res.status(201).json({ success: true, message: "Message sent.", data: result });
});

const reply = run(async (req, res) => {
  const errors = validateReplyInput(req.body || {});
  if (errors.length > 0) return badRequest(res, errors[0]);

  const result = await svc.createReply(req.instructor.id, {
    originalMessageId: req.body.originalMessageId.trim(),
    body: req.body.body,
  });
  return res.status(201).json({ success: true, message: "Reply sent.", data: result });
});

module.exports = {
  listMessages,
  markRead,
  markAllRead,
  getThread,
  startThread,
  reply,
};
