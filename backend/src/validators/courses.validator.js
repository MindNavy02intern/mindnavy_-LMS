// Validation for the Courses tab API (/api/admin/courses).
// Mirrors accessPolicies.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here so the service only
// ever receives safe, bounded values.

const LEVELS        = ["Beginner", "Intermediate", "Advanced"];
const STATUSES      = ["Draft", "Pending", "Published", "Archived"];
// "Rejected" is a LIST filter only, never a writable status: CourseStatus has no
// REJECTED member (a rejected course is a DRAFT carrying a rejectionReason). It
// belongs here and not in STATUSES so no write path can ever accept it.
const LIST_STATUSES = ["All", ...STATUSES, "Rejected"];
const VISIBILITIES  = ["Public", "Private", "Unlisted"];

const MAX = {
  title: 200, subtitle: 300, description: 5000, category: 100, language: 50,
  url: 2000, tag: 40, tags: 20,
  seoTitle: 70, seoDescription: 200, reason: 1000,
  price: 100_000_000,            // cents — $1M cap
  enrollmentLimit: 1_000_000,
  ruleIds: 50, ruleId: 64,       // accessRules id arrays
};

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
    if (!c) errors.push(`status must be one of ${LIST_STATUSES.join(", ")}.`);
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

  // Optional link to the Category table (existence checked in the service).
  const categoryId = optStr(body, "categoryId", MAX.ruleId, errors);

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
      // Absent stays undefined (lets the service auto-link by category name);
      // explicit null means "no link".
      categoryId,
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

  // `status` is intentionally NOT read — transitions happen only through the
  // dedicated endpoints (submit / approve / reject / archive), never raw PATCH.
  if (body.status !== undefined) {
    errors.push("status cannot be set here — use submit/approve/reject (or DELETE to archive).");
  }

  if (body.tags !== undefined) {
    const t = validateTags(body.tags, errors);
    if (t !== undefined) data.tags = t;
  }

  if (body.categoryId !== undefined) {
    const v = optStr(body, "categoryId", MAX.ruleId, errors);
    if (v !== undefined) data.categoryId = v; // null unlinks
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Wizard Step 4 settings (PATCH /courses/:id/settings) ────────────────────────
// These fields are owned ONLY by the settings endpoint (never the generic PATCH).
// Everything is allow-listed: unknown accessRules keys are a hard 400, numbers are
// bounded integers, booleans must be real booleans.

function optBool(body, key, errors) {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return body[key];
}

// Optional positive bounded integer; null clears the value.
function optInt(body, key, max, errors) {
  if (body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (!Number.isInteger(body[key]) || body[key] < 1 || body[key] > max) {
    errors.push(`${key} must be an integer between 1 and ${max}.`);
    return undefined;
  }
  return body[key];
}

function validateIdArray(value, key, errors) {
  if (!Array.isArray(value)) { errors.push(`accessRules.${key} must be an array of id strings.`); return undefined; }
  if (value.length > MAX.ruleIds) { errors.push(`accessRules.${key} must have at most ${MAX.ruleIds} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.trim() || v.length > MAX.ruleId) {
      errors.push(`accessRules.${key} must contain non-empty id strings (max ${MAX.ruleId} chars).`);
      return undefined;
    }
    out.push(v.trim());
  }
  return out;
}

// v1 accessRules shape — every key optional, unknown keys rejected.
function validateAccessRules(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push("accessRules must be an object or null.");
    return undefined;
  }

  const out = {};
  for (const key of Object.keys(value)) {
    if (key === "requiresEnrollment") {
      if (typeof value[key] !== "boolean") { errors.push("accessRules.requiresEnrollment must be a boolean."); return undefined; }
      out[key] = value[key];
    } else if (key === "startDate" || key === "endDate") {
      if (typeof value[key] !== "string" || Number.isNaN(Date.parse(value[key]))) {
        errors.push(`accessRules.${key} must be an ISO 8601 date string.`);
        return undefined;
      }
      out[key] = value[key];
    } else if (key === "allowedGroupIds" || key === "prerequisiteCourseIds") {
      const arr = validateIdArray(value[key], key, errors);
      if (arr === undefined) return undefined;
      out[key] = arr;
    } else {
      errors.push(`accessRules contains unknown key "${key}".`);
      return undefined;
    }
  }
  return out;
}

function validateSettings(body = {}) {
  const errors = [];
  const data = {};

  const isFree = optBool(body, "isFree", errors);
  if (isFree !== undefined) data.isFree = isFree;

  const price = optInt(body, "price", MAX.price, errors);
  if (price !== undefined) data.price = price;

  if (body.currency !== undefined) {
    if (body.currency === null) data.currency = null;
    else if (typeof body.currency !== "string" || !/^[A-Za-z]{3}$/.test(body.currency.trim())) {
      errors.push("currency must be a 3-letter ISO code (e.g. USD).");
    } else data.currency = body.currency.trim().toUpperCase();
  }

  const enrollmentLimit = optInt(body, "enrollmentLimit", MAX.enrollmentLimit, errors);
  if (enrollmentLimit !== undefined) data.enrollmentLimit = enrollmentLimit;

  if (body.visibility !== undefined) {
    const c = canon(VISIBILITIES, body.visibility);
    if (!c) errors.push("visibility must be Public, Private, or Unlisted.");
    else data.visibility = c;
  }

  for (const key of ["certificateEnabled", "dripContentEnabled"]) {
    const v = optBool(body, key, errors);
    if (v !== undefined) data[key] = v;
  }

  const accessRules = validateAccessRules(body.accessRules, errors);
  if (accessRules !== undefined) data.accessRules = accessRules;

  const seoTitle = optStr(body, "seoTitle", MAX.seoTitle, errors);
  if (seoTitle !== undefined) data.seoTitle = seoTitle;
  const seoDescription = optStr(body, "seoDescription", MAX.seoDescription, errors);
  if (seoDescription !== undefined) data.seoDescription = seoDescription;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid settings fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Reject reason (POST /courses/:id/reject) ────────────────────────────────────

function validateRejectReason(body = {}) {
  const errors = [];
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) errors.push("reason is required.");
  else if (reason.length > MAX.reason) errors.push(`reason must be at most ${MAX.reason} characters.`);
  return { isValid: errors.length === 0, errors, data: { reason } };
}

module.exports = {
  validateId,
  validateListQuery,
  validateCreate,
  validateUpdate,
  validateSettings,
  validateRejectReason,
};
