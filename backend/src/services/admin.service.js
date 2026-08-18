const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { authenticator } = require("otplib");
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
const TRUSTED_DEVICE_DAYS = 30; // matches OtpVerificationModal's "Trust this device for 30 days" copy

// No client-supplied device id exists anywhere in this codebase (no
// localStorage token, no cookie) — ipAddress+userAgent is the only stable
// pair available at OTP-verify time, so it's what TrustedDevice.deviceFingerprint
// is derived from. Coarse (same browser+network = same fingerprint) but real
// and deterministic, not a fabricated identifier.
function computeDeviceFingerprint({ ipAddress, userAgent }) {
  return crypto.createHash("sha256").update(`${ipAddress || "unknown"}::${userAgent || "unknown"}`).digest("hex");
}

function deviceNameFromUserAgent(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  const os = ua.includes("windows") ? "Windows"
    : ua.includes("mac") ? "macOS"
    : ua.includes("android") ? "Android"
    : ua.includes("iphone") || ua.includes("ipad") ? "iOS"
    : ua.includes("linux") ? "Linux"
    : "Unknown OS";
  const browser = ua.includes("edg/") ? "Edge"
    : ua.includes("chrome") ? "Chrome"
    : ua.includes("firefox") ? "Firefox"
    : ua.includes("safari") ? "Safari"
    : "Unknown Browser";
  return `${browser} on ${os}`;
}

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

  // MFA gate — password is correct, but a session isn't issued yet. The
  // pending-login map (below) is the only state carried between this
  // response and the /auth/mfa/login-verify call; nothing is written to
  // LoginAttempt/AuditLog until the second factor resolves either way, so
  // the log only ever records a FULLY completed (or fully failed) login.
  if (admin.mfaEnabled) {
    const mfaToken = crypto.randomBytes(32).toString("hex");
    pendingMfaLogins.set(mfaToken, {
      adminId: admin.id, email, ipAddress, userAgent,
      expiresAt: Date.now() + MFA_LOGIN_WINDOW_MS,
    });
    return { success: true, mfaRequired: true, mfaToken };
  }

  return issueSession(admin, { email, ipAddress, userAgent });
}

// Shared tail of a successful login (with or without MFA) — session row,
// lastLoginAt, LoginAttempt + AuditLog rows, and the response shape the
// frontend's AuthContext expects.
async function issueSession(admin, { email, ipAddress, userAgent }) {
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
      mfaEnabled: admin.mfaEnabled,
    },
  };
}

// ── MFA login challenge (real TOTP, otplib) ──────────────────────────────────
// In-memory, same pattern as auth.middleware's session cache — a server
// restart just forces re-login, which is acceptable for a challenge that's
// only ever a few minutes old anyway. mfaToken is single-use (deleted on
// first read, success or failure) so a leaked/replayed token can't be
// reused, and it never contains the adminId in a client-readable form.
const pendingMfaLogins = new Map();
const MFA_LOGIN_WINDOW_MS = 5 * 60 * 1000;

