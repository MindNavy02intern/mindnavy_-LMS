const { validatePasswordStrength } = require("../utils/passwordPolicy");

function validateAdminLoginInput(body) {
  const errors = [];

  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString();

  if (!email) {
    errors.push("Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email format.");
  }

  if (!password) {
    errors.push("Password is required.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      email,
      password,
    },
  };
}

function validateAdminOtpInput(body) {
  const errors = [];

  const code = body?.code?.toString().trim();
  const trustDevice = body?.trustDevice === true;

  if (!code) {
    errors.push("OTP code is required.");
  } else if (!/^[0-9]{6}$/.test(code)) {
    errors.push("OTP code must be 6 digits.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      code,
      trustDevice,
    },
  };
}

function validateForgotPasswordInput(body) {
  const errors = [];

  const email = body?.email?.toString().trim().toLowerCase();

  if (!email) {
    errors.push("Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email format.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { email },
  };
}

function validateResetPasswordInput(body) {
  const errors = [];

  const email = body?.email?.toString().trim().toLowerCase();
  const code = body?.code?.toString().trim();
  const newPassword = body?.newPassword?.toString();

  if (!email) {
    errors.push("Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email format.");
  }

  if (!code) {
    errors.push("Reset code is required.");
  } else if (!/^[0-9]{6}$/.test(code)) {
    errors.push("Reset code must be 6 digits.");
  }

  if (!newPassword) {
    errors.push("New password is required.");
  } else {
    errors.push(...validatePasswordStrength(newPassword));
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { email, code, newPassword },
  };
}

// ── Profile Page self-service (ProfilePage.tsx) ─────────────────────────────

function validateUpdateAdminProfileInput(body) {
  const errors = [];
  const { fullName, phone, bio } = body || {};

  if (fullName !== undefined) {
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
      errors.push("fullName must be 2-100 characters.");
    }
  }

  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string" || phone.trim().length > 30) {
      errors.push("phone must be a string up to 30 characters.");
    }
  }

  if (bio !== undefined && bio !== null) {
    if (typeof bio !== "string" || bio.trim().length > 500) {
      errors.push("bio must be a string up to 500 characters.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(bio !== undefined ? { bio: bio ? bio.trim() : null } : {}),
    },
  };
}

function validateChangeAdminPasswordInput(body) {
  const errors = [];
  const currentPassword = body?.currentPassword?.toString();
  const newPassword = body?.newPassword?.toString();

  if (!currentPassword) {
    errors.push("currentPassword is required.");
  }

  if (!newPassword) {
    errors.push("newPassword is required.");
  } else {
    errors.push(...validatePasswordStrength(newPassword));
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { currentPassword, newPassword },
  };
}

module.exports = {
  validateAdminLoginInput,
  validateAdminOtpInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateUpdateAdminProfileInput,
  validateChangeAdminPasswordInput,
};