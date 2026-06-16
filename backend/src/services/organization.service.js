const prisma = require("../config/prisma");

// ── Org chart cache (30-second TTL) ───────────────────────────────────────────
let orgChartCache    = null;
let orgChartCachedAt = 0;
const ORG_CHART_TTL_MS = 30 * 1000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginate(page, limit) {
  const p   = Math.max(1, Number(page)  || 1);
  const l   = Math.min(100, Math.max(1, Number(limit) || 10));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

const USER_BRIEF = { id: true, fullName: true, email: true };

// ── Branches ───────────────────────────────────────────────────────────────────

async function listBranches({ search, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }, { country: { contains: search, mode: "insensitive" } }] }
    : {};

  const [total, rows] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, locationType: true, address: true,
        city: true, country: true, phone: true, email: true,
        managerId: true, status: true, createdAt: true, updatedAt: true,
        manager:     { select: { fullName: true } },
        _count:      { select: { users: true, departments: true } },
      },
    }),
  ]);

  const data = rows.map((b) => ({
    id: b.id, name: b.name, locationType: b.locationType,
    address: b.address, city: b.city, country: b.country,
    phone: b.phone ?? null, email: b.email ?? null,
    managerId: b.managerId ?? null,
    managerName: b.manager?.fullName ?? null,
    status: b.status, userCount: b._count.users, departmentCount: b._count.departments,
    complianceStatus: "COMPLIANT",
    createdAt: b.createdAt, updatedAt: b.updatedAt,
  }));

  return { data, pagination: buildPagination(total, p, l) };
}

async function getBranch(id) {
  const b = await prisma.branch.findUnique({
    where: { id },
    include: {
      manager:     { select: USER_BRIEF },
      departments: { select: { id: true, name: true, _count: { select: { users: true } } } },
      users:       { select: USER_BRIEF, take: 20 },
      _count:      { select: { users: true, departments: true } },
    },
  });
  if (!b) return null;

  return {
    id: b.id, name: b.name, locationType: b.locationType,
    address: b.address, city: b.city, country: b.country,
    latitude: b.latitude ?? null, longitude: b.longitude ?? null,
    phone: b.phone ?? null, email: b.email ?? null,
    managerId: b.managerId ?? null, status: b.status,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
    manager: b.manager ?? null,
    departments: b.departments.map((d) => ({ id: d.id, name: d.name, userCount: d._count.users })),
    users: b.users,
    metrics: { totalUsers: b._count.users, activeUsers: b.users.length, departments: b._count.departments },
    userCount: b._count.users, departmentCount: b._count.departments, complianceStatus: "COMPLIANT",
  };
}

async function createBranch(data) {
  const branch = await prisma.branch.create({
    data: {
      name:         data.name.trim(),
      locationType: data.locationType.toUpperCase(),
      address:      data.address.trim(),
      city:         data.city.trim(),
      country:      data.country.trim(),
      latitude:     data.latitude  ?? null,
      longitude:    data.longitude ?? null,
      phone:        data.phone     || null,
      email:        data.email     || null,
      managerId:    data.managerId || null,
      status:       data.status    ? data.status.toUpperCase() : "ACTIVE",
    },
  });
  return branch;
}

async function updateBranch(id, data) {
  const update = {};
  if (data.name        !== undefined) update.name        = data.name.trim();
  if (data.locationType !== undefined) update.locationType = data.locationType.toUpperCase();
  if (data.address     !== undefined) update.address     = data.address.trim();
  if (data.city        !== undefined) update.city        = data.city.trim();
  if (data.country     !== undefined) update.country     = data.country.trim();
  if (data.latitude    !== undefined) update.latitude    = data.latitude;
  if (data.longitude   !== undefined) update.longitude   = data.longitude;
  if ("phone"     in data) update.phone     = data.phone     || null;
  if ("email"     in data) update.email     = data.email     || null;
  if ("managerId" in data) update.managerId = data.managerId || null;
  if (data.status !== undefined) update.status = data.status.toUpperCase();

  return prisma.branch.update({ where: { id }, data: update });
}

