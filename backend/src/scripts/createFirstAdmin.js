require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { validatePasswordStrength } = require("../utils/passwordPolicy");

async function createFirstAdmin() {
  const email = process.env.FIRST_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.FIRST_ADMIN_PASSWORD;
  const fullName = process.env.FIRST_ADMIN_FULL_NAME || "MindNavy Admin";

  if (!email || !password) {
    console.error(
      "Error: Please set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in your .env file."
    );
    return;
  }

  const passwordErrors = validatePasswordStrength(password);

  if (passwordErrors.length > 0) {
    console.error("Error: FIRST_ADMIN_PASSWORD is not strong enough.");
    passwordErrors.forEach((error) => console.error("-", error));
    return;
  }

  if (password.length < 8) {
    console.error("Error: FIRST_ADMIN_PASSWORD must be at least 12 characters.");
    return;
  }

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log("Admin already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "super_admin",
      status: "ACTIVE",
    },
  });

  console.log("First admin created:", admin.email);
}

createFirstAdmin()
  .catch((error) => {
    console.error("Failed to create admin:", error.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });