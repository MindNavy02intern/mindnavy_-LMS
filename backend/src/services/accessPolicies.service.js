const prisma = require("../config/prisma");

// ── Helpers ────────────────────────────────────────────────────────────────────

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

// Best-effort audit log — never breaks the primary operation (mirrors roles.service).
async function createPolicyAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, details: details ?? null },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// Explicit select — never returns more than the page needs, and the role is
// loaded as a single batched relation (no N+1 per row).
const POLICY_SELECT = {
  id: true, name: true, description: true,
  resource: true, action: true, effect: true,
  priority: true, status: true, roleId: true,
  createdAt: true, updatedAt: true,
  role: { select: { id: true, name: true } },
};

// Verify a roleId exists before create/update so callers get a clean 404
// instead of a raw Prisma FK error.
async function assertRoleExists(roleId) {
  if (!roleId) return;
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throw Object.assign(new Error("ROLE_NOT_FOUND"), { code: "ROLE_NOT_FOUND" });
}

// ── Access Policies ─────────────────────────────────────────────────────────────

async function listAccessPolicies({ search, status, effect, resource, action, roleId, page, limit } = {}) {
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status && status !== "ALL") where.status = status;
  if (effect && effect !== "ALL") where.effect = effect;
  if (resource) where.resource = resource;
  if (action)   where.action   = action;
  if (roleId)   where.roleId   = roleId;

  const [total, rows] = await Promise.all([
    prisma.accessPolicy.count({ where }),
    prisma.accessPolicy.findMany({
      where,
      skip,
      take,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: POLICY_SELECT,
    }),
  ]);

  return { data: rows, pagination: buildPagination(total, p, l) };
}

async function getAccessPolicy(id) {
  return prisma.accessPolicy.findUnique({ where: { id }, select: POLICY_SELECT });
}

async function createAccessPolicy(data, adminId) {
  await assertRoleExists(data.roleId);

  const policy = await prisma.accessPolicy.create({
    data: {
      name: data.name,
      description: data.description,
      resource: data.resource,
      action: data.action,
      effect: data.effect,
      status: data.status,
      priority: data.priority,
      roleId: data.roleId,
    },
    select: POLICY_SELECT,
  });

  await createPolicyAuditLog(adminId, "ACCESS_POLICY_CREATED", { policyId: policy.id, name: policy.name });
  return policy;
}

async function updateAccessPolicy(id, data, adminId) {
  // Only re-check the role when roleId is actually being changed.
  if (data.roleId !== undefined) await assertRoleExists(data.roleId);

  const policy = await prisma.accessPolicy.update({
    where: { id },
    data,
    select: POLICY_SELECT,
  });

  await createPolicyAuditLog(adminId, "ACCESS_POLICY_UPDATED", { policyId: id, fields: Object.keys(data) });
  return policy;
}

async function deleteAccessPolicy(id, adminId) {
  await prisma.accessPolicy.delete({ where: { id } });
  await createPolicyAuditLog(adminId, "ACCESS_POLICY_DELETED", { policyId: id });
}

// Aggregate numbers for the Access Policies header/stat cards — three grouped
// counts in parallel, no per-row queries.
async function getAccessPolicyStats() {
  const [total, statusGroups, effectGroups] = await Promise.all([
    prisma.accessPolicy.count(),
    prisma.accessPolicy.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.accessPolicy.groupBy({ by: ["effect"], _count: { effect: true } }),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.status]));
  const byEffect = Object.fromEntries(effectGroups.map((g) => [g.effect, g._count.effect]));

  return {
    totalPolicies:    total,
    activePolicies:   byStatus.ACTIVE   ?? 0,
    inactivePolicies: byStatus.INACTIVE ?? 0,
    allowPolicies:    byEffect.ALLOW    ?? 0,
    denyPolicies:     byEffect.DENY     ?? 0,
  };
}

module.exports = {
  listAccessPolicies,
  getAccessPolicy,
  createAccessPolicy,
  updateAccessPolicy,
  deleteAccessPolicy,
  getAccessPolicyStats,
};
