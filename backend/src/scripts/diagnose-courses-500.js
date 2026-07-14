// Diagnostic script for the GET /courses 500 after cleanup-test-data ran.
// Run from backend/: node src/scripts/diagnose-courses-500.js
// Reports orphaned FKs, the specific failing course, and simulates listCourses.

require('dotenv').config()
const prisma = require('../config/prisma')

async function main() {
  console.log('\n── Course 500 diagnostic ──\n')

  // ── 1. All courses: id / title / status / instructorId ──────────────────────
  // NOTE: only selecting fields the CURRENT generated Prisma client knows about.
  // categoryId, isFree, price, etc. are in schema.prisma but NOT in the generated
  // client — that's the root cause of the 500/404. Run prisma generate to fix.
  const allCourses = await prisma.course.findMany({
    select: {
      id: true, title: true, status: true,
      instructorId: true,
      instructor: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total courses in DB: ${allCourses.length}\n`)

  // ── 2. Orphaned instructorId: non-null instructorId with no matching user ────
  const orphanedInstructor = allCourses.filter(
    (c) => c.instructorId !== null && c.instructor === null
  )
  console.log(`Courses with ORPHANED instructorId (non-null but user deleted): ${orphanedInstructor.length}`)
  for (const c of orphanedInstructor) {
    console.log(`  [${c.id}] "${c.title}" (${c.status}) — orphaned instructorId: ${c.instructorId}`)
  }

  // ── 3. Null instructorId (was nulled by cleanup or was already null) ────────
  const nulledInstructor = allCourses.filter((c) => c.instructorId === null)
  console.log(`\nCourses with null instructorId: ${nulledInstructor.length}`)
  for (const c of nulledInstructor) {
    console.log(`  [${c.id}] "${c.title}" (${c.status})`)
  }

  // NOTE: categoryId orphan check skipped — field not in generated Prisma client.
  // The generated client is the OLD schema (pre-wizard fields). Run prisma generate.

  // ── 5. Look up the specific partial ID the frontend is requesting ────────────
  const PARTIAL_ID = 'bd2b'  // the prefix from the 404 in the user's report
  const specificCourse = allCourses.find(
    (c) => c.id.startsWith(PARTIAL_ID) || c.id.includes(PARTIAL_ID)
  )
  if (specificCourse) {
    console.log(`\nCourse matching partial id "${PARTIAL_ID}": FOUND`)
    console.log(`  id: ${specificCourse.id}`)
    console.log(`  title: "${specificCourse.title}"`)
    console.log(`  status: ${specificCourse.status}`)
    console.log(`  instructorId: ${specificCourse.instructorId ?? 'null'}`)
    console.log(`  categoryId: ${specificCourse.categoryId ?? 'null'}`)
  } else {
    console.log(`\nCourse matching partial id "${PARTIAL_ID}": NOT FOUND (was deleted by cleanup)`)
  }

  // ── 6. Simulate the listCourses query exactly ───────────────────────────────
  console.log('\n── Simulating listCourses({ status: "All", page: 1, limit: 10 }) ──')
  try {
    const where = { status: { not: 'ARCHIVED' } }
    const [total, rows, statusGroups] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where, skip: 0, take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, title: true, category: true, level: true, status: true,
          thumbnail: true, updatedAt: true, instructorId: true,
          instructor: { select: { fullName: true } },
        },
      }),
      prisma.course.groupBy({ by: ['status'], where: {}, _count: { _all: true } }),
    ])
    console.log(`  count: ${total}  rows returned: ${rows.length}  statusGroups: ${statusGroups.length}`)
    console.log('  listCourses simulation: OK — no exception thrown')
  } catch (err) {
    console.error('  listCourses simulation THREW:', err)
  }

  // ── 7. Simulate getCourse with OLD select (to isolate query from client issue) ──
  if (specificCourse) {
    console.log(`\n── Simulating getCourse("${specificCourse.id}") with OLD select ──`)
    try {
      const c = await prisma.course.findUnique({
        where: { id: specificCourse.id },
        select: {
          id: true, title: true, category: true, level: true, status: true,
          thumbnail: true, updatedAt: true, instructorId: true,
          instructor: { select: { fullName: true } },
          subtitle: true, description: true, language: true, tags: true,
          createdBy: true, createdAt: true,
        },
      })
      console.log(`  findUnique (old fields only): ${c ? 'OK — row found in DB' : 'NULL — NOT in DB (was deleted)'}`)
    } catch (err) {
      console.error('  findUnique THREW even with old fields:', err.message)
    }

    console.log(`\n── Simulating getCourse with NEW select (will show the Prisma client error) ──`)
    try {
      const c2 = await prisma.course.findUnique({
        where: { id: specificCourse.id },
        select: {
          id: true, title: true, category: true, level: true, status: true,
          thumbnail: true, updatedAt: true, instructorId: true,
          instructor: { select: { fullName: true } },
          subtitle: true, description: true, language: true, tags: true,
          createdBy: true, createdAt: true,
          // New fields — these will fail until prisma generate is run:
          isFree: true, price: true, currency: true, enrollmentLimit: true,
          visibility: true, certificateEnabled: true, dripContentEnabled: true,
          accessRules: true, seoTitle: true, seoDescription: true,
          rejectionReason: true, reviewedAt: true, categoryId: true,
        },
      })
      console.log(`  findUnique (new fields): OK — ${c2 ? 'row found' : 'not found'}`)
    } catch (err) {
      console.error(`  findUnique (new fields) THREW: ${err.message.split('\n')[0]}`)
      console.log('  *** This is why getCourse returns 404 instead of the real course data ***')
    }
  }

  // ── 8. Check if the courseEnrollment groupBy works ──────────────────────────
  console.log('\n── Simulating enrollment groupBy ──')
  try {
    const ids = allCourses.slice(0, 5).map(c => c.id)
    const agg = await prisma.courseEnrollment.groupBy({
      by: ['courseId'],
      where: { courseId: { in: ids } },
      _count: { _all: true },
    })
    console.log(`  enrollment groupBy: OK — ${agg.length} rows`)
  } catch (err) {
    console.error('  enrollment groupBy THREW:', err)
  }

  // ── 9. Raw Prisma connection check ──────────────────────────────────────────
  console.log('\n── Prisma connection check ──')
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS ping`
    console.log(`  DB ping: ${JSON.stringify(result)}`)
  } catch (err) {
    console.error('  DB ping THREW — connection is down:', err)
  }

  console.log('\n── Diagnostic complete ──\n')
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Diagnostic failed at top level:', err)
  await prisma.$disconnect()
  process.exit(1)
})
