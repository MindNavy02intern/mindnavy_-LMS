/**
 * One-time backfill: mints a verificationCode for legacy certificate rows that
 * predate the Certificates system (the column is new and nullable only for
 * their sake). Also snapshots metadata { studentName, courseTitle } so old
 * certs render like new ones. Safe to re-run — only touches rows with a
 * NULL code.
 *
 *   node src/scripts/backfillCertificateCodes.js
 */

require("dotenv").config();

const crypto = require("crypto");
const prisma = require("../config/prisma");

async function main() {
  const legacy = await prisma.certificate.findMany({
    where: { verificationCode: null },
    select: {
      id: true,
      user:   { select: { fullName: true } },
      course: { select: { title: true } },
    },
  });

  for (const cert of legacy) {
    await prisma.certificate.update({
      where: { id: cert.id },
      data: {
        verificationCode: crypto.randomBytes(16).toString("hex"),
        metadata: {
          studentName: cert.user?.fullName ?? null,
          courseTitle: cert.course?.title ?? null,
        },
      },
    });
  }

  console.log(`Backfilled verification codes for ${legacy.length} legacy certificate(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
