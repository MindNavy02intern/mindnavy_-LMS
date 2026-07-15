const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { generateSessionToken, getSessionExpiryDate } = require("../utils/token");
const { clearAllCachedSessions } = require("../middlewares/auth.middleware");

const {
  generateOtpCode,
  hashOtpCode,
  compareOtpCode,
  getOtpExpiryDate,
} = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const FAILED_LOGIN_WINDOW_MINUTES = 15;

async function recordLoginAttempt({
  adminId = null,
  email,
  status,
  reason = null,
  ipAddress = null,
  userAgent = null,
}) {
  await prisma.loginAttempt.create({
    data: {
      adminId,
      email,
      status,
      reason,
      ipAddress,
      userAgent,
    },
  });
}

async function createAuditLog({
  adminId = null,
  action,
  details = null,
  ipAddress = null,
  userAgent = null,
}) {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      details,
      ipAddress,
      userAgent,
    },
  });
}

async function isLoginTemporarilyBlocked({ email }) {
  // In development the lockout is disabled so failed-attempt loops during
  // testing don't lock out the developer. Production behaviour is unchanged.
  if (process.env.NODE_ENV !== "production") return false;

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - FAILED_LOGIN_WINDOW_MINUTES);

  const failedAttemptsCount = await prisma.loginAttempt.count({
    where: {
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      createdAt: {
        gte: windowStart,
      },
    },
  });

  return failedAttemptsCount >= MAX_FAILED_LOGIN_ATTEMPTS;
}

