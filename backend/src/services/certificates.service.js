const crypto = require("crypto");

const prisma = require("../config/prisma");

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

const TEMPLATE_SELECT = {
  id: true, name: true, layout: true, createdAt: true, updatedAt: true,
  _count: { select: { certificates: true } },
};

const CERT_SELECT = {
  id: true, courseId: true, userId: true, templateId: true,
  verificationCode: true, issuedAt: true, revokedAt: true, metadata: true,
  user:     { select: { fullName: true } },
  course:   { select: { title: true } },
  template: { select: { name: true } },
};

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
    status:           c.revokedAt ? "revoked" : "active",
    issuedAt:         iso(c.issuedAt),
    revokedAt:        iso(c.revokedAt),
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
  await getTemplateOrThrow(id);
  const template = await prisma.certificateTemplate.update({ where: { id }, data, select: TEMPLATE_SELECT });
  await certAuditLog(adminId, "CERTIFICATE_TEMPLATE_UPDATED", { templateId: id, fields: Object.keys(data) });
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
  const where = {
    ...(courseId ? { courseId } : {}),
    ...(userId ? { userId } : {}),
    ...(status === "active" ? { revokedAt: null } : {}),
    ...(status === "revoked" ? { revokedAt: { not: null } } : {}),
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
async function issueCertificate({ userId, courseId, templateId }, adminId) {
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

  await certAuditLog(adminId, "CERTIFICATE_ISSUED", { certificateId: cert.id, userId, courseId, templateId: templateId ?? null });
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
      issuedAt: true, revokedAt: true, metadata: true,
      user: { select: { fullName: true } }, course: { select: { title: true } },
    },
  });

  if (!c) return { status: "not_found" };
  if (c.revokedAt) return { status: "revoked" };

  return {
    status: "valid",
    certificate: {
      studentName: c.metadata?.studentName ?? c.user?.fullName ?? null,
      courseTitle: c.metadata?.courseTitle ?? c.course?.title ?? null,
      issuedAt:    iso(c.issuedAt),
    },
  };
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCertificates,
  issueCertificate,
  revokeCertificate,
  reissueCertificate,
  getCertificateForPdf,
  verifyByCode,
};
