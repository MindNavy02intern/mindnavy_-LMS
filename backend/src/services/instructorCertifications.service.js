const crypto = require("crypto");

const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { ALLOWED_MIME } = require("../validators/instructorCertifications.validator");

// ── Instructor certifications service (teaching certs/licences/degrees) ──────────
//
// NOTE: INSTRUCTORS_CONTRACT.md v1 "Known gaps" flags this as a deliberately
// unshipped, SEPARATE entity from InstructorDocument. Shipped anyway at the
// user's explicit direction — see instructors.prisma InstructorCertification.
//
// File handling mirrors instructorDocuments.service exactly: PRIVATE bucket, a
// stored KEY (never a public URL), signed download URLs minted per read
// (5 min), every client-supplied path re-scoped to instructors/<id>/certs/.
// A file is optional — a certification row may exist unattached (created,
// pending upload) same as it may exist fully attached.

const BUCKET = process.env.SUPABASE_INSTRUCTOR_CERTS_BUCKET || "instructor-documents";

const MAX_BYTES = 10 * 1024 * 1024; // scans/PDFs, same ceiling as documents
const SIGN_EXPIRES_IN = 600;   // 10 min to complete the PUT
const DOWNLOAD_EXPIRES_IN = 300; // 5 min — minted fresh on every list read

function domainError(code) { return Object.assign(new Error(code), { code }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorCertifications.service] query failed:", err.message);
    return fallback;
  }
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.instructorId === "string" ? details.instructorId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function requireConfigured() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  return provider;
}

async function assertIsInstructor(id) {
  const user = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "INSTRUCTOR") throw domainError("INSTRUCTOR_NOT_FOUND");
  return user;
}

// Scoping the lookup to instructorId — a certId belonging to another instructor
// answers 404, same rule as instructorDocuments.assertDocumentOf.
async function assertCertificationOf(instructorId, certId) {
  const cert = await prisma.instructorCertification.findFirst({
    where: { id: certId, instructorId },
  });
  if (!cert) throw domainError("CERTIFICATION_NOT_FOUND");
  return cert;
}

function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function prefixFor(instructorId) {
  return `instructors/${instructorId}/certifications/`;
}

function assertPathScoped(instructorId, path) {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw domainError("BAD_PATH");
  }
  const prefix = prefixFor(instructorId);
  if (!path.startsWith(prefix) || path.length <= prefix.length) {
    throw domainError("BAD_PATH");
  }
}

// `fileUrl` in the response is a freshly-minted SIGNED url (or null) — the
// stored column holds only the private bucket key. Same contract as
// InstructorDocument.downloadUrl: do not cache it client-side.
function mapCertification(c, fileUrl = null) {
  return {
    id:           c.id,
    instructorId: c.instructorId,
    name:         c.name,
    type:         c.type,
    issuer:       c.issuer,
    fileUrl,
    status:       c.status,
    createdAt:    iso(c.createdAt),
    updatedAt:    iso(c.updatedAt),
    verifiedAt:   iso(c.verifiedAt),
    verifiedById: c.verifiedById ?? null,
  };
}

// ── List ────────────────────────────────────────────────────────────────────────

async function listCertifications(instructorId, { type, status } = {}) {
  await assertIsInstructor(instructorId);

  const where = { instructorId, ...(type ? { type } : {}), ...(status ? { status } : {}) };
  const rows = await safe(
    () => prisma.instructorCertification.findMany({ where, orderBy: { createdAt: "desc" } }),
    [],
  );

  const provider = getProvider();
  const canSign = provider.isConfigured();

  const certifications = await Promise.all(rows.map(async (c) => {
    if (!c.fileUrl || !canSign) return mapCertification(c, null);
    const url = await safe(
      () => provider.createSignedDownloadUrl(BUCKET, c.fileUrl, DOWNLOAD_EXPIRES_IN),
      null,
    );
    return mapCertification(c, url);
  }));

  return { certifications, total: certifications.length };
}

// ── Sign ────────────────────────────────────────────────────────────────────────

async function signCertificationUpload(instructorId, { fileName }) {
  const provider = requireConfigured();
  await assertIsInstructor(instructorId);

  const path = `${prefixFor(instructorId)}${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BUCKET, path);

  return { uploadUrl, path, maxBytes: MAX_BYTES, expiresIn: SIGN_EXPIRES_IN };
}

// ── Create (attaches an already-signed+uploaded file, or none) ─────────────────

async function createCertification(instructorId, { name, issuer, type, path }, adminId) {
  await assertIsInstructor(instructorId);

  let filePath = null;
  if (path) {
    assertPathScoped(instructorId, path);
    const provider = requireConfigured();
    const info = await provider.statObject(BUCKET, path);
    if (!info.exists) throw domainError("OBJECT_NOT_FOUND");
    if (info.size != null && info.size > MAX_BYTES) {
      await safe(() => provider.removeObject(BUCKET, path), null);
      throw domainError("FILE_TOO_LARGE");
    }
    if (info.mimetype && info.mimetype !== "application/octet-stream" && !ALLOWED_MIME.includes(info.mimetype)) {
      await safe(() => provider.removeObject(BUCKET, path), null);
      throw domainError("BAD_FILE_TYPE");
    }
    filePath = path;
  }

  const cert = await prisma.instructorCertification.create({
    data: { instructorId, name, issuer, type, fileUrl: filePath, status: "PENDING" },
  });

  await auditLog(adminId, "INSTRUCTOR_CERTIFICATION_UPLOADED", { instructorId, certificationId: cert.id, name, type });

  return mapCertification(cert, null);
}

// ── Verify / Reject / Delete ─────────────────────────────────────────────────────

async function verifyCertification(instructorId, certId, adminId) {
  await assertCertificationOf(instructorId, certId);

  const cert = await prisma.instructorCertification.update({
    where: { id: certId },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: adminId ?? null },
  });

  await auditLog(adminId, "INSTRUCTOR_CERTIFICATION_VERIFIED", { instructorId, certificationId: certId });

  return mapCertification(cert, null);
}

async function rejectCertification(instructorId, certId, adminId) {
  await assertCertificationOf(instructorId, certId);

  const cert = await prisma.instructorCertification.update({
    where: { id: certId },
    data: { status: "REJECTED", verifiedAt: new Date(), verifiedById: adminId ?? null },
  });

  await auditLog(adminId, "INSTRUCTOR_CERTIFICATION_REJECTED", { instructorId, certificationId: certId });

  return mapCertification(cert, null);
}

// Hard delete — the task model has no ARCHIVED status to soft-delete into
// (unlike InstructorDocument). Best-effort removes the stored file too, so a
// deleted row does not leave an orphaned object in the bucket.
async function deleteCertification(instructorId, certId, adminId) {
  const current = await assertCertificationOf(instructorId, certId);

  await prisma.instructorCertification.delete({ where: { id: certId } });

  if (current.fileUrl) {
    const provider = getProvider();
    if (provider.isConfigured()) {
      await safe(() => provider.removeObject(BUCKET, current.fileUrl), null);
    }
  }

  await auditLog(adminId, "INSTRUCTOR_CERTIFICATION_DELETED", { instructorId, certificationId: certId });

  return { id: certId };
}

module.exports = {
  BUCKET,
  MAX_BYTES,
  listCertifications,
  signCertificationUpload,
  createCertification,
  verifyCertification,
  rejectCertification,
  deleteCertification,
};
