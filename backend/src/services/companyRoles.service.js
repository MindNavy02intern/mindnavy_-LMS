const prisma = require("../config/prisma");

// ── Helpers ──────────────────────────────────────────────────────────────────

function domainError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// Lazy-seed the one role every AdminUser already has by default (AdminUser.role
// defaults to "admin") — otherwise the catalog would start empty while a real
// role is already in active use, invisible to this tab. Same lazy-create-on-
// read shape as CompetencySettings/SystemSettings elsewhere in this codebase.
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  await prisma.companyRole.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
      description: "Full admin console access (default role).",
      permissions: ["users.manage", "roles.manage", "settings.manage", "reports.view", "reports.export", "organization.manage", "courses.manage", "finance.manage", "integrations.manage", "notifications.manage"],
      isSystem: true,
    },
  }).catch(() => {});
  seeded = true;
}

function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}

// ── List / detail ────────────────────────────────────────────────────────────

async function listCompanyRoles({ search, status, page, limit }) {
  await ensureSeeded();
  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status) where.status = status;

  const [total, rows, userCounts] = await Promise.all([
    prisma.companyRole.count({ where }),
    prisma.companyRole.findMany({ where, orderBy: [{ isSystem: "desc" }, { name: "asc" }], ...paginate(page, limit) }),
    prisma.adminUser.groupBy({ by: ["role"], _count: { role: true } }),
  ]);

  const countByRole = new Map(userCounts.map((r) => [r.role, r._count.role]));
  const data = rows.map((r) => ({ ...r, userCount: countByRole.get(r.name) ?? 0 }));

  return { data, pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
}

async function getCompanyRole(id) {
  const role = await prisma.companyRole.findUnique({ where: { id } });
  if (!role) return null;
  const userCount = await prisma.adminUser.count({ where: { role: role.name } });
  return { ...role, userCount };
}

// ── Mutations ────────────────────────────────────────────────────────────────

async function createCompanyRole(data, adminId) {
  await ensureSeeded();
  let role;
  try {
    role = await prisma.companyRole.create({ data: { ...data, createdById: adminId ?? null } });
  } catch (err) {
    if (err.code === "P2002") throw domainError("DUPLICATE_NAME", `A role named "${data.name}" already exists.`);
    throw err;
  }
  await auditLog(adminId, "COMPANY_ROLE_CREATED", { roleId: role.id, name: role.name });
  return { ...role, userCount: 0 };
}

async function updateCompanyRole(id, data, adminId) {
  const before = await prisma.companyRole.findUnique({ where: { id } });
  if (!before) throw domainError("ROLE_NOT_FOUND", "Company role not found.");
  if (before.isSystem && data.name && data.name !== before.name) {
    throw domainError("SYSTEM_ROLE_LOCKED", "The default admin role's name cannot be changed.");
  }

  let role;
  try {
    role = await prisma.companyRole.update({ where: { id }, data });
  } catch (err) {
    if (err.code === "P2002") throw domainError("DUPLICATE_NAME", `A role named "${data.name}" already exists.`);
    throw err;
  }
  await auditLog(adminId, "COMPANY_ROLE_UPDATED", { roleId: role.id, name: role.name, fields: Object.keys(data) });
  const userCount = await prisma.adminUser.count({ where: { role: role.name } });
  return { ...role, userCount };
}

async function deleteCompanyRole(id, adminId) {
  const role = await prisma.companyRole.findUnique({ where: { id } });
  if (!role) throw domainError("ROLE_NOT_FOUND", "Company role not found.");
  if (role.isSystem) throw domainError("SYSTEM_ROLE_LOCKED", "The default admin role cannot be deleted.");

  const userCount = await prisma.adminUser.count({ where: { role: role.name } });
  if (userCount > 0) throw domainError("ROLE_HAS_USERS", `${userCount} admin(s) still use this role.`);

  await prisma.companyRole.delete({ where: { id } });
  await auditLog(adminId, "COMPANY_ROLE_DELETED", { roleId: id, name: role.name });
}

module.exports = {
  listCompanyRoles,
  getCompanyRole,
  createCompanyRole,
  updateCompanyRole,
  deleteCompanyRole,
};
