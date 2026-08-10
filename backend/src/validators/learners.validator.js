// Validation for the Learners API. Same contract as instructors.validator:
// every function returns { isValid, errors, data } with each field parsed,
// trimmed, bounded and allow-listed here, so the service only ever receives
// safe values.
//
// SECURITY / OWNERSHIP:
//   • `role` is NEVER accepted — POST always forces LEARNER.
//   • `status`, `verificationState`, `email` and `password` are owned by the
//     Users module. PATCH /learners/:id rejects them with a 400 that names the
//     endpoint to use instead (verify has no learner-specific verb — see
//     LEARNERS_CONTRACT.md; reset-password DOES, unlike instructors, per the
//     task spec).
//   • `learnerCode`, `verifiedAt`-equivalents are server-managed.
//
// TERMINOLOGY: "Learner" only. See learners.prisma header note on the dead
// `student.*` scaffolding this module deliberately does not touch.

const { validatePasswordStrength } = require("../utils/passwordPolicy");
// Shared taxonomy (users.validator.js) — imported, not re-declared, so
// Instructors/Users/Learners suspensions can never drift into three lists.
const { VIOLATION_TYPES, normalizeViolationType } = require("./users.validator");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX = {
  fullName: 100,
  email: 254,
  phone: 30,
  program: 120,
  department: 120,
  batch: 60,
  search: 200,
  limit: 100,
  historyLimit: 50,
};

const CREATABLE_STATUSES = new Set(["ACTIVE", "PENDING", "INVITED"]);

const LEARNER_LEVELS = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const LEARNER_VERIFICATION_STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED"]);

// Tab -> AppUser.status scope, for the four tabs that ARE just a status filter.
// The other four (at-risk, completed, pending-verification, graduated) are
// relational/derived and built directly in learners.service (see AT_RISK_THRESHOLD
// and the graduated/completed enrollment-shape queries there) — they have no
// single status value to map to.
const TAB_STATUS_SCOPE = {
  all:       { not: "ARCHIVED" },
  active:    "ACTIVE",
  suspended: "SUSPENDED",
  inactive:  { in: ["PENDING", "INVITED"] },
};

const DERIVED_TABS = new Set(["at-risk", "completed", "pending-verification", "graduated"]);
const ALL_TABS = new Set([...Object.keys(TAB_STATUS_SCOPE), ...DERIVED_TABS]);

const SORTS = new Set(["recent", "name", "courses", "progress"]);

// ── Shared field readers (same helpers as instructors.validator) ────────────────

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

function readLevel(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!LEARNER_LEVELS.has(v)) { errors.push(`level must be one of: ${[...LEARNER_LEVELS].join(", ")}.`); return undefined; }
  return v;
}

function readVerificationStatus(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!LEARNER_VERIFICATION_STATUSES.has(v)) {
    errors.push(`verificationStatus must be one of: ${[...LEARNER_VERIFICATION_STATUSES].join(", ")}.`);
    return undefined;
  }
  return v;
}

// Fields this module must never write — each points at the endpoint that owns it.
const FOREIGN_FIELDS = {
  role:              "role is fixed to LEARNER and cannot be set here.",
  status:            "status is owned by the Users module — use PATCH /api/admin/learners/:id/suspend | /reactivate.",
  verificationState: "verificationState is owned by the Users module — use PATCH /api/admin/users/:id.",
  email:             "email is owned by the Users module — use PATCH /api/admin/users/:id.",
  password:          "password is owned by the Users module — use PATCH /api/admin/learners/:id/reset-password.",
  learnerCode:       "learnerCode is server-generated and cannot be set.",
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
    program:            readString(body.program, "program", MAX.program, errors),
    level:              readLevel(body.level, errors),
    department:         readString(body.department, "department", MAX.department, errors),
    batch:              readString(body.batch, "batch", MAX.batch, errors),
    advisorId:          readString(body.advisorId, "advisorId", 100, errors),
    verificationStatus: readVerificationStatus(body.verificationStatus, errors),
    riskScore:          readInt(body.riskScore, "riskScore", 0, 100, errors),
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

function validateLearnerCreate(body = {}) {
  const errors = [];
  rejectForeignFields(body, errors, { allow: ["email", "password", "status"] });

  const fullName = readString(body.fullName, "fullName", MAX.fullName, errors, { required: true, min: 2 });
  const email    = readEmail(body.email, errors, { required: true });
  const phone    = readString(body.phone, "phone", MAX.phone, errors);

  let status = "ACTIVE";
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!CREATABLE_STATUSES.has(s)) {
      errors.push(`status must be one of: ${[...CREATABLE_STATUSES].join(", ")}.`);
    } else {
      status = s;
    }
  }

  let password;
  if (status !== "INVITED") {
    if (typeof body.password !== "string" || !body.password) {
      errors.push("password is required unless status is INVITED.");
    } else {
      errors.push(...validatePasswordStrength(body.password));
      password = body.password;
    }
  } else if (body.password !== undefined) {
    errors.push("password cannot be set for an INVITED learner.");
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
        phone: phone !== undefined ? phone : null,
      },
      profile: pickDefined(profile),
    },
  };
}

// ── Update (profile fields only) ────────────────────────────────────────────────

