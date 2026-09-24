const crypto = require("crypto");

const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { LOGO_ALLOWED_MIME, LOGO_MAX_BYTES } = require("../validators/certificates.validator");

// ── Instructor custom certificate design (image + name overlay position) ──────
//
// Same sign→PUT→confirm shape as certificates.service.js's template logo
// upload, reusing the SAME public bucket (non-sensitive branding asset, same
// trust tier as a course thumbnail or template logo — no new bucket/env var).
// Ownership (does this instructor own this course?) is the CALLER's job
// (instructorCourses.service.js's assertOwnsCourse), same division of labor
// as signMyUpload/confirmMyUpload delegating to uploads.service.

const DESIGN_BUCKET = process.env.SUPABASE_CERT_LOGO_BUCKET || process.env.SUPABASE_THUMBNAIL_BUCKET || "course-thumbnails";
const SIGN_EXPIRES_IN = 600;

function domainError(code) { return Object.assign(new Error(code), { code }); }

function requireStorage() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  return provider;
}

function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function designPrefixFor(courseId) {
  return `certificate-designs/${courseId}/`;
}

async function getCourseOrThrow(courseId) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, customCertificateImageUrl: true } });
  if (!course) throw domainError("COURSE_NOT_FOUND");
  return course;
}

// Best-effort audit — never breaks the primary write (mirrors certificates.service).
// adminId is always null here (instructor self-service — AuditLog.adminId is
// FK-constrained to AdminUser, same reasoning as instructorCourses.service.js's
// header comment).
async function auditLog(action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const DESIGN_SELECT = {
  customCertificateImageUrl: true,
  certificateNameX: true,
  certificateNameY: true,
  certificateNameFontSize: true,
  certificateNameColor: true,
};

function mapDesign(c) {
  return {
    customCertificateImageUrl: c.customCertificateImageUrl ?? null,
    certificateNameX:          c.certificateNameX ?? null,
    certificateNameY:          c.certificateNameY ?? null,
    certificateNameFontSize:   c.certificateNameFontSize ?? null,
    certificateNameColor:      c.certificateNameColor ?? null,
  };
}

// ── Sign → PUT → confirm ─────────────────────────────────────────────────────

async function signDesignUpload(courseId, { fileName }) {
  await getCourseOrThrow(courseId);
  const provider = requireStorage();

  const path = `${designPrefixFor(courseId)}${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(DESIGN_BUCKET, path);

  return { uploadUrl, path, maxBytes: LOGO_MAX_BYTES, expiresIn: SIGN_EXPIRES_IN };
}

async function confirmDesignUpload(courseId, { path }) {
  const prefix = designPrefixFor(courseId);
  if (path.includes("..") || path.includes("\\") || path.startsWith("/") || !path.startsWith(prefix) || path.length <= prefix.length) {
    throw domainError("BAD_PATH");
  }

  const current = await getCourseOrThrow(courseId);
  const provider = requireStorage();

  const info = await provider.statObject(DESIGN_BUCKET, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND");
  if (info.size != null && info.size > LOGO_MAX_BYTES) {
    await provider.removeObject(DESIGN_BUCKET, path).catch(() => null);
    throw domainError("FILE_TOO_LARGE");
  }
  if (info.mimetype && info.mimetype !== "application/octet-stream" && !LOGO_ALLOWED_MIME.includes(info.mimetype)) {
    await provider.removeObject(DESIGN_BUCKET, path).catch(() => null);
    throw domainError("BAD_FILE_TYPE");
  }

  const url = provider.getPublicUrl(DESIGN_BUCKET, path);
  // Old path is only ever the same bucket's prefix for THIS course (never a
  // course-thumbnail or template logo) — safe to remove unconditionally.
  const oldUrl = current.customCertificateImageUrl;

  const course = await prisma.course.update({
    where: { id: courseId },
    data: { customCertificateImageUrl: url },
    select: DESIGN_SELECT,
  });

  if (oldUrl && oldUrl !== url) {
    const oldPath = oldUrl.split(`${DESIGN_BUCKET}/`).pop();
    if (oldPath && oldPath.startsWith(prefix)) await provider.removeObject(DESIGN_BUCKET, oldPath).catch(() => null);
  }

  // COURSE_SETTINGS_UPDATED is the closest existing AuditAction enum member —
  // there is no dedicated certificate-design action, and adding one is a
  // schema change; the `details` payload carries what actually happened.
  await auditLog("COURSE_SETTINGS_UPDATED", { courseId, field: "customCertificateImageUrl", path });
  return mapDesign(course);
}

// ── Name overlay position ────────────────────────────────────────────────────

async function setPosition(courseId, { nameX, nameY, fontSize, color }) {
  await getCourseOrThrow(courseId);

  const course = await prisma.course.update({
    where: { id: courseId },
    data: {
      certificateNameX: nameX,
      certificateNameY: nameY,
      ...(fontSize !== undefined ? { certificateNameFontSize: fontSize } : {}),
      ...(color !== undefined ? { certificateNameColor: color } : {}),
    },
    select: DESIGN_SELECT,
  });

  await auditLog("COURSE_SETTINGS_UPDATED", { courseId, field: "certificateNamePosition", nameX, nameY });
  return mapDesign(course);
}

module.exports = {
  signDesignUpload,
  confirmDesignUpload,
  setPosition,
};
