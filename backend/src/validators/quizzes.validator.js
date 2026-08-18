// Validation for the Quizzes & Exams API (quizzes + questions + reorder).
// Mirrors learningPaths.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here so the service only
// ever receives safe, bounded values. The per-type `data` payload is REBUILT
// field-by-field from the request — never stored as received — so nothing
// unexpected can land in the Json column.

// All 6 design-doc types are accepted. FILL_IN_BLANK / MATCHING originally
// shipped rejected (schema-forward-compat only, 400'd here) — enabled once
// the editor UI existed. Kept as one combined list rather than a V1/V2 split
// now that every schema-enum value has a real editor.
const V1_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTI_SELECT", "ESSAY", "FILL_IN_BLANK", "MATCHING"];

const MAX = {
  title:        200,
  description:  2000,
  prompt:       2000,
  option:       500,     // chars per option
  options:      10,      // options per question
  answer:       500,     // chars for a FILL_IN_BLANK correct answer
  pairText:     200,     // chars per MATCHING pair side
  pairs:        10,      // pairs per MATCHING question
  points:       100,
  passingGrade: 100,
  attempts:     100,
  timeLimit:    600,     // minutes (10h)
  bulk:         500,     // max items per reorder array
  order:        1000000,
};
const MIN_OPTIONS = 2;
const MIN_PAIRS = 2;

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// ── Shared field readers ────────────────────────────────────────────────────────

function readTitle(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.push("title is required.");
    return undefined;
  }
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) { errors.push(required ? "title is required." : "title cannot be empty."); return undefined; }
  if (title.length > MAX.title) { errors.push(`title must be at most ${MAX.title} characters.`); return undefined; }
  return title;
}

function readDescription(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null; // explicit null clears it
  if (typeof value !== "string") { errors.push("description must be a string."); return undefined; }
  const d = value.trim();
  if (d.length > MAX.description) { errors.push(`description must be at most ${MAX.description} characters.`); return undefined; }
  return d || null;
}

function readBool(value, key, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return value;
}

// Bounded integer. `nullable: true` lets an explicit null through (clears the field).
function readInt(value, key, min, max, errors, { nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null) {
    if (nullable) return null;
    errors.push(`${key} cannot be null.`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return undefined;
  }
  return n;
}

function readCourseId(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null; // explicit null detaches the quiz from its course
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push("courseId must be a non-empty string or null.");
    return undefined;
  }
  return value.trim();
}

// ── Quizzes ──────────────────────────────────────────────────────────────────────

function validateQuizCreate(body = {}) {
  const errors = [];

  const title              = readTitle(body.title, errors, { required: true });
  const description        = readDescription(body.description, errors);
  const courseId           = readCourseId(body.courseId, errors);
  const passingGrade       = readInt(body.passingGrade, "passingGrade", 0, MAX.passingGrade, errors);
  const attemptsAllowed    = readInt(body.attemptsAllowed, "attemptsAllowed", 1, MAX.attempts, errors, { nullable: true });
  const timeLimit          = readInt(body.timeLimit, "timeLimit", 1, MAX.timeLimit, errors, { nullable: true });
  const randomizeQuestions = readBool(body.randomizeQuestions, "randomizeQuestions", errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title,
      description:        description !== undefined ? description : null,
      courseId:           courseId    !== undefined ? courseId    : null,
      passingGrade:       passingGrade !== undefined ? passingGrade : 60,
      attemptsAllowed:    attemptsAllowed !== undefined ? attemptsAllowed : null,
      timeLimit:          timeLimit   !== undefined ? timeLimit   : null,
      randomizeQuestions: randomizeQuestions !== undefined ? randomizeQuestions : false,
    },
  };
}

