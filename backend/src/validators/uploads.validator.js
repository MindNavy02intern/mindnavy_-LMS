// Validation for the Uploads API (/api/admin/uploads).
// Supports "thumbnail" (image → Course.thumbnail) and "video" (→ Lesson.content).
// Video confirm requires a lessonId; the service re-verifies the stored object and
// binds it to that lesson. This validator only checks request shape — ownership and
// storage existence are enforced in the service.

const KINDS = ["thumbnail", "video"];

// Allow-list of mime types per kind. The service ALSO caps size, and confirm
// re-checks the object actually exists — never trust the client's claims alone.
const ALLOWED_MIME = {
  thumbnail: ["image/jpeg", "image/png", "image/webp"],
  video:     ["video/mp4", "video/webm", "video/quicktime"],
};

const MAX = { fileName: 300, path: 500 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function readKind(value, errors) {
  if (!isNonEmptyString(value)) { errors.push("kind is required."); return null; }
  const k = value.trim().toLowerCase();
  if (!KINDS.includes(k)) { errors.push('kind must be "thumbnail" or "video".'); return null; }
  return k;
}

function validateSign(body = {}) {
  const errors = [];

  const fileName = isNonEmptyString(body.fileName) ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > MAX.fileName) errors.push(`fileName must be at most ${MAX.fileName} characters.`);

  const fileType = isNonEmptyString(body.fileType) ? body.fileType.trim().toLowerCase() : "";
  if (!fileType) errors.push("fileType is required.");

  const courseId = isNonEmptyString(body.courseId) ? body.courseId.trim() : "";
  if (!courseId) errors.push("courseId is required.");

  const kind = readKind(body.kind, errors);

  // Only check mime against the list once we know the kind.
  if (kind && fileType && !ALLOWED_MIME[kind].includes(fileType)) {
    errors.push(`fileType "${fileType}" is not allowed for ${kind}. Allowed: ${ALLOWED_MIME[kind].join(", ")}.`);
  }

  return { isValid: errors.length === 0, errors, data: { fileName, fileType, courseId, kind } };
}

function validateConfirm(body = {}) {
  const errors = [];

  const courseId = isNonEmptyString(body.courseId) ? body.courseId.trim() : "";
  if (!courseId) errors.push("courseId is required.");

  const path = isNonEmptyString(body.path) ? body.path.trim() : "";
  if (!path) errors.push("path is required.");
  else if (path.length > MAX.path) errors.push(`path must be at most ${MAX.path} characters.`);

  const kind = readKind(body.kind, errors);

  const lessonId = body.lessonId === undefined || body.lessonId === null
    ? null
    : (isNonEmptyString(body.lessonId) ? body.lessonId.trim() : "");
  if (lessonId === "") errors.push("lessonId must be a non-empty string when provided.");
  else if (kind === "video" && !lessonId) errors.push("lessonId is required for video uploads.");

  return { isValid: errors.length === 0, errors, data: { courseId, path, kind, lessonId } };
}

function validateDelete(query = {}) {
  const errors = [];
  const path = isNonEmptyString(query.path) ? query.path.trim() : "";
  if (!path) errors.push("path query param is required.");
  else if (path.length > MAX.path) errors.push(`path must be at most ${MAX.path} characters.`);

  // kind is optional here (default "thumbnail") so existing thumbnail-only callers
  // keep working; pass ?kind=video to delete from the video bucket.
  let kind = "thumbnail";
  if (isNonEmptyString(query.kind)) {
    const k = query.kind.trim().toLowerCase();
    if (!KINDS.includes(k)) errors.push('kind must be "thumbnail" or "video".');
    else kind = k;
  }

  return { isValid: errors.length === 0, errors, data: { path, kind } };
}

module.exports = {
  KINDS,
  ALLOWED_MIME,
  validateSign,
  validateConfirm,
  validateDelete,
};
