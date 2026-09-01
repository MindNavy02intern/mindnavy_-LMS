// Cleans up the throwaway rows created by seed-throwaway-admin.js + the
// manual curl end-to-end test (Phase 1 instructor auth verification).
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deletedInstructors = await prisma.appUser.deleteMany({
    where: { email: { contains: 'instr-auth-test-instructor-' } },
  });
  const deletedAdmins = await prisma.adminUser.deleteMany({
    where: { email: { contains: 'instr-auth-test-admin-' } },
  });

  console.log(JSON.stringify({
    deletedInstructors: deletedInstructors.count,
    deletedAdmins: deletedAdmins.count,
  }));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
