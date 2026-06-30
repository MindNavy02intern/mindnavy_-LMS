require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const REAL_ADMIN_EMAIL = 'mindnavy@gmail.com';
const REAL_ROLE_NAMES = new Set(['Administrator', 'Manager', 'Instructor', 'Learner']);
const REAL_TEMPLATE_NAMES = new Set([
  'Instructor Template',
  'HR Manager Template',
  'Finance Manager Template',
  'Branch Manager Template',
]);
const TIMESTAMP_PATTERN = /\d{10,}/;
const FAKE_USER_PATTERN = /\d{10,}|^test\.|^invite\.|^bulk/i;

function line(label, n) {
  console.log(`  ${label}: ${n}`);
}

async function main() {
  console.log('========== USER MANAGEMENT ==========');

  const adminUsers = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`\n-- admin_users (${adminUsers.length} total) --`);
  for (const a of adminUsers) {
    const isReal = a.email.toLowerCase() === REAL_ADMIN_EMAIL;
    console.log(`  [${isReal ? 'KEEP' : 'DELETE'}] ${a.id} | ${a.email} | ${a.status} | ${a.createdAt.toISOString()}`);
  }

  const appUsers = await prisma.appUser.findMany({ orderBy: { createdAt: 'asc' } });
  const appUsersFake = appUsers.filter((u) => FAKE_USER_PATTERN.test(u.email));
  const appUsersReal = appUsers.filter((u) => !FAKE_USER_PATTERN.test(u.email));
  console.log(`\n-- app_users (${appUsers.length} total) --`);
  console.log(`  KEEP candidates (${appUsersReal.length}):`);
  for (const u of appUsersReal) console.log(`    ${u.id} | ${u.email} | ${u.role} | ${u.status} | ${u.createdAt.toISOString()}`);
  console.log(`  DELETE candidates (${appUsersFake.length}):`);
  for (const u of appUsersFake) console.log(`    ${u.id} | ${u.email} | ${u.role} | ${u.status} | ${u.createdAt.toISOString()}`);

  const invitationCount = await prisma.invitation.count();
  line('\ninvitations total (all DELETE candidates)', invitationCount);

  const appUserSessionCount = await prisma.appUserSession.count();
  const appUserSessionForFake = await prisma.appUserSession.count({
    where: { userId: { in: appUsersFake.map((u) => u.id) } },
  });
  line('app_user_sessions total', appUserSessionCount);
  line('app_user_sessions belonging to fake app_users (cascade on delete)', appUserSessionForFake);

  const adminSessionCount = await prisma.adminSession.count();
  const fakeAdminIds = adminUsers.filter((a) => a.email.toLowerCase() !== REAL_ADMIN_EMAIL).map((a) => a.id);
  const adminSessionForFake = await prisma.adminSession.count({ where: { adminId: { in: fakeAdminIds } } });
  line('admin_sessions total', adminSessionCount);
  line('admin_sessions belonging to fake admin_users (cascade on delete)', adminSessionForFake);

  const otpCount = await prisma.otpCode.count({ where: { adminId: { in: fakeAdminIds } } });
  const trustedDeviceCount = await prisma.trustedDevice.count({ where: { adminId: { in: fakeAdminIds } } });
  const loginAttemptCount = await prisma.loginAttempt.count({ where: { adminId: { in: fakeAdminIds } } });
  line('otp_codes tied to fake admin_users (not requested, info only)', otpCount);
  line('trusted_devices tied to fake admin_users (not requested, info only)', trustedDeviceCount);
  line('login_attempts tied to fake admin_users (not requested, info only)', loginAttemptCount);

  console.log('\n========== ROLES & PERMISSIONS ==========');

  const roleCount = await prisma.role.count();
  line('roles total (already cleaned)', roleCount);

  const permissionCount = await prisma.permission.count();
  line('permissions total (KEEP all - real seed data)', permissionCount);

  const rolePermissionCount = await prisma.rolePermission.count();
  line('role_permissions total (KEEP all - tied to the 4 real roles)', rolePermissionCount);

  const accessPolicyCount = await prisma.accessPolicy.count();
  line('access_policies total (all DELETE candidates)', accessPolicyCount);

  const roleTemplates = await prisma.roleTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  const templatesReal = roleTemplates.filter((t) => REAL_TEMPLATE_NAMES.has(t.name));
  const templatesFake = roleTemplates.filter((t) => !REAL_TEMPLATE_NAMES.has(t.name));
  console.log(`\n-- role_templates (${roleTemplates.length} total) --`);
  console.log(`  KEEP (${templatesReal.length}):`);
  for (const t of templatesReal) console.log(`    ${t.id} | ${t.name}`);
  console.log(`  DELETE candidates (${templatesFake.length}):`);
  for (const t of templatesFake) console.log(`    ${t.id} | ${t.name} | ${t.createdAt.toISOString()}`);

  console.log('\n========== ORGANIZATION ==========');

  const branchCount = await prisma.branch.count();
  const departmentCount = await prisma.department.count();
  const teamCount = await prisma.team.count();
  const groupCount = await prisma.group.count();
  const groupMemberCount = await prisma.groupMember.count();
  line('branches total (all DELETE candidates)', branchCount);
  line('departments total (all DELETE candidates)', departmentCount);
  line('teams total (all DELETE candidates)', teamCount);
  line('groups total (all DELETE candidates)', groupCount);
  line('group_members total (cascade from groups/users)', groupMemberCount);

  console.log('\n========== OTHER ==========');

  const adminMessageCount = await prisma.adminMessage.count();
  line('admin_messages total (all DELETE candidates)', adminMessageCount);

  const auditLogCount = await prisma.auditLog.count();
  line('audit_logs total (your call - system logs)', auditLogCount);

  console.log('\n  notifications: NO "Notification" model exists in prisma/schema/*.prisma — there is no notifications table to clean. Flagging this instead of assuming.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