async function deleteBranch(id) {
  await prisma.branch.delete({ where: { id } });
}

async function assignDepartmentsToBranch(branchId, departmentIds) {
  const result = await prisma.department.updateMany({
    where: { id: { in: departmentIds } },
    data:  { branchId },
  });
  return { assignedCount: result.count };
}

// ── Departments ────────────────────────────────────────────────────────────────

async function listDepartments({ search, status, branchId, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search)   where.name   = { contains: search, mode: "insensitive" };
  if (status)   where.status = status.toUpperCase();
  if (branchId) where.branchId = branchId;

  const [total, rows] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, code: true, description: true,
        branchId: true, managerId: true, budget: true, status: true,
        createdAt: true, updatedAt: true,
        branch:  { select: { name: true } },
        manager: { select: { fullName: true } },
        _count:  { select: { users: true, teams: true } },
      },
    }),
  ]);

  const data = rows.map((d) => ({
    id: d.id, name: d.name, code: d.code ?? null, description: d.description ?? null,
    branchId: d.branchId, managerId: d.managerId ?? null,
    branchName:  d.branch?.name  ?? null,
    managerName: d.manager?.fullName ?? null,
    budget: d.budget, status: d.status,
    userCount: d._count.users, teamCount: d._count.teams,
    createdAt: d.createdAt, updatedAt: d.updatedAt,
  }));

  return { data, pagination: buildPagination(total, p, l) };
}

async function getDepartment(id) {
  const d = await prisma.department.findUnique({
    where: { id },
    include: {
      manager: { select: USER_BRIEF },
      users:   { select: { ...USER_BRIEF, role: true }, take: 20 },
      teams:   { select: { id: true, name: true, _count: { select: { members: true } } } },
      _count:  { select: { users: true } },
    },
  });
  if (!d) return null;

  const kpis = { totalUsers: d._count.users, activeUsers: d.users.length, completionRate: 0, averageProgress: 0 };

  return {
    id: d.id, name: d.name, code: d.code ?? null, description: d.description ?? null,
    branchId: d.branchId, managerId: d.managerId ?? null, budget: d.budget, status: d.status,
    userCount: d._count.users, createdAt: d.createdAt, updatedAt: d.updatedAt,
    manager: d.manager ?? null,
    members: d.users.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })),
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, memberCount: t._count.members })),
    kpis,
  };
}

async function createDepartment(data) {
  const exists = await prisma.department.findFirst({
    where: { name: { equals: data.name.trim(), mode: "insensitive" }, branchId: data.branchId },
  });
  if (exists) throw Object.assign(new Error("A department with this name already exists in the selected branch."), { status: 409 });

  return prisma.department.create({
    data: {
      name:        data.name.trim(),
      code:        data.code        ? data.code.trim()        : null,
      description: data.description ? data.description.trim() : null,
      branchId:    data.branchId,
      managerId:   data.managerId   || null,
      budget:      data.budget      ?? 0,
      status:      data.status      ? data.status.toUpperCase() : "ACTIVE",
    },
  });
}

async function updateDepartment(id, data) {
  if (data.name !== undefined) {
    const conflict = await prisma.department.findFirst({
      where: {
        name: { equals: data.name.trim(), mode: "insensitive" },
        branchId: data.branchId ?? undefined,
        NOT: { id },
      },
    });
    if (conflict) throw Object.assign(new Error("A department with this name already exists in the branch."), { status: 409 });
  }

  const update = {};
  if (data.name        !== undefined) update.name        = data.name.trim();
  if (data.code        !== undefined) update.code        = data.code ? data.code.trim() : null;
  if (data.description !== undefined) update.description = data.description ? data.description.trim() : null;
  if (data.branchId    !== undefined) update.branchId    = data.branchId;
  if ("managerId" in data) update.managerId = data.managerId || null;
  if (data.budget  !== undefined) update.budget  = data.budget;
  if (data.status  !== undefined) update.status  = data.status.toUpperCase();

  return prisma.department.update({ where: { id }, data: update });
}

