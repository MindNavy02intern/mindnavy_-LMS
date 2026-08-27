const prisma = require("../config/prisma");

// Reusable ownership checks for Phase 3+ instructor-facing routes that REUSE
// existing admin write endpoints (courses, live sessions, documents,
// certifications). None of those endpoints check the caller against the
// owning row today — req.admin?.id is used only for audit-log attribution.
// These guards are the missing check, built now so Phase 3 wires them in
// rather than reinventing the pattern per-route.
//
// Convention: same as the rest of the service layer (see instructors.service.js
// domainError) — throw an Error with .code/.status, never return a boolean.
// Callers decide what to do with the error; these functions never touch
// req/res directly, so they work from any controller/service.

function domainError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

async function assertOwnsCourse(courseId, callerId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    // `status` is additive (Phase 3) — instructorCourses.service.js needs it
    // for the "only Draft/Rejected are self-archivable" rule without a
    // second query. Existing callers select nothing extra, so this is
    // backward-compatible.
    select: { id: true, instructorId: true, status: true },
  });

  if (!course) throw domainError("COURSE_NOT_FOUND", 404);
  if (course.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return course;
}

// Transitive guards (Phase 3) — a CourseSection/Lesson id carries no
// instructorId of its own; ownership only exists via section→course or
// lesson→section→course. Resolving it with a join here (rather than trusting
// that the URL's :id and the :sectionId/:lessonId being operated on actually
// agree) means a request can never slip through by pairing a caller's own
// course id in the URL with a section/lesson id from a DIFFERENT course —
// this is the exact "must do that join, not just check a direct field"
// requirement called out in the blueprint's Course Builder section.
async function assertOwnsSection(sectionId, callerId) {
  const section = await prisma.courseSection.findUnique({
    where: { id: sectionId },
    select: { id: true, courseId: true, course: { select: { instructorId: true } } },
  });

  if (!section) throw domainError("SECTION_NOT_FOUND", 404);
  if (section.course?.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return section;
}

async function assertOwnsLesson(lessonId, callerId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      sectionId: true,
      section: { select: { courseId: true, course: { select: { instructorId: true } } } },
    },
  });

  if (!lesson) throw domainError("LESSON_NOT_FOUND", 404);
  if (lesson.section?.course?.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return lesson;
}

// Same transitive-join shape as assertOwnsSection — a Quiz's own courseId can
// be null (a standalone quiz, admin-only concept) or point at a course the
// caller does NOT own; either way ownership only exists via quiz→course.
async function assertOwnsQuiz(quizId, callerId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, courseId: true, course: { select: { instructorId: true } } },
  });

  if (!quiz) throw domainError("QUIZ_NOT_FOUND", 404);
  if (!quiz.courseId || quiz.course?.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return quiz;
}

async function assertOwnsLiveSession(sessionId, callerId) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    select: { id: true, instructorId: true },
  });

  if (!session) throw domainError("LIVE_SESSION_NOT_FOUND", 404);
  if (session.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return session;
}

async function assertOwnsDocument(docId, callerId) {
  const doc = await prisma.instructorDocument.findUnique({
    where: { id: docId },
    select: { id: true, instructorId: true },
  });

  if (!doc) throw domainError("DOCUMENT_NOT_FOUND", 404);
  if (doc.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return doc;
}

async function assertOwnsCertification(certId, callerId) {
  const cert = await prisma.instructorCertification.findUnique({
    where: { id: certId },
    select: { id: true, instructorId: true },
  });

  if (!cert) throw domainError("CERTIFICATION_NOT_FOUND", 404);
  if (cert.instructorId !== callerId) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return cert;
}

module.exports = {
  assertOwnsCourse,
  assertOwnsLiveSession,
  assertOwnsDocument,
  assertOwnsCertification,
  assertOwnsSection,
  assertOwnsLesson,
  assertOwnsQuiz,
};
