// Backstop cleanup: finds and optionally deletes test-generated data in the DB.
// Run in dry-run mode (default): npm run cleanup:test-data
// Run to actually delete:        npm run cleanup:test-data -- --delete
//
// Safe patterns: only matches email/name/title prefixes that no real record
// would have. Generic single-word prefixes (Group, Role, Team, Branch,
// Department, Policy, ...) are additionally required to end in a pure-digit
// suffix (matching the *.full.spec.ts `uid()`/`Date.now()` helpers) so a real
// "Group Alpha" or "Role Manager" can never match. Does NOT match by date —
// targets structural patterns only.

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
  'roleuser.',
  'message.',
  'logout.',
  'import.',
  'invite.',
  'bulksuspend0.', 'bulksuspend1.', 'bulksuspend2.',
  'bulkrole0.', 'bulkrole1.', 'bulkrole2.',
  'groupmember.',
  'assignee.',
  'tempassignee.',
  'dash-pending-',
  'qa.',
  'qa.competencies.learner.',
  'qa.finance.learner.',
  'qa.instructor.',
  'qa.learner.',
  'qa.learner.bulk.',
  'qa.learners.instructor.',
  'qa.notifications.learner.',
  'qa.panel.instructor.',
  'qa.phaseb.instructor.',
  'qa.phasecd.instructor.',
  'qa.stats.instructor.',
  // Node smoke-test scripts (src/scripts/*SmokeTest.js) use this prefix.
  'smoke.',
]

// Course title prefixes used exclusively by test helpers.
const TEST_COURSE_PREFIXES = [
  'Builder Test ', 'Archive Test Course ', 'Automation Test Course ', 'My New Test Course ',
  'Course for cat ', 'Draft NoApprove ', 'Dup Enroll Course ', 'Enroll Test Course ',
  'Full Course Test ', 'Status Change Course ', 'Unenroll Course ',
  'Cert Disabled Course ', 'Cert Dup Course ', 'Cert Issue Course ', 'Cert PdfDownload Course ',
  'Cert PdfRevoked Course ', 'Cert Placeholder Course ', 'Cert PublicVerify Course ',
  'Cert PublicVerifyRevoked Course ', 'Cert Reissue Course ', 'Cert Revoke Course ', 'Cert TplDelete Course ',
  'LP AddCourse ', 'LP Archived Course ', 'LP Course Fixture ', 'LP Dup Course ',
  'LP Remove Course ', 'LP Reorder Course A ', 'LP Reorder Course B ',
  'Quiz Course Fixture ',
  'BasicInfo NoChange ', 'BasicInfo Regression ', 'BasicInfo SaveDraft ',
  'Preview 404 ', 'Preview Empty ', 'Preview Nav ', 'Preview Test ', 'Preview Toggle ', 'Preview Video ',
  'Settings AccessRules ', 'Settings FreePaid ', 'Settings Group ', 'Settings Next ',
  'Settings NoChange ', 'Settings Prereq ', 'Settings Test ', 'Settings Validation ',
  'Submit Bare ', 'Submit DoubleClick ', 'Submit Invalidation ', 'Submit NonDraft ',
  'Submit Ready ', 'Submit SaveDraft ', 'Submit WrongState ',
  'Approve Cancel ', 'Approve DoubleClick ', 'Approve Race ', 'Approve Test ',
  'Reject Modal ', 'Reject Reason Visible ', 'Reject DoubleClick ', 'Reject Submit ',
  'QA Panel Course ', 'QA Learners Course ', 'QA Learners Bulk Course ', 'QA Phase B Course ',
  'RESTORE SMOKE ', 'Upload Fixture ',
]

// Role name prefixes used exclusively by test helpers. All followed by a
// pure-digit uid() suffix — checked below, not just startsWith.
const TEST_ROLE_PREFIXES = [
  'AssignRole ', 'TempAssignRole ', 'MatrixRole ', 'PermRole ',
  'DupRole ', 'RoleWithUsers ', 'Role ',
]

// Group name prefixes. 'Group ' alone is generic — numeric-suffix-gated below.
const TEST_GROUP_PREFIXES = ['MemberGroup ', 'SearchGroup ', 'Group ']