async function deleteDepartment(id) {
  const dept = await prisma.department.findUnique({ where: { id }, select: { name: true } });

  const count = await prisma.appUser.count({
    where: {
      OR: [
        { departmentId: id },
        { department: { equals: dept?.name ?? "", mode: "insensitive" } },
      ],
    },
  });

  if (count > 0) {
    throw Object.assign(
      new Error(`Cannot delete department: ${count} user${count !== 1 ? "s" : ""} assigned. Reassign them first.`),
      { status: 409 }
    );
  }
  await prisma.department.delete({ where: { id } });
}

async function assignUsersToDepartment(deptId, userIds) {
  await prisma.department.findFirstOrThrow({ where: { id: deptId } });

  let assignedCount = 0;
  let failedCount   = 0;

  await Promise.all(
    userIds.map(async (uid) => {
      try {
        await prisma.appUser.update({ where: { id: uid }, data: { departmentId: deptId } });
        assignedCount++;
      } catch {
        failedCount++;
      }
    })
  );

  return { assignedCount, failedCount };
}

async function getDepartmentKpis(id) {
  const [total, active] = await Promise.all([
    prisma.appUser.count({ where: { departmentId: id } }),
    prisma.appUser.count({ where: { departmentId: id, status: "ACTIVE" } }),
  ]);

  return { totalUsers: total, activeUsers: active, completionRate: 0, averageProgress: 0, averageLearningTime: 0, certificatesEarned: 0 };
}

// ── Teams ──────────────────────────────────────────────────────────────────────

async function listTeams({ search, departmentId, status, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search)       where.name         = { contains: search, mode: "insensitive" };
  if (status)       where.status       = status.toUpperCase();
  if (departmentId) where.departmentId = departmentId;

  const [total, rows] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, departmentId: true, leaderId: true,
        description: true, status: true, createdAt: true, updatedAt: true,
        department: { select: { name: true } },
        leader:     { select: { fullName: true } },
        _count:     { select: { members: true } },
      },
    }),
  ]);

  const data = rows.map((t) => ({
    id: t.id, name: t.name, departmentId: t.departmentId,
    departmentName: t.department?.name ?? null,
    leaderId:   t.leaderId   ?? null,
    leaderName: t.leader?.fullName ?? null,
    description: t.description ?? null,
    status: t.status, memberCount: t._count.members,
    averageLearningProgress: 0,
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  }));

  return { data, pagination: buildPagination(total, p, l) };
}

async function getTeam(id) {
  const t = await prisma.team.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      leader:     { select: USER_BRIEF },
      members:    { select: { ...USER_BRIEF, riskScore: true }, take: 20 },
      _count:     { select: { members: true } },
    },
  });
  if (!t) return null;

  const memberCount = t._count.members;

  return {
    id: t.id, name: t.name, departmentId: t.departmentId,
    departmentName: t.department?.name ?? null,
    leaderId: t.leaderId ?? null, leaderName: t.leader?.fullName ?? null,
    description: t.description ?? null, status: t.status,
    memberCount, averageLearningProgress: 0,
    createdAt: t.createdAt, updatedAt: t.updatedAt,
    department: t.department,
    leader: t.leader ?? null,
    members: t.members.map((m) => ({ id: m.id, fullName: m.fullName, email: m.email, learningProgress: m.riskScore ?? 0 })),
    learningPaths: [],
    metrics: { totalMembers: memberCount, averageProgress: 0, completedCertificates: 0 },
  };
}

async function createTeam(data) {
  const exists = await prisma.team.findFirst({
    where: { name: { equals: data.name.trim(), mode: "insensitive" }, departmentId: data.departmentId },
  });
  if (exists) throw Object.assign(new Error("A team with this name already exists in the selected department."), { status: 409 });

  return prisma.team.create({
    data: {
      name:         data.name.trim(),
      departmentId: data.departmentId,
      leaderId:     data.leaderId    || null,
      description:  data.description ? data.description.trim() : null,
      status:       data.status      ? data.status.toUpperCase() : "ACTIVE",
    },
  });
}

