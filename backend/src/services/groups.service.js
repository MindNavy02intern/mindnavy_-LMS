const prisma = require("../config/prisma");
const { createAuditLog } = require("../utils/auditLog");

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

const USER_BRIEF = { id: true, fullName: true, email: true, avatar: true };

const GROUP_INCLUDE = {
  department: { select: { id: true, name: true } },
  leader:     { select: USER_BRIEF },
  _count:     { select: { members: true } },
};

function mapGroup(g) {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? null,
    departmentId: g.departmentId,
    department: g.department ?? null,
    leaderId: g.leaderId ?? null,
    leader: g.leader ?? null,
    status: g.status,
    memberCount: g._count?.members ?? 0,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

// ── Groups ─────────────────────────────────────────────────────────────────────

async function listGroups({ search, status, departmentId, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status && status !== "ALL") where.status = status;
  if (departmentId) where.departmentId = departmentId;

  const [total, rows] = await Promise.all([
    prisma.group.count({ where }),
    prisma.group.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: GROUP_INCLUDE,
    }),
  ]);

  return { data: rows.map(mapGroup), pagination: buildPagination(total, p, l) };
}

async function getGroup(id) {
  const g = await prisma.group.findUnique({
    where: { id },
    include: {
      ...GROUP_INCLUDE,
      members: {
        include: { user: { select: USER_BRIEF } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!g) return null;

  return {
    ...mapGroup(g),
    members: g.members.map((m) => ({
      userId: m.userId,
      role: m.role ?? null,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
  };
}

async function createGroup({ name, description, departmentId, leaderId, status }, admin = {}) {
  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw Object.assign(new Error("Department not found."), { code: "NOT_FOUND" });
  }

  if (leaderId) {
    const leader = await prisma.appUser.findUnique({ where: { id: leaderId } });
    if (!leader) throw Object.assign(new Error("Leader not found."), { code: "NOT_FOUND" });
  }

  const g = await prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      departmentId,
      leaderId: leaderId || null,
      status: status || "ACTIVE",
    },
    include: GROUP_INCLUDE,
  });

  await createAuditLog(admin?.id, "GROUP_CREATED", { groupId: g.id, name: g.name });
  return mapGroup(g);
}

async function updateGroup(id, { name, description, departmentId, leaderId, status }, admin = {}) {
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error("Group not found."), { code: "NOT_FOUND" });

  if (departmentId && departmentId !== existing.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw Object.assign(new Error("Department not found."), { code: "NOT_FOUND" });
  }

  if (leaderId !== undefined && leaderId !== null && leaderId !== existing.leaderId) {
    const leader = await prisma.appUser.findUnique({ where: { id: leaderId } });
    if (!leader) throw Object.assign(new Error("Leader not found."), { code: "NOT_FOUND" });
  }

  const data = {};
  if (name        !== undefined) data.name        = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (departmentId !== undefined) data.departmentId = departmentId;
  if (leaderId    !== undefined) data.leaderId    = leaderId || null;
  if (status      !== undefined) data.status      = status;

  const g = await prisma.group.update({
    where: { id },
    data,
    include: GROUP_INCLUDE,
  });

  await createAuditLog(admin?.id, "GROUP_UPDATED", { groupId: id, fields: Object.keys(data) });
  return mapGroup(g);
}

async function deleteGroup(id, admin = {}) {
  const g = await prisma.group.findUnique({ where: { id } });
  if (!g) throw Object.assign(new Error("Group not found."), { code: "NOT_FOUND" });
  await prisma.group.delete({ where: { id } });
  await createAuditLog(admin?.id, "GROUP_DELETED", { groupId: id, name: g.name });
}

// ── Members ────────────────────────────────────────────────────────────────────

async function getGroupMembers(groupId) {
  const g = await prisma.group.findUnique({ where: { id: groupId } });
  if (!g) throw Object.assign(new Error("Group not found."), { code: "NOT_FOUND" });

  const rows = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: USER_BRIEF } },
    orderBy: { joinedAt: "asc" },
  });

  return rows.map((m) => ({
    userId: m.userId,
    role: m.role ?? null,
    joinedAt: m.joinedAt,
    user: m.user,
  }));
}

async function addMembers(groupId, userIds, role = "MEMBER", admin = {}) {
  const g = await prisma.group.findUnique({ where: { id: groupId } });
  if (!g) throw Object.assign(new Error("Group not found."), { code: "NOT_FOUND" });

  const users = await prisma.appUser.findMany({ where: { id: { in: userIds } } });
  if (users.length !== userIds.length) {
    throw Object.assign(new Error("One or more users not found."), { code: "NOT_FOUND" });
  }

  const result = await prisma.groupMember.createMany({
    data: userIds.map((userId) => ({ groupId, userId, role })),
    skipDuplicates: true,
  });

  await createAuditLog(admin?.id, "GROUP_MEMBERS_ADDED", { groupId, count: result.count });
  return getGroupMembers(groupId);
}

async function removeMember(groupId, userId, admin = {}) {
  const g = await prisma.group.findUnique({ where: { id: groupId } });
  if (!g) throw Object.assign(new Error("Group not found."), { code: "NOT_FOUND" });

  const result = await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  if (result.count === 0) {
    throw Object.assign(new Error("Member not found in group."), { code: "NOT_FOUND" });
  }
  await createAuditLog(admin?.id, "GROUP_MEMBER_REMOVED", { groupId, userId }, userId);
}

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup, getGroupMembers, addMembers, removeMember };