async function completeMfaLogin({ mfaToken, code, ipAddress, userAgent }) {
  const pending = pendingMfaLogins.get(mfaToken);
  pendingMfaLogins.delete(mfaToken);
  if (!pending || pending.expiresAt < Date.now()) {
    return { success: false, message: "MFA session expired. Please log in again." };
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || !admin.mfaEnabled || !admin.mfaSecret) {
    return { success: false, message: "MFA is no longer enabled on this account." };
  }

  const valid = authenticator.verify({ token: String(code).trim(), secret: admin.mfaSecret });
  if (!valid) {
    await recordLoginAttempt({
      adminId: admin.id, email: admin.email, status: "FAILED", reason: "INVALID_MFA_CODE", ipAddress, userAgent,
    });
    await createAuditLog({
      adminId: admin.id, action: "FAILED_LOGIN", details: { reason: "INVALID_MFA_CODE" }, ipAddress, userAgent,
    });
    return { success: false, message: "Invalid authentication code." };
  }

  return issueSession(admin, { email: admin.email, ipAddress, userAgent });
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

async function verifyAdminOtp({ adminId, code, ipAddress, userAgent, trustDevice = false }) {
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

  // "Trust this device" — upsert so a re-verify on the same browser/network
  // refreshes the 30-day window and un-revokes it, instead of erroring on the
  // @@unique([adminId, deviceFingerprint]) constraint.
  if (trustDevice) {
    const deviceFingerprint = computeDeviceFingerprint({ ipAddress, userAgent });
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
    await prisma.trustedDevice.upsert({
      where: { adminId_deviceFingerprint: { adminId: admin.id, deviceFingerprint } },
      create: { adminId: admin.id, deviceFingerprint, deviceName: deviceNameFromUserAgent(userAgent), ipAddress, userAgent, expiresAt },
      update: { lastUsedAt: new Date(), expiresAt, revokedAt: null, ipAddress, userAgent },
    });
  }

  return {
    success: true,
    message: "OTP verified successfully.",
  };
}

// GET /api/devices/check — called right after login. A device is trusted
// when a non-revoked, non-expired TrustedDevice row exists for this admin +
// this ipAddress/userAgent fingerprint (see computeDeviceFingerprint above,
// same derivation verifyAdminOtp's trustDevice branch writes with).
async function checkDeviceTrust({ adminId, ipAddress, userAgent }) {
  const deviceFingerprint = computeDeviceFingerprint({ ipAddress, userAgent });
  const device = await prisma.trustedDevice.findFirst({
    where: { adminId, deviceFingerprint, revokedAt: null, expiresAt: { gt: new Date() } },
  });

  if (device) {
    await prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return { requiresVerification: false };
  }

  return { requiresVerification: true };
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

// ── Profile Page self-service (ProfilePage.tsx) ─────────────────────────────
// Operates on AdminUser — the logged-in principal for the whole admin
// console (see requireAdminAuth / AdminSession) — NOT on AppUser. Users.
// service's PATCH /users/:id and POST /users/:id/reset-password write a
// completely different table (learners/instructors/managers), so they
// cannot be reused here even though the shapes look similar.

async function updateAdminProfile({ adminId, fullName, phone, bio, ipAddress, userAgent }) {
  const updateData = {};
  if (fullName !== undefined) updateData.fullName = fullName;
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;

  const admin = await prisma.adminUser.update({
    where: { id: adminId },
    data: updateData,
  });

  await createAuditLog({
    adminId,
    action: "ADMIN_PROFILE_UPDATED",
    details: { changedFields: Object.keys(updateData) },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Profile updated successfully.",
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      bio: admin.bio,
      role: admin.role,
      status: admin.status,
      mfaEnabled: admin.mfaEnabled,
    },
  };
}

// Mirrors resetAdminPassword's session-revocation rule: any password change
// (self-service or admin-triggered reset) invalidates every active
// AdminSession, this one included — the caller must log in again. This is
// the same "compromise-safe by default" behaviour resetUserPassword applies
// to AppUser sessions.
async function changeAdminPassword({ adminId, currentPassword, newPassword, ipAddress, userAgent }) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) {
    return { success: false, message: "Admin not found." };
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!isCurrentValid) {
    await createAuditLog({
      adminId,
      action: "FAILED_LOGIN",
      details: { reason: "INVALID_CURRENT_PASSWORD_ON_CHANGE" },
      ipAddress,
      userAgent,
    });
    return { success: false, message: "Current password is incorrect." };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: newPasswordHash },
  });

  await prisma.adminSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  clearAllCachedSessions();

  await createAuditLog({
    adminId,
    action: "ADMIN_PASSWORD_CHANGED",
    details: {},
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    adminId,
    action: "SESSION_REVOKED",
    details: { reason: "ADMIN_PASSWORD_CHANGED" },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Password changed successfully. Please log in again.",
  };
}

module.exports = {
  loginAdmin,
  completeMfaLogin,
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
};