// ── New: everything else the current suite creates ──────────────────────────

const TEST_CATEGORY_PREFIXES = [ // Category (course categories)
  'Cat Delete ', 'Cat FormPicker ', 'Cat HasChildren ', 'Cat HasChildren Sub ', 'Cat HasCourses ',
  'Cat Rename New ', 'Cat Rename Old ', 'Cat Root ', 'Cat Tree Root ', 'Cat Tree Sub ', 'Cat UI Root ',
]

const TEST_SKILL_CATEGORY_PREFIXES = [] // none dedicated yet — skills use SkillCategory only via UI, no *.full.spec.ts fixture prefix found

const TEST_SKILL_PREFIXES = [ // Skill (competency)
  'QA Competency ', 'QA Import Competency ',
]

const TEST_FRAMEWORK_PREFIXES = ['QA Framework '] // CompetencyFramework

const TEST_CERT_TEMPLATE_PREFIXES = [ // CertificateTemplate
  'Cert Template ', 'Cert Edit Test ', 'Cert Placeholder Template ', 'Cert TplDelete Template ',
  'QA Template ', 'Test Template ',
]

const TEST_LEARNING_PATH_PREFIXES = [ // LearningPath (title)
  'LP AddSession ', 'LP Archived ', 'LP Create Test ', 'LP Delete Test ', 'LP Duplicate ',
  'LP Edit Changed ', 'LP Edit Source ', 'LP Missing ', 'LP NoChange ', 'LP Remove ',
  'LP Reorder ', 'LP UnknownId ',
]

const TEST_QUIZ_PREFIXES = [ // Quiz (title)
  'Quiz AllTypes ', 'Quiz Attached Test ', 'Quiz Create Test ', 'Quiz Delete Test ',
  'Quiz DeleteQuestion ', 'Quiz Edit Test ', 'Quiz EditQuestion ', 'Quiz EssayNoPrompt ',
  'Quiz MCNoAnswer ', 'Quiz MSNoAnswer ', 'Quiz NoChange ', 'Quiz Picker Guard ',
  'Quiz Reorder ', 'Quiz TFNoPrompt ', 'Quiz TypeDataGuard ',
]

const TEST_LIVE_SESSION_PREFIXES = ['Past Session ', 'LS Create Test '] // LiveSession (title)

const TEST_BRANCH_PREFIXES = ['Branch ', 'DeptPrereqBranch ', 'TeamPrereqBranch '] // Branch
const TEST_DEPARTMENT_PREFIXES = ['Department ', 'TeamPrereqDept '] // Department
const TEST_TEAM_PREFIXES = ['Team '] // Team

const TEST_COUPON_CODE_PREFIXES = ['QA'] // Coupon.code — e.g. `QA${stamp}`, numeric-gated below
const TEST_TAX_RULE_PREFIXES = ['QA Tax Rule ']
const TEST_INSTRUCTOR_CERT_PREFIXES = ['QA Phase CD Cert ']
const TEST_ANNOUNCEMENT_PREFIXES = ['QA Announcement ', 'QA In-App Alert ']
const TEST_API_KEY_PREFIXES = ['QA API Key ']
const TEST_WEBHOOK_PREFIXES = ['QA Webhook ']
const TEST_ACCESS_POLICY_PREFIXES = ['Policy ', 'SearchPolicy ', 'FilterAllow ', 'FilterDeny ']
const TEST_ROLE_TEMPLATE_PREFIXES = ['QA Template ', 'Test Template ']
const TEST_SCHEDULED_REPORT_PREFIXES = ['Weekly Learners ']

// ── Helpers ───────────────────────────────────────────────────────────────────

// Prisma `startsWith` alone isn't precise enough for short/generic prefixes
// ("Group ", "Role ", "Team ", "Branch ", "Department ", "Policy ", coupon
// code "QA") — a real record could plausibly start the same way. Every
// *.full.spec.ts fixture appends `uid()`/`Date.now()`/`stamp`, which is
// ALWAYS a run of pure digits, so requiring that suffix shape removes the
// false-positive risk without needing per-field exceptions.
function endsInDigits(value, prefix) {
  const rest = value.slice(prefix.length)
  return /^\d+$/.test(rest.trim())
}

