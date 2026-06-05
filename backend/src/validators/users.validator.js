const { validatePasswordStrength } = require("../utils/passwordPolicy");

const VALID_ROLES = new Set(["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"]);
const VALID_STATUSES = new Set(["ACTIVE", "SUSPENDED", "PENDING", "ARCHIVED", "INVITED"]);
const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);

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
  const ALLOWED_FIELDS = new Set(["fullName", "email", "avatar", "verificationState", "riskScore"]);

  const provided = Object.keys(body || {});

  if (provided.length === 0) {
    errors.push("At least one field must be provided for update.");
    return errors;
  }

  const disallowed = provided.filter((k) => !ALLOWED_FIELDS.has(k));
  if (disallowed.length > 0) {
    errors.push(`Fields not allowed here: ${disallowed.join(", ")}. Use the dedicated status/role/password endpoints.`);
  }

  const { fullName, email, avatar, verificationState, riskScore } = body;

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

function validateAssignUserRoleInput(body) {
  const errors = [];
  const { role, reason } = body || {};

  if (!role || typeof role !== "string" || !VALID_ROLES.has(role.trim().toUpperCase())) {
    errors.push(`role is required and must be one of: ${[...VALID_ROLES].join(", ")}.`);
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

module.exports = {
  validateUuidParam,
  validateCreateUserInput,
  validateUpdateUserInput,
  validateUpdateUserStatusInput,
  validateAssignUserRoleInput,
  validateResetUserPasswordInput,
};
