const { validateInstructorLoginInput, validateChangeInstructorPasswordInput } = require("../validators/instructorAuth.validator");
const { loginInstructor, logoutInstructor, changeInstructorPassword } = require("../services/instructorAuth.service");
const { invalidateCachedInstructorSession } = require("../middlewares/instructorAuth.middleware");
const { getClientIp } = require("../utils/clientIp");

function extractRequestMeta(req) {
  // req.ip via TRUST_PROXY, never the client-controlled X-Forwarded-For
  // header — otherwise login-attempt and audit IPs could be forged
  // (utils/clientIp.js).
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || null;
  return { ipAddress, userAgent };
}

async function instructorLoginController(req, res) {
  try {
    const validation = validateInstructorLoginInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data.",
        errors: validation.errors,
      });
    }

    const { ipAddress, userAgent } = extractRequestMeta(req);

    const result = await loginInstructor({
      email: validation.data.email,
      password: validation.data.password,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in instructorLoginController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function instructorLogoutController(req, res) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);

    const token = req.headers.authorization?.split(" ")[1];
    if (token) invalidateCachedInstructorSession(token);

    const result = await logoutInstructor({
      instructorId: req.instructor.id,
      sessionId: req.instructorSession.id,
      ipAddress,
      userAgent,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in instructorLogoutController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function instructorChangePasswordController(req, res) {
  try {
    const validation = validateChangeInstructorPasswordInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.errors[0], errors: validation.errors });
    }

    const { ipAddress, userAgent } = extractRequestMeta(req);

    const result = await changeInstructorPassword({
      instructorId: req.instructor.id,
      currentPassword: validation.data.currentPassword,
      newPassword: validation.data.newPassword,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in instructorChangePasswordController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function instructorMeController(req, res) {
  return res.status(200).json({
    success: true,
    instructor: req.instructor,
    session: req.instructorSession,
  });
}

module.exports = {
  instructorLoginController,
  instructorLogoutController,
  instructorMeController,
  instructorChangePasswordController,
};
