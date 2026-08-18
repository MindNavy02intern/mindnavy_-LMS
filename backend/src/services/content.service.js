const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { typeForMime } = require("../validators/content.validator");

// ── Content Library service (sign → direct upload → confirm, + metadata CRUD) ───
//
// Built on the EXISTING CourseContent model — the table that owns the LM
// content-stats tiles (one table, one owner — IMPACT_MAP B2). Library items have
// courseId = null; course-scoped items keep their courseId. Legacy seed rows
// have no file (fileUrl/filePath null) — every read and delete tolerates that.
//
// Upload flow mirrors uploads.service (the backend never streams file bytes):
// sign issues a signed URL into the library bucket, the client PUTs directly,
// confirm re-verifies what actually landed (existence, size, MIME — never the
// client's claims) and only then creates the DB row.

const BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || "content-library";

// Same Supabase MVP cap story as course videos: this MUST stay in sync with the
// bucket's own max-file-size setting. Bigger files come with the Cloudflare move.
const MAX_BYTES = 50 * 1024 * 1024;

const SIGN_EXPIRES_IN = 600; // advisory, seconds — same budget as uploads.service

// All library objects live under one prefix, so a client-supplied path can never
// point at another bucket area (thumbnails/videos use per-course prefixes).
const PATH_PREFIX = "library/";

function domainError(code) { return Object.assign(new Error(code), { code }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[content.service] query failed:", err.message);
    return fallback;
  }
}

function requireConfigured() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  return provider;
}

// Keep only a safe basename (same rules as uploads.service): no directories,
// allow-listed characters, capped length.
function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

// Client-supplied paths are only ever accepted inside the library prefix.
function assertLibraryPath(path) {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) throw domainError("BAD_PATH");
  if (!path.startsWith(PATH_PREFIX) || path.length <= PATH_PREFIX.length) throw domainError("BAD_PATH");
}

const EXT_TO_TYPE = {
  pdf: "PDF",
  doc: "DOCUMENT", docx: "DOCUMENT", ppt: "DOCUMENT", pptx: "DOCUMENT",
  xls: "DOCUMENT", xlsx: "DOCUMENT", txt: "DOCUMENT",
  mp4: "VIDEO", webm: "VIDEO", mov: "VIDEO",
  mp3: "AUDIO", m4a: "AUDIO", wav: "AUDIO", ogg: "AUDIO",
  jpg: "IMAGE", jpeg: "IMAGE", png: "IMAGE", gif: "IMAGE", webp: "IMAGE",
};

// Type from what storage recorded; extension is the fallback for providers that
// report application/octet-stream. Unrecognizable uploads are rejected.
function deriveType(mimetype, path) {
  const byMime = typeForMime(mimetype);
  if (byMime) return byMime;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? null;
}

// "library/<uuid>-Quarterly_Report.pdf" → "Quarterly_Report.pdf"
function titleFromPath(path) {
  const base = path.slice(PATH_PREFIX.length);
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") || base;
}

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

const CONTENT_SELECT = {
  id: true, courseId: true, title: true, type: true,
  fileUrl: true, filePath: true, sizeBytes: true, mimeType: true,
  tags: true, uploadedBy: true, createdAt: true, updatedAt: true,
  course: { select: { title: true } },
  _count: { select: { usages: true } },
};

function mapItem(i) {
  return {
    id:          i.id,
    title:       i.title,
    type:        i.type,
    courseId:    i.courseId ?? null,
    courseTitle: i.course?.title ?? null,
    fileUrl:     i.fileUrl ?? null,
    sizeBytes:   i.sizeBytes ?? null,
    mimeType:    i.mimeType ?? null,
    tags:        i.tags ?? [],
    uploadedBy:  i.uploadedBy ?? null,
    // Reuse count (CourseContentUsage rows) — separate from courseId, which is
    // this item's own originating course, not a "usage".
    courseUsageCount: i._count?.usages ?? 0,
    createdAt:   iso(i.createdAt),
    updatedAt:   iso(i.updatedAt),
  };
}

// Best-effort audit — never breaks the primary write.
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function getItemOrThrow(id) {
  const item = await prisma.courseContent.findUnique({ where: { id }, select: { id: true, title: true, filePath: true } });
  if (!item) throw domainError("CONTENT_NOT_FOUND");
  return item;
}

async function assertCourseExists(courseId) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!c) throw domainError("COURSE_NOT_FOUND");
}

// ── List (search / filter / paginate + type counts for the tiles) ───────────────

async function listContent({ search, type, tag, courseId, page, limit } = {}) {
  const baseWhere = {
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(courseId ? { courseId } : {}),
  };
  const where = { ...baseWhere, ...(type ? { type } : {}) };

  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows, typeGroups] = await Promise.all([
    safe(() => prisma.courseContent.count({ where }), 0),
    safe(() => prisma.courseContent.findMany({
      where, skip, take, orderBy: { createdAt: "desc" }, select: CONTENT_SELECT,
    }), []),
    // Type chips share every filter EXCEPT type (same pattern as courses tabs).
    safe(() => prisma.courseContent.groupBy({ by: ["type"], where: baseWhere, _count: { _all: true } }), []),
  ]);

  const typeCounts = { All: 0 };
  for (const g of typeGroups) {
    typeCounts[g.type] = g._count._all;
    typeCounts.All += g._count._all;
  }

  return {
    content: rows.map(mapItem),
    pagination: buildPagination(total, p, l),
    typeCounts,
  };
}

// ── Sign: validate → unique library path → signed upload URL ────────────────────

async function signUpload({ fileName, type }) {
  const provider = requireConfigured();
  const path = `${PATH_PREFIX}${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BUCKET, path);

  return { uploadUrl, path, type, maxBytes: MAX_BYTES, expiresIn: SIGN_EXPIRES_IN };
}

// ── Confirm: verify what actually landed, then create the row ───────────────────

async function confirmUpload({ path, title, tags, courseId }, adminId) {
  assertLibraryPath(path);
  const provider = requireConfigured();
  if (courseId) await assertCourseExists(courseId);

  const info = await provider.statObject(BUCKET, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND"); // upload never completed
  if (info.size != null && info.size > MAX_BYTES) throw domainError("FILE_TOO_LARGE");

  const type = deriveType(info.mimetype, path);
  if (!type) throw domainError("BAD_FILE_TYPE");

  const item = await prisma.courseContent.create({
    data: {
      title: title || titleFromPath(path),
      type,
      courseId: courseId ?? null,
      fileUrl: provider.getPublicUrl(BUCKET, path),
      filePath: path,
      sizeBytes: info.size,
      mimeType: info.mimetype,
      tags,
      uploadedBy: adminId ?? null,
    },
    select: CONTENT_SELECT,
  });

  await auditLog(adminId, "CONTENT_CREATED", { contentId: item.id, title: item.title, type, sizeBytes: info.size });
  return mapItem(item);
}

// ── Metadata update ─────────────────────────────────────────────────────────────

async function updateContent(id, data, adminId) {
  await getItemOrThrow(id);
  if (data.courseId) await assertCourseExists(data.courseId);

  const item = await prisma.courseContent.update({ where: { id }, data, select: CONTENT_SELECT });
  await auditLog(adminId, "CONTENT_UPDATED", { contentId: id, fields: Object.keys(data) });
  return mapItem(item);
}

// ── Delete (row first, then the storage object best-effort) ─────────────────────

async function deleteContent(id, adminId) {
  const item = await getItemOrThrow(id);

  await prisma.courseContent.delete({ where: { id } });

  // Legacy rows have no file; a storage failure is an orphan to log, never a 500.
  if (item.filePath) {
    const provider = getProvider();
    if (provider.isConfigured()) {
      await provider.removeObject(BUCKET, item.filePath).catch((err) =>
        console.error("[content] failed to delete storage object", item.filePath, "-", err.message));
    }
  }

  await auditLog(adminId, "CONTENT_DELETED", { contentId: id, title: item.title });
  return { id };
}

// ── Course reuse (CourseContentUsage) ────────────────────────────────────────
// Additive alongside courseId (the item's own originating course) — this is
// every OTHER course that has also linked the item. See the schema comment.

async function listContentCourses(id) {
  await getItemOrThrow(id);
  const rows = await safe(() => prisma.courseContentUsage.findMany({
    where: { contentId: id },
    orderBy: { addedAt: "desc" },
    select: { id: true, courseId: true, addedAt: true, course: { select: { title: true, status: true } } },
  }), []);
  return rows.map((r) => ({
    usageId:      r.id,
    courseId:     r.courseId,
    courseTitle:  r.course?.title ?? null,
    courseStatus: r.course?.status ?? null,
    addedAt:      iso(r.addedAt),
  }));
}

async function linkContentToCourse(id, courseId, adminId) {
  await getItemOrThrow(id);
  await assertCourseExists(courseId);

  let usage;
  try {
    usage = await prisma.courseContentUsage.create({ data: { contentId: id, courseId } });
  } catch (err) {
    if (err.code === "P2002") throw domainError("ALREADY_LINKED");
    throw err;
  }

  await auditLog(adminId, "CONTENT_LINKED_TO_COURSE", { contentId: id, courseId });
  return { usageId: usage.id, courseId, addedAt: iso(usage.addedAt) };
}

async function unlinkContentFromCourse(id, courseId, adminId) {
  const usage = await prisma.courseContentUsage.findUnique({
    where: { contentId_courseId: { contentId: id, courseId } },
  });
  if (!usage) throw domainError("USAGE_NOT_FOUND");

  await prisma.courseContentUsage.delete({ where: { id: usage.id } });
  await auditLog(adminId, "CONTENT_UNLINKED_FROM_COURSE", { contentId: id, courseId });
  return { id: usage.id };
}

module.exports = {
  listContent,
  signUpload,
  confirmUpload,
  updateContent,
  deleteContent,
  listContentCourses,
  linkContentToCourse,
  unlinkContentFromCourse,
};
