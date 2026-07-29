const svc = require("../services/liveSessions.service");
const {
  validateId,
  validateSessionCreate,
  validateSessionUpdate,
  validateListQuery,
} = require("../validators/liveSessions.validator");

// ── Helpers (same pattern as quizzes.controller) ────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "LIVE_SESSION_NOT_FOUND": return notFound(res, "Live session not found.");
    case "COURSE_NOT_FOUND":       return badRequest(res, "Referenced course does not exist.");
    case "INSTRUCTOR_NOT_FOUND":   return badRequest(res, "instructorId must be an existing, non-archived INSTRUCTOR user.");
    case "ALREADY_ENDED":          return badRequest(res, "This session has already ended.");
    case "MEETINGS_NOT_CONFIGURED":
      return res.status(503).json({
        success: false,
        message: "Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET, then restart the server.",
      });
    case "MEETING_PROVIDER_ERROR":
      // Provider messages are pre-sanitized (no tokens/credentials).
      return res.status(502).json({ success: false, message: err.message });
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[LiveSessionsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────────

const listSessions = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const sessions = await svc.listSessions(v.data);
  return res.json({ success: true, data: sessions });
});

const getSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const session = await svc.getSession(req.params.id);
  return res.json({ success: true, data: session });
});

const createSession = run(async (req, res) => {
  const v = validateSessionCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const session = await svc.createSession(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Live session scheduled.", data: session });
});

const updateSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSessionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const session = await svc.updateSession(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Live session updated.", data: session });
});

const deleteSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteSession(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Live session canceled.", data: result });
});

const endSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const session = await svc.endSession(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Live session ended.", data: session });
});

module.exports = {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  endSession,
};
