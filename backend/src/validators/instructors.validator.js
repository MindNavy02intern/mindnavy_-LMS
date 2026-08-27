// Validation for the Instructors API. Same contract as liveSessions.validator:
// every function returns { isValid, errors, data } with each field parsed,
// trimmed, bounded and allow-listed here, so the service only ever receives
// safe values.
//
// SECURITY / OWNERSHIP:
//   • `role` is NEVER accepted — POST always forces INSTRUCTOR.
//   • `status`, `verificationState`, `email` and passwords are owned by the
//     Users module. PATCH /instructors/:id rejects them with a 400 that names
//     the endpoint to use instead, so the two modules can never write the same
//     field from two places.
//   • `verifiedAt` / `verifiedById` are server-stamped, never client input.

const { validatePasswordStrength } = require("../utils/passwordPolicy");
// The violation taxonomy lives with the Users module because users.service
// performs the suspend write and owns the USER_SUSPENDED audit row that records
// it. Imported, not re-declared — two copies of an enum is how they drift.
const { VIOLATION_TYPES, normalizeViolationType } = require("./users.validator");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX = {
  fullName: 100,
  email: 254,
  phone: 30,
  specialization: 120,
  headline: 200,
  bio: 5000,
  url: 500,
  skill: 60,
  skills: 30,
  yearsExperience: 70,
  revenueShareBps: 10000, // 100.00%
  search: 200,
  limit: 100,
  // Suspension history is a side-panel section, not a report — a tighter ceiling
  // than the main list keeps an unbounded audit scan off the table.
  historyLimit: 50,
};

// Statuses a NEW instructor may be created with. SUSPENDED/ARCHIVED are
// transitions, not starting points — they have their own endpoints.
const CREATABLE_STATUSES = new Set(["ACTIVE", "PENDING", "INVITED"]);

// Tab → AppUser.status scope. "pending" is absent on purpose: that tab reads
// the applications queue, not instructors (one source, no copies — B4).
const TAB_STATUS_SCOPE = {
  all:       { not: "ARCHIVED" },
  active:    "ACTIVE",
  suspended: "SUSPENDED",
  // "Never got going" — invited or awaiting first activation. Documented in
  // INSTRUCTORS_CONTRACT.md so the frontend label matches the query.
  inactive:  { in: ["PENDING", "INVITED"] },
  top:       { not: "ARCHIVED" },
};

const SORTS = new Set(["recent", "courses", "students", "name"]);

// ── Shared field readers ────────────────────────────────────────────────────────

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function readString(value, key, max, errors, { required = false, min = 0 } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (value === null) {
    if (required) { errors.push(`${key} cannot be null.`); return undefined; }
    return null;
  }
  if (typeof value !== "string") { errors.push(`${key} must be a string.`); return undefined; }
  const s = value.trim();
  if (!s) {
    if (required) { errors.push(`${key} is required.`); return undefined; }
    return null;
  }
  if (s.length < min) { errors.push(`${key} must be at least ${min} characters.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readInt(value, key, min, max, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return undefined;
  }
  return n;
}

// http/https only, parsed by the URL constructor — blocks javascript:, data:,
// file: and anything else that could be rendered as a link in the admin UI.
function readUrl(value, key, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") { errors.push(`${key} must be a string.`); return undefined; }
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > MAX.url) { errors.push(`${key} must be at most ${MAX.url} characters.`); return undefined; }
  let parsed;
  try { parsed = new URL(raw); } catch { errors.push(`${key} must be a valid URL.`); return undefined; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    errors.push(`${key} must start with http:// or https://.`);
    return undefined;
  }
  return parsed.toString();
}

function readEmail(value, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push("email is required.");
    return undefined;
  }
  if (typeof value !== "string") { errors.push("email must be a string."); return undefined; }
  const email = value.trim().toLowerCase();
  if (!email) { errors.push("email is required."); return undefined; }
  if (email.length > MAX.email || !EMAIL_REGEX.test(email)) {
    errors.push("email must be a valid email address.");
    return undefined;
  }
  return email;
}

