const prisma = require("../config/prisma");

// Shared best-effort audit writer — an audit failure must never break the
// mutation it describes (same contract as the per-service helpers in
// users/roles/courses). `targetUserId` is the AppUser the action was
// performed ON, when there is one; it feeds the indexed per-user activity
// query, while `details` keeps the human-readable context.
async function createAuditLog(adminId, action, details = null, targetUserId = null) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: targetUserId ?? null,
        action,
        details,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

module.exports = { createAuditLog };