async function updateTeam(id, data) {
  if (data.name !== undefined) {
    const deptId = data.departmentId ?? (await prisma.team.findUnique({ where: { id }, select: { departmentId: true } }))?.departmentId;
    const conflict = await prisma.team.findFirst({
      where: { name: { equals: data.name.trim(), mode: "insensitive" }, departmentId: deptId, NOT: { id } },
    });
    if (conflict) throw Object.assign(new Error("A team with this name already exists in the department."), { status: 409 });
  }

  const update = {};
  if (data.name         !== undefined) update.name         = data.name.trim();
  if (data.departmentId !== undefined) update.departmentId = data.departmentId;
  if ("leaderId"    in data) update.leaderId    = data.leaderId    || null;
  if (data.description  !== undefined) update.description  = data.description ? data.description.trim() : null;
  if (data.status       !== undefined) update.status       = data.status.toUpperCase();

  return prisma.team.update({ where: { id }, data: update });
}

async function deleteTeam(id) {
  await prisma.team.delete({ where: { id } });
}

async function assignTeamMembers(teamId, userIds) {
  await prisma.team.findFirstOrThrow({ where: { id: teamId } });

  let assignedCount = 0;
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        await prisma.appUser.update({ where: { id: uid }, data: { teamId } });
        assignedCount++;
      } catch { /* user not found — skip */ }
    })
  );

  return { assignedCount };
}

