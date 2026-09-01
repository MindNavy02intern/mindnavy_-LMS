const svc = require("../services/instructorLiveSessions.service");
const { forceOwnInstructorId } = require("../utils/selfScope");

const {
  validateId,
  validateSessionCreate,
  validateSessionUpdate,
  validateListQuery,
  validateMarkAttendance,
} = require("../validators/liveSessions.validator");

// Same error-code union as liveSessions.controller.js plus FORBIDDEN_NOT_OWNER.

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function forbidden(res, msg) {
  return res.status(403).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "FORBIDDEN_NOT_OWNER":
      return forbidden(res, "You do not have access to this live session.");
    case "LIVE_SESSION_NOT_FOUND":
      return notFound(res, "Live session not found.");
    case "COURSE_NOT_FOUND":
      return badRequest(res, "Referenced course does not exist.");
    case "INSTRUCTOR_NOT_FOUND":
      return badRequest(res, "instructorId must be an existing, non-archived INSTRUCTOR user.");
    case "ALREADY_ENDED":
      return badRequest(res, "This session has already ended.");
    case "USERS_NOT_FOUND":
      return badRequest(res, `One or more users do not exist: ${(err.missing || []).join(", ")}`);
    case "LIVE_SESSIONS_DISABLED":
      return forbidden(res, "Live Sessions is disabled in System Settings.");
    case "MEETINGS_NOT_CONFIGURED":
      return res.status(503).json({
        success: false,
        message: "Zoom is not configured. Contact an admin.",
      });
    case "MEETING_PROVIDER_ERROR":
      return res.status(502).json({ success: false, message: err.message });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorLiveSessionsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
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

const listSessions = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const sessions = await svc.listMySessions(req.instructor.id, v.data);
  return res.json({ success: true, data: sessions });
});

const getSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const session = await svc.getMySession(req.instructor.id, req.params.id);
  return res.json({ success: true, data: session });
});

const createSession = run(async (req, res) => {
  // Forced into the RAW body before validation — same fix as
  // instructorCourses.controller.js's createCourse. validateSessionCreate
  // requires instructorId to be PRESENT; validating the client's raw body
  // (which never sends one) before forcing it would always 400.
  const body = forceOwnInstructorId(req.body, req.instructor.id);
  const v = validateSessionCreate(body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const session = await svc.createMySession(req.instructor.id, v.data);
  return res.status(201).json({ success: true, message: "Live session scheduled.", data: session });
});

const updateSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSessionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const session = await svc.updateMySession(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Live session updated.", data: session });
});

const deleteSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteMySession(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Live session canceled.", data: result });
});

const endSession = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const session = await svc.endMySession(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Live session ended.", data: session });
});

const markAttendance = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sessionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateMarkAttendance(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const records = await svc.markMyAttendance(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: `Attendance recorded for ${records.length} learner(s).`, data: records });
});

module.exports = {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  endSession,
  markAttendance,
};
