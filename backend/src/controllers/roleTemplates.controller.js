const svc = require("../services/roleTemplates.service");
const {
  validateId,
  validateListTemplatesQuery,
  validateCreateTemplate,
  validateApplyTemplate,
} = require("../validators/roleTemplates.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[RoleTemplatesController]", err);
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A template with this name already exists." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function invalidPermissions(res, missing) {
  return res.status(400).json({
    success: false,
    message: "One or more permission IDs do not exist.",
    missing,
  });
}

// ── Controllers ────────────────────────────────────────────────────────────────

async function listRoleTemplates(req, res) {
  try {
    const v = validateListTemplatesQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const result = await svc.listRoleTemplates(v.data);
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getRoleTemplate(req, res) {
  try {
    const idErr = validateId(req.params.id, "templateId");
    if (idErr) return badRequest(res, idErr);
    const template = await svc.getRoleTemplate(req.params.id);
    if (!template) return notFound(res, "Template not found.");
    return res.json({ success: true, data: template });
  } catch (err) { return serverError(res, err); }
}

async function createRoleTemplate(req, res) {
  try {
    const v = validateCreateTemplate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const template = await svc.createRoleTemplate(v.data, req.admin?.id);
    return res.status(201).json({ success: true, message: "Template created successfully.", data: template });
  } catch (err) {
    if (err.code === "INVALID_PERMISSIONS") return invalidPermissions(res, err.missing);
    return serverError(res, err);
  }
}

async function applyRoleTemplate(req, res) {
  try {
    const idErr = validateId(req.params.id, "templateId");
    if (idErr) return badRequest(res, idErr);
    const v = validateApplyTemplate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);

    const result = await svc.applyRoleTemplate(req.params.id, v.data.roleId, req.admin?.id);
    return res.json({
      success: true,
      message: `Template applied: ${result.applied} permission(s) added to the role.`,
      data: result,
    });
  } catch (err) {
    if (err.code === "TEMPLATE_NOT_FOUND")  return notFound(res, "Template not found.");
    if (err.code === "ROLE_NOT_FOUND")      return notFound(res, "Role not found.");
    if (err.code === "INVALID_PERMISSIONS") return invalidPermissions(res, err.missing);
    return serverError(res, err);
  }
}

async function deleteRoleTemplate(req, res) {
  try {
    const idErr = validateId(req.params.id, "templateId");
    if (idErr) return badRequest(res, idErr);
    await svc.deleteRoleTemplate(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Template deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Template not found.");
    return serverError(res, err);
  }
}

module.exports = {
  listRoleTemplates,
  getRoleTemplate,
  createRoleTemplate,
  applyRoleTemplate,
  deleteRoleTemplate,
};
