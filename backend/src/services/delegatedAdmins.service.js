const prisma = require("../config/prisma");

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

function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}

// Display-only derived status — an expired grant is never silently treated as
// still ACTIVE, but expiry is never enforced anywhere (see schema comment),
// so there's no background job to "flip" it; the effective label is computed
// fresh on every read instead of drifting out of sync with a stored value.
function effectiveStatus(row) {
  if (row.status === "ACTIVE" && row.expiresAt && row.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return row.status;
}

async function listDelegatedAdmins({ status, page, limit }) {
  const where = {};
  const [total, rows] = await Promise.all([
    prisma.delegatedAdmin.count({ where }),
    prisma.delegatedAdmin.findMany({ where, orderBy: { grantedAt: "desc" }, ...paginate(page, limit) }),
  ]);

  const ids = [...new Set(rows.flatMap((r) => [r.adminId, r.grantedById, r.revokedById].filter(Boolean)))];
  const admins = ids.length
    ? await prisma.adminUser.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true } })
    : [];
  const byId = new Map(admins.map((a) => [a.id, a]));

  let data = rows.map((r) => ({
    ...r,
    effectiveStatus: effectiveStatus(r),
    admin: byId.get(r.adminId) ?? null,
    grantedBy: byId.get(r.grantedById) ?? null,
    revokedBy: r.revokedById ? byId.get(r.revokedById) ?? null : null,
  }));

  // status filter applies to the DERIVED status (so "EXPIRED" is filterable
  // even though nothing ever persists that value) — filtered in memory after
  // the join since it depends on effectiveStatus, not the raw column.
  if (status) data = data.filter((r) => r.effectiveStatus === status);

  return { data, pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
}

async function listAdminDirectory() {
  return prisma.adminUser.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true, role: true, status: true },
  });
}

async function grantDelegatedAdmin({ adminId, scopeRole, reason, expiresAt }, grantedById) {
  const [admin, role] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: adminId }, select: { id: true, fullName: true } }),
    prisma.companyRole.findUnique({ where: { name: scopeRole }, select: { name: true } }),
  ]);
  if (!admin) throw domainError("ADMIN_NOT_FOUND", "Admin user not found.");
  if (!role) throw domainError("ROLE_NOT_FOUND", `Company role "${scopeRole}" not found.`);

  const existing = await prisma.delegatedAdmin.findFirst({
    where: { adminId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (existing) throw domainError("ALREADY_DELEGATED", `${admin.fullName} already has an active delegated grant.`);

  const grant = await prisma.delegatedAdmin.create({
    data: { adminId, grantedById, scopeRole, reason: reason ?? null, expiresAt: expiresAt ?? null },
  });
  await auditLog(grantedById, "DELEGATED_ADMIN_GRANTED", { grantId: grant.id, adminId, scopeRole, expiresAt: expiresAt ?? null });
  return grant;
}

async function revokeDelegatedAdmin(id, revokedById) {
  const grant = await prisma.delegatedAdmin.findUnique({ where: { id } });
  if (!grant) throw domainError("GRANT_NOT_FOUND", "Delegated admin grant not found.");
  if (grant.status !== "ACTIVE") throw domainError("ALREADY_REVOKED", "This grant is not active.");

  const updated = await prisma.delegatedAdmin.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById },
  });
  await auditLog(revokedById, "DELEGATED_ADMIN_REVOKED", { grantId: id, adminId: grant.adminId });
  return updated;
}

module.exports = {
  listDelegatedAdmins,
  listAdminDirectory,
  grantDelegatedAdmin,
  revokeDelegatedAdmin,
};
