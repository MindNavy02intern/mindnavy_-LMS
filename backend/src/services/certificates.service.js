const crypto = require("crypto");

const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { LOGO_ALLOWED_MIME, LOGO_MAX_BYTES } = require("../validators/certificates.validator");
const { getCachedFeatureFlags } = require("./settings.service");

// ── Certificates service (templates + issued certificates + public verify) ──────
//
// Same conventions as quizzes.service: reads use safe() so tabs render empty
// (never 500) pre-migration; writes verify every reference first for clean
// 400/404s. Key decisions (see CERTIFICATES_CONTRACT.md):
//   - The pre-existing Certificate model was EXTENDED, not duplicated — it keeps
//     feeding the LM KPI + activity feed (one field, one owner).
//   - v1 issuance is MANUAL only, but issueCertificate() is the single entry
//     point future auto-triggers (course completion, quiz pass, …) will call.
//   - Issue respects Course.certificateEnabled (wizard Step 4 flag).
//   - Revoke is soft (revokedAt); reissue UPDATES the row: fresh code, fresh
//     issuedAt, clears revokedAt — the (course, user) pair stays unique.
//   - verify is the only public read: minimal fields, no ids, no email.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[certificates.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

function newVerificationCode() {
  return crypto.randomBytes(16).toString("hex"); // 32 hex chars, matches CODE_FORMAT
}

// ── Template logo storage (sign -> PUT -> confirm, same pattern as course
// thumbnails/instructor/learner documents) ──────────────────────────────────
// Reuses the existing course-thumbnails PUBLIC bucket (logos are non-sensitive
// branding assets, same trust level as a course thumbnail) — no dedicated
// bucket needed, override-able via SUPABASE_CERT_LOGO_BUCKET the same way
// SUPABASE_LEARNER_DOCS_BUCKET works.
const LOGO_BUCKET = process.env.SUPABASE_CERT_LOGO_BUCKET || process.env.SUPABASE_THUMBNAIL_BUCKET || "course-thumbnails";
const LOGO_SIGN_EXPIRES_IN = 600;

function requireStorage() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  return provider;
}

function safeLogoFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function logoPrefixFor(templateId) {
  return `certificate-templates/${templateId}/`;
}

const TEMPLATE_SELECT = {
  id: true, name: true, layout: true, createdAt: true, updatedAt: true,
  _count: { select: { certificates: true } },
};

const CERT_SELECT = {
  id: true, courseId: true, userId: true, templateId: true,
  verificationCode: true, issuedAt: true, revokedAt: true, expiresAt: true, metadata: true,
  user:     { select: { fullName: true } },
  course:   { select: { title: true } },
  template: { select: { name: true } },
};

// Expiring within this many days counts as "expiring soon" for the list
// filter + Reports counts — matches the "upcoming renewal" window other
// admin consoles use; not configurable (no ask for a settings field here).
const EXPIRING_SOON_DAYS = 30;

function mapTemplate(t) {
  return {
    id:               t.id,
    name:             t.name,
    layout:           t.layout,
    certificateCount: t._count?.certificates ?? 0,
    createdAt:        iso(t.createdAt),
    updatedAt:        iso(t.updatedAt),
  };
}

function mapCertificate(c) {
  return {
    id:               c.id,
    userId:           c.userId,
    // Snapshot first (survives renames/deletes), live relation as fallback.
    studentName:      c.metadata?.studentName ?? c.user?.fullName ?? null,
    courseId:         c.courseId,
    courseTitle:      c.metadata?.courseTitle ?? c.course?.title ?? null,
    templateId:       c.templateId ?? null,
    templateName:     c.template?.name ?? null,
    verificationCode: c.verificationCode,
    status:           c.revokedAt ? "revoked" : (c.expiresAt && c.expiresAt <= new Date() ? "expired" : "active"),
    issuedAt:         iso(c.issuedAt),
    revokedAt:        iso(c.revokedAt),
    expiresAt:        iso(c.expiresAt),
  };
}

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function certAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Existence guards ─────────────────────────────────────────────────────────────

async function getTemplateOrThrow(id) {
  const t = await prisma.certificateTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!t) throw domainError("TEMPLATE_NOT_FOUND");
  return t;
}

