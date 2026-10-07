/**
 * Marks the Playwright test browser as a TRUSTED DEVICE for every active
 * admin, so `npx playwright test` can sign in without stopping at the
 * new-device email-code step. Exactly what ticking "Trust this device" on the
 * verify screen does — same TrustedDevice row, same 30-day expiry.
 *
 *   npm run trust:test-device        (run once; re-run when it expires)
 *
 * Why it's needed: new-device verification is enforced by the server now
 * (admin.service.js finishLogin). Before, tests reached /dashboard only
 * because the frontend navigated there before its device check finished.
 *
 * Safety:
 *   • Dev-only — refuses unless NODE_ENV=development (config/runtime.js).
 *   • Needs DATABASE_URL, i.e. it grants nothing an operator doesn't already
 *     have (same footing as mintSmokeSession.js).
 *   • Scoped to the loopback addresses and the fixed test user agent set in
 *     frontend/playwright.config.ts — it trusts the test browser on this
 *     machine, not "any browser".
 */

require("dotenv").config();

const prisma = require("../config/prisma");
const { isDevMode } = require("../config/runtime");
const { computeDeviceFingerprint, TRUSTED_DEVICE_DAYS } = require("../services/admin.service");

// Must match `use.userAgent` in frontend/playwright.config.ts.
const TEST_USER_AGENT = "MindNavy-Playwright";
// How req.ip can read a local browser, depending on the OS/IPv6 setup.
const LOOPBACK_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];

async function main() {
  // `return` after each exit, so the guard never depends on process.exit
  // actually halting (it's stubbed in tests, and wrapped by some runners).
  if (!isDevMode()) {
    console.error("Refusing to run: this script is for local development only (set NODE_ENV=development).");
    return process.exit(1);
  }

  const admins = await prisma.adminUser.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (admins.length === 0) {
    console.error("No ACTIVE admin user found. Run create:first-admin first.");
    return process.exit(1);
  }

  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

  for (const admin of admins) {
    for (const ipAddress of LOOPBACK_IPS) {
      const deviceFingerprint = computeDeviceFingerprint({ ipAddress, userAgent: TEST_USER_AGENT });
      await prisma.trustedDevice.upsert({
        where: { adminId_deviceFingerprint: { adminId: admin.id, deviceFingerprint } },
        create: {
          adminId: admin.id,
          deviceFingerprint,
          deviceName: "Playwright test browser",
          ipAddress,
          userAgent: TEST_USER_AGENT,
          expiresAt,
        },
        update: { expiresAt, revokedAt: null, lastUsedAt: new Date() },
      });
    }
    console.log(`Trusted the Playwright test browser for ${admin.email} until ${expiresAt.toISOString().slice(0, 10)}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to trust the test device:", err.message);
  process.exit(1);
});
