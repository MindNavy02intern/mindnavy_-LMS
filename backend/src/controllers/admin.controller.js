const { validateAdminLoginInput } = require("../validators/adminAuth.validator");
const { loginAdmin, logoutAdmin } = require("../services/admin.service");

async function adminLoginController(req, res) {
  const validation = validateAdminLoginInput(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data.",
      errors: validation.errors,
    });
  }

  const forwardedFor = req.headers["x-forwarded-for"];

  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

  const userAgent = req.headers["user-agent"] || null;

  const result = await loginAdmin({
    email: validation.data.email,
    password: validation.data.password,
    ipAddress,
    userAgent,
  });

  if (!result.success) {
    return res.status(401).json(result);
  }

  return res.status(200).json(result);
}

async function adminLogoutController(req, res) {
  const forwardedFor = req.headers["x-forwarded-for"];

  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

  const userAgent = req.headers["user-agent"] || null;

  const result = await logoutAdmin({
    adminId: req.admin.id,
    sessionId: req.adminSession.id,
    ipAddress,
    userAgent,
  });

  return res.status(200).json(result);
}

async function adminMeController(req, res) {
  return res.status(200).json({
    success: true,
    admin: req.admin,
    session: req.adminSession,
  });
}

module.exports = {
  adminLoginController,
  adminMeController,
  adminLogoutController,
};