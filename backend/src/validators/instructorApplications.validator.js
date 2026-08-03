// Validation for the Instructor Applications API (public submit + admin review).
// Same { isValid, errors, data } contract as the other validators; readers are
// local to this file by convention (each validator owns its own bounds).
//
// SECURITY — the submit path is UNAUTHENTICATED (blueprint 05 §3):
//   • Only the applicant-supplied fields below are read; `status`, `reviewedBy*`,
//     `createdUserId` and every review field are rejected outright, so a bot
//     cannot self-approve.
//   • cvUrl / portfolioUrl are LINKS ONLY, http/https, parsed by the URL
//     constructor — v1 does not open an unauthenticated upload surface.
//   • A honeypot field (`website`) is offered to bots: when it is filled the
//     submission is flagged and silently dropped by the controller, which still
//     answers 200 so the bot learns nothing.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX = {
  fullName: 100,
  email: 254,
  phone: 30,
  headline: 200,
  bio: 5000,
  specialization: 120,
  skill: 60,
  skills: 30,
  yearsExperience: 70,
  url: 500,
  reason: 2000,
  notes: 2000,
  search: 200,
  limit: 100,
};

const STATUSES = ["PENDING", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];

// Anything a reviewer or the server owns — never accepted from a submission.
const REVIEW_ONLY_FIELDS = [
  "status", "reviewNotes", "rejectionReason", "changeRequest",
  "reviewedById", "reviewedAt", "createdUserId", "id",
];

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

function readSkills(value, errors) {
  if (value === undefined) return [];
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

// ── Public submit ───────────────────────────────────────────────────────────────

function validateApplicationSubmit(body = {}) {
  const errors = [];

  for (const key of REVIEW_ONLY_FIELDS) {
    if (body[key] !== undefined) errors.push(`${key} cannot be set on a submission.`);
  }

  const fullName = readString(body.fullName, "fullName", MAX.fullName, errors, { required: true, min: 2 });

  let email;
  if (typeof body.email !== "string" || !body.email.trim()) {
    errors.push("email is required.");
  } else {
    const normalized = body.email.trim().toLowerCase();
    if (normalized.length > MAX.email || !EMAIL_REGEX.test(normalized)) errors.push("email must be a valid email address.");
    else email = normalized;
  }

  const phone           = readString(body.phone, "phone", MAX.phone, errors);
  const headline        = readString(body.headline, "headline", MAX.headline, errors);
  const bio             = readString(body.bio, "bio", MAX.bio, errors, { required: true, min: 30 });
  const specialization  = readString(body.specialization, "specialization", MAX.specialization, errors, { required: true, min: 2 });
  const yearsExperience = readInt(body.yearsExperience, "yearsExperience", 0, MAX.yearsExperience, errors);
  const cvUrl           = readUrl(body.cvUrl, "cvUrl", errors);
  const portfolioUrl    = readUrl(body.portfolioUrl, "portfolioUrl", errors);
  const skills          = readSkills(body.skills, errors);

  // Honeypot: a real form leaves this hidden input empty.
  const spam = typeof body.website === "string" && body.website.trim().length > 0;

  return {
    isValid: errors.length === 0,
    errors,
    spam,
    data: {
      fullName,
      email,
      phone:           phone           ?? null,
      headline:        headline        ?? null,
      bio,
      specialization,
      yearsExperience: yearsExperience ?? null,
      cvUrl:           cvUrl           ?? null,
      portfolioUrl:    portfolioUrl    ?? null,
      skills:          skills          ?? [],
    },
  };
}

// ── Admin review decisions ──────────────────────────────────────────────────────

function validateApprove(body = {}) {
  const errors = [];
  const reviewNotes = readString(body.reviewNotes, "reviewNotes", MAX.notes, errors);
  return { isValid: errors.length === 0, errors, data: { reviewNotes: reviewNotes ?? null } };
}

function validateReject(body = {}) {
  const errors = [];
  const rejectionReason = readString(body.rejectionReason, "rejectionReason", MAX.reason, errors, { required: true, min: 3 });
  const reviewNotes     = readString(body.reviewNotes, "reviewNotes", MAX.notes, errors);
  return {
    isValid: errors.length === 0,
    errors,
    data: { rejectionReason, reviewNotes: reviewNotes ?? null },
  };
}

function validateRequestChanges(body = {}) {
  const errors = [];
  const changeRequest = readString(body.changeRequest, "changeRequest", MAX.reason, errors, { required: true, min: 3 });
  const reviewNotes   = readString(body.reviewNotes, "reviewNotes", MAX.notes, errors);
  return {
    isValid: errors.length === 0,
    errors,
    data: { changeRequest, reviewNotes: reviewNotes ?? null },
  };
}

// ── List query ──────────────────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 10 };

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
  if (query.status !== undefined) {
    const s = String(query.status).trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(", ").toLowerCase()}.`);
    else data.status = s;
  }

  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  STATUSES,
  validateId,
  validateApplicationSubmit,
  validateApprove,
  validateReject,
  validateRequestChanges,
  validateListQuery,
};
