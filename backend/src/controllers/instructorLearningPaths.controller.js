const svc = require("../services/instructorLearningPaths.service");
const { validateId } = require("../validators/learningPaths.validator");

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
    case "PATH_NOT_FOUND":
      return notFound(res, "Learning path not found.");
    case "FORBIDDEN_NOT_OWNER":
      return forbidden(res, "This learning path does not contain any of your courses.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorLearningPathsController]", err);
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

const listPaths = run(async (req, res) => {
  const paths = await svc.listMyLearningPaths(req.instructor.id);
  return res.json({ success: true, data: paths });
});

const getPath = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const path = await svc.getMyLearningPath(req.instructor.id, req.params.id);
  return res.json({ success: true, data: path });
});

module.exports = {
  listPaths,
  getPath,
};
