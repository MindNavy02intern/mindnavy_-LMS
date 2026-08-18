const svc = require("../services/delegatedAdmins.service");
const { validateId, validateGrant, validateListQuery } = require("../validators/delegatedAdmins.validator");

function badRequest(res, msg) { return res.status(400).json({ success: false, message: msg }); }
function notFound(res, msg = "Not found.") { return res.status(404).json({ success: false, message: msg }); }

function handleDomainError(res, err) {
  switch (err.code) {
    case "ADMIN_NOT_FOUND":
    case "ROLE_NOT_FOUND":
    case "GRANT_NOT_FOUND":
      return notFound(res, err.message);
    case "ALREADY_DELEGATED":
    case "ALREADY_REVOKED":
      return res.status(409).json({ success: false, message: err.message });
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[DelegatedAdminsController]", err);
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (err) { return handleDomainError(res, err) ?? serverError(res, err); }
  };
}

const listDelegatedAdmins = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listDelegatedAdmins(v.data);
  return res.json({ success: true, ...result });
});

const getAdminDirectory = run(async (_req, res) => {
  const data = await svc.listAdminDirectory();
  return res.json({ success: true, data });
});

const grantDelegatedAdmin = run(async (req, res) => {
  const v = validateGrant(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const grant = await svc.grantDelegatedAdmin(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Delegated admin access granted.", data: grant });
});

const revokeDelegatedAdmin = run(async (req, res) => {
  const idErr = validateId(req.params.id, "grantId");
  if (idErr) return badRequest(res, idErr);
  const grant = await svc.revokeDelegatedAdmin(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Delegated admin access revoked.", data: grant });
});

module.exports = {
  listDelegatedAdmins, getAdminDirectory, grantDelegatedAdmin, revokeDelegatedAdmin,
};
