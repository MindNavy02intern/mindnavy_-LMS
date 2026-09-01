// Validator for the instructor SELF-service profile PATCH — deliberately
// narrower than instructors.validator.js's admin-facing validateInstructorUpdate,
// which also allows fullName/phone/skills and (via readProfileFields)
// revenueShareBps. An instructor editing their own profile may touch none of
// those — see INSTRUCTOR_DASHBOARD_BLUEPRINT.docx Section 2.2's "Editable
// fields" list, and the Phase 2 task's explicit CANNOT-update list.
//
// Composed from instructors.validator's exported pieces rather than
// reimplementing field parsing: readProfileFields/pickDefined give the exact
// same MAX limits and URL/int validation admin's own edit modal uses;
// rejectForeignFields + FOREIGN_FIELDS already cover role/status/
// verificationState/email/password/verifiedAt/verifiedById/riskScore for
// free. Only revenueShareBps/fullName/phone/skills are NEW restrictions this
// validator adds on top — those are allowed for admin, not for self-service.

const {
  readProfileFields,
  pickDefined,
  rejectForeignFields,
} = require("./instructors.validator");

const SELF_SERVICE_FOREIGN_FIELDS = {
  revenueShareBps: "revenueShareBps is set by an admin, not editable here.",
  fullName:        "fullName is owned by the Users module — an instructor cannot self-edit it here.",
  phone:           "phone is owned by the Users module — an instructor cannot self-edit it here.",
  skills:          "skills is owned by the Users module — an instructor cannot self-edit it here.",
};

function validateInstructorSelfProfileUpdate(body = {}) {
  const errors = [];

  // Covers role/status/verificationState/email/password/verifiedAt/
  // verifiedById/riskScore — the exact same rule admin's own PATCH enforces.
  rejectForeignFields(body, errors);

  for (const [key, message] of Object.entries(SELF_SERVICE_FOREIGN_FIELDS)) {
    if (body[key] !== undefined) errors.push(message);
  }

  // readProfileFields also reads revenueShareBps — harmless to compute even
  // though the loop above already flagged it as an error when present; the
  // request 400s before the service ever sees this object.
  const profile = pickDefined(readProfileFields(body, errors));
  delete profile.revenueShareBps;

  if (errors.length === 0 && Object.keys(profile).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data: { profile } };
}

module.exports = {
  validateInstructorSelfProfileUpdate,
};
