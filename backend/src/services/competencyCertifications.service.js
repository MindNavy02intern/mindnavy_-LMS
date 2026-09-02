const crypto = require("crypto");
const prisma = require("../config/prisma");

// ── Competency Certifications (Certifications tab) ───────────────────────────
//
// competencyCert.assign/verify/revoke were dead mutation IDs in the v1
// contract — no certification-tracking entity existed. This is that entity.
// Own file (not competencies.service.js, already 1300+ lines) — same split
// as invoicePdf.service.js living next to finance.service.js. Controller and
// routes stay in the shared competencies.controller.js/routes.js per that
// file's own header convention ("same file, not a second router").
//
// EXPIRED is never written to `status` — see the schema comment on
// CompetencyCertification. A VERIFIED row past its expiresAt is labeled
// EXPIRED only at read time (effectiveStatus), same lazy-derive shape as
// DelegatedAdmin.effectiveStatus elsewhere in this codebase.

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

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function newVerificationCode() {
  return crypto.randomBytes(16).toString("hex"); // 32 hex chars, same shape as Certificate.verificationCode
}

function effectiveStatus(row) {
  if (row.status === "VERIFIED" && row.expiresAt && row.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return row.status;
}

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function assertUserExists(userId) {
  const u = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
  if (!u) throw domainError("USER_NOT_FOUND");
  return u;
}

async function assertSkillExists(skillId) {
  const s = await prisma.skill.findUnique({ where: { id: skillId }, select: { id: true, name: true } });
  if (!s) throw domainError("SKILL_NOT_FOUND");
  return s;
}

async function assertFrameworkExists(frameworkId) {
  if (!frameworkId) return null;
  const f = await prisma.competencyFramework.findUnique({ where: { id: frameworkId }, select: { id: true, name: true } });
  if (!f) throw domainError("FRAMEWORK_NOT_FOUND");
  return f;
}

async function getCertOrThrow(id) {
  const row = await prisma.competencyCertification.findUnique({ where: { id } });
  if (!row) throw domainError("CERTIFICATION_NOT_FOUND");
  return row;
}

// Batch-resolve names for a page of rows — one query per referenced entity
// type, never N+1. userName comes from a real relation; skill/framework stay
// plain-string refs (see schema note), so a deleted one just reads null
// instead of failing the whole list.
async function withNames(rows) {
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const skillIds = [...new Set(rows.map((r) => r.skillId))];
  const frameworkIds = [...new Set(rows.map((r) => r.frameworkId).filter(Boolean))];

  const [users, skills, frameworks] = await Promise.all([
    userIds.length ? prisma.appUser.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } }) : [],
    skillIds.length ? prisma.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true, name: true } }) : [],
    frameworkIds.length ? prisma.competencyFramework.findMany({ where: { id: { in: frameworkIds } }, select: { id: true, name: true } }) : [],
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const skillById = new Map(skills.map((s) => [s.id, s.name]));
  const frameworkById = new Map(frameworks.map((f) => [f.id, f.name]));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: userById.get(r.userId)?.fullName ?? null,
    userEmail: userById.get(r.userId)?.email ?? null,
    skillId: r.skillId,
    skillName: skillById.get(r.skillId) ?? null,
    frameworkId: r.frameworkId,
    frameworkName: r.frameworkId ? (frameworkById.get(r.frameworkId) ?? null) : null,
    status: r.status,
    effectiveStatus: effectiveStatus(r),
    issuedAt: iso(r.issuedAt),
    expiresAt: iso(r.expiresAt),
    issuedById: r.issuedById,
    revokedAt: iso(r.revokedAt),
    revokedById: r.revokedById,
    verificationCode: r.verificationCode,
    notes: r.notes,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

async function listCertifications({ userId, skillId, status, page, limit }) {
  const where = {
    ...(userId ? { userId } : {}),
    ...(skillId ? { skillId } : {}),
    // status filter applies to the DERIVED status (EXPIRED is never a raw
    // column value) — filtered in memory after the batch name-resolve below,
    // same shape as DelegatedAdmin's status filter.
  };

<<<<<<< HEAD
  // paginate() here returns the normalized page/limit alongside skip/take, so
  // destructure it — spreading the whole object into findMany passes `page`/
  // `limit` as Prisma args and every request 400s. Same shape accessPolicies /
  // content / courses / enrollments already use.
  const { skip, take, page: p, limit: l } = paginate(page, limit);

=======
  const { skip, take } = paginate(page, limit);
>>>>>>> bilal
  const [total, rows] = await Promise.all([
    prisma.competencyCertification.count({ where }),
    prisma.competencyCertification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
  ]);

  let data = await withNames(rows);
  if (status) data = data.filter((r) => r.effectiveStatus === status);

  return { certifications: data, pagination: buildPagination(total, p, l) };
}

async function getCertification(id) {
  const row = await getCertOrThrow(id);
  const [named] = await withNames([row]);
  return named;
}

async function listUserCertifications(userId) {
  await assertUserExists(userId);
  const rows = await prisma.competencyCertification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return withNames(rows);
}

async function assignCertification({ userId, skillId, frameworkId, expiresAt, notes }, adminId) {
  await assertUserExists(userId);
  await assertSkillExists(skillId);
  await assertFrameworkExists(frameworkId);

  const row = await prisma.competencyCertification.create({
    data: {
      userId, skillId, frameworkId: frameworkId ?? null,
      expiresAt: expiresAt ?? null, notes: notes ?? null,
      issuedById: adminId ?? null,
      verificationCode: newVerificationCode(),
    },
  });

  await auditLog(adminId, "COMPETENCY_CERTIFICATION_ASSIGNED", { certificationId: row.id, userId, skillId, frameworkId: frameworkId ?? null });
  const [named] = await withNames([row]);
  return named;
}

async function verifyCertification(id, notes, adminId) {
  const current = await getCertOrThrow(id);
  if (current.status !== "PENDING") throw domainError("NOT_PENDING", "Only PENDING certifications can be verified.");

  const row = await prisma.competencyCertification.update({
    where: { id },
    data: { status: "VERIFIED", ...(notes !== undefined ? { notes } : {}) },
  });

  await auditLog(adminId, "COMPETENCY_CERTIFICATION_VERIFIED", { certificationId: id });
  const [named] = await withNames([row]);
  return named;
}

async function revokeCertification(id, reason, adminId) {
  const current = await getCertOrThrow(id);
  if (current.status === "REVOKED") throw domainError("ALREADY_REVOKED", "This certification is already revoked.");

  const row = await prisma.competencyCertification.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById: adminId ?? null, notes: reason },
  });

  await auditLog(adminId, "COMPETENCY_CERTIFICATION_REVOKED", { certificationId: id, reason });
  const [named] = await withNames([row]);
  return named;
}

async function deleteCertification(id, adminId) {
  await getCertOrThrow(id);
  await prisma.competencyCertification.delete({ where: { id } });
  await auditLog(adminId, "COMPETENCY_CERTIFICATION_DELETED", { certificationId: id });
  return { id };
}

module.exports = {
  listCertifications,
  getCertification,
  listUserCertifications,
  assignCertification,
  verifyCertification,
  revokeCertification,
  deleteCertification,
};