function orConditions(field, prefixes) {
  return prefixes.map(p => ({ [field]: { startsWith: p } }))
}

async function findByPrefixes(delegate, field, prefixes, digitGated = []) {
  if (prefixes.length === 0) return []
  const rows = await delegate.findMany({
    where: { OR: orConditions(field, prefixes) },
    select: { id: true, [field]: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [])
  if (digitGated.length === 0) return rows
  return rows.filter(r => {
    const value = r[field]
    const gatedPrefix = digitGated.find(p => value.startsWith(p))
    return !gatedPrefix || endsInDigits(value, gatedPrefix)
  })
}

async function deleteRows(delegate, rows, label) {
  if (rows.length === 0) return 0
  let count = 0
  for (const r of rows) {
    const ok = await delegate.delete({ where: { id: r.id } }).then(() => true).catch(e => {
      console.warn(`  ${label} ${r.id} delete skipped: ${e.message.split('\n')[0]}`)
      return false
    })
    if (ok) count++
  }
  console.log(`Deleted ${count}/${rows.length} ${label}.`)
  return count
}

async function main() {
  console.log(`\n── MindNavy test-data ${DRY_RUN ? 'AUDIT (dry-run)' : 'CLEANUP'} ──\n`)
  if (DRY_RUN) {
    console.log('Pass --delete to actually remove records.\n')
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  const testUsers = await findByPrefixes(prisma.appUser, 'email', TEST_EMAIL_PREFIXES)
  console.log(`Users  matching test patterns: ${testUsers.length}`)

  const testCourses = await findByPrefixes(prisma.course, 'title', TEST_COURSE_PREFIXES)
  console.log(`Courses matching test patterns: ${testCourses.length}`)

  const roleDelegate = prisma.role ?? null
  const testRoles = roleDelegate
    ? await findByPrefixes(roleDelegate, 'name', TEST_ROLE_PREFIXES, TEST_ROLE_PREFIXES)
    : []
  console.log(`Roles  matching test patterns: ${testRoles.length}`)

  const testGroups = await findByPrefixes(prisma.group, 'name', TEST_GROUP_PREFIXES, TEST_GROUP_PREFIXES)
  console.log(`Groups matching test patterns: ${testGroups.length}`)

  const testApplications = await findByPrefixes(prisma.instructorApplication, 'email', TEST_EMAIL_PREFIXES)
  console.log(`Instructor applications matching test patterns: ${testApplications.length}`)

  const testCategories = await findByPrefixes(prisma.category, 'name', TEST_CATEGORY_PREFIXES)
  console.log(`Course categories matching test patterns: ${testCategories.length}`)

  const testSkillCategories = await findByPrefixes(prisma.skillCategory, 'name', TEST_SKILL_CATEGORY_PREFIXES)
  console.log(`Skill categories matching test patterns: ${testSkillCategories.length}`)

  const testSkills = await findByPrefixes(prisma.skill, 'name', TEST_SKILL_PREFIXES)
  console.log(`Skills (competencies) matching test patterns: ${testSkills.length}`)

  const testFrameworks = await findByPrefixes(prisma.competencyFramework, 'name', TEST_FRAMEWORK_PREFIXES)
  console.log(`Competency frameworks matching test patterns: ${testFrameworks.length}`)

  const testCertTemplates = await findByPrefixes(prisma.certificateTemplate, 'name', TEST_CERT_TEMPLATE_PREFIXES)
  console.log(`Certificate templates matching test patterns: ${testCertTemplates.length}`)

  const testLearningPaths = await findByPrefixes(prisma.learningPath, 'title', TEST_LEARNING_PATH_PREFIXES)
  console.log(`Learning paths matching test patterns: ${testLearningPaths.length}`)

  const testQuizzes = await findByPrefixes(prisma.quiz, 'title', TEST_QUIZ_PREFIXES)
  console.log(`Quizzes matching test patterns: ${testQuizzes.length}`)

  const testLiveSessions = await findByPrefixes(prisma.liveSession, 'title', TEST_LIVE_SESSION_PREFIXES)
  console.log(`Live sessions matching test patterns: ${testLiveSessions.length}`)

  const testTeams = await findByPrefixes(prisma.team, 'name', TEST_TEAM_PREFIXES, TEST_TEAM_PREFIXES)
  console.log(`Teams matching test patterns: ${testTeams.length}`)

  const testDepartments = await findByPrefixes(prisma.department, 'name', TEST_DEPARTMENT_PREFIXES, TEST_DEPARTMENT_PREFIXES)
  console.log(`Departments matching test patterns: ${testDepartments.length}`)

  const testBranches = await findByPrefixes(prisma.branch, 'name', TEST_BRANCH_PREFIXES, TEST_BRANCH_PREFIXES)
  console.log(`Branches matching test patterns: ${testBranches.length}`)

  const testCoupons = await findByPrefixes(prisma.coupon, 'code', TEST_COUPON_CODE_PREFIXES, TEST_COUPON_CODE_PREFIXES)
  console.log(`Coupons matching test patterns: ${testCoupons.length}`)

  const testTaxRules = await findByPrefixes(prisma.taxRule, 'name', TEST_TAX_RULE_PREFIXES)
  console.log(`Tax rules matching test patterns: ${testTaxRules.length}`)

  const testInstructorCerts = await findByPrefixes(prisma.instructorCertification, 'name', TEST_INSTRUCTOR_CERT_PREFIXES)
  console.log(`Instructor certifications matching test patterns: ${testInstructorCerts.length}`)

  const testAnnouncements = await findByPrefixes(prisma.announcement, 'title', TEST_ANNOUNCEMENT_PREFIXES)
  console.log(`Announcements matching test patterns: ${testAnnouncements.length}`)

  const testApiKeys = await findByPrefixes(prisma.apiKey, 'name', TEST_API_KEY_PREFIXES)
  console.log(`API keys matching test patterns: ${testApiKeys.length}`)

  const testWebhooks = await findByPrefixes(prisma.webhook, 'name', TEST_WEBHOOK_PREFIXES)
  console.log(`Webhooks matching test patterns: ${testWebhooks.length}`)

  const testAccessPolicies = await findByPrefixes(prisma.accessPolicy, 'name', TEST_ACCESS_POLICY_PREFIXES, TEST_ACCESS_POLICY_PREFIXES)
  console.log(`Access policies matching test patterns: ${testAccessPolicies.length}`)

  const testRoleTemplates = await findByPrefixes(prisma.roleTemplate, 'name', TEST_ROLE_TEMPLATE_PREFIXES)
  console.log(`Role templates matching test patterns: ${testRoleTemplates.length}`)

  const testScheduledReports = await findByPrefixes(prisma.scheduledReport, 'name', TEST_SCHEDULED_REPORT_PREFIXES)
  console.log(`Scheduled reports matching test patterns: ${testScheduledReports.length}`)

  const groups = [
    ['Users', testUsers], ['Courses', testCourses], ['Roles', testRoles], ['Groups', testGroups],
    ['Instructor applications', testApplications], ['Course categories', testCategories],
    ['Skill categories', testSkillCategories], ['Skills', testSkills], ['Frameworks', testFrameworks],
    ['Certificate templates', testCertTemplates], ['Learning paths', testLearningPaths],
    ['Quizzes', testQuizzes], ['Live sessions', testLiveSessions], ['Teams', testTeams],
    ['Departments', testDepartments], ['Branches', testBranches], ['Coupons', testCoupons],
    ['Tax rules', testTaxRules], ['Instructor certifications', testInstructorCerts],
    ['Announcements', testAnnouncements], ['API keys', testApiKeys], ['Webhooks', testWebhooks],
    ['Access policies', testAccessPolicies], ['Role templates', testRoleTemplates],
    ['Scheduled reports', testScheduledReports],
  ]

  if (DRY_RUN) {
    const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0)
    console.log(`\nTotal test-pattern records found: ${total}`)
    console.log('Run with --delete to remove them.')
    await prisma.$disconnect()
    return
  }

  // ── Deletion (leaf/child tables first — FK-safe order) ──────────────────────
  console.log('')

  await deleteRows(prisma.team, testTeams, 'teams')
  await deleteRows(prisma.department, testDepartments, 'departments')
  await deleteRows(prisma.branch, testBranches, 'branches') // cascades any leftover teams/departments under it

  await deleteRows(prisma.learningPath, testLearningPaths, 'learning paths') // cascades LearningPathItem
  await deleteRows(prisma.quiz, testQuizzes, 'quizzes') // cascades Question
  await deleteRows(prisma.liveSession, testLiveSessions, 'live sessions')

  await deleteRows(prisma.competencyFramework, testFrameworks, 'competency frameworks') // cascades FrameworkSkill
  await deleteRows(prisma.skill, testSkills, 'skills') // cascades SkillCourseMapping/UserSkillProfile/SkillAssessment
  // Skill categories: children before parents (parent link is RESTRICT).
  for (const cat of [...testSkillCategories].reverse()) {
    await prisma.skillCategory.delete({ where: { id: cat.id } }).catch(e => {
      console.warn(`  Skill category ${cat.id} delete skipped: ${e.message.split('\n')[0]}`)
    })
  }

  await deleteRows(prisma.certificateTemplate, testCertTemplates, 'certificate templates') // Certificate.templateId sets null

  await deleteRows(prisma.coupon, testCoupons, 'coupons')
  await deleteRows(prisma.taxRule, testTaxRules, 'tax rules')
  await deleteRows(prisma.instructorCertification, testInstructorCerts, 'instructor certifications')
  await deleteRows(prisma.announcement, testAnnouncements, 'announcements')
  await deleteRows(prisma.apiKey, testApiKeys, 'API keys')
  await deleteRows(prisma.webhook, testWebhooks, 'webhooks')
  await deleteRows(prisma.accessPolicy, testAccessPolicies, 'access policies')
  await deleteRows(prisma.roleTemplate, testRoleTemplates, 'role templates')
  await deleteRows(prisma.scheduledReport, testScheduledReports, 'scheduled reports')

  await deleteRows(prisma.role, testRoles, 'roles')
  await deleteRows(prisma.group, testGroups, 'groups')

  // Course categories: children before parents (parent link is RESTRICT).
  for (const cat of [...testCategories].reverse()) {
    await prisma.category.delete({ where: { id: cat.id } }).catch(e => {
      console.warn(`  Category ${cat.id} delete skipped: ${e.message.split('\n')[0]}`)
    })
  }

  // Courses (cascades CourseEnrollment/CourseContent/Certificate/CourseSection→Lesson).
  if (testCourses.length > 0) {
    const ids = testCourses.map(c => c.id)
    const { count } = await prisma.course.deleteMany({ where: { id: { in: ids } } }).catch(() => ({ count: 0 }))
    console.log(`Deleted ${count} courses.`)
  }

  // Instructor applications (no FK to app_users — must be deleted explicitly).
  if (testApplications.length > 0) {
    const { count } = await prisma.instructorApplication.deleteMany({
      where: { id: { in: testApplications.map(a => a.id) } },
    })
    console.log(`Deleted ${count} instructor applications.`)
  }

  // Users: soft-archive first (clears FK constraints), then hard-delete.
  if (testUsers.length > 0) {
    const userIds = testUsers.map(u => u.id)
    await prisma.branch.updateMany({ where: { managerId: { in: userIds } }, data: { managerId: null } }).catch(() => null)
    await prisma.department.updateMany({ where: { managerId: { in: userIds } }, data: { managerId: null } }).catch(() => null)
    await prisma.team.updateMany({ where: { leaderId: { in: userIds } }, data: { leaderId: null } }).catch(() => null)
    await prisma.group.updateMany({ where: { leaderId: { in: userIds } }, data: { leaderId: null } }).catch(() => null)
    await prisma.adminMessage.deleteMany({ where: { receiverUserId: { in: userIds } } }).catch(() => null)
    await prisma.course.updateMany({ where: { instructorId: { in: userIds } }, data: { instructorId: null } }).catch(() => null)
    await prisma.liveSession.updateMany({ where: { instructorId: { in: userIds } }, data: { instructorId: null } }).catch(() => null)

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
