const svc = require("../services/organization.service");
const {
  validateId,
  validateCreateBranch,  validateUpdateBranch,
  validateCreateDepartment, validateUpdateDepartment,
  validateCreateTeam,    validateUpdateTeam,
  validateUserIds,       validateDeptIds,
  validateOrgMove,       validateHierarchySettings,
} = require("../validators/organization.validator");

// ── Shared response helpers ────────────────────────────────────────────────────

function badRequest(res, errors) {
  return res.status(400).json({ success: false, message: errors[0], errors });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function conflict(res, msg) {
  return res.status(409).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[OrgController]", err);
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err.code === "P2003") {
    const field = err.meta?.field_name ?? "a referenced field";
    return res.status(400).json({ success: false, message: `Invalid ID: the value provided for "${field}" does not match any existing record.` });
  }
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A record with this name already exists." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Branches ───────────────────────────────────────────────────────────────────

async function listBranches(req, res) {
  try {
    const { search, page, limit } = req.query;
    const result = await svc.listBranches({ search, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getBranch(req, res) {
  try {
    const err = validateId(req.params.branchId, "branchId");
    if (err) return badRequest(res, [err]);
    const branch = await svc.getBranch(req.params.branchId);
    if (!branch) return notFound(res, "Branch not found.");
    return res.json({ success: true, data: branch });
  } catch (err) { return serverError(res, err); }
}

async function createBranch(req, res) {
  try {
    const errors = validateCreateBranch(req.body);
    if (errors.length) return badRequest(res, errors);
    const branch = await svc.createBranch(req.body, req.admin);
    return res.status(201).json({ success: true, message: "Branch created successfully.", data: branch });
  } catch (err) { return serverError(res, err); }
}

async function updateBranch(req, res) {
  try {
    const idErr = validateId(req.params.branchId, "branchId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateUpdateBranch(req.body);
    if (errors.length) return badRequest(res, errors);
    const branch = await svc.updateBranch(req.params.branchId, req.body, req.admin);
    return res.json({ success: true, message: "Branch updated successfully.", data: branch });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Branch not found.");
    return serverError(res, err);
  }
}

async function deleteBranch(req, res) {
  try {
    const err = validateId(req.params.branchId, "branchId");
    if (err) return badRequest(res, [err]);
    await svc.deleteBranch(req.params.branchId, req.admin);
    return res.json({ success: true, message: "Branch deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Branch not found.");
    return serverError(res, err);
  }
}

async function assignDepartmentsToBranch(req, res) {
  try {
    const idErr = validateId(req.params.branchId, "branchId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateDeptIds(req.body);
    if (errors.length) return badRequest(res, errors);
    const result = await svc.assignDepartmentsToBranch(req.params.branchId, req.body.departmentIds, req.admin);
    return res.json({ success: true, message: `${result.assignedCount} department(s) assigned.`, ...result });
  } catch (err) { return serverError(res, err); }
}

// ── Departments ────────────────────────────────────────────────────────────────

async function listDepartments(req, res) {
  try {
    const { search, status, branchId, page, limit } = req.query;
    const result = await svc.listDepartments({ search, status, branchId, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getDepartment(req, res) {
  try {
    const err = validateId(req.params.departmentId, "departmentId");
    if (err) return badRequest(res, [err]);
    const dept = await svc.getDepartment(req.params.departmentId);
    if (!dept) return notFound(res, "Department not found.");
    return res.json({ success: true, data: dept });
  } catch (err) { return serverError(res, err); }
}

async function createDepartment(req, res) {
  try {
    const errors = validateCreateDepartment(req.body);
    if (errors.length) return badRequest(res, errors);
    const dept = await svc.createDepartment(req.body, req.admin);
    return res.status(201).json({ success: true, message: "Department created successfully.", data: dept });
  } catch (err) {
    if (err.status === 409) return conflict(res, err.message);
    return serverError(res, err);
  }
}

async function updateDepartment(req, res) {
  try {
    const idErr = validateId(req.params.departmentId, "departmentId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateUpdateDepartment(req.body);
    if (errors.length) return badRequest(res, errors);
    const dept = await svc.updateDepartment(req.params.departmentId, req.body, req.admin);
    return res.json({ success: true, message: "Department updated successfully.", data: dept });
  } catch (err) {
    if (err.status === 409)  return conflict(res, err.message);
    if (err.code === "P2025") return notFound(res, "Department not found.");
    return serverError(res, err);
  }
}

async function deleteDepartment(req, res) {
  try {
    const err = validateId(req.params.departmentId, "departmentId");
    if (err) return badRequest(res, [err]);
    await svc.deleteDepartment(req.params.departmentId, req.admin);
    return res.json({ success: true, message: "Department deleted successfully." });
  } catch (err) {
    if (err.status === 409)  return conflict(res, err.message);
    if (err.code === "P2025") return notFound(res, "Department not found.");
    return serverError(res, err);
  }
}

async function assignUsersToDepartment(req, res) {
  try {
    const idErr = validateId(req.params.departmentId, "departmentId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateUserIds(req.body);
    if (errors.length) return badRequest(res, errors);
    const result = await svc.assignUsersToDepartment(req.params.departmentId, req.body.userIds, req.admin);
    return res.json({ success: true, message: `${result.assignedCount} user(s) assigned.`, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getDepartmentKpis(req, res) {
  try {
    const err = validateId(req.params.departmentId, "departmentId");
    if (err) return badRequest(res, [err]);
    const kpis = await svc.getDepartmentKpis(req.params.departmentId);
    return res.json({ success: true, data: kpis });
  } catch (err) { return serverError(res, err); }
}

// ── Teams ──────────────────────────────────────────────────────────────────────

async function listTeams(req, res) {
  try {
    const { search, departmentId, status, page, limit } = req.query;
    const result = await svc.listTeams({ search, departmentId, status, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getTeam(req, res) {
  try {
    const err = validateId(req.params.teamId, "teamId");
    if (err) return badRequest(res, [err]);
    const team = await svc.getTeam(req.params.teamId);
    if (!team) return notFound(res, "Team not found.");
    return res.json({ success: true, data: team });
  } catch (err) { return serverError(res, err); }
}

async function createTeam(req, res) {
  try {
    const errors = validateCreateTeam(req.body);
    if (errors.length) return badRequest(res, errors);
    const team = await svc.createTeam(req.body, req.admin);
    return res.status(201).json({ success: true, message: "Team created successfully.", data: team });
  } catch (err) {
    if (err.status === 409) return conflict(res, err.message);
    return serverError(res, err);
  }
}

async function updateTeam(req, res) {
  try {
    const idErr = validateId(req.params.teamId, "teamId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateUpdateTeam(req.body);
    if (errors.length) return badRequest(res, errors);
    const team = await svc.updateTeam(req.params.teamId, req.body, req.admin);
    return res.json({ success: true, message: "Team updated successfully.", data: team });
  } catch (err) {
    if (err.status === 409)  return conflict(res, err.message);
    if (err.code === "P2025") return notFound(res, "Team not found.");
    return serverError(res, err);
  }
}

async function deleteTeam(req, res) {
  try {
    const err = validateId(req.params.teamId, "teamId");
    if (err) return badRequest(res, [err]);
    await svc.deleteTeam(req.params.teamId, req.admin);
    return res.json({ success: true, message: "Team deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Team not found.");
    return serverError(res, err);
  }
}

async function assignTeamMembers(req, res) {
  try {
    const idErr = validateId(req.params.teamId, "teamId");
    if (idErr) return badRequest(res, [idErr]);
    const errors = validateUserIds(req.body);
    if (errors.length) return badRequest(res, errors);
    const result = await svc.assignTeamMembers(req.params.teamId, req.body.userIds, req.admin);
    return res.json({ success: true, message: `${result.assignedCount} member(s) assigned.`, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getTeamMembers(req, res) {
  try {
    const err = validateId(req.params.teamId, "teamId");
    if (err) return badRequest(res, [err]);
    const { search, page, limit } = req.query;
    const result = await svc.getTeamMembers(req.params.teamId, { search, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

// ── Org Chart ──────────────────────────────────────────────────────────────────

async function getOrgChart(req, res) {
  try {
    const chart = await svc.getOrgChart();
    return res.json({ success: true, ...chart });
  } catch (err) { return serverError(res, err); }
}

async function moveOrgNode(req, res) {
  try {
    const errors = validateOrgMove(req.body);
    if (errors.length) return badRequest(res, errors);
    const { nodeId, newParentId, action } = req.body;
    const data = await svc.moveOrgNode(nodeId, newParentId, action, req.admin);
    return res.json({ success: true, message: "Node moved successfully.", data });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status === 409) return conflict(res, err.message);
    return serverError(res, err);
  }
}

// ── Hierarchy Settings ─────────────────────────────────────────────────────────

async function getHierarchySettings(req, res) {
  try {
    const settings = await svc.getHierarchySettings();
    return res.json({ success: true, data: settings });
  } catch (err) { return serverError(res, err); }
}

async function updateHierarchySettings(req, res) {
  try {
    const errors = validateHierarchySettings(req.body);
    if (errors.length) return badRequest(res, errors);
    const settings = await svc.updateHierarchySettings(req.body, req.admin);
    return res.json({ success: true, message: "Hierarchy settings updated.", data: settings });
  } catch (err) { return serverError(res, err); }
}

async function resetHierarchySettings(req, res) {
  try {
    const settings = await svc.resetHierarchySettings(req.admin);
    return res.json({ success: true, message: "Hierarchy settings reset to defaults.", data: settings });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  listBranches, getBranch, createBranch, updateBranch, deleteBranch, assignDepartmentsToBranch,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  assignUsersToDepartment, getDepartmentKpis,
  listTeams, getTeam, createTeam, updateTeam, deleteTeam, assignTeamMembers, getTeamMembers,
  getOrgChart, moveOrgNode,
  getHierarchySettings, updateHierarchySettings, resetHierarchySettings,
};
