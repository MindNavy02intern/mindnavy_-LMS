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

module.exports = {
  validateAdminLoginInput,
};