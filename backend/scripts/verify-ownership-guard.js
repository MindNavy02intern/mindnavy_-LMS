// Manual verification for src/utils/ownershipGuard.js — no test framework
// exists on the backend (package.json's "test" script is a stub), so this
// mirrors the project's existing scripts/ convention (real dev DB, throwaway
// rows, cleanup in a finally block) rather than inventing a Jest setup for
// one file.
//
// Run: node scripts/verify-ownership-guard.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const { assertOwnsCourse } = require('../src/utils/ownershipGuard');

let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass++;
    console.log(`  PASS - ${label}`);
  } else {
    fail++;
    console.log(`  FAIL - ${label}`);
  }
}

async function main() {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash('Test1234!', 12);

  const instructorA = await prisma.appUser.create({
    data: {
      email: `ownership-guard-a-${stamp}@test.local`,
      passwordHash,
      fullName: 'Ownership Guard Test A',
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
    },
  });

  const instructorB = await prisma.appUser.create({
    data: {
      email: `ownership-guard-b-${stamp}@test.local`,
      passwordHash,
      fullName: 'Ownership Guard Test B',
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
    },
  });

  const course = await prisma.course.create({
    data: {
      title: `Ownership Guard Test Course ${stamp}`,
      category: 'Test',
      instructorId: instructorA.id,
    },
  });

  try {
    console.log('\nCase 1: course owned by A, called with A id -> should PASS');
    try {
      const result = await assertOwnsCourse(course.id, instructorA.id);
      check('assertOwnsCourse resolves for the real owner', result.id === course.id);
    } catch (err) {
      check(`assertOwnsCourse resolves for the real owner (threw ${err.code} instead)`, false);
    }

    console.log('\nCase 2: course owned by A, called with B id -> should THROW 403 FORBIDDEN_NOT_OWNER');
    try {
      await assertOwnsCourse(course.id, instructorB.id);
      check('assertOwnsCourse throws for a non-owner', false);
    } catch (err) {
      check('assertOwnsCourse throws FORBIDDEN_NOT_OWNER', err.code === 'FORBIDDEN_NOT_OWNER');
      check('assertOwnsCourse sets status 403', err.status === 403);
    }

    console.log('\nCase 3: course id does not exist -> should THROW 404 COURSE_NOT_FOUND');
    try {
      await assertOwnsCourse('00000000-0000-0000-0000-000000000000', instructorA.id);
      check('assertOwnsCourse throws for a missing course', false);
    } catch (err) {
      check('assertOwnsCourse throws COURSE_NOT_FOUND', err.code === 'COURSE_NOT_FOUND');
      check('assertOwnsCourse sets status 404', err.status === 404);
    }
  } finally {
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.appUser.delete({ where: { id: instructorA.id } });
    await prisma.appUser.delete({ where: { id: instructorB.id } });
    await prisma.$disconnect();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Verification script crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
