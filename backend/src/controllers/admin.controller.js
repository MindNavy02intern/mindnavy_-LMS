const {
  validateAdminLoginInput,
  validateAdminOtpInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateUpdateAdminProfileInput,
  validateChangeAdminPasswordInput,

} = require("../validators/adminAuth.validator");

const {
  loginAdmin,
  logoutAdmin,
  sendAdminOtp,
  verifyAdminOtp,
  checkDeviceTrust,
  getAdminTrustedDevices,
  revokeAdminTrustedDevice,
  forgotAdminPassword,
  resetAdminPassword,
  updateAdminProfile,
  changeAdminPassword,
} = require("../services/admin.service");

const { invalidateCachedSession } = require("../middlewares/auth.middleware");

async function adminLoginController(req, res) {
  try {
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
  } catch (error) {
    console.error("Error in adminLoginController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminLogoutController(req, res) {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    const token = req.headers.authorization?.split(" ")[1];
    if (token) invalidateCachedSession(token);

    const result = await logoutAdmin({
      adminId: req.admin.id,
      sessionId: req.adminSession.id,
      ipAddress,
      userAgent,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminLogoutController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminMeController(req, res) {
  return res.status(200).json({
    success: true,
    admin: req.admin,
    session: req.adminSession,
  });
}

async function adminSendOtpController(req, res) {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await sendAdminOtp({
      adminId: req.admin.id,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      // Delivery failure is an upstream (SMTP) problem, not an authorization one.
      const status = result.code === "EMAIL_SEND_FAILED" ? 502 : 403;
      return res.status(status).json({ success: false, message: result.message });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminSendOtpController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminVerifyOtpController(req, res) {
  try {
    const validation = validateAdminOtpInput(req.body);

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

    const result = await verifyAdminOtp({
      adminId: req.admin.id,
      code: validation.data.code,
      trustDevice: validation.data.trustDevice,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminVerifyOtpController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminCheckDeviceController(req, res) {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await checkDeviceTrust({ adminId: req.admin.id, ipAddress, userAgent });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in adminCheckDeviceController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminGetTrustedDevicesController(req, res) {
  try {
    const result = await getAdminTrustedDevices({
      adminId: req.admin.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminGetTrustedDevicesController:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

async function adminRevokeTrustedDeviceController(req, res) {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "Device ID is required.",
      });
    }

    const forwardedFor = req.headers["x-forwarded-for"];

    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

    const userAgent = req.headers["user-agent"] || null;

    const result = await revokeAdminTrustedDevice({
      adminId: req.admin.id,
      deviceId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminRevokeTrustedDeviceController:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

async function adminForgotPasswordController(req, res) {
  try {
    const validation = validateForgotPasswordInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const forwardedFor = req.headers["x-forwarded-for"];

    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

    const userAgent = req.headers["user-agent"] || null;

    const result = await forgotAdminPassword({
      email: validation.data.email,
      ipAddress,
      userAgent,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminForgotPasswordController:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

async function adminResetPasswordController(req, res) {
  try {
    const validation = validateResetPasswordInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const forwardedFor = req.headers["x-forwarded-for"];

    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

    const userAgent = req.headers["user-agent"] || null;

    const result = await resetAdminPassword({
      email: validation.data.email,
      code: validation.data.code,
      newPassword: validation.data.newPassword,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminResetPasswordController:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

async function adminUpdateProfileController(req, res) {
  try {
    const validation = validateUpdateAdminProfileInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.errors[0], errors: validation.errors });
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await updateAdminProfile({
      adminId: req.admin.id,
      ...validation.data,
      ipAddress,
      userAgent,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in adminUpdateProfileController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function adminChangePasswordController(req, res) {
  try {
    const validation = validateChangeAdminPasswordInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.errors[0], errors: validation.errors });
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await changeAdminPassword({
      adminId: req.admin.id,
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
    console.error("Error in adminChangePasswordController:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

module.exports = {
  adminLoginController,
  adminMeController,
  adminLogoutController,
  adminSendOtpController,
  adminVerifyOtpController,
  adminCheckDeviceController,
  adminGetTrustedDevicesController,
  adminRevokeTrustedDeviceController,
  adminForgotPasswordController,
  adminResetPasswordController,
  adminUpdateProfileController,
  adminChangePasswordController,

};