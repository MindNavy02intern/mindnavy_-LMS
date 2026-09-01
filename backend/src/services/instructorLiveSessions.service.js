const liveSessionsService = require("./liveSessions.service");
const { assertOwnsLiveSession, assertOwnsCourse } = require("../utils/ownershipGuard");
const { forceOwnInstructorId } = require("../utils/selfScope");

// ── Instructor self-service Live Sessions layer ──────────────────────────────
//
// Same shape as instructorCourses.service.js: thin guard-then-delegate
// wrappers over the existing admin liveSessions.service — createSession's
// real Zoom meeting creation, updateSession's Zoom-first-then-DB patching,
// deleteSession's best-effort Zoom cleanup, and markAttendance's transaction
// are all reused verbatim. adminId is ALWAYS null on every write below —
// see instructorCourses.service.js's header note (AuditLog.adminId is
// FK-constrained to AdminUser).

async function listMySessions(instructorId, query) {
  // Server value always wins — never the client's ?instructorId=.
  return liveSessionsService.listSessions({ ...query, instructorId });
}

async function getMySession(instructorId, sessionId) {
  await assertOwnsLiveSession(sessionId, instructorId);
  return liveSessionsService.getSession(sessionId);
}

async function createMySession(instructorId, body) {
  const data = forceOwnInstructorId(body, instructorId);
  // If a course is linked, it must be one of THIS instructor's own courses —
  // liveSessions.service.createSession only checks the course exists, not
  // who owns it (an admin scheduling on behalf of any instructor is
  // legitimate; a self-service instructor attaching someone else's course
  // to their own session is not).
  if (data.courseId) await assertOwnsCourse(data.courseId, instructorId);
  return liveSessionsService.createSession(data, null);
}

async function updateMySession(instructorId, sessionId, body) {
  await assertOwnsLiveSession(sessionId, instructorId);
  // instructorId is never transferable via self-service — strip it outright,
  // same rule as instructorCourses.service.updateMyCourse.
  const { instructorId: _ignored, ...data } = body;
  if (data.courseId) await assertOwnsCourse(data.courseId, instructorId);
  return liveSessionsService.updateSession(sessionId, data, null);
}

async function deleteMySession(instructorId, sessionId) {
  await assertOwnsLiveSession(sessionId, instructorId);
  return liveSessionsService.deleteSession(sessionId, null);
}

async function endMySession(instructorId, sessionId) {
  await assertOwnsLiveSession(sessionId, instructorId);
  return liveSessionsService.endSession(sessionId, null);
}

async function markMyAttendance(instructorId, sessionId, records) {
  await assertOwnsLiveSession(sessionId, instructorId);
  return liveSessionsService.markAttendance(sessionId, records, null);
}

module.exports = {
  listMySessions,
  getMySession,
  createMySession,
  updateMySession,
  deleteMySession,
  endMySession,
  markMyAttendance,
};