function validateLearnerUpdate(body = {}) {
  const errors = [];
  rejectForeignFields(body, errors);

  const profile = pickDefined(readProfileFields(body, errors));
  const data = { profile, user: {} };

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

// ── Suspend / Reactivate (delegate to users.service — same shared taxonomy) ─────

function validateSuspend(body = {}) {
  const errors = [];
  const reason = readString(body.reason, "reason", 500, errors, { required: true, min: 3 });
  const notes  = readString(body.notes, "notes", 2000, errors);

  let violationType = null;
  if (body.violationType !== undefined && body.violationType !== null) {
    violationType = normalizeViolationType(body.violationType);
    if (violationType === null) {
      errors.push(`violationType must be one of: ${[...VIOLATION_TYPES].join(", ")}.`);
    }
  }

  return { isValid: errors.length === 0, errors, data: { reason, notes: notes ?? null, violationType } };
}

function validateReactivate(body = {}) {
  const errors = [];
  const notes = readString(body.notes, "notes", 2000, errors);
  return { isValid: errors.length === 0, errors, data: { notes: notes ?? null } };
}

// ── Reset password ────────────────────────────────────────────────────────────

function validateResetPassword(body = {}) {
  const errors = [];
  if (typeof body.newPassword !== "string" || !body.newPassword) {
    errors.push("newPassword is required.");
    return { isValid: false, errors, data: {} };
  }
  errors.push(...validatePasswordStrength(body.newPassword));
  return { isValid: errors.length === 0, errors, data: { newPassword: body.newPassword } };
}

// ── History query (suspension history — same shape as instructors) ─────────────

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
    if (!ALL_TABS.has(t)) {
      errors.push(`tab must be one of: ${[...ALL_TABS].join(", ")}.`);
    } else {
      data.tab = t;
    }
  }
  if (query.sort !== undefined) {
    const s = String(query.sort).trim().toLowerCase();
    if (!SORTS.has(s)) errors.push(`sort must be one of: ${[...SORTS].join(", ")}.`);
    else data.sort = s;
  }

  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;

  const department = readString(query.department, "department", MAX.department, errors);
  if (department) data.department = department;

  const program = readString(query.program, "program", MAX.program, errors);
  if (program) data.program = program;

  return { isValid: errors.length === 0, errors, data };
}

// ── Enrollment / progress / activity (Part 3) ───────────────────────────────────

const ACTIVITY_TYPES = new Set([
  "login", "lesson_viewed", "video_watched", "quiz_attempt", "assignment_upload", "session_attended",
]);

function readDate(value, key, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") { errors.push(`${key} must be an ISO date string.`); return undefined; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push(`${key} must be a valid ISO date.`); return undefined; }
  return d;
}

// One of courseId / learningPathId, plus the same optional startDate/
// expiryDate/cohortId the underlying enrollments.service now accepts
// (ENROLLMENTS_CONTRACT.md addendum). learningPathId has no direct FK on
// CourseEnrollment — the service expands it into one enrollment per COURSE
// item in the path (see learners.service.enrollLearnerInPath).
function validateEnrollBody(body = {}) {
  const errors = [];
  const courseId = readString(body.courseId, "courseId", 100, errors);
  const learningPathId = readString(body.learningPathId, "learningPathId", 100, errors);

  if (courseId && learningPathId) errors.push("Send courseId OR learningPathId, not both.");
  if (!courseId && !learningPathId) errors.push("courseId or learningPathId is required.");

  const startDate = readDate(body.startDate, "startDate", errors);
  const expiryDate = readDate(body.expiryDate, "expiryDate", errors);
  if (startDate && expiryDate && expiryDate <= startDate) errors.push("expiryDate must be after startDate.");
  const cohortId = readString(body.cohortId, "cohortId", 100, errors);

  return { isValid: errors.length === 0, errors, data: { courseId, learningPathId, startDate, expiryDate, cohortId } };
}

function validateBulkEnroll(body = {}) {
  const errors = [];
  const learnerIds = Array.isArray(body.learnerIds) ? body.learnerIds.filter((v) => typeof v === "string" && v.trim()) : null;
  if (!learnerIds || learnerIds.length === 0) errors.push("learnerIds must be a non-empty array of learner ids.");
  if (learnerIds && learnerIds.length > 500) errors.push("learnerIds must contain at most 500 entries.");

  const rest = validateEnrollBody(body);
  errors.push(...rest.errors);

  return { isValid: errors.length === 0, errors, data: { learnerIds: learnerIds ?? [], ...rest.data } };
}

function validateActivityQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 20 };

  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) errors.push("page must be a positive integer.");
    else data.page = n;
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX.limit) {
      errors.push(`limit must be an integer between 1 and ${MAX.limit}.`);
    } else {
      data.limit = n;
    }
  }
  if (query.type !== undefined && String(query.type).trim() !== "") {
    const t = String(query.type).trim();
    if (!ACTIVITY_TYPES.has(t)) errors.push(`type must be one of: ${[...ACTIVITY_TYPES].join(", ")}.`);
    else data.type = t;
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Assessments / Certificates / Attendance (Part 5) ────────────────────────────

// PATCH .../assessments/:aid/grade — score 0-100 required, feedback optional.
function validateGrade(body = {}) {
  const errors = [];
  const score = readInt(body.score, "score", 0, 100, errors);
  if (score === undefined) errors.push("score is required (integer 0-100).");
  const feedback = readString(body.feedback, "feedback", 5000, errors);
  return { isValid: errors.length === 0, errors, data: { score, feedback: feedback ?? null } };
}

function validateSimplePageQuery(query = {}) {
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

module.exports = {
  TAB_STATUS_SCOPE,
  DERIVED_TABS,
  ACTIVITY_TYPES,
  validateId,
  validateLearnerCreate,
  validateLearnerUpdate,
  validateSuspend,
  validateReactivate,
  validateResetPassword,
  validateHistoryQuery,
  validateListQuery,
  validateEnrollBody,
  validateBulkEnroll,
  validateActivityQuery,
  validateGrade,
  validateSimplePageQuery,
};
