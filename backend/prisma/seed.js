require("dotenv").config();
const prisma = require("../src/config/prisma");

const PERMISSIONS = [
  { name: "Create User",          description: "Can create new users",               category: "USERS" },
  { name: "Edit User",            description: "Can edit user details",               category: "USERS" },
  { name: "Delete User",          description: "Can delete users",                    category: "USERS" },
  { name: "View Users",           description: "Can view all users",                  category: "USERS" },
  { name: "Manage Roles",         description: "Can manage roles and permissions",    category: "ADMIN" },
  { name: "View Reports",         description: "Can view reports",                    category: "REPORTS" },
  { name: "Export Reports",       description: "Can export reports",                  category: "REPORTS" },
  { name: "Edit Settings",        description: "Can edit system settings",            category: "SETTINGS" },
  { name: "Manage Organization",  description: "Can manage organization structure",   category: "ORGANIZATION" },
  { name: "Manage Courses",       description: "Can manage courses",                  category: "COURSES" },
  { name: "View Learner Progress",description: "Can view learner progress",           category: "LEARNERS" },
  { name: "Assign Courses",       description: "Can assign courses to users",         category: "COURSES" },
];

const ROLES = [
  { name: "Administrator", description: "Full system access",            status: "ACTIVE" },
  { name: "Manager",       description: "Manage users and reports",      status: "ACTIVE" },
  { name: "Instructor",    description: "Create and manage courses",     status: "ACTIVE" },
  { name: "Learner",       description: "Take courses and view content", status: "ACTIVE" },
];

// Predefined permission bundles. Permission NAMES (stable) are resolved to IDs at
// seed time — the RoleTemplate.permissions JSON stores the resolved IDs.
const ROLE_TEMPLATES = [
  {
    name: "Instructor Template",
    description: "Course delivery: manage and assign courses, track learner progress.",
    permissionNames: ["Manage Courses", "Assign Courses", "View Learner Progress"],
  },
  {
    name: "HR Manager Template",
    description: "People management: create/edit/view users and view reports.",
    permissionNames: ["Create User", "Edit User", "View Users", "View Reports"],
  },
  {
    name: "Finance Manager Template",
    description: "Financial oversight: view and export reports.",
    permissionNames: ["View Reports", "Export Reports"],
  },
  {
    name: "Branch Manager Template",
    description: "Branch operations: view users, reports, manage org, assign courses.",
    permissionNames: ["View Users", "View Reports", "Manage Organization", "Assign Courses"],
  },
];

async function main() {
  console.log("Seeding roles & permissions…");

  // Upsert permissions (safe to run multiple times)
  const perms = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where:  { name: p.name },
        update: { description: p.description, category: p.category },
        create: p,
      })
    )
  );
  console.log(`  ${perms.length} permissions upserted`);

  const byName = Object.fromEntries(perms.map((p) => [p.name, p]));

  // Upsert roles
  const [adminRole, managerRole, instructorRole] = await Promise.all(
    ROLES.map((r) =>
      prisma.role.upsert({
        where:  { name: r.name },
        update: { description: r.description, status: r.status },
        create: r,
      })
    )
  );
  console.log(`  ${ROLES.length} roles upserted`);

  // Assign permissions — replace all on each run so assignments stay accurate
  const adminPerms  = perms.map((p) => p.id);
  const managerPerms = [
    byName["View Users"].id,
    byName["View Reports"].id,
    byName["Export Reports"].id,
    byName["Manage Organization"].id,
  ];
  const instructorPerms = [
    byName["Manage Courses"].id,
    byName["Assign Courses"].id,
    byName["View Learner Progress"].id,
  ];

  for (const [roleId, permIds] of [
    [adminRole.id,      adminPerms],
    [managerRole.id,    managerPerms],
    [instructorRole.id, instructorPerms],
  ]) {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
  }

  console.log("  Permissions assigned to roles");

  // Upsert default role templates (idempotent by unique name).
  for (const tpl of ROLE_TEMPLATES) {
    const ids = tpl.permissionNames
      .map((n) => byName[n]?.id)
      .filter(Boolean); // skip any name not present in PERMISSIONS
    await prisma.roleTemplate.upsert({
      where:  { name: tpl.name },
      update: { description: tpl.description, permissions: ids },
      create: { name: tpl.name, description: tpl.description, permissions: ids },
    });
  }
  console.log(`  ${ROLE_TEMPLATES.length} role templates upserted`);

  console.log("Done.");
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
