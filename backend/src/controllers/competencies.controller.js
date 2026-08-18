const svc = require("../services/competencies.service");
const certSvc = require("../services/competencyCertifications.service");
const {
  validateId,
  validateSkillListQuery,
  validateSkillCreate,
  validateSkillUpdate,
  validateAssignCourse,
  validateFrameworkListQuery,
  validateFrameworkCreate,
  validateFrameworkUpdate,
  validateFrameworkSkillAdd,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateAssessmentListQuery,
  validateAssessmentCreate,
  validateSkillGapsQuery,
  validateCompetencySettings,
  validateProficiencyLevelsUpdate,
  validateCertificationListQuery,
  validateCertificationAssign,
  validateCertificationVerify,
  validateCertificationRevoke,
} = require("../validators/competencies.validator");

// ── Helpers (same pattern as instructors.controller) ────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}
function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}
function conflict(res, msg, data) {
  return res.status(409).json({ success: false, message: msg, ...(data ? { data } : {}) });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "SKILL_NOT_FOUND":
      return notFound(res, "Skill not found.");
    case "CATEGORY_NOT_FOUND":
      return badRequest(res, "categoryId does not reference an existing skill category.");
    case "COURSE_NOT_FOUND":
      return badRequest(res, "courseId does not reference an existing course.");
    case "COURSE_ALREADY_ASSIGNED":
      return conflict(res, "This course is already assigned to this skill.");
    case "MAPPING_NOT_FOUND":
      return notFound(res, "This course is not assigned to this skill.");
    case "SKILL_IN_USE":
      return conflict(
        res,
        "This skill is still in use (user profiles, assessments, frameworks, or course mappings). Archive it instead, or remove those references first.",
        err.blockers,
      );
    case "FRAMEWORK_NOT_FOUND":
      return notFound(res, "Framework not found.");
    case "SKILL_ALREADY_IN_FRAMEWORK":
      return conflict(res, "This skill is already required by this framework.");
    case "FRAMEWORK_SKILL_NOT_FOUND":
      return notFound(res, "This skill is not part of this framework.");
    case "SKILL_CATEGORY_NOT_FOUND":
      return notFound(res, "Skill category not found.");
    case "PARENT_NOT_FOUND":
      return notFound(res, "Parent category not found.");
    case "MAX_DEPTH":
      return badRequest(res, "Only two levels are supported — a subcategory cannot be a parent.");
    case "SELF_PARENT":
      return badRequest(res, "A category cannot be its own parent.");
    case "DUPLICATE_SKILL_CATEGORY":
      return badRequest(res, "A category with this name already exists at this level.");
    case "HAS_CHILDREN_MOVE":
      return badRequest(res, "Move or delete its subcategories first — a category with subcategories cannot become a subcategory.");
    case "HAS_CHILDREN_DELETE":
      return badRequest(res, "Delete its subcategories first.");
    case "HAS_SKILLS":
      return badRequest(res, "Reassign this category's skills first.");
    case "USER_NOT_FOUND":
      return notFound(res, "User not found.");
    case "CERTIFICATION_NOT_FOUND":
      return notFound(res, "Certification not found.");
    case "NOT_PENDING":
      return badRequest(res, err.message);
    case "ALREADY_REVOKED":
      return conflict(res, err.message);
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[CompetenciesController]", err);
  // CSV import/settings validation throws plain Errors with a `.statusCode`
  // (same shape users.service uses for its import errors) rather than the
  // `.code` domain-error convention the rest of this module uses.
  if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2002") return conflict(res, "This record already exists.");
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

// ── Handlers ─────────────────────────────────────────────────────────────────

const listSkills = run(async (req, res) => {
  const v = validateSkillListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listSkills(v.data);
  return res.json({ success: true, data: result });
});

// Registered BEFORE /skills/:id — "stats"/"analytics" must never be read as a
// skill id (same ordering rule as instructors.routes).
const getStats = run(async (req, res) => {
  const stats = await svc.getStats();
  return res.json({ success: true, data: stats });
});

const getAnalytics = run(async (req, res) => {
  const analytics = await svc.getAnalytics();
  return res.json({ success: true, data: analytics });
});

const getSkill = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const skill = await svc.getSkill(req.params.id);
  return res.json({ success: true, data: skill });
});

const createSkill = run(async (req, res) => {
  const v = validateSkillCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const skill = await svc.createSkill(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Skill created.", data: skill });
});

const updateSkill = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSkillUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const skill = await svc.updateSkill(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Skill updated.", data: skill });
});

