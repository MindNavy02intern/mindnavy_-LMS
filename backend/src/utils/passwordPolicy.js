// Built-in minimum. System Settings > Security "Minimum Length" can RAISE it,
// never lower it — settings.service pushes the configured value in whenever it
// (re)loads settings, so this stays a plain synchronous check for the
// validators. Until settings have loaded (or if they can't), the floor applies.
const PASSWORD_MIN_LENGTH_FLOOR = 12;
let configuredMinLength = PASSWORD_MIN_LENGTH_FLOOR;

function setConfiguredPasswordMinLength(value) {
  configuredMinLength = Math.max(PASSWORD_MIN_LENGTH_FLOOR, Number(value) || 0);
}

function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
    return errors;
  }

  // Validate the exact string that will be hashed — no trimming, so the
  // password checked here is byte-for-byte the one bcrypt stores.
  if (password.length < configuredMinLength) {
    errors.push(`Password must be at least ${configuredMinLength} characters.`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include at least one special character.");
  }

  return errors;
}

module.exports = {
  PASSWORD_MIN_LENGTH_FLOOR,
  setConfiguredPasswordMinLength,
  validatePasswordStrength,
};