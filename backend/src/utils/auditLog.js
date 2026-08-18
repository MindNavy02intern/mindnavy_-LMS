const prisma = require("../config/prisma");

/**
 * @param {string|null} adminId
 * @param {string} action
 * @param {object|null} [meta]
 * @param {string} [entityId]
 * @returns {Promise<void>}
 */
async function createAuditLog(adminId, action, meta, entityId) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        action,
        details: meta ?? null,
        targetUserId: entityId ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

module.exports = { createAuditLog };
