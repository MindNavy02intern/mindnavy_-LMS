// One-shot: creates a throwaway ACTIVE AdminUser for manual curl testing of
// the instructor-auth flow, prints its email/password, then exits. The row
// is NOT auto-deleted here — cleanup-instructor-auth-test.js removes it
// (and everything it creates downstream) after the curl flow finishes.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = `instr-auth-test-admin-${Date.now()}@test.local`;
  const password = 'TestAdmin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, fullName: 'Instr Auth Test Admin', role: 'admin', status: 'ACTIVE' },
  });

  console.log(JSON.stringify({ id: admin.id, email, password }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
