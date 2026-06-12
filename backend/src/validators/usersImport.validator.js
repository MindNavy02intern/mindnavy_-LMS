const { validatePasswordStrength } = require("../utils/passwordPolicy");

const MAX_IMPORT_ROWS = 200;
const MAX_RETURNED_ERRORS = 50;
const ALLOWED_HEADERS = ["fullName", "email", "password", "role", "status", "verificationState","phone",];
const REQUIRED_HEADERS = ["fullName", "email", "password", "role"];

const OPTIONAL_HEADERS = [
  "status",
  "verificationState",
  "phone",
];

const VALID_ROLES = new Set(["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"]);
const VALID_STATUSES = new Set(["ACTIVE", "SUSPENDED", "PENDING", "ARCHIVED", "INVITED"]);
const VALID_VERIFICATION_STATES = new Set(["VERIFIED", "PENDING", "REJECTED", "EXPIRED"]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateHeaders(headers) {
  const allowedSet = new Set(ALLOWED_HEADERS);

  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      return `Missing required CSV header: ${required}.`;
    }
  }

  for (const h of headers) {
    if (!allowedSet.has(h)) {
      return `Unknown CSV header: ${h}.`;
    }
  }

  return null;
}

function validateAndNormalizeRow(row, rowNumber, seenEmails) {
  const errors = [];

  const fullName = typeof row.fullName === "string" ? row.fullName.trim() : "";
  const rawEmail = typeof row.email === "string" ? row.email.trim() : "";
  const email = rawEmail.toLowerCase();
  const password = typeof row.password === "string" ? row.password.trim() : "";
  const role = typeof row.role === "string" ? row.role.trim().toUpperCase() : "";
  const phone = row.phone ? row.phone.trim() : null;
  const status =
    typeof row.status === "string" && row.status.trim()
      ? row.status.trim().toUpperCase()
      : "ACTIVE";
  const verificationState =
    typeof row.verificationState === "string" && row.verificationState.trim()
      ? row.verificationState.trim().toUpperCase()
      : "PENDING";

  // fullName
  if (!fullName) {
    errors.push("fullName is required.");
  } else if (fullName.length < 2) {
    errors.push("fullName must be at least 2 characters.");
  } else if (fullName.length > 120) {
    errors.push("fullName must be at most 120 characters.");
  }

  // email
  if (!rawEmail) {
    errors.push("email is required.");
  } else if (rawEmail.length > 254) {
    errors.push("email must be at most 254 characters.");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Invalid email.");
  } else if (seenEmails.has(email)) {
    errors.push("Duplicate email in CSV.");
  } else {
    seenEmails.add(email);
  }

  // password — never log
  if (!password) {
    errors.push("password is required.");
  } else {
    const pwErrors = validatePasswordStrength(password);
    if (pwErrors.length > 0) errors.push(pwErrors[0]);
  }

  // role
  if (!role) {
    errors.push("role is required.");
  } else if (!VALID_ROLES.has(role)) {
    errors.push(`role must be one of: ${[...VALID_ROLES].join(", ")}.`);
  }

  // status (defaulted above)
  if (!VALID_STATUSES.has(status)) {
    errors.push(`status must be one of: ${[...VALID_STATUSES].join(", ")}.`);
  }

  // verificationState (defaulted above)
  if (!VALID_VERIFICATION_STATES.has(verificationState)) {
    errors.push(`verificationState must be one of: ${[...VALID_VERIFICATION_STATES].join(", ")}.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, displayEmail: rawEmail };
  }

  return {
    valid: true,
    displayEmail: email,
    normalized: { fullName, email, password, role, status, verificationState,phone },
  };
}

  function validateImportRows(rows) {
    const validRows = [];
    const returnedErrors = [];
    let failedCount = 0;
    const seenEmails = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // Row 1 is the header; data starts at row 2
      const result = validateAndNormalizeRow(rows[i], rowNumber, seenEmails);

      if (result.valid) {
        validRows.push({ ...result.normalized, rowIndex: rowNumber });
      } else {
        failedCount++;
        if (returnedErrors.length < MAX_RETURNED_ERRORS) {
          returnedErrors.push({
            row: rowNumber,
            email: result.displayEmail || null,
            message: result.errors[0],
          });
        }
      }
    }

    return { validRows, failedCount, returnedErrors };
  }

module.exports = {
  MAX_IMPORT_ROWS,
  MAX_RETURNED_ERRORS,
  ALLOWED_HEADERS,
  validateHeaders,
  validateImportRows,
};
