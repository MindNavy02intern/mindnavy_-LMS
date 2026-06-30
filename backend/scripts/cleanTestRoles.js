require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const TEST_ROLE_PATTERN = /\d{10,}/;
const PROTECTED_NAMES = new Set(['Administrator', 'Manager', 'Instructor', 'Learner']);

const isConfirmed = process.argv.includes('--confirm');

async function main() {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const toDelete = roles.filter(
    (r) => TEST_ROLE_PATTERN.test(r.name) && !PROTECTED_NAMES.has(r.name)
  );

  if (toDelete.length === 0) {
    console.log('No test roles found matching the pattern. Nothing to do.');
    return;
  }

  if (!isConfirmed) {
    console.log(`[DRY RUN] ${toDelete.length} roles would be deleted:`);
    for (const r of toDelete) {
      console.log(`  - ${r.name} (id: ${r.id})`);
    }
    console.log('\nNo changes made. Re-run with --confirm to actually delete these roles.');
    return;
  }

  const result = await prisma.role.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });

  console.log(`${result.count} roles deleted: [${toDelete.map((r) => r.name).join(', ')}]`);
  console.log('Associated role_permissions rows were removed automatically via cascade delete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
