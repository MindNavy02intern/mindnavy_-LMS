const { validatePasswordStrength } = require("../utils/passwordPolicy");

function validateInstructorLoginInput(body) {
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

// Mirrors adminAuth.validator's validateChangeAdminPasswordInput exactly —
// same shape, same shared passwordPolicy.validatePasswordStrength.
function validateChangeInstructorPasswordInput(body) {
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
  validateInstructorLoginInput,
  validateChangeInstructorPasswordInput,
};
