const quizzesService = require("./quizzes.service");
const { assertOwnsCourse, assertOwnsQuiz } = require("../utils/ownershipGuard");

// ── Instructor self-service Quizzes layer ────────────────────────────────────
//
// Thin guard-then-delegate wrappers over quizzes.service.js (R4 reuse rule),
// same shape as instructorCourses.service.js. quizzes.service/validator have
// ZERO ownership concept — a Quiz's own courseId is the only link back to an
// instructor, so every function here resolves ownership via assertOwnsCourse
// (course-scoped calls) or assertOwnsQuiz (quiz/question-id-scoped calls,
// which transitively also covers the course).
//
// adminId is always null on every delegated call — AuditLog.adminId is FK-
// constrained to AdminUser, never an AppUser id (same rule as every other
// reused-service call in this project).

async function listMyQuizzes(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  return quizzesService.listQuizzes({ courseId });
}

async function getMyQuiz(instructorId, courseId, quizId) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.getQuiz(quizId);
}

async function createMyQuiz(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  // courseId is forced into the body by the controller before validation
  // (same "force before validate" fix already applied to createCourse /
  // createSession) — data.courseId here is always the URL's own :id, never
  // a client-supplied value, so a self-service quiz can never be created
  // detached or pointed at someone else's course.
  return quizzesService.createQuiz(data, null);
}

async function updateMyQuiz(instructorId, courseId, quizId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  // A self-service quiz may never be detached (courseId: null) or reassigned
  // to a different course — both would either orphan it from every
  // instructor (assertOwnsQuiz treats null courseId as unowned) or hand it
  // to a course this caller doesn't control. Strip it outright, matching
  // updateMyCourse's treatment of instructorId.
  const { courseId: _ignored, ...safeData } = data;
  return quizzesService.updateQuiz(quizId, safeData, null);
}

async function deleteMyQuiz(instructorId, courseId, quizId) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.deleteQuiz(quizId, null);
}

// ── Questions ─────────────────────────────────────────────────────────────────

async function createMyQuestion(instructorId, courseId, quizId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.createQuestion(quizId, data, null);
}

async function updateMyQuestion(instructorId, courseId, quizId, questionId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.updateQuestion(quizId, questionId, data, null);
}

async function deleteMyQuestion(instructorId, courseId, quizId, questionId) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.deleteQuestion(quizId, questionId, null);
}

async function reorderMyQuestions(instructorId, courseId, quizId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsQuiz(quizId, instructorId);
  return quizzesService.reorderQuestions(quizId, data, null);
}

module.exports = {
  listMyQuizzes,
  getMyQuiz,
  createMyQuiz,
  updateMyQuiz,
  deleteMyQuiz,
  createMyQuestion,
  updateMyQuestion,
  deleteMyQuestion,
  reorderMyQuestions,
};
