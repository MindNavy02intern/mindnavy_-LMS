const svc = require("../services/instructorSessions.service");

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "CANNOT_REVOKE_CURRENT_SESSION":
      return badRequest(res, "You can't revoke your current session this way — use Sign Out instead.");
    case "SESSION_NOT_FOUND":
      return notFound(res, "Session not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorSessionsController]", err);
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
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

function validateId(id, label) {
  if (!id || typeof id !== "string" || !id.trim()) return `${label} is required.`;
  return null;
}

const listSessions = run(async (req, res) => {
  const result = await svc.listMySessions(req.instructor.id, req.instructorSession.id);
  return res.json({ success: true, data: result });
});

const revokeSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.revokeMySession(req.instructor.id, req.params.id, req.instructorSession.id);
  return res.json({ success: true, message: "Session revoked.", data: result });
});

module.exports = {
  listSessions,
  revokeSession,
};
