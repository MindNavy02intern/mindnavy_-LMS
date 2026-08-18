// Validation for the Live Sessions API. Mirrors quizzes.validator: each function
// returns { isValid, errors, data } with every field parsed, trimmed, bounded and
// allow-listed here, so the service only ever receives safe values.
//
// SECURITY: zoomMeetingId / joinUrl / startUrl / status are NEVER accepted from
// the client — meeting links are written only by the meetings adapter, and status
// is owned by the schedule (derived from startTime + durationMin).

const V1_PROVIDERS = ["ZOOM"];
const V2_PROVIDERS = ["MEET", "TEAMS", "OTHER"];

const MAX = {
  title: 200,
  description: 2000,
  durationMin: 1440, // 24h
  maxParticipants: 10000,
};
const MIN_DURATION = 5;

// Sessions may be scheduled a moment ago (clock skew, slow form) but not in the
// real past — Zoom rejects past start times anyway; fail it here with a clear 400.
const PAST_GRACE_MS = 2 * 60 * 1000;

// IANA zone ids straight from the runtime — no hand-maintained list.
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));
VALID_TIMEZONES.add("UTC");

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// ── Shared field readers (same conventions as quizzes.validator) ────────────────

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
  if (value === null) return null;
  if (typeof value !== "string") { errors.push("description must be a string."); return undefined; }
  const d = value.trim();
  if (d.length > MAX.description) { errors.push(`description must be at most ${MAX.description} characters.`); return undefined; }
  return d || null;
}

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

