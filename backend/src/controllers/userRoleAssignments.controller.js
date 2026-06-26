const svc = require("../services/userRoleAssignments.service");
const {
  validateId,
  validateListAssignmentsQuery,
  validateCreateAssignment,
  validateUpdateAssignment,
} = require("../validators/userRoleAssignments.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function conflict(res, msg) {
  return res.status(409).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[UserRoleAssignmentsController]", err);
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "This user already has that role assigned." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found." });
  }
  if (err.code === "P2003") {
    return res.status(400).json({ success: false, message: "Invalid reference: user or role does not exist." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Controllers ────────────────────────────────────────────────────────────────

async function getAssignmentStats(req, res) {
  try {
    const stats = await svc.getAssignmentStats();
    return res.json({ success: true, data: stats });
  } catch (err) { return serverError(res, err); }
}

async function listAssignments(req, res) {
  try {
    const v = validateListAssignmentsQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const result = await svc.listAssignments(v.data);
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function createAssignment(req, res) {
  try {
    const v = validateCreateAssignment(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const assignment = await svc.createAssignment(v.data, req.admin?.id);
    return res.status(201).json({ success: true, message: "Role assigned successfully.", data: assignment });
  } catch (err) {
    if (err.code === "USER_NOT_FOUND")  return notFound(res, "User not found.");
    if (err.code === "ROLE_NOT_FOUND")  return notFound(res, "Role not found.");
    if (err.code === "ALREADY_ASSIGNED") return conflict(res, "This user already has that role assigned.");
    return serverError(res, err);
  }
}

async function updateAssignment(req, res) {
  try {
    const idErr = validateId(req.params.id, "assignmentId");
    if (idErr) return badRequest(res, idErr);
    const v = validateUpdateAssignment(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const assignment = await svc.updateAssignment(req.params.id, v.data, req.admin?.id);
    return res.json({ success: true, message: "Assignment updated successfully.", data: assignment });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Assignment not found.");
    return serverError(res, err);
  }
}

async function deleteAssignment(req, res) {
  try {
    const idErr = validateId(req.params.id, "assignmentId");
    if (idErr) return badRequest(res, idErr);
    await svc.deleteAssignment(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Assignment removed successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Assignment not found.");
    return serverError(res, err);
  }
}

module.exports = {
  getAssignmentStats,
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
