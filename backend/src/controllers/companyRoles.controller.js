const svc = require("../services/companyRoles.service");
const {
  validateId, validateCreateCompanyRole, validateUpdateCompanyRole, validateListQuery,
  CONSOLE_PERMISSIONS,
} = require("../validators/companyRoles.validator");

function badRequest(res, msg) { return res.status(400).json({ success: false, message: msg }); }
function notFound(res, msg = "Not found.") { return res.status(404).json({ success: false, message: msg }); }

function handleDomainError(res, err) {
  switch (err.code) {
    case "ROLE_NOT_FOUND":     return notFound(res, err.message);
    case "DUPLICATE_NAME":     return res.status(409).json({ success: false, message: err.message });
    case "SYSTEM_ROLE_LOCKED": return badRequest(res, err.message);
    case "ROLE_HAS_USERS":     return res.status(409).json({ success: false, message: err.message, error: "ROLE_HAS_USERS" });
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[CompanyRolesController]", err);
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (err) { return handleDomainError(res, err) ?? serverError(res, err); }
  };
}

const listCompanyRoles = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listCompanyRoles(v.data);
  return res.json({ success: true, ...result });
});

const getPermissionCatalog = run(async (_req, res) => {
  return res.json({ success: true, data: CONSOLE_PERMISSIONS });
});

const getCompanyRole = run(async (req, res) => {
  const idErr = validateId(req.params.id, "roleId");
  if (idErr) return badRequest(res, idErr);
  const role = await svc.getCompanyRole(req.params.id);
  if (!role) return notFound(res, "Company role not found.");
  return res.json({ success: true, data: role });
});

const createCompanyRole = run(async (req, res) => {
  const v = validateCreateCompanyRole(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const role = await svc.createCompanyRole(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Company role created.", data: role });
});

const updateCompanyRole = run(async (req, res) => {
  const idErr = validateId(req.params.id, "roleId");
  if (idErr) return badRequest(res, idErr);
  const v = validateUpdateCompanyRole(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const role = await svc.updateCompanyRole(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Company role updated.", data: role });
});

const deleteCompanyRole = run(async (req, res) => {
  const idErr = validateId(req.params.id, "roleId");
  if (idErr) return badRequest(res, idErr);
  await svc.deleteCompanyRole(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Company role deleted." });
});

module.exports = {
  listCompanyRoles, getPermissionCatalog, getCompanyRole,
  createCompanyRole, updateCompanyRole, deleteCompanyRole,
};
