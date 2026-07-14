// Backstop cleanup: finds and optionally deletes test-generated data in the DB.
// Run in dry-run mode (default): npm run cleanup:test-data
// Run to actually delete:        npm run cleanup:test-data -- --delete
//
// Safe patterns: only matches email/title prefixes that no real user would have.
// Does NOT match by date — targets structural patterns only.

require('dotenv').config()
const prisma = require('../config/prisma')

const DRY_RUN = !process.argv.includes('--delete')

// Email prefixes used exclusively by test helpers in *.full.spec.ts files.
const TEST_EMAIL_PREFIXES = [
  'test.',
  'suspend.',
  'archive.',
  'approve.',
  'reject.',
  'assignrole.',
  'message.',
  'logout.',
  'import.',
  'bulksuspend0.',
  'bulksuspend1.',
  'bulksuspend2.',
  'bulkrole0.',
  'bulkrole1.',
  'bulkrole2.',
  'groupmember.',
  'assignee.',
  'tempassignee.',
]

// Course title prefixes used exclusively by test helpers.
const TEST_COURSE_PREFIXES = [
  'Builder Test ',
  'Archive Test Course ',
  'Automation Test Course ',
  'My New Test Course ',
]

// Role name prefixes used exclusively by test helpers.
const TEST_ROLE_PREFIXES = [
  'AssignRole ',
  'TempAssignRole ',
  'MatrixRole ',
]

// Group name prefixes used exclusively by test helpers.
const TEST_GROUP_PREFIXES = [
  'MemberGroup ',
  'SearchGroup ',
  // 'Group ' is intentionally excluded — too broad, could match real groups.
]

async function main() {
  console.log(`\n── MindNavy test-data ${DRY_RUN ? 'AUDIT (dry-run)' : 'CLEANUP'} ──\n`)
  if (DRY_RUN) {
    console.log('Pass --delete to actually remove records.\n')
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const userWhere = {
    OR: TEST_EMAIL_PREFIXES.map(p => ({
      email: { startsWith: p },
    })),
  }
  const testUsers = await prisma.appUser.findMany({
    where: userWhere,
    select: { id: true, email: true, fullName: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Users  matching test patterns: ${testUsers.length}`)
  if (testUsers.length > 0) {
    for (const u of testUsers) {
      console.log(`  ${u.email} (${u.status}) — ${u.createdAt.toISOString()}`)
    }
  }

  // ── Courses ────────────────────────────────────────────────────────────────
  const courseWhere = {
    OR: TEST_COURSE_PREFIXES.map(p => ({
      title: { startsWith: p },
    })),
  }
  const testCourses = await prisma.course.findMany({
    where: courseWhere,
    select: { id: true, title: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`\nCourses matching test patterns: ${testCourses.length}`)
  if (testCourses.length > 0) {
    for (const c of testCourses) {
      console.log(`  [${c.id}] "${c.title}" (${c.status}) — ${c.createdAt.toISOString()}`)
    }
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleWhere = {
    OR: TEST_ROLE_PREFIXES.map(p => ({
      name: { startsWith: p },
    })),
  }
  const testRoles = await prisma.lmsRole.findMany({
    where: roleWhere,
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [])  // model name may differ — non-fatal
  console.log(`\nRoles  matching test patterns: ${testRoles.length}`)

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groupWhere = {
    OR: TEST_GROUP_PREFIXES.map(p => ({
      name: { startsWith: p },
    })),
  }
  const testGroups = await prisma.group.findMany({
    where: groupWhere,
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [])
  console.log(`Groups matching test patterns: ${testGroups.length}`)

  if (DRY_RUN) {
    const total = testUsers.length + testCourses.length + testRoles.length + testGroups.length
    console.log(`\nTotal test-pattern records found: ${total}`)
    console.log('Run with --delete to remove them.')
    await prisma.$disconnect()
    return
  }

  // ── Deletion ───────────────────────────────────────────────────────────────

  // Courses first (no FK blocks from user deletion).
  if (testCourses.length > 0) {
    const ids = testCourses.map(c => c.id)
    const { count } = await prisma.course.deleteMany({ where: { id: { in: ids } } })
    console.log(`\nDeleted ${count} courses.`)
  }

  // Roles.
  if (testRoles.length > 0) {
    for (const r of testRoles) {
      await prisma.lmsRole.delete({ where: { id: r.id } }).catch(e => {
        console.warn(`  Role ${r.id} delete skipped: ${e.message}`)
      })
    }
    console.log(`Deleted ${testRoles.length} roles (best-effort).`)
  }

  // Groups.
  if (testGroups.length > 0) {
    for (const g of testGroups) {
      await prisma.group.delete({ where: { id: g.id } }).catch(e => {
        console.warn(`  Group ${g.id} delete skipped: ${e.message}`)
      })
    }
    console.log(`Deleted ${testGroups.length} groups (best-effort).`)
  }

  // Users: soft-archive first (clears FK constraints), then hard-delete.
  if (testUsers.length > 0) {
    // NULL out any org FKs that reference these users.
    const userIds = testUsers.map(u => u.id)
    await prisma.branch.updateMany({
      where: { managerId: { in: userIds } },
      data: { managerId: null },
    }).catch(() => null)
    await prisma.department.updateMany({
      where: { managerId: { in: userIds } },
      data: { managerId: null },
    }).catch(() => null)
    await prisma.team.updateMany({
      where: { leaderId: { in: userIds } },
      data: { leaderId: null },
    }).catch(() => null)
    await prisma.group.updateMany({
      where: { leaderId: { in: userIds } },
      data: { leaderId: null },
    }).catch(() => null)
    // Delete admin messages sent TO these users (receiverUserId is required, no cascade).
    await prisma.adminMessage.deleteMany({
      where: { receiverUserId: { in: userIds } },
    }).catch(() => null)
    // Course instructorId → NULL (RESTRICT FK on Course).
    await prisma.course.updateMany({
      where: { instructorId: { in: userIds } },
      data: { instructorId: null },
    }).catch(() => null)

    const { count } = await prisma.appUser.deleteMany({ where: { id: { in: userIds } } })
    console.log(`Deleted ${count} users.`)
  }

  console.log('\nCleanup complete.')
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('cleanup-test-data failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
