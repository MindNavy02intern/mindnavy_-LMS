const svc = require("../services/groups.service");

// Allowed stored statuses (list filter additionally accepts "ALL", handled in the service).
const VALID_GROUP_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

// Returns the normalized status, or `false` when the value is invalid.
function normalizeGroupStatus(status) {
  if (status === undefined || status === null) return status;
  const upper = String(status).trim().toUpperCase();
  return VALID_GROUP_STATUSES.has(upper) ? upper : false;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[GroupsController]", err);
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A group with this name already exists." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Groups ─────────────────────────────────────────────────────────────────────

async function listGroups(req, res) {
  try {
    const { search, status, departmentId, page, limit } = req.query;
    const result = await svc.listGroups({ search, status, departmentId, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getGroup(req, res) {
  try {
    const group = await svc.getGroup(req.params.id);
    if (!group) return notFound(res, "Group not found.");
    return res.json({ success: true, data: group });
  } catch (err) { return serverError(res, err); }
}

async function createGroup(req, res) {
  try {
    const { name, description, departmentId, leaderId } = req.body;
    if (!name?.trim())   return badRequest(res, "Group name is required.");

    const status = normalizeGroupStatus(req.body.status);
    if (status === false) return badRequest(res, "status must be ACTIVE or INACTIVE.");

    const group = await svc.createGroup({ name, description, departmentId, leaderId, status }, req.admin);
    return res.status(201).json({ success: true, message: "Group created successfully.", data: group });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

async function updateGroup(req, res) {
  try {
    const { name, description, departmentId, leaderId } = req.body;

    const status = normalizeGroupStatus(req.body.status);
    if (status === false) return badRequest(res, "status must be ACTIVE or INACTIVE.");

    const group = await svc.updateGroup(req.params.id, { name, description, departmentId, leaderId, status }, req.admin);
    return res.json({ success: true, message: "Group updated successfully.", data: group });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

async function deleteGroup(req, res) {
  try {
    await svc.deleteGroup(req.params.id, req.admin);
    return res.json({ success: true, message: "Group deleted successfully." });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

// ── Members ────────────────────────────────────────────────────────────────────

async function getGroupMembers(req, res) {
  try {
    const members = await svc.getGroupMembers(req.params.id);
    return res.json({ success: true, data: members });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

async function addMembers(req, res) {
  try {
    const { userIds, role } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return badRequest(res, "userIds must be a non-empty array.");
    }
    const members = await svc.addMembers(req.params.id, userIds, role, req.admin);
    return res.status(201).json({ success: true, message: "Members added successfully.", data: members });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

async function removeMember(req, res) {
  try {
    await svc.removeMember(req.params.id, req.params.userId, req.admin);
    return res.json({ success: true, message: "Member removed successfully." });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(res, err.message);
    return serverError(res, err);
  }
}

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup, getGroupMembers, addMembers, removeMember };
