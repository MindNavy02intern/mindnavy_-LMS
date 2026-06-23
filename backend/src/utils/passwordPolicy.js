function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
    return errors;
  }

  password = password.trim();

  if (password.length < 8) {
    errors.push("Password must be at least 12 characters.");
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
  validatePasswordStrength,
};