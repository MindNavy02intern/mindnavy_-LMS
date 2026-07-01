/**
 * Clears the login-attempt lockout for a specific admin email (or all emails).
 *
 * Usage:
 *   node scripts/resetLoginLockout.js bilalalsaleh751@gmail.com
 *   node scripts/resetLoginLockout.js --all
 *
 * Safe to run any time — it only removes the FAILED/INVALID_CREDENTIALS rows
 * in login_attempts that drive the 15-minute lockout window. Admin accounts,
 * sessions, org data, and audit logs are never touched.
 */

require("dotenv").config();
const prisma = require("../src/config/prisma");

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: node scripts/resetLoginLockout.js <email>  OR  --all");
    process.exit(1);
  }

  const where =
    arg === "--all"
      ? { status: "FAILED", reason: "INVALID_CREDENTIALS" }
      : { email: arg, status: "FAILED", reason: "INVALID_CREDENTIALS" };

  const { count } = await prisma.loginAttempt.deleteMany({ where });

  const target = arg === "--all" ? "all admin emails" : `"${arg}"`;
  console.log(`✓ Deleted ${count} failed-attempt row(s) for ${target}.`);
  console.log("  Lockout cleared — you can log in again immediately.");
}

main()
  .catch((err) => { console.error("Error:", err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
