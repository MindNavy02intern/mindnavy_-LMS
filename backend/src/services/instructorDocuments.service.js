const crypto = require("crypto");

const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { ALLOWED_MIME } = require("../validators/instructorDocuments.validator");

// ── Instructor documents service (sign → direct upload → confirm) ───────────────
//
// Administrative paperwork held on file for an instructor: identity, contracts,
// agreements, tax forms, compliance records. Teaching certificates are NOT here
// (blueprint 05 §11 owns those) — see the model comment.
//
// SECURITY — this module handles the most sensitive data in the system, so three
// rules differ from the course-asset uploads in uploads.service:
//
//   1. PRIVATE bucket. Reads mint a short-lived signed URL per request
//      (createSignedDownloadUrl). We never call getPublicUrl and never store a
//      URL in the database — a public link to someone's passport cannot be
//      revoked once it has been seen.
//   2. Every path is scoped to `instructors/<instructorId>/`. A client-supplied
//      path is only ever accepted after it is proven to sit under the prefix of
//      the instructor named in the route, so one instructor's confirm can never
//      attach another instructor's file.
//   3. Every read of a single document goes through assertDocumentOf(), which
//      matches the document id AND the instructor id. A guessed document id
//      belonging to someone else answers 404, not 200.
//
// Conventions otherwise match uploads.service and instructors.service: domain
// errors carry a `code` the controller maps to a clean 4xx, and audit is
// best-effort so it can never break the primary write.

const BUCKET = process.env.SUPABASE_INSTRUCTOR_DOCS_BUCKET || "instructor-documents";

// Paperwork, not media. 10MB covers a scanned multi-page contract comfortably.
const MAX_BYTES = 10 * 1024 * 1024;

// Advisory upload budget reported to the client (same meaning as uploads.service).
const SIGN_EXPIRES_IN = 600; // 10 min

// Download links live only as long as it takes to click them. Short by design:
// this URL grants unauthenticated access to the file for its whole lifetime, so
// a copied link should stop working while the admin is still on the page.
const DOWNLOAD_EXPIRES_IN = 300; // 5 min

function domainError(code, extra) { return Object.assign(new Error(code), { code, ...extra }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorDocuments.service] query failed:", err.message);
    return fallback;
  }
}

// Best-effort audit — never breaks the primary write.
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

// A LEARNER id must be indistinguishable from a missing one — same rule as the
// rest of the Instructors module.
async function assertIsInstructor(id) {
  const user = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "INSTRUCTOR") throw domainError("INSTRUCTOR_NOT_FOUND");
  return user;
}

// Fetch a document ONLY if it belongs to this instructor. Scoping the lookup
// instead of checking after the fact means a guessed id from another
// instructor's file answers 404 and leaks nothing — not even its existence.
async function assertDocumentOf(instructorId, docId) {
  const doc = await prisma.instructorDocument.findFirst({
    where: { id: docId, instructorId },
  });
  if (!doc) throw domainError("DOCUMENT_NOT_FOUND");
  return doc;
}

// Keep only a safe basename (identical rules to uploads.service): strip any
// directory parts, allow-list characters, cap length.
function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function prefixFor(instructorId) {
  return `instructors/${instructorId}/`;
}

// The trust boundary for every client-supplied path. Rejects traversal, absolute
// paths and backslashes, then requires the path to sit under THIS instructor's
// prefix with something after it.
function assertPathScoped(instructorId, path) {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw domainError("BAD_PATH");
  }
  const prefix = prefixFor(instructorId);
  if (!path.startsWith(prefix) || path.length <= prefix.length) {
    throw domainError("BAD_PATH");
  }
}

