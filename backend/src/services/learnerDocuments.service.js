const crypto = require("crypto");

const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { ALLOWED_MIME } = require("../validators/learnerDocuments.validator");

// ── Learner documents service (sign → direct upload → confirm) ──────────────────
// Mirrors instructorDocuments.service exactly. See learners.prisma
// LearnerDocument for the bucket-reuse note — no dedicated bucket exists yet,
// so this rides the EXISTING "instructor-documents" bucket under a
// learners/<id>/ prefix (confirmed live before writing this), override-able
// via SUPABASE_LEARNER_DOCS_BUCKET.

const BUCKET = process.env.SUPABASE_LEARNER_DOCS_BUCKET || "instructor-documents";

const MAX_BYTES = 10 * 1024 * 1024;
const SIGN_EXPIRES_IN = 600;
const DOWNLOAD_EXPIRES_IN = 300;

function domainError(code, extra) { return Object.assign(new Error(code), { code, ...extra }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[learnerDocuments.service] query failed:", err.message);
    return fallback;
  }
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.learnerId === "string" ? details.learnerId : null,
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

async function assertIsLearner(id) {
  const user = await prisma.appUser.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || user.role !== "LEARNER") throw domainError("LEARNER_NOT_FOUND");
  return user;
}

async function assertDocumentOf(learnerId, docId) {
  const doc = await prisma.learnerDocument.findFirst({ where: { id: docId, learnerId } });
  if (!doc) throw domainError("DOCUMENT_NOT_FOUND");
  return doc;
}

function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function prefixFor(learnerId) {
  return `learners/${learnerId}/documents/`;
}

function assertPathScoped(learnerId, path) {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw domainError("BAD_PATH");
  }
  const prefix = prefixFor(learnerId);
  if (!path.startsWith(prefix) || path.length <= prefix.length) {
    throw domainError("BAD_PATH");
  }
}

function mapDocument(d, downloadUrl = null) {
  return {
    id:              d.id,
    learnerId:       d.learnerId,
    type:            d.type,
    status:          d.status,
    fileName:        d.fileName,
    fileSize:        d.fileSize,
    mimeType:        d.mimeType,
    downloadUrl,
    downloadExpiresIn: downloadUrl ? DOWNLOAD_EXPIRES_IN : null,
    rejectionReason: d.rejectionReason ?? null,
    expiresAt:       iso(d.expiresAt),
    uploadedById:    d.uploadedById ?? null,
    uploadedAt:      iso(d.uploadedAt),
    verifiedAt:      iso(d.verifiedAt),
    verifiedById:    d.verifiedById ?? null,
    updatedAt:       iso(d.updatedAt),
  };
}

async function listDocuments(learnerId, { type, status, includeArchived = false } = {}) {
  await assertIsLearner(learnerId);

  const where = { learnerId };
  if (type) where.type = type;
  if (status) where.status = status;
  else if (!includeArchived) where.status = { not: "ARCHIVED" };

  const rows = await safe(
    () => prisma.learnerDocument.findMany({ where, orderBy: { uploadedAt: "desc" } }),
    [],
  );

  const provider = getProvider();
  const canSign = provider.isConfigured();

  const documents = await Promise.all(rows.map(async (d) => {
    if (!canSign) return mapDocument(d, null);
    const url = await safe(() => provider.createSignedDownloadUrl(BUCKET, d.filePath, DOWNLOAD_EXPIRES_IN), null);
    return mapDocument(d, url);
  }));

  return { documents, total: documents.length };
}

async function signDocumentUpload(learnerId, { fileName, fileType, type }) {
  const provider = requireConfigured();
  await assertIsLearner(learnerId);

  const path = `${prefixFor(learnerId)}${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BUCKET, path);

  return { uploadUrl, path, type, maxBytes: MAX_BYTES, expiresIn: SIGN_EXPIRES_IN };
}

async function confirmDocumentUpload(learnerId, { path, fileName, type, expiresAt }, adminId) {
  assertPathScoped(learnerId, path);

  const provider = requireConfigured();
  await assertIsLearner(learnerId);

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

  const doc = await prisma.learnerDocument.create({
    data: {
      learnerId,
      type,
      status: "PENDING",
      fileName: safeFileName(fileName),
      filePath: path,
      fileSize: info.size ?? 0,
      mimeType: info.mimetype ?? "application/octet-stream",
      expiresAt: expiresAt ?? null,
      uploadedById: adminId ?? null,
    },
  });

  await auditLog(adminId, "LEARNER_DOCUMENT_UPLOADED", { learnerId, documentId: doc.id, type, fileName: doc.fileName });

  return mapDocument(doc);
}

async function verifyDocument(learnerId, docId, adminId) {
  const current = await assertDocumentOf(learnerId, docId);
  if (current.status === "ARCHIVED") throw domainError("DOCUMENT_ARCHIVED");

  const doc = await prisma.learnerDocument.update({
    where: { id: docId },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: adminId ?? null, rejectionReason: null },
  });

  await auditLog(adminId, "LEARNER_DOCUMENT_VERIFIED", { learnerId, documentId: docId, type: doc.type });

  return mapDocument(doc);
}

async function rejectDocument(learnerId, docId, reason, adminId) {
  const current = await assertDocumentOf(learnerId, docId);
  if (current.status === "ARCHIVED") throw domainError("DOCUMENT_ARCHIVED");

  const doc = await prisma.learnerDocument.update({
    where: { id: docId },
    data: { status: "REJECTED", rejectionReason: reason, verifiedAt: new Date(), verifiedById: adminId ?? null },
  });

  await auditLog(adminId, "LEARNER_DOCUMENT_REJECTED", { learnerId, documentId: docId, type: doc.type, reason });

  return mapDocument(doc);
}

async function archiveDocument(learnerId, docId, adminId) {
  const current = await assertDocumentOf(learnerId, docId);
  if (current.status === "ARCHIVED") return mapDocument(current);

  const doc = await prisma.learnerDocument.update({ where: { id: docId }, data: { status: "ARCHIVED" } });

  await auditLog(adminId, "LEARNER_DOCUMENT_ARCHIVED", { learnerId, documentId: docId, type: doc.type });

  return mapDocument(doc);
}

module.exports = {
  BUCKET,
  MAX_BYTES,
  DOWNLOAD_EXPIRES_IN,
  listDocuments,
  signDocumentUpload,
  confirmDocumentUpload,
  verifyDocument,
  rejectDocument,
  archiveDocument,
};
