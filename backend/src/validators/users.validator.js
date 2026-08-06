const { validatePasswordStrength } = require("../utils/passwordPolicy");

const VALID_ROLES = new Set(["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"]);
const VALID_STATUSES = new Set(["ACTIVE", "SUSPENDED", "PENDING", "ARCHIVED", "INVITED"]);
const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);

// Violation taxonomy for a suspension (blueprint 05 §14). It lives HERE, next to
// the suspend write and the USER_SUSPENDED audit row that records it, so the
// Instructors module imports one list instead of declaring a second one that
// could drift.
//
// OPTIONAL in v1 on purpose: this endpoint shipped before the field existed and
// the Instructors UI is still adding the dropdown, so an omitted value is valid
// and stored as null. Making it required now would break every caller that is
// already suspending with { reason, notes }.
const VIOLATION_TYPES = new Set([
  "COPYRIGHT",
  "POLICY",
  "FRAUD",
  "BEHAVIOR",
  "FAKE_CERT",
  "SECURITY",
]);

// Single normalizer for the field, shared by both validators and by the service
// that performs the write. Returns the canonical value, or null when absent.
// Throws nothing — callers decide whether an unrecognised value is an error.
function normalizeViolationType(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return VIOLATION_TYPES.has(v) ? v : null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUuidParam(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    return "Invalid user id.";
  }
  return null;
}

function validateCreateUserInput(body) {
  const errors = [];

  const { fullName, email, password, role, status, verificationState } = body || {};

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
    errors.push("fullName is required and must be 2-100 characters.");
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    errors.push("A valid email is required.");
  }

  const effectiveStatus = status ? status.trim().toUpperCase() : "PENDING";
  if (!VALID_STATUSES.has(effectiveStatus)) {
    errors.push(`status must be one of: ${[...VALID_STATUSES].join(", ")}.`);
  }

  // password required unless creating an INVITED user
  if (effectiveStatus !== "INVITED") {
    if (!password || typeof password !== "string") {
      errors.push("password is required.");
    } else {
      const pwErrors = validatePasswordStrength(password);
      errors.push(...pwErrors);
    }
  }

  if (!role || typeof role !== "string" || !VALID_ROLES.has(role.trim().toUpperCase())) {
    errors.push(`role is required and must be one of: ${[...VALID_ROLES].join(", ")}.`);
  }

  if (verificationState != null) {
    if (typeof verificationState !== "string" || !VALID_VERIFICATION_STATES.has(verificationState.trim().toUpperCase())) {
      errors.push(`verificationState must be one of: ${[...VALID_VERIFICATION_STATES].join(", ")}.`);
    }
  }

  return errors;
}

function validateUpdateUserInput(body) {
  const errors = [];
  const ALLOWED_FIELDS = new Set([
    "fullName", "email", "avatar", "verificationState", "riskScore",
    "phone", "department", "branch", "groupId", "accessLevel", "managerId", "skills", "role",
  ]);

  const provided = Object.keys(body || {});

  if (provided.length === 0) {
    errors.push("At least one field must be provided for update.");
    return errors;
  }

  const disallowed = provided.filter((k) => !ALLOWED_FIELDS.has(k));
  if (disallowed.length > 0) {
    errors.push(`Fields not allowed here: ${disallowed.join(", ")}. Use the dedicated status/role/password endpoints.`);
  }

  const { fullName, email, avatar, verificationState, riskScore, phone, department, branch, groupId, accessLevel, managerId, skills } = body;

  if (fullName !== undefined) {
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
      errors.push("fullName must be 2-100 characters.");
    }
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      errors.push("A valid email is required.");
    }
  }

  if (avatar !== undefined && avatar !== null) {
    if (typeof avatar !== "string" || avatar.trim().length > 500) {
      errors.push("avatar must be a string up to 500 characters.");
    }
  }

  if (verificationState !== undefined) {
    if (typeof verificationState !== "string" || !VALID_VERIFICATION_STATES.has(verificationState.trim().toUpperCase())) {
      errors.push(`verificationState must be one of: ${[...VALID_VERIFICATION_STATES].join(", ")}.`);
    }
  }

  if (riskScore !== undefined) {
    if (typeof riskScore !== "number" || !Number.isInteger(riskScore) || riskScore < 0 || riskScore > 100) {
      errors.push("riskScore must be an integer between 0 and 100.");
    }
  }

  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string" || phone.trim().length > 30) {
      errors.push("phone must be a string up to 30 characters.");
    }
  }

  if (department !== undefined && department !== null) {
    if (typeof department !== "string" || department.trim().length > 100) {
      errors.push("department must be a string up to 100 characters.");
    }
  }

  if (branch !== undefined && branch !== null) {
    if (typeof branch !== "string" || branch.trim().length > 100) {
      errors.push("branch must be a string up to 100 characters.");
    }
  }

  if (groupId !== undefined && groupId !== null) {
    if (typeof groupId !== "string" || groupId.trim().length > 100) {
      errors.push("groupId must be a string up to 100 characters.");
    }
  }

  if (accessLevel !== undefined && accessLevel !== null) {
    if (typeof accessLevel !== "string" || accessLevel.trim().length > 50) {
      errors.push("accessLevel must be a string up to 50 characters.");
    }
  }

  if (managerId !== undefined && managerId !== null) {
    if (typeof managerId !== "string" || managerId.trim().length > 100) {
      errors.push("managerId must be a string up to 100 characters.");
    }
  }

  if (skills !== undefined && skills !== null) {
    if (!Array.isArray(skills) || skills.some((s) => typeof s !== "string")) {
      errors.push("skills must be an array of strings.");
    }
  }

  return errors;
}

