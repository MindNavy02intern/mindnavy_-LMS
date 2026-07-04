// Validation for the Course Builder API (sections + lessons + reorder).
// Mirrors courses.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here so the service only
// ever receives safe, bounded values. Cross-field checks that need the DB (e.g.
// a lesson's *effective* type on PATCH) are done in the service, not here.

const LESSON_TYPES = ["TEXT", "VIDEO_URL"];

const MAX = {
  title:    200,
  content:  20000, // TEXT body — well under the 50kb express.json limit
  url:      2000,
  duration: 100000, // minutes (~69 days) — a generous sanity cap
  bulk:     1000, // max items per reorder array
  order:    1000000,
};

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// Accept only http/https URLs (WHATWG parser). Used for VIDEO_URL lessons.
function isValidUrl(s) {
  if (typeof s !== "string") return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Optional non-negative integer (order, durationMin). Returns undefined (absent),
// null (explicit null → clears the value), or the parsed int. Pushes on invalid.
function optInt(body, key, max, errors) {
  if (body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  const n = Number(body[key]);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    errors.push(`${key} must be an integer between 0 and ${max}.`);
    return undefined;
  }
  return n;
}

// ── Sections ─────────────────────────────────────────────────────────────────────

function validateSectionCreate(body = {}) {
  const errors = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("title is required.");
  else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);

  const order = optInt(body, "order", MAX.order, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: { title, ...(order !== undefined && order !== null ? { order } : {}) },
  };
}

function validateSectionUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) errors.push("title cannot be empty.");
    else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);
    else data.title = title;
  }

  const order = optInt(body, "order", MAX.order, errors);
  if (order !== undefined && order !== null) data.order = order;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Lessons ──────────────────────────────────────────────────────────────────────

// Shared type + content rule. On create both are present so we fully validate the
// URL here. `type` is required on create, optional on update.
function readType(value, errors, { required }) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) errors.push("type is required.");
    return undefined;
  }
  const upper = String(value).trim().toUpperCase();
  if (!LESSON_TYPES.includes(upper)) {
    errors.push("type must be TEXT or VIDEO_URL.");
    return undefined;
  }
  return upper;
}

function validateLessonCreate(body = {}) {
  const errors = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("title is required.");
  else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);

  const type = readType(body.type, errors, { required: true });

  // content: TEXT → body (optional, capped); VIDEO_URL → required valid URL.
  let content = null;
  const rawContent = body.content;
  if (rawContent !== undefined && rawContent !== null) {
    if (typeof rawContent !== "string") errors.push("content must be a string.");
    else content = rawContent.trim();
  }

  if (type === "VIDEO_URL") {
    if (!content) errors.push("content (video URL) is required for a VIDEO_URL lesson.");
    else if (!isValidUrl(content)) errors.push("content must be a valid http(s) URL for a VIDEO_URL lesson.");
    else if (content.length > MAX.url) errors.push(`video URL must be at most ${MAX.url} characters.`);
  } else if (type === "TEXT" && content && content.length > MAX.content) {
    errors.push(`content must be at most ${MAX.content} characters.`);
  }

  const durationMin = optInt(body, "durationMin", MAX.duration, errors);
  const order = optInt(body, "order", MAX.order, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title,
      type,
      content: content || null,
      ...(durationMin !== undefined ? { durationMin } : {}),
      ...(order !== undefined && order !== null ? { order } : {}),
    },
  };
}

function validateLessonUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) errors.push("title cannot be empty.");
    else if (title.length > MAX.title) errors.push(`title must be at most ${MAX.title} characters.`);
    else data.title = title;
  }

  if (body.type !== undefined) {
    const type = readType(body.type, errors, { required: false });
    if (type) data.type = type;
  }

  if (body.content !== undefined) {
    if (body.content === null) {
      data.content = null;
    } else if (typeof body.content !== "string") {
      errors.push("content must be a string.");
    } else {
      const c = body.content.trim();
      if (c.length > MAX.content) errors.push(`content must be at most ${MAX.content} characters.`);
      else data.content = c || null;
    }
  }

  const durationMin = optInt(body, "durationMin", MAX.duration, errors);
  if (durationMin !== undefined) data.durationMin = durationMin; // null clears it

  const order = optInt(body, "order", MAX.order, errors);
  if (order !== undefined && order !== null) data.order = order;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  // NOTE: the TEXT↔VIDEO_URL "content must be a URL" cross-check needs the lesson's
  // *effective* type (current type merged with this patch), so it runs in the service.
  return { isValid: errors.length === 0, errors, data };
}

// ── Reorder (bulk) ─────────────────────────────────────────────────────────────────

function validateReorder(body = {}) {
  const errors = [];

  const rawSections = body.sections;
  const rawLessons = body.lessons;

  if (rawSections !== undefined && !Array.isArray(rawSections)) errors.push("sections must be an array.");
  if (rawLessons !== undefined && !Array.isArray(rawLessons)) errors.push("lessons must be an array.");

  const sectionsIn = Array.isArray(rawSections) ? rawSections : [];
  const lessonsIn = Array.isArray(rawLessons) ? rawLessons : [];

  if (sectionsIn.length > MAX.bulk) errors.push(`sections must have at most ${MAX.bulk} items.`);
  if (lessonsIn.length > MAX.bulk) errors.push(`lessons must have at most ${MAX.bulk} items.`);

  if (sectionsIn.length === 0 && lessonsIn.length === 0) {
    errors.push("Provide at least one section or lesson to reorder.");
  }

  const sections = [];
  for (const s of sectionsIn) {
    const idErr = validateId(s?.id, "section id");
    const order = optInt(s ?? {}, "order", MAX.order, errors);
    if (idErr) { errors.push(idErr); continue; }
    if (!Number.isInteger(order)) { errors.push("each section needs an integer order."); continue; }
    sections.push({ id: s.id.trim(), order });
  }

  const lessons = [];
  for (const l of lessonsIn) {
    const idErr = validateId(l?.id, "lesson id");
    const secErr = validateId(l?.sectionId, "lesson sectionId");
    const order = optInt(l ?? {}, "order", MAX.order, errors);
    if (idErr) { errors.push(idErr); continue; }
    if (secErr) { errors.push(secErr); continue; }
    if (!Number.isInteger(order)) { errors.push("each lesson needs an integer order."); continue; }
    lessons.push({ id: l.id.trim(), sectionId: l.sectionId.trim(), order });
  }

  return { isValid: errors.length === 0, errors, data: { sections, lessons } };
}

module.exports = {
  validateId,
  isValidUrl,
  validateSectionCreate,
  validateSectionUpdate,
  validateLessonCreate,
  validateLessonUpdate,
  validateReorder,
};