async function loginAdmin({ email, password, ipAddress, userAgent }) {
  const isBlocked = await isLoginTemporarilyBlocked({
    email,
  });

  if (isBlocked) {
    await recordLoginAttempt({
      email,
      status: "BLOCKED",
      reason: "TEMPORARILY_BLOCKED",
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: "Too many failed login attempts. Please try again later.",
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin) {
    await recordLoginAttempt({
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
    };
  }

  if (admin.status !== "ACTIVE") {
    await recordLoginAttempt({
      adminId: admin.id,
      email,
      status: "FAILED",
      reason: `ACCOUNT_${admin.status}`,
      ipAddress,
      userAgent,
    });

    await createAuditLog({
      adminId: admin.id,
      action: "FAILED_LOGIN",
      details: {
        reason: `ACCOUNT_${admin.status}`,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: "Access denied.",
    };
  }

  const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

  if (!isPasswordValid) {
    await recordLoginAttempt({
      adminId: admin.id,
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      ipAddress,
      userAgent,
    });

    await createAuditLog({
      adminId: admin.id,
      action: "FAILED_LOGIN",
      details: {
        reason: "INVALID_CREDENTIALS",
      },
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
    };
  }

  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiryDate();

  const session = await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      sessionToken,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await recordLoginAttempt({
    adminId: admin.id,
    email,
    status: "SUCCESS",
    reason: "LOGIN_SUCCESS",
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    adminId: admin.id,
    action: "ADMIN_LOGIN",
    details: {
      sessionId: session.id,
    },
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    adminId: admin.id,
    action: "SESSION_CREATED",
    details: {
      sessionId: session.id,
      expiresAt,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Login successful.",
    token: sessionToken,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      status: admin.status,
    },
  };
}

async function logoutAdmin({ adminId, sessionId, ipAddress, userAgent }) {
  await prisma.adminSession.update({
    where: {
      id: sessionId,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await createAuditLog({
    adminId,
    action: "ADMIN_LOGOUT",
    details: {
      sessionId,
    },
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    adminId,
    action: "SESSION_REVOKED",
    details: {
      sessionId,
      reason: "ADMIN_LOGOUT",
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Logout successful.",
  };
}

async function sendAdminOtp({ adminId, ipAddress, userAgent }) {
  const admin = await prisma.adminUser.findUnique({
    where: {
      id: adminId,
    },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return {
      success: false,
      message: "Access denied.",
    };
  }

  await prisma.otpCode.updateMany({
    where: {
      adminId: admin.id,
      purpose: "ADMIN_LOGIN",
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const otpCode = generateOtpCode();
  const codeHash = await hashOtpCode(otpCode);
  const expiresAt = getOtpExpiryDate();

  await prisma.otpCode.create({
    data: {
      adminId: admin.id,
      codeHash,
      purpose: "ADMIN_LOGIN",
      expiresAt,
    },
  });

  await createAuditLog({
    adminId: admin.id,
    action: "OTP_SENT",
    details: {
      purpose: "ADMIN_LOGIN",
      expiresAt,
      ipAddress,
      userAgent,
    },
    ipAddress,
    userAgent,
  });

  const delivery = await sendOtpEmail(admin.email, otpCode, "ADMIN_LOGIN");

  if (!delivery.sent) {
    // SMTP not configured yet → dev fallback: code on the server console.
    // In production (or on a real send failure) the user must be told —
    // silently succeeding would strand them on the OTP screen.
    if (delivery.reason === "NOT_CONFIGURED" && process.env.NODE_ENV !== "production") {
      console.log("DEV OTP CODE:", otpCode);
    } else {
      return {
        success: false,
        code: "EMAIL_SEND_FAILED",
        message: "Failed to send the OTP email. Please try again.",
      };
    }
  }

  return {
    success: true,
    message: "OTP sent successfully.",
  };
}

async function verifyAdminOtp({ adminId, code, ipAddress, userAgent }) {
  const admin = await prisma.adminUser.findUnique({
    where: {
      id: adminId,
    },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return {
      success: false,
      message: "Access denied.",
    };
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      adminId: admin.id,
      purpose: "ADMIN_LOGIN",
      usedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    return {
      success: false,
      message: "Invalid or expired OTP code.",
    };
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return {
      success: false,
      message: "Invalid or expired OTP code.",
    };
  }

  // Atomically claim an attempt slot — the guarded updateMany means parallel
  // requests can never push a code past maxAttempts (check + increment in one
  // statement instead of read-then-write).
  const claimed = await prisma.otpCode.updateMany({
    where: { id: otpRecord.id, attempts: { lt: otpRecord.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });

  if (claimed.count === 0) {
    await prisma.otpCode.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return {
      success: false,
      message: "Too many OTP attempts. Please request a new code.",
    };
  }

  const isOtpValid = await compareOtpCode(code, otpRecord.codeHash);

  if (!isOtpValid) {
    await createAuditLog({
      adminId: admin.id,
      action: "FAILED_LOGIN",
      details: {
        reason: "INVALID_OTP",
        ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: "Invalid or expired OTP code.",
    };
  }

  await prisma.otpCode.update({
    where: {
      id: otpRecord.id,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await createAuditLog({
    adminId: admin.id,
    action: "OTP_VERIFIED",
    details: {
      purpose: "ADMIN_LOGIN",
      ipAddress,
      userAgent,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "OTP verified successfully.",
  };
}

async function getAdminTrustedDevices({ adminId }) {
  const devices = await prisma.trustedDevice.findMany({
    where: {
      adminId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      deviceName: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      trustedAt: true,

    },
  });

  return {
    success: true,
    devices,
  };
}

async function revokeAdminTrustedDevice({
  adminId,
  deviceId,
  ipAddress,
  userAgent,
}) {
  const device = await prisma.trustedDevice.findFirst({
    where: {
      id: deviceId,
      adminId,
      revokedAt: null,
    },
  });

  if (!device) {
    return {
      success: false,
      message: "Trusted device not found.",
    };
  }

  await prisma.trustedDevice.update({
    where: {
      id: device.id,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await createAuditLog({
    adminId,
    action: "SESSION_REVOKED",
    details: {
      reason: "TRUSTED_DEVICE_REVOKED",
      deviceId: device.id,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Trusted device revoked successfully.",
  };
}

async function forgotAdminPassword({ email, ipAddress, userAgent }) {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  // Security: لا نكشف إذا الإيميل موجود أو لا
  if (!admin || admin.status !== "ACTIVE") {
    return {
      success: true,
      message: "If this email exists, a password reset code has been sent.",
    };
  }

  await prisma.otpCode.updateMany({
    where: {
      adminId: admin.id,
      purpose: "PASSWORD_RESET",
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const resetCode = generateOtpCode();
  const codeHash = await hashOtpCode(resetCode);
  const expiresAt = getOtpExpiryDate();

  await prisma.otpCode.create({
    data: {
      adminId: admin.id,
      codeHash,
      purpose: "PASSWORD_RESET",
      expiresAt,
    },
  });

  await createAuditLog({
    adminId: admin.id,
    action: "OTP_SENT",
    details: {
      purpose: "PASSWORD_RESET",
      expiresAt,
    },
    ipAddress,
    userAgent,
  });

  // Anti-enumeration: the response is the SAME generic message whether the email
  // exists, the send succeeds, or the send fails — a delivery error must not
  // reveal that the account is real. Failures are only logged server-side.
  const delivery = await sendOtpEmail(admin.email, resetCode, "PASSWORD_RESET");

  if (!delivery.sent) {
    if (delivery.reason === "NOT_CONFIGURED" && process.env.NODE_ENV !== "production") {
      console.log("DEV PASSWORD RESET CODE:", resetCode);
    } else {
      console.error("[admin.service] password reset email failed to send (adminId:", admin.id + ")");
    }
  }

  return {
    success: true,
    message: "If this email exists, a password reset code has been sent.",
  };
}

async function resetAdminPassword({
  email,
  code,
  newPassword,
  ipAddress,
  userAgent,
}) {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return {
      success: false,
      message: "Invalid or expired reset code.",
    };
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      adminId: admin.id,
      purpose: "PASSWORD_RESET",
      usedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    return {
      success: false,
      message: "Invalid or expired reset code.",
    };
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    return {
      success: false,
      message: "Invalid or expired reset code.",
    };
  }

  // Same atomic attempt-claim as verifyAdminOtp — parallel reset requests
  // cannot exceed maxAttempts.
  const claimed = await prisma.otpCode.updateMany({
    where: { id: otpRecord.id, attempts: { lt: otpRecord.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });

  if (claimed.count === 0) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    return {
      success: false,
      message: "Too many reset attempts. Please request a new code.",
    };
  }

  const isCodeValid = await compareOtpCode(code, otpRecord.codeHash);

  if (!isCodeValid) {
    await createAuditLog({
      adminId: admin.id,
      action: "FAILED_LOGIN",
      details: {
        reason: "INVALID_PASSWORD_RESET_CODE",
      },
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      message: "Invalid or expired reset code.",
    };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      passwordHash: newPasswordHash,
    },
  });

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.adminSession.updateMany({
    where: {
      adminId: admin.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  clearAllCachedSessions();

  await createAuditLog({
    adminId: admin.id,
    action: "OTP_VERIFIED",
    details: {
      purpose: "PASSWORD_RESET",
    },
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    adminId: admin.id,
    action: "SESSION_REVOKED",
    details: {
      reason: "PASSWORD_RESET",
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Password reset successfully. Please login again.",
  };
}

module.exports = {
  loginAdmin,
  logoutAdmin,
  sendAdminOtp,
  verifyAdminOtp,
  getAdminTrustedDevices,
  revokeAdminTrustedDevice,
  forgotAdminPassword,
  resetAdminPassword,

};