const deleteSkill = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteSkill(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Skill deleted.", data: result });
});

const assignCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const v = validateAssignCourse(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.assignCourseToSkill(req.params.id, v.data.courseId, req.admin?.id);
  return res.status(201).json({ success: true, message: "Course assigned to skill.", data: result });
});

const removeCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const courseIdErr = validateId(req.params.courseId, "courseId");
  if (courseIdErr) return badRequest(res, courseIdErr);
  const result = await svc.removeCourseFromSkill(req.params.id, req.params.courseId, req.admin?.id);
  return res.json({ success: true, message: "Course removed from skill.", data: result });
});

// ── Frameworks (Part 2) ──────────────────────────────────────────────────────

const listFrameworks = run(async (req, res) => {
  const v = validateFrameworkListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listFrameworks(v.data);
  return res.json({ success: true, data: result });
});

const getFramework = run(async (req, res) => {
  const idErr = validateId(req.params.id, "frameworkId");
  if (idErr) return badRequest(res, idErr);
  const framework = await svc.getFramework(req.params.id);
  return res.json({ success: true, data: framework });
});

const createFramework = run(async (req, res) => {
  const v = validateFrameworkCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const framework = await svc.createFramework(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Framework created.", data: framework });
});

const updateFramework = run(async (req, res) => {
  const idErr = validateId(req.params.id, "frameworkId");
  if (idErr) return badRequest(res, idErr);
  const v = validateFrameworkUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const framework = await svc.updateFramework(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Framework updated.", data: framework });
});

const deleteFramework = run(async (req, res) => {
  const idErr = validateId(req.params.id, "frameworkId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteFramework(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Framework deleted.", data: result });
});

const addFrameworkSkill = run(async (req, res) => {
  const idErr = validateId(req.params.id, "frameworkId");
  if (idErr) return badRequest(res, idErr);
  const v = validateFrameworkSkillAdd(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.addSkillToFramework(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Skill added to framework.", data: result });
});

const removeFrameworkSkill = run(async (req, res) => {
  const idErr = validateId(req.params.id, "frameworkId");
  if (idErr) return badRequest(res, idErr);
  const skillIdErr = validateId(req.params.skillId, "skillId");
  if (skillIdErr) return badRequest(res, skillIdErr);
  const result = await svc.removeSkillFromFramework(req.params.id, req.params.skillId, req.admin?.id);
  return res.json({ success: true, message: "Skill removed from framework.", data: result });
});

// ── Skill categories (Part 2) ────────────────────────────────────────────────

const listCategories = run(async (req, res) => {
  const categories = await svc.listSkillCategories();
  return res.json({ success: true, data: categories });
});

const createCategory = run(async (req, res) => {
  const v = validateCategoryCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const category = await svc.createSkillCategory(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Category created.", data: category });
});

const updateCategory = run(async (req, res) => {
  const idErr = validateId(req.params.id, "categoryId");
  if (idErr) return badRequest(res, idErr);
  const v = validateCategoryUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const category = await svc.updateSkillCategory(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Category updated.", data: category });
});

const deleteCategory = run(async (req, res) => {
  const idErr = validateId(req.params.id, "categoryId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteSkillCategory(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Category deleted.", data: result });
});

// ── User skill profiles (Part 2) ─────────────────────────────────────────────

const getUserSkills = run(async (req, res) => {
  const idErr = validateId(req.params.userId, "userId");
  if (idErr) return badRequest(res, idErr);
  const skills = await svc.getUserSkills(req.params.userId);
  return res.json({ success: true, data: skills });
});

// ── Assessments (Part 2) ─────────────────────────────────────────────────────

const listAssessments = run(async (req, res) => {
  const v = validateAssessmentListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listAssessments(v.data);
  return res.json({ success: true, data: result });
});

const createAssessment = run(async (req, res) => {
  const v = validateAssessmentCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.createAssessment(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Assessment recorded.", data: result });
});

// ── Skill gaps (Part 2) ──────────────────────────────────────────────────────

const getSkillGaps = run(async (req, res) => {
  const v = validateSkillGapsQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.getSkillGaps(v.data);
  return res.json({ success: true, data: result });
});

// ── Skills — export / import (Import/Export tab) ────────────────────────────

const exportSkills = run(async (req, res) => {
  const v = validateSkillListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.exportSkills(v.data, req.admin?.id);
  return res.json({ success: true, data: result });
});

// Not wrapped in run() — mirrors users.controller.importUsers exactly: the
// upload-error/no-file checks happen before the try/catch, same as there.
async function importSkills(req, res) {
  if (req.uploadError) return badRequest(res, req.uploadError);
  if (!req.file) return badRequest(res, "No CSV file uploaded. Use field name: file.");
  try {
    const result = await svc.importSkillsFromCsv(req.file, req.admin?.id);
    return res.json(result);
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

// ── Competency Settings (Settings tab) ───────────────────────────────────────

const getCompetencySettings = run(async (req, res) => {
  const settings = await svc.getCompetencySettings();
  return res.json({ success: true, data: settings });
});

const updateCompetencySettings = run(async (req, res) => {
  const errors = validateCompetencySettings(req.body);
  if (errors.length) return badRequest(res, errors[0]);
  const settings = await svc.updateCompetencySettings(req.body, req.admin?.id);
  return res.json({ success: true, message: "Settings updated.", data: settings });
});

// ── Proficiency Levels (Proficiency Levels tab) ──────────────────────────────

const getProficiencyLevels = run(async (req, res) => {
  const levels = await svc.getProficiencyLevels();
  return res.json({ success: true, data: { levels } });
});

const updateProficiencyLevels = run(async (req, res) => {
  const v2 = validateProficiencyLevelsUpdate(req.body);
  if (!v2.isValid) return badRequest(res, v2.errors[0]);
  const levels = await svc.updateProficiencyLevels(v2.data.levels, req.admin?.id);
  return res.json({ success: true, message: "Proficiency levels updated.", data: { levels } });
});

// ── Skill distribution (CompetencySidePanel donut) ──────────────────────────

const getSkillDistribution = run(async (req, res) => {
  const idErr = validateId(req.params.id, "skillId");
  if (idErr) return badRequest(res, idErr);
  const distribution = await svc.getSkillDistribution(req.params.id);
  return res.json({ success: true, data: distribution });
});

// ── Competency Certifications (Certifications tab) ──────────────────────────

const listCertifications = run(async (req, res) => {
  const v = validateCertificationListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await certSvc.listCertifications(v.data);
  return res.json({ success: true, data: result });
});

const getCertification = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificationId");
  if (idErr) return badRequest(res, idErr);
  const cert = await certSvc.getCertification(req.params.id);
  return res.json({ success: true, data: cert });
});

const getUserCertifications = run(async (req, res) => {
  const idErr = validateId(req.params.userId, "userId");
  if (idErr) return badRequest(res, idErr);
  const certs = await certSvc.listUserCertifications(req.params.userId);
  return res.json({ success: true, data: certs });
});

const assignCertification = run(async (req, res) => {
  const v = validateCertificationAssign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await certSvc.assignCertification(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Certification assigned.", data: cert });
});

const verifyCertification = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificationId");
  if (idErr) return badRequest(res, idErr);
  const v = validateCertificationVerify(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await certSvc.verifyCertification(req.params.id, v.data.notes, req.admin?.id);
  return res.json({ success: true, message: "Certification verified.", data: cert });
});

const revokeCertification = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificationId");
  if (idErr) return badRequest(res, idErr);
  const v = validateCertificationRevoke(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await certSvc.revokeCertification(req.params.id, v.data.reason, req.admin?.id);
  return res.json({ success: true, message: "Certification revoked.", data: cert });
});

const deleteCertification = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificationId");
  if (idErr) return badRequest(res, idErr);
  const result = await certSvc.deleteCertification(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Certification deleted.", data: result });
});

module.exports = {
  listSkills,
  getStats,
  getAnalytics,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  assignCourse,
  removeCourse,
  // Part 2
  listFrameworks,
  getFramework,
  createFramework,
  updateFramework,
  deleteFramework,
  addFrameworkSkill,
  removeFrameworkSkill,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getUserSkills,
  listAssessments,
  createAssessment,
  getSkillGaps,
  exportSkills,
  importSkills,
  getCompetencySettings,
  updateCompetencySettings,
  getProficiencyLevels,
  updateProficiencyLevels,
  getSkillDistribution,
  // Certifications
  listCertifications,
  getCertification,
  getUserCertifications,
  assignCertification,
  verifyCertification,
  revokeCertification,
  deleteCertification,
};