function validateQuizUpdate(body = {}) {
  const errors = [];
  const data = {};

  const title = readTitle(body.title, errors, { required: false });
  if (title !== undefined) data.title = title;

  const description = readDescription(body.description, errors);
  if (description !== undefined) data.description = description; // null clears it

  const courseId = readCourseId(body.courseId, errors);
  if (courseId !== undefined) data.courseId = courseId; // null detaches

  const passingGrade = readInt(body.passingGrade, "passingGrade", 0, MAX.passingGrade, errors);
  if (passingGrade !== undefined) data.passingGrade = passingGrade;

  const attemptsAllowed = readInt(body.attemptsAllowed, "attemptsAllowed", 1, MAX.attempts, errors, { nullable: true });
  if (attemptsAllowed !== undefined) data.attemptsAllowed = attemptsAllowed; // null = unlimited

  const timeLimit = readInt(body.timeLimit, "timeLimit", 1, MAX.timeLimit, errors, { nullable: true });
  if (timeLimit !== undefined) data.timeLimit = timeLimit; // null = no limit

  const randomizeQuestions = readBool(body.randomizeQuestions, "randomizeQuestions", errors);
  if (randomizeQuestions !== undefined) data.randomizeQuestions = randomizeQuestions;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Question `data` payload (per-type, rebuilt field-by-field) ───────────────────

function readOptions(raw, errors) {
  if (!Array.isArray(raw?.options)) { errors.push("data.options must be an array."); return null; }
  if (raw.options.length < MIN_OPTIONS || raw.options.length > MAX.options) {
    errors.push(`data.options must have between ${MIN_OPTIONS} and ${MAX.options} entries.`);
    return null;
  }
  const options = [];
  for (const o of raw.options) {
    const s = typeof o === "string" ? o.trim() : "";
    if (!s) { errors.push("every option must be a non-empty string."); return null; }
    if (s.length > MAX.option) { errors.push(`each option must be at most ${MAX.option} characters.`); return null; }
    options.push(s);
  }
  return options;
}

// Returns the clean payload for the Json column (or null for ESSAY), pushing
// errors on anything malformed. Only validated fields survive.
function buildQuestionData(type, raw, errors) {
  switch (type) {
    case "MULTIPLE_CHOICE": {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { errors.push("data is required for MULTIPLE_CHOICE."); return undefined; }
      const options = readOptions(raw, errors);
      if (!options) return undefined;
      const correctIndex = readInt(raw.correctIndex, "data.correctIndex", 0, options.length - 1, errors);
      if (correctIndex === undefined) {
        // readInt is silent on an ABSENT value — require it explicitly, like TRUE_FALSE.
        if (raw.correctIndex === undefined) errors.push("data.correctIndex is required for MULTIPLE_CHOICE.");
        return undefined;
      }
      return { options, correctIndex };
    }
    case "TRUE_FALSE": {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { errors.push("data is required for TRUE_FALSE."); return undefined; }
      const correct = readBool(raw.correct, "data.correct", errors);
      if (correct === undefined) { if (raw.correct === undefined) errors.push("data.correct is required for TRUE_FALSE."); return undefined; }
      return { correct };
    }
    case "MULTI_SELECT": {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { errors.push("data is required for MULTI_SELECT."); return undefined; }
      const options = readOptions(raw, errors);
      if (!options) return undefined;
      if (!Array.isArray(raw.correctIndexes) || raw.correctIndexes.length === 0) {
        errors.push("data.correctIndexes must be a non-empty array.");
        return undefined;
      }
      const seen = new Set();
      for (const i of raw.correctIndexes) {
        if (!Number.isInteger(i) || i < 0 || i >= options.length) { errors.push("every correctIndexes entry must be a valid option index."); return undefined; }
        if (seen.has(i)) { errors.push("correctIndexes must not contain duplicates."); return undefined; }
        seen.add(i);
      }
      return { options, correctIndexes: [...seen] };
    }
    case "ESSAY": {
      // Manual grading — no answer data. Reject a payload so bad clients notice.
      if (raw !== undefined && raw !== null) { errors.push("data must be null for ESSAY questions."); return undefined; }
      return null;
    }
    case "FILL_IN_BLANK": {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { errors.push("data is required for FILL_IN_BLANK."); return undefined; }
      const correctAnswer = typeof raw.correctAnswer === "string" ? raw.correctAnswer.trim() : "";
      if (!correctAnswer) { errors.push("data.correctAnswer is required for FILL_IN_BLANK."); return undefined; }
      if (correctAnswer.length > MAX.answer) { errors.push(`data.correctAnswer must be at most ${MAX.answer} characters.`); return undefined; }
      return { correctAnswer };
    }
    case "MATCHING": {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { errors.push("data is required for MATCHING."); return undefined; }
      if (!Array.isArray(raw.pairs) || raw.pairs.length < MIN_PAIRS || raw.pairs.length > MAX.pairs) {
        errors.push(`data.pairs must have between ${MIN_PAIRS} and ${MAX.pairs} entries.`);
        return undefined;
      }
      const pairs = [];
      for (const p of raw.pairs) {
        const left  = typeof p?.left  === "string" ? p.left.trim()  : "";
        const right = typeof p?.right === "string" ? p.right.trim() : "";
        if (!left || !right) { errors.push("every pair must have a non-empty left and right."); return undefined; }
        if (left.length > MAX.pairText || right.length > MAX.pairText) { errors.push(`each pair side must be at most ${MAX.pairText} characters.`); return undefined; }
        pairs.push({ left, right });
      }
      return { pairs };
    }
    default:
      return undefined;
  }
}

function readType(value, errors) {
  if (value === undefined || value === null || String(value).trim() === "") {
    errors.push("type is required.");
    return undefined;
  }
  const upper = String(value).trim().toUpperCase();
  if (!V1_TYPES.includes(upper)) {
    errors.push(`type must be one of: ${V1_TYPES.join(", ")}.`);
    return undefined;
  }
  return upper;
}

function readPrompt(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.push("prompt is required.");
    return undefined;
  }
  const p = typeof value === "string" ? value.trim() : "";
  if (!p) { errors.push(required ? "prompt is required." : "prompt cannot be empty."); return undefined; }
  if (p.length > MAX.prompt) { errors.push(`prompt must be at most ${MAX.prompt} characters.`); return undefined; }
  return p;
}