function mapDocument(d, downloadUrl = null) {
  return {
    id:              d.id,
    instructorId:    d.instructorId,
    type:            d.type,
    status:          d.status,
    fileName:        d.fileName,
    fileSize:        d.fileSize,
    mimeType:        d.mimeType,
    // Short-lived and minted per request — never cache this client-side.
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

// ── List ────────────────────────────────────────────────────────────────────────

async function listDocuments(instructorId, { type, status, includeArchived = false } = {}) {
  await assertIsInstructor(instructorId);

  const where = { instructorId };
  if (type) where.type = type;
  if (status) where.status = status;
  // An explicit ?status=ARCHIVED always wins over the default hiding.
  else if (!includeArchived) where.status = { not: "ARCHIVED" };

  const rows = await safe(
    () => prisma.instructorDocument.findMany({ where, orderBy: { uploadedAt: "desc" } }),
    [],
  );

  // One signed URL per row. Storage may be unconfigured (503 on writes, but a
  // read should still list what is on file) — in that case the row comes back
  // with downloadUrl: null and the UI disables the Download button.
  const provider = getProvider();
  const canSign = provider.isConfigured();

  const documents = await Promise.all(rows.map(async (d) => {
    if (!canSign) return mapDocument(d, null);
    const url = await safe(
      () => provider.createSignedDownloadUrl(BUCKET, d.filePath, DOWNLOAD_EXPIRES_IN),
      null,
    );
    return mapDocument(d, url);
  }));

  return { documents, total: documents.length };
}

// ── Sign ────────────────────────────────────────────────────────────────────────

async function signDocumentUpload(instructorId, { fileName, fileType, type }) {
  const provider = requireConfigured();
  await assertIsInstructor(instructorId);

  // Path is built server-side from the route's instructorId — the client never
  // chooses where its file lands.
  const path = `${prefixFor(instructorId)}${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BUCKET, path);

  return { uploadUrl, path, type, maxBytes: MAX_BYTES, expiresIn: SIGN_EXPIRES_IN };
}

// ── Confirm ─────────────────────────────────────────────────────────────────────

async function confirmDocumentUpload(instructorId, { path, fileName, type, expiresAt }, adminId) {
  assertPathScoped(instructorId, path);

  const provider = requireConfigured();
  await assertIsInstructor(instructorId);

  // Verify what ACTUALLY landed rather than what the client says it uploaded.
  const info = await provider.statObject(BUCKET, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND"); // upload never completed
  if (info.size != null && info.size > MAX_BYTES) {
    // The object is real but oversized — remove it so a rejected upload cannot
    // sit in the bucket unreferenced.
    await safe(() => provider.removeObject(BUCKET, path), null);
    throw domainError("FILE_TOO_LARGE");
  }
  // Reject only a RECOGNISED wrong type; unknown/octet-stream is left to the
  // bucket's own allowed-mime config (same rule as uploads.service).
  if (info.mimetype && info.mimetype !== "application/octet-stream" && !ALLOWED_MIME.includes(info.mimetype)) {
    await safe(() => provider.removeObject(BUCKET, path), null);
    throw domainError("BAD_FILE_TYPE");
  }

  const doc = await prisma.instructorDocument.create({
    data: {
      instructorId,
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

  await auditLog(adminId, "INSTRUCTOR_DOCUMENT_UPLOADED", {
    instructorId, documentId: doc.id, type, fileName: doc.fileName,
  });

  return mapDocument(doc);
}

// ── Verify / Reject / Archive ───────────────────────────────────────────────────

async function verifyDocument(instructorId, docId, adminId) {
  const current = await assertDocumentOf(instructorId, docId);
  if (current.status === "ARCHIVED") throw domainError("DOCUMENT_ARCHIVED");

  const doc = await prisma.instructorDocument.update({
    where: { id: docId },
    data: {
      status: "VERIFIED",
      verifiedAt: new Date(),
      verifiedById: adminId ?? null,
      // Clear the old refusal — a verified document must not still carry the
      // reason it was once rejected for.
      rejectionReason: null,
    },
  });

  await auditLog(adminId, "INSTRUCTOR_DOCUMENT_VERIFIED", {
    instructorId, documentId: docId, type: doc.type,
  });

  return mapDocument(doc);
}

async function rejectDocument(instructorId, docId, reason, adminId) {
  const current = await assertDocumentOf(instructorId, docId);
  if (current.status === "ARCHIVED") throw domainError("DOCUMENT_ARCHIVED");

  const doc = await prisma.instructorDocument.update({
    where: { id: docId },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      // Provenance of the DECISION, not of an approval — who looked at it and
      // when is exactly what a rejection needs to record too.
      verifiedAt: new Date(),
      verifiedById: adminId ?? null,
    },
  });

  await auditLog(adminId, "INSTRUCTOR_DOCUMENT_REJECTED", {
    instructorId, documentId: docId, type: doc.type, reason,
  });

  return mapDocument(doc);
}

// Soft delete. The file deliberately STAYS in the bucket: this is a compliance
// record, and "an admin rejected my identity document and then erased it" must
// remain answerable. A hard purge is a separate, deliberate operation.
async function archiveDocument(instructorId, docId, adminId) {
  const current = await assertDocumentOf(instructorId, docId);
  if (current.status === "ARCHIVED") return mapDocument(current);

  const doc = await prisma.instructorDocument.update({
    where: { id: docId },
    data: { status: "ARCHIVED" },
  });

  await auditLog(adminId, "INSTRUCTOR_DOCUMENT_ARCHIVED", {
    instructorId, documentId: docId, type: doc.type,
  });

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