function readSkills(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) { errors.push("skills must be an array of strings."); return undefined; }
  if (value.length > MAX.skills) { errors.push(`skills must contain at most ${MAX.skills} entries.`); return undefined; }
  const out = [];
  for (const raw of value) {
    if (typeof raw !== "string") { errors.push("skills must contain strings only."); return undefined; }
    const s = raw.trim();
    if (!s) continue;
    if (s.length > MAX.skill) { errors.push(`each skill must be at most ${MAX.skill} characters.`); return undefined; }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// Fields this module must never write — each points at the endpoint that owns it.
const FOREIGN_FIELDS = {
  role:              "role is fixed to INSTRUCTOR and cannot be set here.",
  status:            "status is owned by the Users module — use PATCH /api/admin/instructors/:id/suspend | /reactivate.",
  verificationState: "verificationState is owned by the Users module — use PATCH /api/admin/instructors/:id/verify.",
  email:             "email is owned by the Users module — use PATCH /api/admin/users/:id.",
  password:          "password is owned by the Users module — use POST /api/admin/users/:id/reset-password.",
  verifiedAt:        "verifiedAt is server-managed and cannot be set.",
  verifiedById:      "verifiedById is server-managed and cannot be set.",
  riskScore:         "riskScore is server-managed and cannot be set.",
};

function rejectForeignFields(body, errors, { allow = [] } = {}) {
  for (const [key, message] of Object.entries(FOREIGN_FIELDS)) {
    if (allow.includes(key)) continue;
    if (body[key] !== undefined) errors.push(message);
  }
}

// ── Profile block (shared by create + update) ───────────────────────────────────

function readProfileFields(body, errors) {
  return {
    specialization:  readString(body.specialization, "specialization", MAX.specialization, errors),
    headline:        readString(body.headline, "headline", MAX.headline, errors),
    bio:             readString(body.bio, "bio", MAX.bio, errors),
    yearsExperience: readInt(body.yearsExperience, "yearsExperience", 0, MAX.yearsExperience, errors),
    websiteUrl:      readUrl(body.websiteUrl, "websiteUrl", errors),
    linkedinUrl:     readUrl(body.linkedinUrl, "linkedinUrl", errors),
    revenueShareBps: readInt(body.revenueShareBps, "revenueShareBps", 0, MAX.revenueShareBps, errors),
  };
}

function pickDefined(source) {
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ── Create ──────────────────────────────────────────────────────────────────────

function validateInstructorCreate(body = {}) {
  const errors = [];

  // email / password / status are set ONCE, at creation time, and are then
  // owned by the Users module — hence allow-listed here and rejected by
  // validateInstructorUpdate. `status` also decides whether a password is
  // required (INVITED accounts have none yet).
  rejectForeignFields(body, errors, { allow: ["email", "password", "status"] });

  const fullName = readString(body.fullName, "fullName", MAX.fullName, errors, { required: true, min: 2 });
  const email    = readEmail(body.email, errors, { required: true });
  const phone    = readString(body.phone, "phone", MAX.phone, errors);
  const skills   = readSkills(body.skills, errors);

  let status = "ACTIVE";
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!CREATABLE_STATUSES.has(s)) {
      errors.push(`status must be one of: ${[...CREATABLE_STATUSES].join(", ")}.`);
    } else {
      status = s;
    }
  }

  // An INVITED instructor has no password yet (they set one via the invite
  // flow) — identical rule to users.validator.validateCreateUserInput.
  let password;
  if (status !== "INVITED") {
    if (typeof body.password !== "string" || !body.password) {
      errors.push("password is required unless status is INVITED.");
    } else {
      errors.push(...validatePasswordStrength(body.password));
      password = body.password;
    }
  } else if (body.password !== undefined) {
    errors.push("password cannot be set for an INVITED instructor.");
  }

  const profile = readProfileFields(body, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      user: {
        fullName,
        email,
        password,
        status,
        phone:  phone  !== undefined ? phone  : null,
        skills: skills !== undefined ? skills : [],
      },
      profile: pickDefined(profile),
    },
  };
}

// ── Update (profile fields only) ────────────────────────────────────────────────