async function getTeamMembers(teamId, { search, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = { teamId };
  if (search) where.OR = [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];

  const [total, rows] = await Promise.all([
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({ where, skip, take, select: { ...USER_BRIEF, role: true, riskScore: true } }),
  ]);

  return {
    data: rows.map((u) => ({ ...u, learningProgress: u.riskScore ?? 0 })),
    pagination: buildPagination(total, p, l),
  };
}

// ── Org Chart ──────────────────────────────────────────────────────────────────

async function getOrgChart() {
  if (orgChartCache && Date.now() - orgChartCachedAt < ORG_CHART_TTL_MS) {
    return orgChartCache;
  }

  const [branches, departments, teams] = await Promise.all([
    prisma.branch.findMany({
      select: { id: true, name: true, status: true, manager: { select: { fullName: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.department.findMany({
      select: { id: true, name: true, branchId: true, status: true, manager: { select: { fullName: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true, departmentId: true, status: true, leader: { select: { fullName: true } }, _count: { select: { members: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const nodes = [];
  const edges = [];

  // Root company node
  const companyId = "COMPANY";
  nodes.push({
    id: companyId, label: "Organization", type: "COMPANY",
    data: { name: "Organization", userCount: undefined, status: "ACTIVE", manager: undefined },
  });

  // Branch nodes
  branches.forEach((b) => {
    const nodeId = `BRANCH:${b.id}`;
    nodes.push({
      id: nodeId, label: b.name, type: "BRANCH", parentId: companyId,
      data: { name: b.name, userCount: b._count.users, status: b.status, manager: b.manager?.fullName },
    });
    edges.push({ id: `${companyId}→${nodeId}`, source: companyId, target: nodeId, animated: false });
  });

  // Department nodes
  departments.forEach((d) => {
    const nodeId   = `DEPT:${d.id}`;
    const parentId = `BRANCH:${d.branchId}`;
    nodes.push({
      id: nodeId, label: d.name, type: "DEPARTMENT", parentId,
      data: { name: d.name, userCount: d._count.users, status: d.status, manager: d.manager?.fullName },
    });
    edges.push({ id: `${parentId}→${nodeId}`, source: parentId, target: nodeId, animated: false });
  });

  // Team nodes
  teams.forEach((t) => {
    const nodeId   = `TEAM:${t.id}`;
    const parentId = `DEPT:${t.departmentId}`;
    nodes.push({
      id: nodeId, label: t.name, type: "TEAM", parentId,
      data: { name: t.name, userCount: t._count.members, status: t.status, manager: t.leader?.fullName },
    });
    edges.push({ id: `${parentId}→${nodeId}`, source: parentId, target: nodeId, animated: false });
  });

  orgChartCache    = { nodes, edges };
  orgChartCachedAt = Date.now();
  return orgChartCache;
}

async function moveOrgNode(nodeId, newParentId, action) {
  const act = action.toUpperCase();

  if (act === "MOVE_DEPARTMENT") {
    // nodeId is a department id, newParentId is a branch id
    const branch = await prisma.branch.findUnique({ where: { id: newParentId } });
    if (!branch) throw Object.assign(new Error("Target branch not found."), { status: 404 });
    const dept = await prisma.department.update({ where: { id: nodeId }, data: { branchId: newParentId } });
    return dept;
  }

  if (act === "MOVE_TEAM") {
    // nodeId is a team id, newParentId is a department id
    const dept = await prisma.department.findUnique({ where: { id: newParentId } });
    if (!dept) throw Object.assign(new Error("Target department not found."), { status: 404 });
    const team = await prisma.team.update({ where: { id: nodeId }, data: { departmentId: newParentId } });
    return team;
  }

  if (act === "MOVE_USER") {
    // nodeId is a user id, newParentId is a department or team id
    // Try team first, then department
    const team = await prisma.team.findUnique({ where: { id: newParentId } });
    if (team) {
      const user = await prisma.appUser.update({ where: { id: nodeId }, data: { teamId: newParentId } });
      return user;
    }
    const dept = await prisma.department.findUnique({ where: { id: newParentId } });
    if (dept) {
      const user = await prisma.appUser.update({ where: { id: nodeId }, data: { departmentId: newParentId } });
      return user;
    }
    throw Object.assign(new Error("Target (team or department) not found."), { status: 404 });
  }

  throw Object.assign(new Error("Unknown move action."), { status: 400 });
}

// ── Hierarchy Settings ─────────────────────────────────────────────────────────

const HIERARCHY_DEFAULTS = {
  allowMultiReporting:          false,
  maxReportingLevels:           5,
  requireManagerApproval:       true,
  applyRoleBasedAccess:         true,
  departmentHeadsSeeOwnOnly:    true,
  inheritPermissionsFromParent: true,
  allowPermissionOverride:      false,
  requireApprovalForMoves:      true,
  approvalLevels:               2,
  autoApproveAfterDays:         7,
  customRules:                  null,
};

async function getHierarchySettings() {
  let settings = await prisma.hierarchySettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) {
    settings = await prisma.hierarchySettings.create({ data: HIERARCHY_DEFAULTS });
  }
  return settings;
}

async function updateHierarchySettings(data) {
  let settings = await prisma.hierarchySettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) {
    settings = await prisma.hierarchySettings.create({ data: HIERARCHY_DEFAULTS });
  }

  const update = {};
  const boolFields = ["allowMultiReporting", "requireManagerApproval", "applyRoleBasedAccess", "departmentHeadsSeeOwnOnly", "inheritPermissionsFromParent", "allowPermissionOverride", "requireApprovalForMoves"];
  boolFields.forEach((f) => { if (f in data && typeof data[f] === "boolean") update[f] = data[f]; });

  const intFields = ["maxReportingLevels", "approvalLevels", "autoApproveAfterDays"];
  intFields.forEach((f) => { if (f in data && Number.isInteger(data[f])) update[f] = data[f]; });

  if ("customRules" in data) update.customRules = data.customRules ?? null;

  return prisma.hierarchySettings.update({ where: { id: settings.id }, data: update });
}

async function resetHierarchySettings() {
  let settings = await prisma.hierarchySettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) {
    return prisma.hierarchySettings.create({ data: HIERARCHY_DEFAULTS });
  }
  return prisma.hierarchySettings.update({ where: { id: settings.id }, data: HIERARCHY_DEFAULTS });
}

module.exports = {
  listBranches, getBranch, createBranch, updateBranch, deleteBranch, assignDepartmentsToBranch,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  assignUsersToDepartment, getDepartmentKpis,
  listTeams, getTeam, createTeam, updateTeam, deleteTeam, assignTeamMembers, getTeamMembers,
  getOrgChart, moveOrgNode,
  getHierarchySettings, updateHierarchySettings, resetHierarchySettings,
};
