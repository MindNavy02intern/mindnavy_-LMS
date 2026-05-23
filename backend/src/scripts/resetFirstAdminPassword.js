require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { validatePasswordStrength } = require("../utils/passwordPolicy");

async function resetFirstAdminPassword() {
  const email = process.env.FIRST_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.FIRST_ADMIN_PASSWORD;

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

  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin) {
    console.error("Error: Admin not found.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.update({
    where: { email },
    data: {
      passwordHash,
      updatedAt: new Date(),
    },
  });

  await prisma.adminSession.updateMany({
    where: {
      adminId: admin.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  console.log("Admin password reset successfully:", email);
  console.log("All active admin sessions revoked.");
}

resetFirstAdminPassword()
  .catch((error) => {
    console.error("Failed to reset admin password:", error.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });