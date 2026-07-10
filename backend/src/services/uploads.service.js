const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { ALLOWED_MIME } = require("../validators/uploads.validator");

// ── Uploads service (sign → direct upload → confirm) ────────────────────────────
//
// The backend only issues signed upload URLs and verifies the result — it never
// streams the file bytes. All storage calls go through the provider adapter
// (./storage) and this service references nothing Supabase-specific, so the
// frontend only ever talks to OUR sign/confirm endpoints (never Supabase by name)
// and swapping providers is confined to the adapter layer.
//
// Both thumbnails (images, → Course.thumbnail) and video (→ Lesson.content of a
// VIDEO_URL lesson) are enabled. Video confirm additionally re-verifies the stored
// object's size/type and binds it to a specific lesson of the course.
//
// TODO(prod): Supabase video hosting is a temporary DEV/MVP solution (no
// transcoding, small size cap, direct public URLs). For production, add a
// Cloudflare Stream provider behind the same ./storage adapter and switch
// STORAGE_PROVIDER — no endpoint, contract, or frontend change required.

const BUCKET = {
  thumbnail: process.env.SUPABASE_THUMBNAIL_BUCKET || "course-thumbnails",
  video:     process.env.SUPABASE_VIDEO_BUCKET || "course-videos",
};

// Video is capped at 50MB while on Supabase (temporary MVP). This MUST stay in
// sync with the Supabase bucket's own max-file-size setting; production video
// moves to Cloudflare Stream where this limit no longer applies. See TODO above.
const MAX_BYTES = { thumbnail: 5 * 1024 * 1024, video: 50 * 1024 * 1024 };

// Advisory expiry we report to the client. (Supabase's own signed-upload token is
// valid ~2h and is not configurable per-call; we surface this shorter budget so
// the UI encourages a prompt upload. Cloudflare will honour it exactly.)
const SIGN_EXPIRES_IN = 600; // seconds (10 min)

function domainError(code) { return Object.assign(new Error(code), { code }); }

function requireConfigured() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  return provider;
}

async function assertCourseExists(courseId) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!c) throw domainError("COURSE_NOT_FOUND");
}

// Keep only a safe basename: strip any directory parts, allow-list characters,
// cap length. Prevents path traversal / weird object keys.
function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.slice(0, 120) || "file";
}

// ── Sign: validate → build a unique path → return a signed upload URL ─────────────

async function signUpload({ fileName, fileType, kind, courseId }) {
  const provider = requireConfigured();
  await assertCourseExists(courseId);

  // Path inside the bucket: <courseId>/<uuid>-<safeName>. The courseId prefix lets
  // us scope deletes and keeps one course's assets grouped together.
  const path = `${courseId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BUCKET[kind], path);

  return {
    uploadUrl,
    path,
    kind,
    maxBytes: MAX_BYTES[kind],
    expiresIn: SIGN_EXPIRES_IN,
  };
}

// ── Confirm: verify the object really exists, then persist its URL ────────────────

async function confirmUpload({ courseId, path, kind, lessonId }) {
  // Same trust boundary as deleteUpload: the client-supplied path must be a
  // clean relative key scoped to THIS course's prefix.
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw domainError("BAD_PATH");
  }
  if (!path.startsWith(`${courseId}/`) || path.length <= courseId.length + 1) {
    throw domainError("BAD_PATH");
  }
  // Video must name the lesson it belongs to — fail fast before touching storage.
  if (kind === "video" && !lessonId) throw domainError("LESSON_ID_REQUIRED");

  const provider = requireConfigured();
  await assertCourseExists(courseId);

  const bucket = BUCKET[kind];
  const info = await provider.statObject(bucket, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND"); // upload never completed

  const url = provider.getPublicUrl(bucket, path);

  if (kind === "thumbnail") {
    await prisma.course.update({ where: { id: courseId }, data: { thumbnail: url } });
    return { url };
  }

  // ── kind === "video": re-verify the real object, then bind it to the lesson ──
  // Never trust the client's fileType/size claims — check what actually landed.
  if (info.size != null && info.size > MAX_BYTES.video) throw domainError("FILE_TOO_LARGE");
  // Reject only a *recognised* wrong type; unknown/octet-stream is left to the
  // bucket's own allowed-mime config (the primary gate on upload).
  if (
    info.mimetype &&
    info.mimetype !== "application/octet-stream" &&
    !ALLOWED_MIME.video.includes(info.mimetype)
  ) {
    throw domainError("BAD_FILE_TYPE");
  }

  // A Lesson belongs to a Course only through its section, so join to check
  // ownership — there is no lesson.courseId column.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true, section: { select: { courseId: true } } },
  });
  if (!lesson) throw domainError("LESSON_NOT_FOUND");
  if (lesson.section.courseId !== courseId) throw domainError("LESSON_COURSE_MISMATCH");
  if (lesson.type !== "VIDEO_URL") throw domainError("LESSON_NOT_VIDEO");

  await prisma.lesson.update({ where: { id: lessonId }, data: { content: url } });
  return { url };
}

// ── Delete: remove an orphaned/replaced object (path must be scoped) ──────────────

async function deleteUpload({ path, kind = "thumbnail" }) {
  // Security: the path is client-supplied, so scope it hard BEFORE doing anything.
  // Expected shape: "<courseId>/<filename>" — no traversal, no absolute paths, and
  // the courseId prefix must be a real course (can't touch other buckets/objects).
  // A malformed path is a client error (400), checked ahead of storage config (503).
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw domainError("BAD_PATH");
  }
  const [courseId, ...rest] = path.split("/");
  if (!courseId || rest.length === 0 || rest.join("/").length === 0) {
    throw domainError("BAD_PATH");
  }

  const provider = requireConfigured();
  await assertCourseExists(courseId); // 404 if the prefix isn't a real course

  // Delete from the bucket matching `kind` (defaults to thumbnail for backward
  // compatibility with callers that omit it). BUCKET is keyed by kind, so no
  // provider-specific branching here.
  const bucket = BUCKET[kind] || BUCKET.thumbnail;
  await provider.removeObject(bucket, path);
  return { deleted: true, path, kind };
}

module.exports = { signUpload, confirmUpload, deleteUpload };
