require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const REAL_ADMIN_EMAIL = 'mindnavy@gmail.com';
const REAL_TEMPLATE_NAMES = [
  'Instructor Template',
  'HR Manager Template',
  'Finance Manager Template',
  'Branch Manager Template',
];

const isConfirmed = process.argv.includes('--confirm');

async function main() {
  // ---- Gather everything that WOULD be deleted (read-only) ----
  const appUsersToDelete = await prisma.appUser.findMany({
    where: { email: { not: REAL_ADMIN_EMAIL } },
    select: { id: true, email: true },
  });
  const roleTemplatesToDelete = await prisma.roleTemplate.findMany({
    where: { name: { notIn: REAL_TEMPLATE_NAMES } },
    select: { id: true, name: true },
  });
  const invitationCount = await prisma.invitation.count();
  const accessPolicyCount = await prisma.accessPolicy.count();
  const branchCount = await prisma.branch.count();
  const departmentCount = await prisma.department.count();
  const teamCount = await prisma.team.count();
  const groupCount = await prisma.group.count();
  const groupMemberCount = await prisma.groupMember.count();
  const adminMessageCount = await prisma.adminMessage.count();
  const auditLogCount = await prisma.auditLog.count();

  const appUserIds = appUsersToDelete.map((u) => u.id);

  console.log('========== PLANNED DELETIONS ==========');
  console.log(`app_users: ${appUsersToDelete.length} (everything except ${REAL_ADMIN_EMAIL})`);
  console.log(`invitations: ${invitationCount} (all)`);
  console.log(`access_policies: ${accessPolicyCount} (all)`);
  console.log(`role_templates: ${roleTemplatesToDelete.length} (all except the 4 seeded templates)`);
  for (const t of roleTemplatesToDelete) console.log(`    - ${t.name}`);
  console.log(`groups: ${groupCount} (all)`);
  console.log(`group_members: ${groupMemberCount} (all)`);
  console.log(`teams: ${teamCount} (all)`);
  console.log(`departments: ${departmentCount} (all)`);
  console.log(`branches: ${branchCount} (all)`);
  console.log(`admin_messages: ${adminMessageCount} (all)`);
  console.log(`audit_logs: ${auditLogCount} (all)`);
  console.log('\nNOT touched: roles (4), permissions (12), role_permissions (24), admin_users (1, real admin), admin_sessions (74, real admin).');

  if (!isConfirmed) {
    console.log('\n[DRY RUN] No changes made. Re-run with --confirm to actually delete.');
    return;
  }

  console.log('\nDeleting...');

  await prisma.$transaction(
    async (tx) => {
      // Phase 1 — null out cross-references between AppUser <-> org tables to break FK cycles.
      await tx.branch.updateMany({ data: { managerId: null } });
      await tx.department.updateMany({ data: { managerId: null } });
      await tx.team.updateMany({ data: { leaderId: null } });
      await tx.group.updateMany({ data: { leaderId: null } });
      await tx.appUser.updateMany({
        where: { id: { in: appUserIds } },
        data: { branchId: null, departmentId: null, teamId: null },
      });

      // Phase 2 — delete children before parents.
      await tx.adminMessage.deleteMany({});
      await tx.groupMember.deleteMany({});
      await tx.invitation.deleteMany({});
      await tx.accessPolicy.deleteMany({});
      await tx.roleTemplate.deleteMany({ where: { name: { notIn: REAL_TEMPLATE_NAMES } } });
      await tx.group.deleteMany({});
      await tx.team.deleteMany({});
      await tx.department.deleteMany({});
      await tx.branch.deleteMany({});
      await tx.appUser.deleteMany({ where: { id: { in: appUserIds } } });
      await tx.auditLog.deleteMany({});
    },
    { timeout: 30000 }
  );

  console.log('\nDone. Deleted:');
  console.log(`  ${appUsersToDelete.length} app_users`);
  console.log(`  ${invitationCount} invitations`);
  console.log(`  ${accessPolicyCount} access_policies`);
  console.log(`  ${roleTemplatesToDelete.length} role_templates`);
  console.log(`  ${groupCount} groups`);
  console.log(`  ${groupMemberCount} group_members`);
  console.log(`  ${teamCount} teams`);
  console.log(`  ${departmentCount} departments`);
  console.log(`  ${branchCount} branches`);
  console.log(`  ${adminMessageCount} admin_messages`);
  console.log(`  ${auditLogCount} audit_logs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
