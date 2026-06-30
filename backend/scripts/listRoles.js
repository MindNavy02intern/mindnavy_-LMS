require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const FAKE_PATTERN = /(\d{10,})|^(DupRole|PermRole|TestRole|Role|saleh)\d*/i;

async function main() {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const real = [];
  const fake = [];

  for (const r of roles) {
    if (FAKE_PATTERN.test(r.name)) {
      fake.push(r);
    } else {
      real.push(r);
    }
  }

  console.log(`\nTotal roles in DB: ${roles.length}`);

  console.log(`\n=== REAL roles (KEEP) — ${real.length} ===`);
  for (const r of real) {
    console.log(`${r.id} | ${r.name} | ${r.status} | ${r.createdAt.toISOString()}`);
  }

  console.log(`\n=== FAKE/TEST roles (candidates for DELETE) — ${fake.length} ===`);
  for (const r of fake) {
    console.log(`${r.id} | ${r.name} | ${r.status} | ${r.createdAt.toISOString()}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
