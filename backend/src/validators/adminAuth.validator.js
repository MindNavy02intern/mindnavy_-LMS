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
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { email, code, newPassword },
  };
}

module.exports = {
  validateAdminLoginInput,
  validateAdminOtpInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,


};