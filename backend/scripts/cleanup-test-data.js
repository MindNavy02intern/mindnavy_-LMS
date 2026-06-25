require("dotenv").config();
const prisma = require("../src/config/prisma");

// Exact naming patterns used by the Playwright suite in frontend/tests/*.full.spec.ts.
// (The data doesn't use a "TEST_"/"playwright" tag — it uses readable names like
// "Test User 1782...", "Branch 1782...", "suspend.1782...@mindnavy.com" — so the
// filters below match those, not generic "test_"/"playwright" substrings.)

const USER_EMAIL_PREFIXES = [
  "test.", "suspend.", "archive.", "approve.", "reject.", "assignrole.",
  "message.", "logout.", "import.", "bulksuspend0.", "bulksuspend1.",
  "bulkrole0.", "bulkrole1.", "roleuser.", "groupmember.",
];

const USER_NAME_PREFIXES = [
  "Test User ", "Suspend User ", "Archive User ", "Approve User ",
  "Reject User ", "AssignRole User ", "Message User ", "Logout User ",
  "Import User ", "Bulk Suspend ", "Bulk Role ", "Role User ", "Group Member ",
];

const ROLE_NAME_PREFIXES     = ["Role ", "RoleWithUsers", "DupRole", "PermRole", "MatrixRole"];
const BRANCH_NAME_PREFIXES   = ["Branch ", "DeptPrereqBranch", "TeamPrereqBranch"];
const DEPARTMENT_PREFIXES    = ["Department ", "TeamPrereqDept"];
const TEAM_NAME_PREFIXES     = ["Team "];
const GROUP_NAME_PREFIXES    = ["Group ", "MemberGroup", "SearchGroup"];
const INVITATION_EMAIL_PREFIX = "invite.";

const USER_WHERE = {
  OR: [
    ...USER_EMAIL_PREFIXES.map((p) => ({ email: { startsWith: p } })),
    ...USER_NAME_PREFIXES.map((p) => ({ fullName: { startsWith: p } })),
  ],
};

async function cleanup() {
  console.log("🧹 Cleaning up Playwright test data...");

  // AdminMessage.receiverUserId has no ON DELETE CASCADE — the "Send Message"
  // test leaves messages pointing at test users, which would otherwise block
  // the AppUser delete below.
  const deletedMessages = await prisma.adminMessage.deleteMany({
    where: { receiverUser: USER_WHERE },
  });
  console.log(`✅ Deleted ${deletedMessages.count} test admin messages`);

  // Users — AppUserSession and GroupMember cascade from the user side;
  // Branch/Department/Team manager/leader FKs are untouched by these tests.
  const deletedUsers = await prisma.appUser.deleteMany({ where: USER_WHERE });
  console.log(`✅ Deleted ${deletedUsers.count} test users`);

  // Roles — RolePermission cascades automatically (onDelete: Cascade).
  const deletedRoles = await prisma.role.deleteMany({
    where: { OR: ROLE_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  });
  console.log(`✅ Deleted ${deletedRoles.count} test roles`);

  // Groups before Teams/Departments — Group.departmentId has no cascade.
  const deletedGroups = await prisma.group.deleteMany({
    where: { OR: GROUP_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  });
  console.log(`✅ Deleted ${deletedGroups.count} test groups`);

  // Teams before Departments — Team.departmentId cascades from Department,
  // but deleting child-first keeps this script's own counts accurate.
  const deletedTeams = await prisma.team.deleteMany({
    where: { OR: TEAM_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  });
  console.log(`✅ Deleted ${deletedTeams.count} test teams`);

  // Departments before Branches — same reasoning (Department.branchId cascades).
  const deletedDepts = await prisma.department.deleteMany({
    where: { OR: DEPARTMENT_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  });
  console.log(`✅ Deleted ${deletedDepts.count} test departments`);

  const deletedBranches = await prisma.branch.deleteMany({
    where: { OR: BRANCH_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  });
  console.log(`✅ Deleted ${deletedBranches.count} test branches`);

  // Invitations — only the "invite." prefix is test data; real invitations
  // also live at @mindnavy.com (e.g. mn02intern@mindnavy.com), so a broad
  // domain or "playwright" match would have deleted real rows.
  const deletedInvitations = await prisma.invitation.deleteMany({
    where: { email: { startsWith: INVITATION_EMAIL_PREFIX } },
  });
  console.log(`✅ Deleted ${deletedInvitations.count} test invitations`);

  console.log("🎉 Cleanup complete!");
}

cleanup()
  .catch((err) => { console.error("Cleanup failed:", err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
