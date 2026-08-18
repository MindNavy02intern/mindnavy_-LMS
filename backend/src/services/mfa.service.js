const bcrypt = require("bcryptjs");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const prisma = require("../config/prisma");

// ── Per-admin TOTP MFA (SecurityTab.tsx) — real otplib/qrcode, no 3rd party ──
//
// Enrollment is a two-step setup->verify (mirrors every sign->confirm upload
// flow already in this codebase): setup mints a fresh secret + QR every call
// and returns it to the client WITHOUT persisting anything — AdminUser.mfaSecret
// is only ever written once verify proves the admin can actually produce a
// valid code from it (schema comment on that field says exactly this). This
// is a per-admin toggle, separate from SystemSettings.mfaEnabled (an org-wide
// policy flag that doesn't enroll anyone by itself).

function domainError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function setupMfa(admin) {
  if (admin.mfaEnabled) throw domainError("ALREADY_ENABLED", "MFA is already enabled on this account.");

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(admin.email, "MindNavy LMS", secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  return { secret, qrCodeDataUrl };
}

async function verifyMfaSetup(admin, secret, code) {
  if (admin.mfaEnabled) throw domainError("ALREADY_ENABLED", "MFA is already enabled on this account.");

  const valid = authenticator.verify({ token: code, secret });
  if (!valid) throw domainError("INVALID_CODE", "That code didn't match. Check your authenticator app and try again.");

  await prisma.adminUser.update({ where: { id: admin.id }, data: { mfaSecret: secret, mfaEnabled: true } });
  await auditLog(admin.id, "ADMIN_MFA_ENABLED", null);
  return { enabled: true };
}

async function disableMfa(admin, password) {
  if (!admin.mfaEnabled) throw domainError("NOT_ENABLED", "MFA is not enabled on this account.");

  const row = await prisma.adminUser.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  const validPassword = row && await bcrypt.compare(password, row.passwordHash);
  if (!validPassword) throw domainError("INVALID_PASSWORD", "Incorrect password.");

  await prisma.adminUser.update({ where: { id: admin.id }, data: { mfaSecret: null, mfaEnabled: false } });
  await auditLog(admin.id, "ADMIN_MFA_DISABLED", null);
  return { enabled: false };
}

module.exports = { setupMfa, verifyMfaSetup, disableMfa };
