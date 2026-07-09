// TEMPORARY STUB — replace with Hassan's real backend/src/utils/auditLog.js
// This exists only so the server can start locally. Do not build on this logic.
// Functions stubbed: createAuditLog
// Used by: organization.service.js, groups.service.js, invitations.service.js

/**
 * @param {string|null} adminId
 * @param {string} action
 * @param {object|null} [meta]
 * @param {string} [entityId]
 * @returns {Promise<void>}
 */
async function createAuditLog(adminId, action, meta, entityId) {
  console.log('[STUB auditLog]', { adminId, action, meta, entityId });
}

module.exports = { createAuditLog };