async function assertTemplateRefExists(templateId) {
  const t = await prisma.certificateTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
  if (!t) throw domainError("TEMPLATE_REF_NOT_FOUND");
}

async function getCertificateOrThrow(id) {
  const c = await prisma.certificate.findUnique({ where: { id }, select: CERT_SELECT });
  if (!c) throw domainError("CERT_NOT_FOUND");
  return c;
}

// ── Templates ────────────────────────────────────────────────────────────────────

async function listTemplates() {
  const rows = await safe(
    () => prisma.certificateTemplate.findMany({ orderBy: { createdAt: "desc" }, select: TEMPLATE_SELECT }),
    [],
  );
  return rows.map(mapTemplate);
}

async function getTemplate(id) {
  const t = await prisma.certificateTemplate.findUnique({ where: { id }, select: TEMPLATE_SELECT });
  if (!t) throw domainError("TEMPLATE_NOT_FOUND");
  return mapTemplate(t);
}

async function createTemplate(data, adminId) {
  const template = await prisma.certificateTemplate.create({
    data: { name: data.name, layout: data.layout },
    select: TEMPLATE_SELECT,
  });
  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_CREATED", { templateId: template.id, name: template.name });
  return mapTemplate(template);
}

async function updateTemplate(id, data, adminId) {
  const current = await prisma.certificateTemplate.findUnique({ where: { id }, select: { layout: true } });
  if (!current) throw domainError("TEMPLATE_NOT_FOUND");

  // PATCH's `layout` REPLACES the whole object (contract-documented) — but the
  // logo is written only by the dedicated upload/remove endpoints below, so a
  // plain name/color edit here must carry it forward, not silently wipe it.
  const patch = { ...data };
  if (patch.layout) {
    patch.layout = {
      ...patch.layout,
      logoUrl: current.layout?.logoUrl ?? null,
      logoPath: current.layout?.logoPath ?? null,
    };
  }

  const template = await prisma.certificateTemplate.update({ where: { id }, data: patch, select: TEMPLATE_SELECT });
  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_UPDATED", { templateId: id, fields: Object.keys(data) });
  return mapTemplate(template);
}

// ── Logo upload (sign -> PUT -> confirm) ──────────────────────────────────────

