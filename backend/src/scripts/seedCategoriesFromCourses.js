/**
 * One-time Categories migration (Task 84, step 3):
 *   1. Creates a root Category for every distinct legacy `Course.category` string
 *      that doesn't already exist in the Category table (case-insensitive).
 *   2. Backfills `Course.categoryId` on every unlinked course by name match.
 *
 * Safe to re-run (idempotent): existing categories are reused, already-linked
 * courses are skipped. Existing courses keep working at every step.
 *
 * Run: node src/scripts/seedCategoriesFromCourses.js
 */

require("dotenv").config();

const prisma = require("../config/prisma");

async function main() {
  const groups = await prisma.course.groupBy({ by: ["category"] });
  const legacyNames = groups.map((g) => g.category).filter(Boolean);

  const existing = await prisma.category.findMany({ select: { id: true, name: true } });
  const byLowerName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  let created = 0;
  for (const name of legacyNames) {
    if (byLowerName.has(name.toLowerCase())) continue;
    const cat = await prisma.category.create({ data: { name }, select: { id: true, name: true } });
    byLowerName.set(cat.name.toLowerCase(), cat);
    created++;
  }

  let linked = 0;
  for (const [, cat] of byLowerName) {
    const { count } = await prisma.course.updateMany({
      where: { categoryId: null, category: { equals: cat.name, mode: "insensitive" } },
      data: { categoryId: cat.id },
    });
    linked += count;
  }

  console.log(`Categories seeded: ${created} created (${byLowerName.size} total) · ${linked} courses linked.`);
}

main()
  .catch((err) => { console.error("Seed failed:", err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
