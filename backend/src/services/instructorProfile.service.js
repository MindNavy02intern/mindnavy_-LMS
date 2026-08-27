const prisma = require("../config/prisma");
const instructorsService = require("./instructors.service");

// Thin self-service layer over instructors.service — deliberately thin: the
// admin functions already do everything needed once called with the right
// arguments. adminId is ALWAYS null on every write below (never
// req.instructor.id) — instructors.service.updateInstructor's audit call
// feeds it into AuditLog.adminId, which is FK-constrained to AdminUser;
// passing an AppUser id there would raise a foreign key violation, not
// silently misattribute the row. The instructor's own id already reaches
// the audit trail via the `userId`/targetUserId field the service sets
// itself from its first argument.

function domainError(code) { return Object.assign(new Error(code), { code }); }

async function getMyProfile(instructorId) {
  return instructorsService.getInstructor(instructorId);
}

async function updateMyProfile(instructorId, profile) {
  return instructorsService.updateInstructor(instructorId, { profile, user: {} }, null);
}

// New rule, not present on the admin side: an instructor may only withdraw
// a document that is still PENDING — once an admin has verified or rejected
// it, that decision is the record and stays visible (rejected) or locked
// (verified), same reasoning as instructorCertifications' own
// PENDING-only-delete convention (Section 2.7 of the blueprint).
async function assertDocumentIsWithdrawable(instructorId, docId) {
  const doc = await prisma.instructorDocument.findFirst({ where: { id: docId, instructorId } });
  if (!doc) throw domainError("DOCUMENT_NOT_FOUND");
  if (doc.status !== "PENDING") throw domainError("DOCUMENT_NOT_WITHDRAWABLE");
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  assertDocumentIsWithdrawable,
};
