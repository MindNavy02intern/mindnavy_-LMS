const svc = require("../services/instructorCompetencies.service");

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "USER_NOT_FOUND":
      return notFound(res, "Instructor not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorCompetenciesController]", err);
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

const getCourseSkills = run(async (req, res) => {
  const result = await svc.getMySkills(req.instructor.id);
  return res.json({ success: true, data: result });
});

const getCertifications = run(async (req, res) => {
  const result = await svc.getMyCertifications(req.instructor.id);
  return res.json({ success: true, data: result });
});

module.exports = {
  getCourseSkills,
  getCertifications,
};
