const svc = require("../services/quizzes.service");
const {
  validateId,
  validateQuizCreate,
  validateQuizUpdate,
  validateQuestionCreate,
  validateQuestionUpdate,
  validateReorder,
} = require("../validators/quizzes.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

// Domain errors thrown by the service → clean HTTP status + message.
function handleDomainError(res, err) {
  switch (err.code) {
    case "QUIZ_NOT_FOUND":       return notFound(res, "Quiz not found.");
    case "QUESTION_NOT_FOUND":   return notFound(res, "Question not found in this quiz.");
    case "COURSE_NOT_FOUND":     return badRequest(res, "Referenced course does not exist.");
    case "QUESTION_NOT_IN_QUIZ": return badRequest(res, "A question does not belong to this quiz.");
    default:                     return null;
  }
}

function serverError(res, err) {
  console.error("[QuizzesController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  // Table missing → migration not run yet. A clean 503 makes the cause obvious.
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

// ── Quizzes ──────────────────────────────────────────────────────────────────────

const listQuizzes = run(async (req, res) => {
  // Optional ?courseId= filter — matches the frontend key ['quizzes', courseId?].
  const courseId = typeof req.query.courseId === "string" && req.query.courseId.trim()
    ? req.query.courseId.trim()
    : undefined;
  const quizzes = await svc.listQuizzes({ courseId });
  return res.json({ success: true, data: quizzes });
});

const getQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId");
  if (idErr) return badRequest(res, idErr);
  const quiz = await svc.getQuiz(req.params.id);
  return res.json({ success: true, data: quiz });
});

const createQuiz = run(async (req, res) => {
  const v = validateQuizCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.createQuiz(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Quiz created.", data: quiz });
});

const updateQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuizUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.updateQuiz(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Quiz updated.", data: quiz });
});

const deleteQuiz = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteQuiz(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Quiz deleted.", data: result });
});

// ── Questions ────────────────────────────────────────────────────────────────────

const createQuestion = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuestionCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const question = await svc.createQuestion(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Question added.", data: question });
});

const updateQuestion = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId") ?? validateId(req.params.questionId, "questionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateQuestionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const question = await svc.updateQuestion(req.params.id, req.params.questionId, v.data, req.admin?.id);
  return res.json({ success: true, message: "Question updated.", data: question });
});

const deleteQuestion = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId") ?? validateId(req.params.questionId, "questionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteQuestion(req.params.id, req.params.questionId, req.admin?.id);
  return res.json({ success: true, message: "Question deleted.", data: result });
});

// ── Reorder ────────────────────────────────────────────────────────────────────────

const reorderQuestions = run(async (req, res) => {
  const idErr = validateId(req.params.id, "quizId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReorder(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const quiz = await svc.reorderQuestions(req.params.id, v.data, req.admin?.id);
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