// ── Questions ────────────────────────────────────────────────────────────────────

function validateQuestionCreate(body = {}) {
  const errors = [];

  const type   = readType(body.type, errors);
  const prompt = readPrompt(body.prompt, errors, { required: true });
  const points = readInt(body.points, "points", 1, MAX.points, errors);
  const order  = readInt(body.order, "order", 0, MAX.order, errors);
  const data   = type ? buildQuestionData(type, body.data, errors) : undefined;

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      type,
      prompt,
      data:   data !== undefined ? data : null,
      points: points !== undefined ? points : 1,
      ...(order !== undefined ? { order } : {}),
    },
  };
}

function validateQuestionUpdate(body = {}) {
  const errors = [];
  const data = {};

  // The (type, data) pair travels together: answer data only makes sense against
  // its type, and the validator can't check `data` alone against the CURRENT type
  // (that lives in the DB). Requiring both keeps all shape validation right here.
  if ((body.type === undefined) !== (body.data === undefined)) {
    errors.push("type and data must be provided together.");
  } else if (body.type !== undefined) {
    const type = readType(body.type, errors);
    const payload = type ? buildQuestionData(type, body.data, errors) : undefined;
    if (type && payload !== undefined) { data.type = type; data.data = payload; }
  }

  const prompt = readPrompt(body.prompt, errors, { required: false });
  if (prompt !== undefined) data.prompt = prompt;

  const points = readInt(body.points, "points", 1, MAX.points, errors);
  if (points !== undefined) data.points = points;

  const order = readInt(body.order, "order", 0, MAX.order, errors);
  if (order !== undefined) data.order = order;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Reorder (bulk) ─────────────────────────────────────────────────────────────────

function validateReorder(body = {}) {
  const errors = [];

  if (!Array.isArray(body.items)) {
    return { isValid: false, errors: ["items must be an array."], data: { items: [] } };
  }
  if (body.items.length === 0) errors.push("Provide at least one item to reorder.");
  if (body.items.length > MAX.bulk) errors.push(`items must have at most ${MAX.bulk} entries.`);

  const items = [];
  for (const it of body.items) {
    const idErr = validateId(it?.id, "item id");
    const order = readInt(it?.order, "order", 0, MAX.order, errors);
    if (idErr) { errors.push(idErr); continue; }
    if (!Number.isInteger(order)) { errors.push("each item needs an integer order."); continue; }
    items.push({ id: it.id.trim(), order });
  }

  return { isValid: errors.length === 0, errors, data: { items } };
}

module.exports = {
  validateId,
  validateQuizCreate,
  validateQuizUpdate,
  validateQuestionCreate,
  validateQuestionUpdate,
  validateReorder,
  V1_TYPES,
};
