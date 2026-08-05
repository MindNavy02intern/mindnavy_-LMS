/**
 * One-time data fix: the two LM seed instructors were created with hardcoded
 * non-UUID ids ("seed-inst-1" / "seed-inst-2") by seedLearning.js before it
 * switched to crypto.randomUUID(). Non-UUID ids fail the app-level UUID
 * validators (e.g. the Messages "recipientId must be a valid UUID" check).
 *
 * How this is safe: every foreign key in the schema that references
 * app_users.id is ON UPDATE CASCADE at the database level (verified live
 * against pg_constraint/information_schema before writing this script — see
 * the query in the PR/session notes). That means a single
 * `appUser.update({ where: { id: old }, data: { id: new } })` is enough —
 * Postgres itself propagates the new id to every dependent row (courses,
 * live_sessions, course_enrollments, certificates, instructor_profiles,
 * admin_messages, user_role_assignments, app_user_sessions, group_members,
 * branches.managerId, departments.managerId, teams.leaderId). Manually
 * rewriting those tables would be redundant and would fight the cascade —
 * intentionally NOT done here.
 *
 * Both instructors are fixed inside one transaction: either both ids get
 * replaced, or neither does (no half-fixed state if something errors
 * mid-way). Safe to re-run — any target id not found (already fixed, or
 * never seeded) is skipped, not treated as an error.
 *
 * Run (from the backend folder):
 *   node src/scripts/fixSeedInstructorIds.js
 */

const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const prisma = require("../config/prisma");

// Real FK columns referencing app_users.id, per the live pg_constraint check
// (all ON UPDATE CASCADE) — used only to report what moved, not to write.
const DEPENDENT_TABLES = [
  { table: "courses",                 column: "instructorId" },
  { table: "live_sessions",           column: "instructorId" },
  { table: "instructor_profiles",     column: "userId" },
  { table: "course_enrollments",      column: "userId" },
  { table: "certificates",            column: "userId" },
  { table: "admin_messages",          column: "receiverUserId" },
  { table: "user_role_assignments",   column: "userId" },
  { table: "app_user_sessions",       column: "userId" },
  { table: "group_members",           column: "userId" },
  { table: "branches",                column: "managerId" },
  { table: "departments",             column: "managerId" },
  { table: "teams",                   column: "leaderId" },
];

const TARGET_IDS = ["seed-inst-1", "seed-inst-2"];

async function countReferencing(id) {
  const counts = {};
  for (const { table, column } of DEPENDENT_TABLES) {
    // Table/column names come only from the fixed DEPENDENT_TABLES list above
    // (never user input), so this is safe despite being a raw identifier.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "${table}" WHERE "${column}" = $1`,
      id,
    );
    const n = rows[0]?.n ?? 0;
    if (n > 0) counts[`${table}.${column}`] = n;
  }
  return counts;
}

async function main() {
  console.log("Fixing non-UUID seed instructor ids...\n");

  const fixed = [];

  await prisma.$transaction(async (tx) => {
    for (const oldId of TARGET_IDS) {
      const existing = await tx.appUser.findUnique({ where: { id: oldId } });
      if (!existing) {
        console.log(`Skip "${oldId}" — not found (already fixed, or never seeded).`);
        continue;
      }

      const newId = crypto.randomUUID();
      await tx.appUser.update({ where: { id: oldId }, data: { id: newId } });
      fixed.push({ oldId, newId, fullName: existing.fullName, email: existing.email });
      console.log(`${existing.fullName} <${existing.email}>: "${oldId}" -> "${newId}"`);
    }
  });

  if (fixed.length === 0) {
    console.log("\nNothing to fix — no seed instructors with non-UUID ids were found.");
    return;
  }

  console.log("\nVerifying cascade — rows now referencing each new id:");
  for (const { fullName, newId } of fixed) {
    const counts = await countReferencing(newId);
    console.log(`  ${fullName} (${newId}):`, Object.keys(counts).length ? counts : "(no dependent rows)");
  }

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fix failed — transaction rolled back, no partial changes:", err);
    process.exit(1);
  });
