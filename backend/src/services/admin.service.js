const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { generateSessionToken, getSessionExpiryDate } = require("../utils/token");

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";

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

async function loginAdmin({ email, password, ipAddress, userAgent }) {
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

module.exports = {
  loginAdmin,
  logoutAdmin,
};