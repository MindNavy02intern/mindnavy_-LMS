require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  await prisma.$executeRaw`ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USERS_IMPORTED'`;
  console.log("AuditAction enum: USERS_IMPORTED value added (or already existed).");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
