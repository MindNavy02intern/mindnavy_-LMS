const svc = require("../services/mfa.service");
const { completeMfaLogin } = require("../services/admin.service");
const { validateMfaVerify, validateMfaDisable, validateMfaLoginVerify } = require("../validators/mfa.validator");

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "ALREADY_ENABLED": return badRequest(res, err.message);
    case "NOT_ENABLED":     return badRequest(res, err.message);
    case "INVALID_CODE":    return badRequest(res, err.message);
    case "INVALID_PASSWORD": return res.status(401).json({ success: false, message: err.message });
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[MfaController]", err);
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

const setup = run(async (req, res) => {
  const data = await svc.setupMfa(req.admin);
  return res.json({ success: true, data });
});

const verify = run(async (req, res) => {
  const v = validateMfaVerify(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.verifyMfaSetup(req.admin, v.data.secret, v.data.code);
  return res.json({ success: true, message: "MFA enabled on your account.", data });
});

const disable = run(async (req, res) => {
  const v = validateMfaDisable(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.disableMfa(req.admin, v.data.password);
  return res.json({ success: true, message: "MFA disabled on your account.", data });
});

// Login-time challenge — NOT behind requireAdminAuth (no session exists
// between a correct password and a verified second factor).
const loginVerify = run(async (req, res) => {
  const v = validateMfaLoginVerify(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);

  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = req.headers["user-agent"] || null;

  const result = await completeMfaLogin({ mfaToken: v.data.mfaToken, code: v.data.code, ipAddress, userAgent });
  if (!result.success) return res.status(401).json(result);
  return res.status(200).json(result);
});

module.exports = { setup, verify, disable, loginVerify };