function validateInstructorUpdate(body = {}) {
  const errors = [];
  rejectForeignFields(body, errors);

  const profile = pickDefined(readProfileFields(body, errors));

  // `skills` lives on AppUser (one column, shared with the Users module — the
  // same field, not a fork) and is edited from both screens by design.
  const data = { profile, user: {} };
  const skills = readSkills(body.skills, errors);
  if (skills !== undefined) data.user.skills = skills;

  if (body.fullName !== undefined) {
    const fullName = readString(body.fullName, "fullName", MAX.fullName, errors, { required: true, min: 2 });
    if (fullName !== undefined) data.user.fullName = fullName;
  }
  if (body.phone !== undefined) {
    const phone = readString(body.phone, "phone", MAX.phone, errors);
    if (phone !== undefined) data.user.phone = phone;
  }

  if (errors.length === 0 && Object.keys(profile).length === 0 && Object.keys(data.user).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Suspend (reason required — users.service dereferences it) ───────────────────

function validateSuspend(body = {}) {
  const errors = [];
  const reason = readString(body.reason, "reason", 500, errors, { required: true, min: 3 });
  const notes  = readString(body.notes, "notes", 2000, errors);

  // OPTIONAL in v1 and required in a later commit, once the Suspend modal ships
  // its dropdown — the endpoint is already live and the current UI sends only
  // { reason, notes }, so requiring it today would break suspension outright.
  // A value that IS sent must be in the taxonomy: a typo has to be a 400, not a
  // suspension silently filed with no violation type.
  let violationType = null;
  if (body.violationType !== undefined && body.violationType !== null) {
    violationType = normalizeViolationType(body.violationType);
    if (violationType === null) {
      errors.push(`violationType must be one of: ${[...VIOLATION_TYPES].join(", ")}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { reason, notes: notes ?? null, violationType },
  };
}

// ── Reactivate (everything optional — the action itself is the payload) ─────────

function validateReactivate(body = {}) {
  const errors = [];
  const notes = readString(body.notes, "notes", 2000, errors);
  // No foreign-field check: reactivate takes exactly one field, so anything else
  // in the body is ignored rather than rejected (an empty body is the norm).
  return { isValid: errors.length === 0, errors, data: { notes: notes ?? null } };
}

// ── Suspension history query ────────────────────────────────────────────────────

function validateHistoryQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 20 };

  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) errors.push("page must be a positive integer.");
    else data.page = n;
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX.historyLimit) {
      errors.push(`limit must be an integer between 1 and ${MAX.historyLimit}.`);
    } else {
      data.limit = n;
    }
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── List query ──────────────────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 10, tab: "all", sort: "recent" };

  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) errors.push("page must be a positive integer.");
    else data.page = n;
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX.limit) errors.push(`limit must be an integer between 1 and ${MAX.limit}.`);
    else data.limit = n;
  }
  if (query.tab !== undefined) {
    const t = String(query.tab).trim().toLowerCase();
    if (t === "pending") {
      errors.push("The pending tab reads GET /api/admin/instructor-applications, not this endpoint.");
    } else if (!Object.prototype.hasOwnProperty.call(TAB_STATUS_SCOPE, t)) {
      errors.push(`tab must be one of: ${Object.keys(TAB_STATUS_SCOPE).join(", ")}.`);
    } else {
      data.tab = t;
    }
  }
  if (query.sort !== undefined) {
    const s = String(query.sort).trim().toLowerCase();
    if (!SORTS.has(s)) errors.push(`sort must be one of: ${[...SORTS].join(", ")}.`);
    else data.sort = s;
  }
  // The Top Performers tab IS a sort — keep the two in sync so ?tab=top alone
  // works. Ranked by STUDENTS, which is the one canonical definition of "top"
  // in this module: the same metric backs the `topInstructor` badge and the
  // Top Instructors chart, so a badge can never contradict the list.
  if (data.tab === "top" && query.sort === undefined) data.sort = "students";

  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;

  const specialization = readString(query.specialization, "specialization", MAX.specialization, errors);
  if (specialization) data.specialization = specialization;

  const categoryId = readString(query.categoryId, "categoryId", 100, errors);
  if (categoryId) data.categoryId = categoryId;

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  TAB_STATUS_SCOPE,
  validateId,
  validateInstructorCreate,
  validateInstructorUpdate,
  validateSuspend,
  validateReactivate,
  validateHistoryQuery,
  validateListQuery,
  // Exported additively for instructorSelf.validator.js (Phase 2) to compose
  // its own narrower self-service validator from — same field readers, same
  // MAX limits, no duplicated constraints. Nothing above this line changed.
  readProfileFields,
  pickDefined,
  rejectForeignFields,
  FOREIGN_FIELDS,
};
