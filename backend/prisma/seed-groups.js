const prisma = require("../src/config/prisma");

async function main() {
  console.log("Seeding Groups data...");

  const departments = await prisma.department.findMany({ take: 2, orderBy: { createdAt: "asc" } });
  if (departments.length === 0) {
    console.log("No departments found. Run organization seed first.");
    return;
  }

  const users = await prisma.appUser.findMany({ take: 5, orderBy: { createdAt: "asc" } });
  if (users.length === 0) {
    console.log("No users found. Run user seed first.");
    return;
  }

  const dept1 = departments[0];
  const dept2 = departments[1] ?? departments[0];

  const group1 = await prisma.group.upsert({
    where: { name: "IT Development Team" },
    update: {},
    create: {
      name: "IT Development Team",
      description: "Developers and IT specialists",
      departmentId: dept1.id,
      leaderId: users[0]?.id ?? null,
      status: "ACTIVE",
    },
  });

  const group2 = await prisma.group.upsert({
    where: { name: "HR & Recruitment" },
    update: {},
    create: {
      name: "HR & Recruitment",
      description: "Human resources team",
      departmentId: dept2.id,
      leaderId: users[1]?.id ?? null,
      status: "ACTIVE",
    },
  });

  const memberData = [
    users[1] ? { groupId: group1.id, userId: users[1].id, role: "MEMBER" } : null,
    users[2] ? { groupId: group1.id, userId: users[2].id, role: "MEMBER" } : null,
    users[3] ? { groupId: group1.id, userId: users[3].id, role: "ADMIN"  } : null,
    users[2] ? { groupId: group2.id, userId: users[2].id, role: "MEMBER" } : null,
    users[4] ? { groupId: group2.id, userId: users[4].id, role: "MEMBER" } : null,
  ].filter(Boolean);

  if (memberData.length > 0) {
    await prisma.groupMember.createMany({ data: memberData, skipDuplicates: true });
  }

  console.log(`Created groups: "${group1.name}", "${group2.name}"`);
  console.log("Groups seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