function readRef(value, key, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (value === null) {
    if (required) { errors.push(`${key} cannot be null.`); return undefined; }
    return null;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${key} must be a non-empty string.`);
    return undefined;
  }
  return value.trim();
}

function readStartTime(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.push("startTime is required.");
    return undefined;
  }
  const t = typeof value === "string" || value instanceof Date ? new Date(value) : new Date(NaN);
  if (Number.isNaN(t.getTime())) { errors.push("startTime must be a valid ISO date-time."); return undefined; }
  if (t.getTime() < Date.now() - PAST_GRACE_MS) { errors.push("startTime must be in the future."); return undefined; }
  return t;
}

function readTimezone(value, errors) {
  if (value === undefined) return undefined;
  const tz = typeof value === "string" ? value.trim() : "";
  if (!VALID_TIMEZONES.has(tz)) { errors.push('timezone must be a valid IANA zone id (e.g. "Asia/Beirut", "UTC").'); return undefined; }
  return tz;
}

function readProvider(value, errors) {
  if (value === undefined) return undefined;
  const p = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (V2_PROVIDERS.includes(p)) { errors.push(`${p} is not available yet (v2) — v1 provider: ZOOM.`); return undefined; }
  if (!V1_PROVIDERS.includes(p)) { errors.push("provider must be ZOOM."); return undefined; }
  return p;
}

// ── Create / Update ─────────────────────────────────────────────────────────────

function validateSessionCreate(body = {}) {
  const errors = [];

  const title           = readTitle(body.title, errors, { required: true });
  const description     = readDescription(body.description, errors);
  const courseId        = readRef(body.courseId, "courseId", errors);
  const instructorId    = readRef(body.instructorId, "instructorId", errors, { required: true });
  const startTime       = readStartTime(body.startTime, errors, { required: true });
  const durationMin     = readInt(body.durationMin, "durationMin", MIN_DURATION, MAX.durationMin, errors);
  const timezone        = readTimezone(body.timezone, errors);
  const maxParticipants = readInt(body.maxParticipants, "maxParticipants", 1, MAX.maxParticipants, errors, { nullable: true });
  const provider        = readProvider(body.provider, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title,
      description:     description !== undefined ? description : null,
      courseId:        courseId    !== undefined ? courseId    : null,
      instructorId,
      startTime,
      durationMin:     durationMin !== undefined ? durationMin : 60,
      timezone:        timezone    !== undefined ? timezone    : "UTC",
      maxParticipants: maxParticipants !== undefined ? maxParticipants : null,
      provider:        provider    !== undefined ? provider    : "ZOOM",
    },
  };
}

function validateSessionUpdate(body = {}) {
  const errors = [];
  const data = {};

  const title = readTitle(body.title, errors, { required: false });
  if (title !== undefined) data.title = title;

  const description = readDescription(body.description, errors);
  if (description !== undefined) data.description = description; // null clears it

  const courseId = readRef(body.courseId, "courseId", errors);
  if (courseId !== undefined) data.courseId = courseId; // null detaches

  const instructorId = readRef(body.instructorId, "instructorId", errors);
  if (instructorId === null) errors.push("instructorId cannot be null.");
  else if (instructorId !== undefined) data.instructorId = instructorId;

  const startTime = readStartTime(body.startTime, errors, { required: false });
  if (startTime !== undefined) data.startTime = startTime;

  const durationMin = readInt(body.durationMin, "durationMin", MIN_DURATION, MAX.durationMin, errors);
  if (durationMin !== undefined) data.durationMin = durationMin;

  const timezone = readTimezone(body.timezone, errors);
  if (timezone !== undefined) data.timezone = timezone;

  const maxParticipants = readInt(body.maxParticipants, "maxParticipants", 1, MAX.maxParticipants, errors, { nullable: true });
  if (maxParticipants !== undefined) data.maxParticipants = maxParticipants; // null = no cap

  if (body.provider !== undefined) errors.push("provider cannot be changed after creation.");
  for (const key of ["status", "zoomMeetingId", "joinUrl", "startUrl", "meetingLink"]) {
    if (body[key] !== undefined) errors.push(`${key} is server-managed and cannot be set.`);
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── List query ──────────────────────────────────────────────────────────────────

const STATUSES = ["UPCOMING", "LIVE", "ENDED"];

function validateListQuery(query = {}) {
  const errors = [];
  const data = {};

  if (query.status !== undefined) {
    const s = String(query.status).trim().toUpperCase();
    if (!STATUSES.includes(s)) errors.push("status must be one of: upcoming, live, ended.");
    else data.status = s;
  }
  const courseId = readRef(query.courseId, "courseId", errors);
  if (courseId) data.courseId = courseId;
  const instructorId = readRef(query.instructorId, "instructorId", errors);
  if (instructorId) data.instructorId = instructorId;

  return { isValid: errors.length === 0, errors, data };
}

// ── Attendance (Trigger 4 write endpoint) ────────────────────────────────────

const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];
const MAX_ATTENDANCE_RECORDS = 300;

function validateMarkAttendance(body = {}) {
  const errors = [];
  const records = Array.isArray(body.records) ? body.records : null;
  if (!records || records.length === 0) { errors.push("records must be a non-empty array."); return { isValid: false, errors, data: null }; }
  if (records.length > MAX_ATTENDANCE_RECORDS) { errors.push(`records must have at most ${MAX_ATTENDANCE_RECORDS} items.`); return { isValid: false, errors, data: null }; }

  const data = [];
  const seen = new Set();
  for (const [i, r] of records.entries()) {
    const userIdErr = validateId(r?.userId, `records[${i}].userId`);
    if (userIdErr) { errors.push(userIdErr); continue; }
    const userId = r.userId.trim();
    if (seen.has(userId)) { errors.push(`records[${i}].userId is duplicated.`); continue; }
    seen.add(userId);

    const status = typeof r.status === "string" ? r.status.trim().toUpperCase() : "";
    if (!ATTENDANCE_STATUSES.includes(status)) { errors.push(`records[${i}].status must be one of: ${ATTENDANCE_STATUSES.join(", ")}.`); continue; }

    let durationMin;
    if (r.durationMin !== undefined && r.durationMin !== null) {
      const n = Number(r.durationMin);
      if (!Number.isInteger(n) || n < 0 || n > MAX.durationMin) { errors.push(`records[${i}].durationMin must be an integer between 0 and ${MAX.durationMin}.`); continue; }
      durationMin = n;
    }

    let participationScore;
    if (r.participationScore !== undefined && r.participationScore !== null) {
      const n = Number(r.participationScore);
      if (!Number.isInteger(n) || n < 0 || n > 100) { errors.push(`records[${i}].participationScore must be an integer between 0 and 100.`); continue; }
      participationScore = n;
    }

    data.push({
      userId, status,
      joinedAt: r.joinedAt ? new Date(r.joinedAt) : undefined,
      leftAt: r.leftAt ? new Date(r.leftAt) : undefined,
      durationMin, participationScore,
    });
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateId,
  validateSessionCreate,
  validateSessionUpdate,
  validateListQuery,
  validateMarkAttendance,
};
