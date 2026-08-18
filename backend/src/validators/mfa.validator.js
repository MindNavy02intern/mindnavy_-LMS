// Validation for TOTP MFA endpoints (setup/verify/disable/login-verify).

function readCode(body, errors) {
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) errors.push("code must be a 6-digit number.");
  return code;
}

function validateMfaVerify(body = {}) {
  const errors = [];
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  if (!secret) errors.push("secret is required.");
  const code = readCode(body, errors);
  return { isValid: errors.length === 0, errors, data: { secret, code } };
}

function validateMfaDisable(body = {}) {
  const errors = [];
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) errors.push("password is required.");
  return { isValid: errors.length === 0, errors, data: { password } };
}

function validateMfaLoginVerify(body = {}) {
  const errors = [];
  const mfaToken = typeof body.mfaToken === "string" ? body.mfaToken.trim() : "";
  if (!mfaToken) errors.push("mfaToken is required.");
  const code = readCode(body, errors);
  return { isValid: errors.length === 0, errors, data: { mfaToken, code } };
}

module.exports = { validateMfaVerify, validateMfaDisable, validateMfaLoginVerify };
