const svc = require("../services/instructorQuizzes.service");

const {
  validateId,
  validateQuizCreate,
  validateQuizUpdate,
  validateQuestionCreate,
  validateQuestionUpdate,
  validateReorder,
} = require("../validators/quizzes.validator");

// Error-code union of quizzes.controller.js plus FORBIDDEN_NOT_OWNER.

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
      return forbidden(res, "You do not have access to this quiz.");
    case "COURSE_NOT_FOUND":
      return notFound(res, "Course not found.");
    case "QUIZ_NOT_FOUND":
      return notFound(res, "Quiz not found.");
    case "QUESTION_NOT_FOUND":
      return notFound(res, "Question not found.");
    case "QUESTION_NOT_IN_QUIZ":
      return badRequest(res, "A question does not belong to this quiz.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorQuizzesController]", err);
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

// ── Quizzes ───────────────────────────────────────────────────────────────────

const listQuizzes = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const quizzes = await svc.listMyQuizzes(req.instructor.id, req.params.id);
  return res.json({ success: true, data: quizzes });
});

const getQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.quizId, "quizId");
  if (idErr) return badRequest(res, idErr);
  const quiz = await svc.getMyQuiz(req.instructor.id, req.params.id, req.params.quizId);
  return res.json({ success: true, data: quiz });
});

const createQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  // Forced into the RAW body before validation — same fix as createCourse /
  // createSession. courseId is always the URL's own :id, never the client's.
  const body = { ...req.body, courseId: req.params.id };
  const v = validateQuizCreate(body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.createMyQuiz(req.instructor.id, req.params.id, v.data);
  return res.status(201).json({ success: true, message: "Quiz created.", data: quiz });
});

const updateQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.quizId, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuizUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.updateMyQuiz(req.instructor.id, req.params.id, req.params.quizId, v.data);
  return res.json({ success: true, message: "Quiz updated.", data: quiz });
});

const deleteQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.quizId, "quizId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteMyQuiz(req.instructor.id, req.params.id, req.params.quizId);
  return res.json({ success: true, message: "Quiz deleted.", data: result });
});

// ── Questions ─────────────────────────────────────────────────────────────────

const createQuestion = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.quizId, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuestionCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const question = await svc.createMyQuestion(req.instructor.id, req.params.id, req.params.quizId, v.data);
  return res.status(201).json({ success: true, message: "Question added.", data: question });
});

const updateQuestion = run(async (req, res) => {
  const idErr =
    validateId(req.params.id, "courseId") ||
    validateId(req.params.quizId, "quizId") ||
    validateId(req.params.questionId, "questionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuestionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const question = await svc.updateMyQuestion(req.instructor.id, req.params.id, req.params.quizId, req.params.questionId, v.data);
  return res.json({ success: true, message: "Question updated.", data: question });
});

const deleteQuestion = run(async (req, res) => {
  const idErr =
    validateId(req.params.id, "courseId") ||
    validateId(req.params.quizId, "quizId") ||
    validateId(req.params.questionId, "questionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteMyQuestion(req.instructor.id, req.params.id, req.params.quizId, req.params.questionId);
  return res.json({ success: true, message: "Question deleted.", data: result });
});

const reorderQuestions = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.quizId, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReorder(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.reorderMyQuestions(req.instructor.id, req.params.id, req.params.quizId, v.data);
  return res.json({ success: true, message: "Order updated.", data: quiz });
});

module.exports = {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
};
