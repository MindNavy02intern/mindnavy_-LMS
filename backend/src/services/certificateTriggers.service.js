const prisma = require("../config/prisma");
const certificatesService = require("./certificates.service");

// ── Certificate auto-issue triggers (CERTIFICATES_CONTRACT.md v1 deferred
// triggers, wired up) ────────────────────────────────────────────────────────
//
// v1 shipped issueCertificate() as "the single entry point future auto-triggers
// will call" — this module is that caller. Every function here is BEST-EFFORT:
// all errors are swallowed (expected ones — ALREADY_ISSUED, CERT_DISABLED —
// silently; anything else is logged) so a certificate hiccup never breaks the
// action that triggered it (an enrollment update, a quiz grade, …).
// issueCertificate() itself already handles dedupe (@@unique([courseId,userId]))
// and audit logging (CERTIFICATE_ISSUED) — nothing here repeats that.
//
// Trigger 4 (attendance threshold) — wired below (onAttendanceMarked), now
// that PATCH /api/admin/live-sessions/:id/attendance is a real writer.
//
// Trigger 3 (learning path completion) has no path-level certificate concept
// in the schema (Certificate.courseId is required, PDF/verify assume a real
// course) — by design decision (2026-08-17), it CASCADES into the existing
// per-course certificate for every COURSE item in a completed path, rather
// than inventing a parallel path-certificate model/PDF/verify surface.

async function tryIssue(userId, courseId, adminId, trigger) {
  try {
    await certificatesService.issueCertificate({ userId, courseId }, adminId, trigger);
  } catch (err) {
    if (err.code !== "ALREADY_ISSUED" && err.code !== "CERT_DISABLED") {
      console.error("[certificateTriggers] issue failed:", err.code || err.message);
    }
  }
}

async function pathsContaining(itemType, itemId) {
  const rows = await prisma.learningPathItem.findMany({
    where: { itemType, itemId },
    select: { pathId: true },
  });
  return [...new Set(rows.map((r) => r.pathId))];
}

// A path item is "complete" for a learner using whichever real signal that
// item type already has — same three signals the rest of the admin console
// reads (CourseEnrollment.status, SessionAttendance.status, QuizAttempt).
async function isItemComplete(item, userId) {
  if (item.itemType === "COURSE") {
    const e = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: item.itemId, userId } },
      select: { status: true },
    });
    return e?.status === "COMPLETED";
  }
  if (item.itemType === "LIVE_SESSION") {
    const a = await prisma.sessionAttendance.findUnique({
      where: { sessionId_userId: { sessionId: item.itemId, userId } },
      select: { status: true },
    });
    return a?.status === "PRESENT" || a?.status === "LATE";
  }
  // QUIZ — latest graded attempt, passed against the quiz's own passingGrade.
  const attempt = await prisma.quizAttempt.findFirst({
    where: { quizId: item.itemId, userId, status: "GRADED" },
    orderBy: { gradedAt: "desc" },
    select: { score: true, quiz: { select: { passingGrade: true } } },
  });
  return attempt != null && attempt.score != null && attempt.score >= attempt.quiz.passingGrade;
}

async function maybeCompletePath(pathId, userId, adminId) {
  const items = await prisma.learningPathItem.findMany({
    where: { pathId },
    select: { itemType: true, itemId: true },
  });
  if (items.length === 0) return;

  for (const item of items) {
    if (!(await isItemComplete(item, userId))) return; // not all complete yet
  }

  // All items complete — cascade into a certificate for every COURSE item in
  // the path (LIVE_SESSION/QUIZ items have no certificate of their own).
  for (const item of items) {
    if (item.itemType === "COURSE") await tryIssue(userId, item.itemId, adminId, "path_completed");
  }
}

async function recheckPathsFor(itemType, itemId, userId, adminId) {
  for (const pathId of await pathsContaining(itemType, itemId)) {
    await maybeCompletePath(pathId, userId, adminId);
  }
}

// ── Trigger 1 — course completion ────────────────────────────────────────────
async function onEnrollmentCompleted(courseId, userId, adminId) {
  try {
    await tryIssue(userId, courseId, adminId, "enrollment_completed");
    await recheckPathsFor("COURSE", courseId, userId, adminId);
  } catch (err) {
    console.error("[certificateTriggers] onEnrollmentCompleted failed:", err.message);
  }
}

// ── Trigger 2 — quiz passing grade ───────────────────────────────────────────
// Also requires the learner's enrollment in the quiz's course to already be
// COMPLETED — passing one quiz isn't the same as finishing the course.
async function onQuizGraded({ quizId, userId, score }, adminId) {
  try {
    if (score == null) return;
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { courseId: true, passingGrade: true } });
    if (!quiz?.courseId || score < quiz.passingGrade) return;

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: quiz.courseId, userId } },
      select: { status: true },
    });
    if (enrollment?.status !== "COMPLETED") return;

    await tryIssue(userId, quiz.courseId, adminId, "quiz_passed");
    await recheckPathsFor("QUIZ", quizId, userId, adminId);
  } catch (err) {
    console.error("[certificateTriggers] onQuizGraded failed:", err.message);
  }
}

// ── Trigger 4 — attendance threshold ─────────────────────────────────────────
// A live session has no course-level completion of its own to certify — this
// only ever cascades into learning-path certificates the same way Trigger 2
// does for quizzes (a LIVE_SESSION path item completing is what recheckPathsFor
// already knows how to evaluate via isItemComplete's PRESENT/LATE check).
async function onAttendanceMarked(sessionId, userId, adminId) {
  try {
    await recheckPathsFor("LIVE_SESSION", sessionId, userId, adminId);
  } catch (err) {
    console.error("[certificateTriggers] onAttendanceMarked failed:", err.message);
  }
}

module.exports = { onEnrollmentCompleted, onQuizGraded, onAttendanceMarked };
