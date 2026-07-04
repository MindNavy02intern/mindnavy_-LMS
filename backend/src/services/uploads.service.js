const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getProvider } = require("./storage");

// ── Uploads service (sign → direct upload → confirm) ────────────────────────────
//
// The backend only issues signed upload URLs and verifies the result — it never
// streams the file bytes. All storage calls go through the provider adapter
// (./storage), so moving video to Cloudflare Stream later touches only that layer.
//
// Phase 1: thumbnails (images) are fully enabled. Video is intentionally deferred
// to Cloudflare Stream (transcoding + large tus uploads); asking to sign a video
// returns a clean "coming soon" 400 rather than half-building a throwaway pipeline.

const BUCKET = {
  thumbnail: process.env.SUPABASE_THUMBNAIL_BUCKET || "course-thumbnails",
  video:     process.env.SUPABASE_VIDEO_BUCKET || "course-videos",
};

const MAX_BYTES = { thumbnail: 5 * 1024 * 1024, video: 2 * 1024 * 1024 * 1024 };

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
  if (kind === "video") {
    // Phase 1 guard — see header note.
    throw domainError("VIDEO_UPLOAD_NOT_ENABLED");
  }
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
  if (kind === "video") {
    throw domainError("VIDEO_UPLOAD_NOT_ENABLED");
  }
  const provider = requireConfigured();
  await assertCourseExists(courseId);

  const bucket = BUCKET[kind];
  const exists = await provider.objectExists(bucket, path);
  if (!exists) throw domainError("OBJECT_NOT_FOUND"); // upload never completed

  const url = provider.getPublicUrl(bucket, path);

  if (kind === "thumbnail") {
    await prisma.course.update({ where: { id: courseId }, data: { thumbnail: url } });
  }

  return { url };
}

// ── Delete: remove an orphaned/replaced object (path must be scoped) ──────────────

async function deleteUpload({ path }) {
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

  // Phase 1 only manages thumbnails, so the delete targets the thumbnail bucket.
  await provider.removeObject(BUCKET.thumbnail, path);
  return { deleted: true, path };
}

module.exports = { signUpload, confirmUpload, deleteUpload };
