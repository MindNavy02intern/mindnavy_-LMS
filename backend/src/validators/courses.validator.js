// Validation for the Courses tab API (/api/admin/courses).
// Mirrors accessPolicies.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here so the service only
// ever receives safe, bounded values.

const LEVELS        = ["Beginner", "Intermediate", "Advanced"];
const STATUSES      = ["Draft", "Pending", "Published", "Archived"];
const LIST_STATUSES = ["All", ...STATUSES];

const MAX = { title: 200, subtitle: 300, description: 5000, category: 100, language: 50, url: 2000, tag: 40, tags: 20 };

// Return the canonically-cased value matching case-insensitively, or null.
function canon(list, value) {
  const lower = String(value).toLowerCase();
  return list.find((v) => v.toLowerCase() === lower) ?? null;
}

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// Optional string with a max length. Returns: undefined (absent/invalid),
// null (explicit null / empty), or the trimmed value.
function optStr(body, key, max, errors) {
  if (body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "string") { errors.push(`${key} must be a string.`); return undefined; }
  const v = body[key].trim();
  if (v.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return v || null;
}

function validateTags(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) { errors.push("tags must be an array of strings."); return undefined; }
  if (value.length > MAX.tags) { errors.push(`tags must have at most ${MAX.tags} items.`); return undefined; }
  const out = [];
  for (const t of value) {
    if (typeof t !== "string") { errors.push("each tag must be a string."); return undefined; }
    const v = t.trim();
    if (!v) continue;
    if (v.length > MAX.tag) { errors.push(`each tag must be at most ${MAX.tag} characters.`); return undefined; }
    out.push(v);
  }
  return out;
}

function validateListQuery(q = {}) {
  const errors = [];

  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;

  let status = "All";
  if (q.status !== undefined && q.status !== null && String(q.status).trim() !== "") {
    const c = canon(LIST_STATUSES, q.status);
    if (!c) errors.push("status must be one of All, Draft, Pending, Published, Archived.");
    else status = c;
  }

  const category   = typeof q.category   === "string" && q.category.trim()   ? q.category.trim()   : null;
  const instructor = typeof q.instructor === "string" && q.instructor.trim() ? q.instructor.trim() : null;
  const search     = typeof q.search     === "string" ? q.search.trim() : "";

  return { isValid: errors.length === 0, errors, data: { page, limit, status, category, instructor, search } };
}

function validateCreate(body = {}) {
  const errors = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("title is required.");
  else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);

  const instructorId = typeof body.instructorId === "string" ? body.instructorId.trim() : "";
  if (!instructorId) errors.push("instructorId is required.");

  const subtitle    = optStr(body, "subtitle", MAX.subtitle, errors);
  const description = optStr(body, "description", MAX.description, errors);
  const category    = optStr(body, "category", MAX.category, errors);
  const language    = optStr(body, "language", MAX.language, errors);
  const thumbnail   = optStr(body, "thumbnail", MAX.url, errors);

  let level = "Beginner";
  if (body.level !== undefined && body.level !== null && String(body.level).trim() !== "") {
    const c = canon(LEVELS, body.level);
    if (!c) errors.push("level must be Beginner, Intermediate, or Advanced.");
    else level = c;
  }

  const tags = validateTags(body.tags, errors);

  // `status` is intentionally NOT read — a course is always created as Draft.

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title,
      instructorId,
      subtitle:    subtitle    ?? null,
      description: description  ?? null,
      category:    category     ?? null,
      language:    language     ?? null,
      thumbnail:   thumbnail    ?? null,
      level,
      tags:        tags ?? [],
    },
  };
}

function validateUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) errors.push("title cannot be empty.");
    else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);
    else data.title = title;
  }

  if (body.instructorId !== undefined) {
    const id = typeof body.instructorId === "string" ? body.instructorId.trim() : "";
    if (!id) errors.push("instructorId cannot be empty.");
    else data.instructorId = id;
  }

  const CAPS = { subtitle: MAX.subtitle, description: MAX.description, category: MAX.category, language: MAX.language, thumbnail: MAX.url };
  for (const key of Object.keys(CAPS)) {
    const v = optStr(body, key, CAPS[key], errors);
    if (v !== undefined) data[key] = v;
  }

  if (body.level !== undefined) {
    const c = canon(LEVELS, body.level);
    if (!c) errors.push("level must be Beginner, Intermediate, or Advanced.");
    else data.level = c;
  }

  if (body.status !== undefined) {
    const c = canon(STATUSES, body.status);
    if (!c) errors.push("status must be Draft, Pending, Published, or Archived.");
    else data.status = c;
  }

  if (body.tags !== undefined) {
    const t = validateTags(body.tags, errors);
    if (t !== undefined) data.tags = t;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = { validateId, validateListQuery, validateCreate, validateUpdate };
