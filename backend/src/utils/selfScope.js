// Reusable helper for Phase 3+ instructor-facing routes that reuse existing
// admin POST bodies (POST /courses, POST /live-sessions) which currently
// accept an arbitrary client-supplied instructorId. Forces it to the
// authenticated caller's own id, ignoring whatever the client sent — never
// trust instructorId from req.body once a route sits behind
// requireInstructorAuth.

function forceOwnInstructorId(body, callerId) {
  return { ...(body || {}), instructorId: callerId };
}

module.exports = {
  forceOwnInstructorId,
};