async function signLogoUpload(templateId, { fileName }) {
  await getTemplateOrThrow(templateId);
  const provider = requireStorage();

  const path = `${logoPrefixFor(templateId)}${crypto.randomUUID()}-${safeLogoFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(LOGO_BUCKET, path);

  return { uploadUrl, path, maxBytes: LOGO_MAX_BYTES, expiresIn: LOGO_SIGN_EXPIRES_IN };
}

async function confirmLogoUpload(templateId, { path }, adminId) {
  const prefix = logoPrefixFor(templateId);
  if (path.includes("..") || path.includes("\\") || path.startsWith("/") || !path.startsWith(prefix) || path.length <= prefix.length) {
    throw domainError("BAD_PATH");
  }

  const current = await prisma.certificateTemplate.findUnique({ where: { id: templateId }, select: { layout: true } });
  if (!current) throw domainError("TEMPLATE_NOT_FOUND");

  const provider = requireStorage();
  const info = await provider.statObject(LOGO_BUCKET, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND");
  if (info.size != null && info.size > LOGO_MAX_BYTES) {
    await provider.removeObject(LOGO_BUCKET, path).catch(() => null);
    throw domainError("FILE_TOO_LARGE");
  }
  if (info.mimetype && info.mimetype !== "application/octet-stream" && !LOGO_ALLOWED_MIME.includes(info.mimetype)) {
    await provider.removeObject(LOGO_BUCKET, path).catch(() => null);
    throw domainError("BAD_FILE_TYPE");
  }

  const url = provider.getPublicUrl(LOGO_BUCKET, path);
  const oldPath = current.layout?.logoPath ?? null;

  const template = await prisma.certificateTemplate.update({
    where: { id: templateId },
    data: { layout: { ...current.layout, logoUrl: url, logoPath: path } },
    select: TEMPLATE_SELECT,
  });

  // Best-effort cleanup of the object it's replacing — never blocks the response.
  if (oldPath && oldPath !== path) await provider.removeObject(LOGO_BUCKET, oldPath).catch(() => null);

  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_LOGO_UPLOADED", { templateId, path });
  return mapTemplate(template);
}

async function removeLogo(templateId, adminId) {
  const current = await prisma.certificateTemplate.findUnique({ where: { id: templateId }, select: { layout: true } });
  if (!current) throw domainError("TEMPLATE_NOT_FOUND");

  const oldPath = current.layout?.logoPath ?? null;
  const template = await prisma.certificateTemplate.update({
    where: { id: templateId },
    data: { layout: { ...current.layout, logoUrl: null, logoPath: null } },
    select: TEMPLATE_SELECT,
  });

  if (oldPath) {
    const provider = getProvider();
    if (provider.isConfigured()) await provider.removeObject(LOGO_BUCKET, oldPath).catch(() => null);
  }

  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_LOGO_REMOVED", { templateId });
  return mapTemplate(template);
}

async function deleteTemplate(id, adminId) {
  await getTemplateOrThrow(id);
  // Issued certificates survive: templateId is set NULL by the relation default,
  // and they keep rendering via metadata snapshot + default layout.
  await prisma.certificateTemplate.delete({ where: { id } });
  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_DELETED", { templateId: id });
  return { id };
}

// ── Issued certificates ───────────────────────────────────────────────────────────

async function listCertificates({ courseId, userId, status, limit, offset }) {
  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
  const where = {
    ...(courseId ? { courseId } : {}),
    ...(userId ? { userId } : {}),
    ...(status === "revoked" ? { revokedAt: { not: null } } : {}),
    // "active" here means not-revoked (matches the pre-expiry meaning of the
    // filter) — expired-but-not-revoked certs stay reachable via their own
    // dedicated filter instead of silently vanishing from "active".
    ...(status === "active" ? { revokedAt: null } : {}),
    ...(status === "expired" ? { revokedAt: null, expiresAt: { lte: now } } : {}),
    ...(status === "expiring_soon" ? { revokedAt: null, expiresAt: { gt: now, lte: soon } } : {}),
  };

  const [rows, total] = await safe(
    () => Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        take: limit,
        skip: offset,
        select: CERT_SELECT,
      }),
      prisma.certificate.count({ where }),
    ]),
    [[], 0],
  );

  return { items: rows.map(mapCertificate), total, limit, offset };
}

// The single issuance entry point — future auto-triggers (course completion,
// quiz passing grade, path completion, session attendance) call THIS.
// `trigger` is optional audit-trail metadata only (e.g. "enrollment_completed",
// "quiz_passed", "path_completed") — manual issuance (the admin Issue dialog)
// omits it, so its audit rows are unchanged; certificateTriggers.service.js
// passes it so the audit log can tell an auto-issue apart from a manual one.
async function issueCertificate({ userId, courseId, templateId }, adminId, trigger) {
  const flags = await getCachedFeatureFlags();
  if (!flags.certificatesModuleEnabled) throw domainError("CERTIFICATES_MODULE_DISABLED");

  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
  if (!user) throw domainError("USER_NOT_FOUND");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, certificateEnabled: true },
  });
  if (!course) throw domainError("COURSE_NOT_FOUND");
  if (!course.certificateEnabled) throw domainError("CERT_DISABLED");

  if (templateId) await assertTemplateRefExists(templateId);

  const existing = await prisma.certificate.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { id: true },
  });
  if (existing) throw domainError("ALREADY_ISSUED");

  let cert;
  try {
    cert = await prisma.certificate.create({
      data: {
        userId,
        courseId,
        templateId: templateId ?? null,
        verificationCode: newVerificationCode(),
        // Issue-time snapshot — keeps the certificate truthful across renames.
        metadata: { studentName: user.fullName, courseTitle: course.title },
      },
      select: CERT_SELECT,
    });
  } catch (err) {
    if (err.code === "P2002") throw domainError("ALREADY_ISSUED"); // insert race on the pair
    throw err;
  }

  await certAuditLog(adminId, "CERTIFICATE_ISSUED", {
    certificateId: cert.id, userId, courseId, templateId: templateId ?? null,
    ...(trigger ? { trigger } : {}),
  });
  return mapCertificate(cert);
}

// `reason` is optional and additive (Learners module Part 5) — the Certificate
// model has no revocationReason column (a second writer of "why" belongs in
// the audit trail, not a new schema field for one caller). Existing callers
// that don't pass it are unaffected; the detail is simply absent.
async function revokeCertificate(id, adminId, reason) {
  const current = await getCertificateOrThrow(id);
  if (current.revokedAt) throw domainError("ALREADY_REVOKED");

  const cert = await prisma.certificate.update({
    where: { id },
    data: { revokedAt: new Date() },
    select: CERT_SELECT,
  });
  await certAuditLog(adminId, "CERTIFICATE_REVOKED", { certificateId: id, ...(reason ? { reason } : {}) });
  return mapCertificate(cert);
}

// Set or clear (expiresAt: null) an issued certificate's expiry — independent
// of revoke/reissue since a cert can expire without ever being revoked.
async function setCertificateExpiry(id, expiresAt, adminId) {
  await getCertificateOrThrow(id);
  const cert = await prisma.certificate.update({
    where: { id },
    data: { expiresAt },
    select: CERT_SELECT,
  });
  await certAuditLog(adminId, "CERTIFICATE_EXPIRY_UPDATED", { certificateId: id, expiresAt: expiresAt ? expiresAt.toISOString() : null });
  return mapCertificate(cert);
}

// Reissue = same (course, user) pair, fresh code + issuedAt, un-revoked.
// The old code stops verifying immediately (it no longer exists anywhere).
async function reissueCertificate(id, { templateId }, adminId) {
  await getCertificateOrThrow(id);
  if (typeof templateId === "string") await assertTemplateRefExists(templateId);

  const cert = await prisma.certificate.update({
    where: { id },
    data: {
      verificationCode: newVerificationCode(),
      issuedAt: new Date(),
      revokedAt: null,
      ...(templateId !== undefined ? { templateId } : {}),
    },
    select: CERT_SELECT,
  });
  await certAuditLog(adminId, "CERTIFICATE_REISSUED", { certificateId: id, templateId: templateId ?? undefined });
  return mapCertificate(cert);
}

// ── PDF data ─────────────────────────────────────────────────────────────────────

async function getCertificateForPdf(id) {
  const c = await prisma.certificate.findUnique({
    where: { id },
    select: { ...CERT_SELECT, template: { select: { name: true, layout: true } } },
  });
  if (!c) throw domainError("CERT_NOT_FOUND");
  if (c.revokedAt) throw domainError("CERT_REVOKED");

  // Self-heal a legacy row that slipped past the backfill script.
  let code = c.verificationCode;
  if (!code) {
    code = newVerificationCode();
    await prisma.certificate.update({ where: { id }, data: { verificationCode: code } });
  }

  return {
    studentName:      c.metadata?.studentName ?? c.user?.fullName ?? null,
    courseTitle:      c.metadata?.courseTitle ?? c.course?.title ?? null,
    issuedAt:         c.issuedAt,
    verificationCode: code,
    layout:           c.template?.layout ?? null,
  };
}

// ── Public verify (unauthenticated — minimal response, no ids, no email) ─────────

async function verifyByCode(code) {
  const c = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    select: {
      issuedAt: true, revokedAt: true, expiresAt: true, metadata: true,
      user: { select: { fullName: true } }, course: { select: { title: true } },
    },
  });

  if (!c) return { status: "not_found" };
  if (c.revokedAt) return { status: "revoked" };
  if (c.expiresAt && c.expiresAt <= new Date()) {
    return {
      status: "expired",
      certificate: {
        studentName: c.metadata?.studentName ?? c.user?.fullName ?? null,
        courseTitle: c.metadata?.courseTitle ?? c.course?.title ?? null,
        issuedAt:    iso(c.issuedAt),
        expiresAt:   iso(c.expiresAt),
      },
    };
  }

  return {
    status: "valid",
    certificate: {
      studentName: c.metadata?.studentName ?? c.user?.fullName ?? null,
      courseTitle: c.metadata?.courseTitle ?? c.course?.title ?? null,
      issuedAt:    iso(c.issuedAt),
      expiresAt:   iso(c.expiresAt),
    },
  };
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  setCertificateExpiry,
  updateTemplate,
  deleteTemplate,
  signLogoUpload,
  confirmLogoUpload,
  removeLogo,
  listCertificates,
  issueCertificate,
  revokeCertificate,
  reissueCertificate,
  getCertificateForPdf,
  verifyByCode,
};
