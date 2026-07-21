// Validation for the Content Library API (/api/admin/content).
// Same conventions as uploads.validator + quizzes.validator: request shape only —
// storage existence, ownership and size re-checks live in the service.
//
// v1 uploadable types: VIDEO, DOCUMENT, PDF, AUDIO, IMAGE. QUIZ rows stay owned
// by the quiz flow and SCORM upload is v2 — both are rejected here (they remain
// valid FILTER values so legacy rows stay browsable).

const UPLOADABLE_TYPES = ["VIDEO", "DOCUMENT", "PDF", "AUDIO", "IMAGE"];
const ALL_TYPES = [...UPLOADABLE_TYPES, "QUIZ", "SCORM"];

// MIME → ContentType. The service re-derives the type from what storage actually
// recorded on confirm — the client's claim only gates the sign step.
const MIME_TO_TYPE = {
  "application/pdf": "PDF",

  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
  "application/vnd.ms-powerpoint": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "DOCUMENT",
  "application/vnd.ms-excel": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "DOCUMENT",
  "text/plain": "DOCUMENT",

  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",

  "audio/mpeg": "AUDIO",
  "audio/mp4": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/ogg": "AUDIO",

  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
};

const MAX = { fileName: 300, path: 500, title: 200, search: 200, tag: 50, tags: 20 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validateId(id, label = "id") {
  if (!isNonEmptyString(id)) return `${label} is required.`;
  return null;
}

function typeForMime(mime) {
  return MIME_TO_TYPE[String(mime || "").toLowerCase()] ?? null;
}

// Trimmed, bounded, deduped tag list. `[]` is valid (clears all tags).
function readTags(value, errors) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { errors.push("tags must be an array of strings."); return undefined; }
  if (value.length > MAX.tags) { errors.push(`tags must have at most ${MAX.tags} entries.`); return undefined; }
  const seen = new Set();
  for (const t of value) {
    const s = typeof t === "string" ? t.trim() : "";
    if (!s) { errors.push("every tag must be a non-empty string."); return undefined; }
    if (s.length > MAX.tag) { errors.push(`each tag must be at most ${MAX.tag} characters.`); return undefined; }
    seen.add(s.toLowerCase());
  }
  return [...seen];
}

function readTitle(value, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push("title is required.");
    return undefined;
  }
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) { errors.push("title cannot be empty."); return undefined; }
  if (t.length > MAX.title) { errors.push(`title must be at most ${MAX.title} characters.`); return undefined; }
  return t;
}

function readCourseId(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null; // null = library-wide item / detach
  if (!isNonEmptyString(value)) { errors.push("courseId must be a non-empty string or null."); return undefined; }
  return value.trim();
}

// ── Sign / Confirm ──────────────────────────────────────────────────────────────

function validateSign(body = {}) {
  const errors = [];

  const fileName = isNonEmptyString(body.fileName) ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > MAX.fileName) errors.push(`fileName must be at most ${MAX.fileName} characters.`);

  const fileType = isNonEmptyString(body.fileType) ? body.fileType.trim().toLowerCase() : "";
  let type = null;
  if (!fileType) errors.push("fileType is required.");
  else {
    type = typeForMime(fileType);
    if (!type) errors.push(`fileType "${fileType}" is not allowed. Allowed: ${Object.keys(MIME_TO_TYPE).join(", ")}.`);
  }

  return { isValid: errors.length === 0, errors, data: { fileName, fileType, type } };
}

function validateConfirm(body = {}) {
  const errors = [];

  const path = isNonEmptyString(body.path) ? body.path.trim() : "";
  if (!path) errors.push("path is required.");
  else if (path.length > MAX.path) errors.push(`path must be at most ${MAX.path} characters.`);

  const title = readTitle(body.title, errors); // optional — service defaults to the file name
  const tags = readTags(body.tags, errors);
  const courseId = readCourseId(body.courseId, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      path,
      title: title !== undefined ? title : null,
      tags: tags !== undefined ? tags : [],
      courseId: courseId !== undefined ? courseId : null,
    },
  };
}

// ── Update (metadata only — the file itself is immutable) ───────────────────────

function validateUpdate(body = {}) {
  const errors = [];
  const data = {};

  const title = readTitle(body.title, errors);
  if (title !== undefined) data.title = title;

  const tags = readTags(body.tags, errors);
  if (tags !== undefined) data.tags = tags;

  const courseId = readCourseId(body.courseId, errors);
  if (courseId !== undefined) data.courseId = courseId;

  for (const key of ["fileUrl", "filePath", "sizeBytes", "mimeType", "type", "uploadedBy"]) {
    if (body[key] !== undefined) errors.push(`${key} is server-managed and cannot be set.`);
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── List query ──────────────────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];
  const data = {};

  if (query.search !== undefined) {
    const s = String(query.search).trim();
    if (s.length > MAX.search) errors.push(`search must be at most ${MAX.search} characters.`);
    else if (s) data.search = s;
  }

  if (query.type !== undefined) {
    const t = String(query.type).trim().toUpperCase();
    if (!ALL_TYPES.includes(t)) errors.push(`type must be one of: ${ALL_TYPES.join(", ")}.`);
    else data.type = t;
  }

  if (query.tag !== undefined) {
    const t = String(query.tag).trim().toLowerCase();
    if (!t || t.length > MAX.tag) errors.push(`tag must be 1–${MAX.tag} characters.`);
    else data.tag = t;
  }

  if (query.courseId !== undefined) {
    if (!isNonEmptyString(query.courseId)) errors.push("courseId must be a non-empty string.");
    else data.courseId = query.courseId.trim();
  }

  data.page = query.page;
  data.limit = query.limit;

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateId,
  validateSign,
  validateConfirm,
  validateUpdate,
  validateListQuery,
  typeForMime,
  UPLOADABLE_TYPES,
  ALL_TYPES,
  MIME_TO_TYPE,
};
