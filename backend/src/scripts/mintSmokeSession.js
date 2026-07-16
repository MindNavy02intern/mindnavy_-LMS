/**
 * Mints a SHORT-LIVED admin session for running the smoke tests locally and
 * prints the Bearer token. Dev tooling only — requires DB access (DATABASE_URL),
 * so it grants nothing an operator doesn't already have. No secret is stored.
 *
 *   node src/scripts/mintSmokeSession.js            -> 30 min session
 *   SMOKE_TTL_MIN=10 node src/scripts/mintSmokeSession.js
 *
 * The session is tagged userAgent "smoke-test" so it's easy to spot and revoke.
 */

require("dotenv").config();

const crypto = require("crypto");
const prisma = require("../config/prisma");

async function main() {
  const admin = await prisma.adminUser.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error("No ACTIVE admin user found. Run create:first-admin first.");
    process.exit(1);
  }

  const ttlMin = Number(process.env.SMOKE_TTL_MIN) || 30;
  const token = crypto.randomBytes(32).toString("hex");

  await prisma.adminSession.create({
    data: {
      adminId:      admin.id,
      sessionToken: token,
      expiresAt:    new Date(Date.now() + ttlMin * 60 * 1000),
      userAgent:    "smoke-test",
    },
  });

  console.log(`Minted ${ttlMin}-minute smoke session for ${admin.email}`);
  console.log(token);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to mint smoke session:", err.message);
  process.exit(1);
});
