const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { generateSessionToken, getSessionExpiryDate } = require("../utils/token");
const { clearAllCachedInstructorSessions } = require("../middlewares/instructorAuth.middleware");

// Mirrors admin.service.js's loginAdmin() shape exactly (lockout window,
// LoginAttempt/AuditLog trail, generic non-leaking error messages) — see
// audit notes for the two deliberate deviations:
//  1. AppUserSession.tokenHash is stored hashed (sha256 of the raw token),
//     unlike AdminSession.sessionToken which stores the raw token in
//     plaintext — this follows what the column name already says.
//  2. No new AuditAction/OtpPurpose enum values were added. LoginAttempt and
//     AuditLog are both already actor-agnostic (adminId is nullable on both,
//     AuditLog has a separate targetUserId) — reused as-is with adminId:null
//     and targetUserId:<instructor id>, and reused the existing generic
//     SESSION_CREATED / SESSION_REVOKED / FAILED_LOGIN enum values instead of
//     minting INSTRUCTOR_LOGIN/INSTRUCTOR_LOGOUT. Zero schema migration.

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const FAILED_LOGIN_WINDOW_MINUTES = 15;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function recordLoginAttempt({ email, status, reason = null, ipAddress = null, userAgent = null }) {
  // adminId stays null — this row is an instructor login attempt, not an
  // admin one. LoginAttempt has never enforced actor type beyond that.
  await prisma.loginAttempt.create({
    data: { adminId: null, email, status, reason, ipAddress, userAgent },
  });
}

// Best-effort — same convention every other service's auditLog() helper in
// this codebase already follows (learners/instructors/notifications/etc.):
// a failed audit write must never break the actual login/logout/password
// mutation it's describing. This function was the one outlier without a
// try/catch, which only ever went unnoticed because every prior call site
// used an enum value already present in the generated Prisma Client.
async function createAuditLog({ instructorId = null, action, details = null, ipAddress = null, userAgent = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: null,
        targetUserId: instructorId,
        action,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error(`[instructorAuth.service] audit log error (${action}):`, err.message);
  }
}

async function isInstructorLoginBlocked({ email }) {
  // Same dev-only carve-out as admin's isLoginTemporarilyBlocked — disabled
  // outside production so local/Playwright retries never lock out testing.
  if (process.env.NODE_ENV !== "production") return false;

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - FAILED_LOGIN_WINDOW_MINUTES);

  const failedAttemptsCount = await prisma.loginAttempt.count({
    where: {
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      createdAt: { gte: windowStart },
    },
  });

  return failedAttemptsCount >= MAX_FAILED_LOGIN_ATTEMPTS;
}

async function loginInstructor({ email, password, ipAddress, userAgent }) {
  const isBlocked = await isInstructorLoginBlocked({ email });

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

  const user = await prisma.appUser.findUnique({ where: { email } });

  // Not found, wrong role, or no password ever set all collapse into the
  // SAME generic message as a wrong password — never tell the caller which
  // check actually failed (this was an explicit instruction, not just
  // mirroring admin's narrower "user not found" case).
  if (!user || user.role !== "INSTRUCTOR" || !user.passwordHash) {
    await recordLoginAttempt({
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      ipAddress,
      userAgent,
    });

    if (user) {
      await createAuditLog({
        instructorId: user.id,
        action: "FAILED_LOGIN",
        details: { reason: !user.passwordHash ? "NO_PASSWORD_SET" : "WRONG_ROLE" },
        ipAddress,
        userAgent,
      });
    }

    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  if (user.status !== "ACTIVE") {
    await recordLoginAttempt({
      email,
      status: "FAILED",
      reason: `ACCOUNT_${user.status}`,
      ipAddress,
      userAgent,
    });

    await createAuditLog({
      instructorId: user.id,
      action: "FAILED_LOGIN",
      details: { reason: `ACCOUNT_${user.status}` },
      ipAddress,
      userAgent,
    });

    // Same wording as admin.service.js's inactive-account branch — doesn't
    // leak WHICH inactive status (suspended vs pending vs archived), just
    // that access is denied.
    return { success: false, message: "Access denied." };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    await recordLoginAttempt({
      email,
      status: "FAILED",
      reason: "INVALID_CREDENTIALS",
      ipAddress,
      userAgent,
    });

    await createAuditLog({
      instructorId: user.id,
      action: "FAILED_LOGIN",
      details: { reason: "INVALID_CREDENTIALS" },
      ipAddress,
      userAgent,
    });

    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  return issueInstructorSession(user, { email, ipAddress, userAgent });
}

async function issueInstructorSession(user, { email, ipAddress, userAgent }) {
  const rawToken = generateSessionToken();
  const expiresAt = getSessionExpiryDate();

  const session = await prisma.appUserSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  await recordLoginAttempt({
    email,
    status: "SUCCESS",
    reason: "LOGIN_SUCCESS",
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    instructorId: user.id,
    action: "SESSION_CREATED",
    details: { sessionId: session.id, expiresAt, actorType: "INSTRUCTOR" },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Login successful.",
    token: rawToken,
    instructor: instructorSummary(user),
  };
}

async function logoutInstructor({ instructorId, sessionId, ipAddress, userAgent }) {
  await prisma.appUserSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  await createAuditLog({
    instructorId,
    action: "SESSION_REVOKED",
    details: { sessionId, actorType: "INSTRUCTOR" },
    ipAddress,
    userAgent,
  });

  return { success: true, message: "Logged out." };
}

// Mirrors admin.service.js's changeAdminPassword exactly: bcrypt.compare the
// current password, hash+store the new one, then revoke every active
// AppUserSession for this user (including the one making this call) and
// clear the in-memory session cache — same "any password change invalidates
// every session, compromise-safe by default" rule admin's own self-service
// password change already applies. The frontend signs the caller out and
// redirects to /instructor/login immediately after a success response
// (Part 4), so revoking the calling session too (rather than carving out an
// exception for it) matches what the user actually sees either way.
async function changeInstructorPassword({ instructorId, currentPassword, newPassword, ipAddress, userAgent }) {
  const user = await prisma.appUser.findUnique({ where: { id: instructorId } });
  if (!user || !user.passwordHash) {
    return { success: false, message: "Instructor not found." };
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    await createAuditLog({
      instructorId,
      action: "FAILED_LOGIN",
      details: { reason: "INVALID_CURRENT_PASSWORD_ON_CHANGE" },
      ipAddress,
      userAgent,
    });
    return { success: false, message: "Current password is incorrect." };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.appUser.update({ where: { id: instructorId }, data: { passwordHash: newPasswordHash } });

  await prisma.appUserSession.updateMany({
    where: { userId: instructorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  clearAllCachedInstructorSessions();

  await createAuditLog({
    instructorId,
    action: "INSTRUCTOR_PASSWORD_CHANGED",
    details: {},
    ipAddress,
    userAgent,
  });

  return { success: true, message: "Password changed successfully. Please log in again." };
}

// Deliberately narrow — same fields the admin /me endpoint exposes on
// req.admin, scoped to what an instructor session actually needs client-side.
// Full profile (bio/specialization/etc.) is a Phase-2 concern (My Profile
// page), not this auth endpoint's job.
function instructorSummary(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    verificationState: user.verificationState,
  };
}

module.exports = {
  hashToken,
  loginInstructor,
  logoutInstructor,
  changeInstructorPassword,
  instructorSummary,
};
