const prisma = require("../config/prisma");

// ── Quizzes & Exams service (quizzes + questions + reorder) ─────────────────────
//
// Same conventions as learningPaths.service: reads use safe() so the tab renders
// empty (never 500s) before `npx prisma db push` has created the tables; writes
// verify references first so a bad request is a clean 400/404, never an orphan
// row or a 500. Deleting a quiz cascades to its questions at the DB level.
//
// Grading v1 is a decision, not code: ESSAY = manual, every other type is
// auto-gradable. `autoGradable` on the detail response is derived live from the
// question types (computed, never stored — IMPACT_MAP R3). Learner attempts and
// the grading endpoint ship with the learner runtime.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[quizzes.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

const QUIZ_SELECT = {
  id: true, title: true, description: true, courseId: true,
  passingGrade: true, attemptsAllowed: true, timeLimit: true,
  randomizeQuestions: true, createdAt: true, updatedAt: true,
  _count: { select: { questions: true } },
};

const QUESTION_SELECT = {
  id: true, quizId: true, type: true, prompt: true, data: true,
  points: true, order: true, createdAt: true, updatedAt: true,
};

function mapQuiz(q) {
  return {
    id:                 q.id,
    title:              q.title,
    description:        q.description ?? null,
    courseId:           q.courseId ?? null,
    passingGrade:       q.passingGrade,
    attemptsAllowed:    q.attemptsAllowed ?? null,
    timeLimit:          q.timeLimit ?? null,
    randomizeQuestions: q.randomizeQuestions,
    questionCount:      q._count?.questions ?? 0,
    createdAt:          iso(q.createdAt),
    updatedAt:          iso(q.updatedAt),
  };
}

function mapQuestion(qn) {
  return {
    id:        qn.id,
    quizId:    qn.quizId,
    type:      qn.type,
    prompt:    qn.prompt,
    data:      qn.data ?? null,
    points:    qn.points,
    order:     qn.order,
    createdAt: iso(qn.createdAt),
    updatedAt: iso(qn.updatedAt),
  };
}

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function quizAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Existence guards (clean 404/400 instead of a raw Prisma error) ─────────────────

async function getQuizOrThrow(id) {
  const q = await prisma.quiz.findUnique({ where: { id }, select: { id: true } });
  if (!q) throw domainError("QUIZ_NOT_FOUND");
  return q;
}

async function assertCourseExists(courseId) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!c) throw domainError("COURSE_NOT_FOUND");
}

async function getQuestionInQuizOrThrow(quizId, questionId) {
  const qn = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, quizId: true },
  });
  if (!qn || qn.quizId !== quizId) throw domainError("QUESTION_NOT_FOUND");
  return qn;
}

// ── Quizzes ──────────────────────────────────────────────────────────────────────

async function listQuizzes({ courseId } = {}) {
  const rows = await safe(
    () => prisma.quiz.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: { createdAt: "desc" },
      select: QUIZ_SELECT,
    }),
    [],
  );
  return rows.map(mapQuiz);
}

async function getQuiz(id) {
  const q = await prisma.quiz.findUnique({
    where: { id },
    select: {
      ...QUIZ_SELECT,
      questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: QUESTION_SELECT },
    },
  });
  if (!q) throw domainError("QUIZ_NOT_FOUND");

  const questions = q.questions.map(mapQuestion);
  return {
    ...mapQuiz(q),
    questions,
    // Derived live (R3): total points across questions, and whether the whole
    // quiz can be auto-graded (ESSAY is the only manual type in v1).
    totalPoints:  questions.reduce((sum, qn) => sum + qn.points, 0),
    autoGradable: questions.every((qn) => qn.type !== "ESSAY"),
  };
}

async function createQuiz(data, adminId) {
  if (data.courseId) await assertCourseExists(data.courseId);

  const quiz = await prisma.quiz.create({
    data: {
      title:              data.title,
      description:        data.description,
      courseId:           data.courseId,
      passingGrade:       data.passingGrade,
      attemptsAllowed:    data.attemptsAllowed,
      timeLimit:          data.timeLimit,
      randomizeQuestions: data.randomizeQuestions,
    },
    select: QUIZ_SELECT,
  });

  await quizAuditLog(adminId, "QUIZ_CREATED", { quizId: quiz.id, title: quiz.title, courseId: quiz.courseId });
  return mapQuiz(quiz);
}

async function updateQuiz(id, data, adminId) {
  await getQuizOrThrow(id);
  // courseId may be set/changed (verify the target) or null (detach — no check).
  if (data.courseId) await assertCourseExists(data.courseId);

  const quiz = await prisma.quiz.update({ where: { id }, data, select: QUIZ_SELECT });
  await quizAuditLog(adminId, "QUIZ_UPDATED", { quizId: id, fields: Object.keys(data) });
  return mapQuiz(quiz);
}

async function deleteQuiz(id, adminId) {
  await getQuizOrThrow(id);
  // Questions are removed by the DB cascade (onDelete: Cascade on Question.quiz).
  await prisma.quiz.delete({ where: { id } });
  await quizAuditLog(adminId, "QUIZ_DELETED", { quizId: id });
  return { id };
}

// ── Questions ────────────────────────────────────────────────────────────────────

async function createQuestion(quizId, data, adminId) {
  await getQuizOrThrow(quizId);

  // Default order = end of the current list, so a new question lands at the bottom.
  const order = data.order ?? (await prisma.question.count({ where: { quizId } }));

  const question = await prisma.question.create({
    data: {
      quizId,
      type:   data.type,
      prompt: data.prompt,
      data:   data.data,
      points: data.points,
      order,
    },
    select: QUESTION_SELECT,
  });

  await quizAuditLog(adminId, "QUESTION_CREATED", { quizId, questionId: question.id, type: question.type });
  return mapQuestion(question);
}

async function updateQuestion(quizId, questionId, data, adminId) {
  await getQuizOrThrow(quizId);
  await getQuestionInQuizOrThrow(quizId, questionId);

  const question = await prisma.question.update({ where: { id: questionId }, data, select: QUESTION_SELECT });
  await quizAuditLog(adminId, "QUESTION_UPDATED", { quizId, questionId, fields: Object.keys(data) });
  return mapQuestion(question);
}

async function deleteQuestion(quizId, questionId, adminId) {
  await getQuizOrThrow(quizId);
  await getQuestionInQuizOrThrow(quizId, questionId);

  await prisma.question.delete({ where: { id: questionId } });
  await quizAuditLog(adminId, "QUESTION_DELETED", { quizId, questionId });
  return { id: questionId };
}

// ── Reorder (one atomic bulk write after drag-and-drop) ────────────────────────────

async function reorderQuestions(quizId, { items }, adminId) {
  await getQuizOrThrow(quizId);

  // Every referenced question must belong to THIS quiz.
  const owned = await prisma.question.findMany({ where: { quizId }, select: { id: true } });
  const ownedIds = new Set(owned.map((qn) => qn.id));
  for (const it of items) {
    if (!ownedIds.has(it.id)) throw domainError("QUESTION_NOT_IN_QUIZ");
  }

  // One transaction: all order updates apply together or none do.
  await prisma.$transaction(
    items.map((it) => prisma.question.update({ where: { id: it.id }, data: { order: it.order } })),
  );

  await quizAuditLog(adminId, "QUIZ_QUESTIONS_REORDERED", { quizId, items: items.length });
  return getQuiz(quizId);
}

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