function validateUpdateUserStatusInput(body) {
  const errors = [];
  const { status, reason } = body || {};

  if (!status || typeof status !== "string" || !VALID_STATUSES.has(status.trim().toUpperCase())) {
    errors.push(`status is required and must be one of: ${[...VALID_STATUSES].join(", ")}.`);
  }

  if (reason != null) {
    if (typeof reason !== "string" || reason.trim().length > 300) {
      errors.push("reason must be a string up to 300 characters.");
    }
  }

  return errors;
}

function validateSuspendUserInput(body) {
  const errors = [];
  const { reason, notes, violationType } = body || {};

  if (!reason || typeof reason !== "string" || reason.trim().length === 0 || reason.trim().length > 300) {
    errors.push("reason is required and must be up to 300 characters.");
  }

  if (notes != null) {
    if (typeof notes !== "string" || notes.trim().length > 500) {
      errors.push("notes must be a string up to 500 characters.");
    }
  }

  // Optional (see VIOLATION_TYPES) — but a value that IS sent must be in the
  // taxonomy. Silently dropping a typo would file the suspension under "no
  // violation type" and the compliance history would under-report it.
  if (violationType != null && normalizeViolationType(violationType) === null) {
    errors.push(`violationType must be one of: ${[...VIOLATION_TYPES].join(", ")}.`);
  }

  return errors;
}

function validateAssignUserRoleInput(body) {
  const errors = [];
  const { roleId, reason } = body || {};

  if (!roleId || typeof roleId !== "string" || !roleId.trim()) {
    errors.push("roleId is required.");
  } else {
    const trimmed = roleId.trim();
    const isEnum = VALID_ROLES.has(trimmed.toUpperCase());
    const isUuid = UUID_REGEX.test(trimmed);
    if (!isEnum && !isUuid) {
      errors.push(`roleId must be a valid role (${[...VALID_ROLES].join(", ")}) or a role UUID.`);
    }
  }

  if (reason != null) {
    if (typeof reason !== "string" || reason.trim().length > 300) {
      errors.push("reason must be a string up to 300 characters.");
    }
  }

  return errors;
}

function validateResetUserPasswordInput(body) {
  const { newPassword } = body || {};

  if (!newPassword || typeof newPassword !== "string") {
    return ["newPassword is required."];
  }

  return validatePasswordStrength(newPassword);
}

function validateSendMessageInput(body) {
  const errors = [];
  const { message, subject } = body || {};

  if (message === undefined || message === null) {
    errors.push("Message body is required.");
    return errors;
  }

  if (typeof message !== "string") {
    errors.push("Message body must be a string.");
    return errors;
  }

  if (message.trim().length === 0) {
    errors.push("Message body cannot be empty.");
    return errors;
  }

  if (message.trim().length > 2000) {
    errors.push("Message body must not exceed 2000 characters.");
  }

  if (subject !== undefined && subject !== null) {
    if (typeof subject !== "string") {
      errors.push("Subject must be a string.");
    } else if (subject.trim().length > 150) {
      errors.push("Subject must not exceed 150 characters.");
    }
  }

  return errors;
}

function validateForceLogoutInput(body) {
  const { reason } = body || {};
  if (reason != null) {
    if (typeof reason !== "string" || reason.trim().length > 300) {
      return ["reason must be a string up to 300 characters."];
    }
  }
  return [];
}

module.exports = {
  VIOLATION_TYPES,
  normalizeViolationType,
  validateUuidParam,
  validateCreateUserInput,
  validateUpdateUserInput,
  validateUpdateUserStatusInput,
  validateSuspendUserInput,
  validateAssignUserRoleInput,
  validateResetUserPasswordInput,
  validateSendMessageInput,
  validateForceLogoutInput,
};
