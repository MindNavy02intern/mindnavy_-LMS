const svc = require("../services/accessPolicies.service");
const {
  validateId,
  validateListQuery,
  validateCreate,
  validateUpdate,
} = require("../validators/accessPolicies.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[AccessPoliciesController]", err);
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A policy with this name already exists." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found." });
  }
  if (err.code === "P2003") {
    return res.status(400).json({ success: false, message: "Invalid reference: one or more IDs do not exist." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Access Policies ─────────────────────────────────────────────────────────────

async function listAccessPolicies(req, res) {
  try {
    const v = validateListQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const result = await svc.listAccessPolicies(v.data);
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getAccessPolicyStats(req, res) {
  try {
    const stats = await svc.getAccessPolicyStats();
    return res.json({ success: true, data: stats });
  } catch (err) { return serverError(res, err); }
}

async function getAccessPolicy(req, res) {
  try {
    const idErr = validateId(req.params.id, "policyId");
    if (idErr) return badRequest(res, idErr);
    const policy = await svc.getAccessPolicy(req.params.id);
    if (!policy) return notFound(res, "Access policy not found.");
    return res.json({ success: true, data: policy });
  } catch (err) { return serverError(res, err); }
}

async function createAccessPolicy(req, res) {
  try {
    const v = validateCreate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const policy = await svc.createAccessPolicy(v.data, req.admin?.id);
    return res.status(201).json({
      success: true,
      message: "Access policy created successfully.",
      data: policy,
    });
  } catch (err) {
    if (err.code === "ROLE_NOT_FOUND") return notFound(res, "Role not found.");
    return serverError(res, err);
  }
}

async function updateAccessPolicy(req, res) {
  try {
    const idErr = validateId(req.params.id, "policyId");
    if (idErr) return badRequest(res, idErr);
    const v = validateUpdate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const policy = await svc.updateAccessPolicy(req.params.id, v.data, req.admin?.id);
    return res.json({
      success: true,
      message: "Access policy updated successfully.",
      data: policy,
    });
  } catch (err) {
    if (err.code === "ROLE_NOT_FOUND") return notFound(res, "Role not found.");
    if (err.code === "P2025")          return notFound(res, "Access policy not found.");
    return serverError(res, err);
  }
}

async function deleteAccessPolicy(req, res) {
  try {
    const idErr = validateId(req.params.id, "policyId");
    if (idErr) return badRequest(res, idErr);
    await svc.deleteAccessPolicy(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Access policy deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Access policy not found.");
    return serverError(res, err);
  }
}

module.exports = {
  listAccessPolicies,
  getAccessPolicyStats,
  getAccessPolicy,
  createAccessPolicy,
  updateAccessPolicy,
  deleteAccessPolicy,
};
