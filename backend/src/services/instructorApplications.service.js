const prisma = require("../config/prisma");
const { sendMail } = require("../utils/mailer");

// ── Instructor Applications service ─────────────────────────────────────────────
//
// The "Become Instructor" queue. Submissions arrive unauthenticated; every
// decision is admin-only and audited.
//
// APPROVE is the only endpoint in this module that creates an account. It runs
// as ONE transaction (AppUser + InstructorProfile + the application row), and
// the application's `createdUserId` column is UNIQUE — so two admins clicking
// Approve at the same moment cannot mint two accounts: the loser hits P2002 and
// gets a 409. Approving an already-decided application is refused outright.
//
// Applicant emails are sent AFTER the transaction commits and are best-effort:
// sendMail() never throws, and a mail failure must not roll back an approval
// that already happened.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorApplications.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.userId === "string" ? details.userId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// States an admin may still act on.
const OPEN_STATES = ["PENDING", "CHANGES_REQUESTED"];

const APPLICATION_SELECT = {
  id: true, fullName: true, email: true, phone: true,
  headline: true, bio: true, specialization: true, skills: true,
  yearsExperience: true, cvUrl: true, portfolioUrl: true,
  status: true, reviewNotes: true, rejectionReason: true, changeRequest: true,
  reviewedById: true, reviewedAt: true, createdUserId: true,
  createdAt: true, updatedAt: true,
};

function mapApplication(a) {
  return {
    id:              a.id,
    fullName:        a.fullName,
    email:           a.email,
    phone:           a.phone ?? null,
    headline:        a.headline ?? null,
    bio:             a.bio ?? null,
    specialization:  a.specialization ?? null,
    skills:          a.skills ?? [],
    yearsExperience: a.yearsExperience ?? null,
    cvUrl:           a.cvUrl ?? null,
    portfolioUrl:    a.portfolioUrl ?? null,
    status:          a.status,
    reviewNotes:     a.reviewNotes ?? null,
    rejectionReason: a.rejectionReason ?? null,
    changeRequest:   a.changeRequest ?? null,
    reviewedById:    a.reviewedById ?? null,
    reviewedAt:      iso(a.reviewedAt),
    createdUserId:   a.createdUserId ?? null,
    createdAt:       iso(a.createdAt),
    updatedAt:       iso(a.updatedAt),
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────────

async function listApplications({ page, limit, status, search }) {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email:    { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [total, rows, statusGroups] = await Promise.all([
    safe(() => prisma.instructorApplication.count({ where }), 0),
    safe(() => prisma.instructorApplication.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: "asc" }, // longest-waiting first, like the approvals widget
      select: APPLICATION_SELECT,
    }), []),
    safe(() => prisma.instructorApplication.groupBy({ by: ["status"], _count: { _all: true } }), []),
  ]);

  const statusCounts = { PENDING: 0, CHANGES_REQUESTED: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of statusGroups) statusCounts[g.status] = g._count._all;

  return {
    applications: rows.map(mapApplication),
    statusCounts,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

async function getApplicationRow(id) {
  const app = await prisma.instructorApplication.findUnique({ where: { id }, select: APPLICATION_SELECT });
  if (!app) throw domainError("APPLICATION_NOT_FOUND");
  return app;
}

async function getApplication(id) {
  return mapApplication(await getApplicationRow(id));
}

// ── Public submit ───────────────────────────────────────────────────────────────

// Deliberately non-committal about what already exists for this email: the
// caller is unauthenticated, so every outcome returns the same generic message
// and no ids. Nothing here leaks whether an address has applied, been rejected,
// or already has an account.
//
//   open application (PENDING)  → no-op, no duplicate queue entry
//   CHANGES_REQUESTED           → fields replaced, status back to PENDING
//   APPROVED                    → no-op (they already have an account)
//   REJECTED / none             → new application
async function submitApplication(data) {
  const existing = await prisma.instructorApplication.findFirst({
    where: { email: data.email, status: { in: [...OPEN_STATES, "APPROVED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  if (existing?.status === "PENDING" || existing?.status === "APPROVED") {
    return { accepted: true, applicationId: existing.id, duplicate: true };
  }

  if (existing?.status === "CHANGES_REQUESTED") {
    const updated = await prisma.instructorApplication.update({
      where: { id: existing.id },
      data: { ...data, status: "PENDING", changeRequest: null, reviewedById: null, reviewedAt: null },
      select: { id: true },
    });
    await auditLog(null, "INSTRUCTOR_APPLICATION_SUBMITTED", { applicationId: updated.id, email: data.email, resubmitted: true });
    return { accepted: true, applicationId: updated.id, duplicate: false };
  }

  const created = await prisma.instructorApplication.create({ data, select: { id: true } });
  await auditLog(null, "INSTRUCTOR_APPLICATION_SUBMITTED", { applicationId: created.id, email: data.email, resubmitted: false });
  return { accepted: true, applicationId: created.id, duplicate: false };
}

// ── Review decisions ────────────────────────────────────────────────────────────

function assertOpen(app) {
  if (!OPEN_STATES.includes(app.status)) throw domainError("APPLICATION_ALREADY_DECIDED");
}

async function approveApplication(id, { reviewNotes }, adminId) {
  const app = await getApplicationRow(id);
  assertOpen(app);

  const emailOwner = await prisma.appUser.findFirst({ where: { email: app.email }, select: { id: true } });
  if (emailOwner) throw domainError("EMAIL_TAKEN");

  let userId;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.appUser.create({
        data: {
          fullName:          app.fullName,
          email:             app.email,
          // No password: the account is created by an admin, not by the
          // applicant. They set one through the reset-password flow — no
          // temporary secret is ever generated, stored or emailed.
          passwordHash:      null,
          role:              "INSTRUCTOR",
          status:            "ACTIVE",
          verificationState: "VERIFIED",
          phone:             app.phone,
          skills:            app.skills ?? [],
          instructorProfile: {
            create: {
              specialization:  app.specialization,
              headline:        app.headline,
              bio:             app.bio,
              yearsExperience: app.yearsExperience,
              verifiedAt:      new Date(),
              verifiedById:    adminId ?? null,
            },
          },
        },
        select: { id: true },
      });

      await tx.instructorApplication.update({
        where: { id },
        data: {
          status:        "APPROVED",
          reviewNotes,
          createdUserId: user.id,
          reviewedById:  adminId ?? null,
          reviewedAt:    new Date(),
        },
      });

      return user.id;
    });
  } catch (err) {
    // Unique violation on email or on createdUserId = someone approved this
    // (or created that account) first. Never a 500.
    if (err.code === "P2002") throw domainError("EMAIL_TAKEN");
    throw err;
  }

  await auditLog(adminId, "INSTRUCTOR_APPLICATION_APPROVED", {
    applicationId: id, userId, email: app.email,
  });

  await notifyApplicant(app.email, "approved", {
    fullName: app.fullName,
  });

  return { application: mapApplication(await getApplicationRow(id)), userId };
}

async function rejectApplication(id, { rejectionReason, reviewNotes }, adminId) {
  const app = await getApplicationRow(id);
  assertOpen(app);

  const updated = await prisma.instructorApplication.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason,
      reviewNotes,
      reviewedById: adminId ?? null,
      reviewedAt: new Date(),
    },
    select: APPLICATION_SELECT,
  });

  await auditLog(adminId, "INSTRUCTOR_APPLICATION_REJECTED", {
    applicationId: id, email: app.email, rejectionReason,
  });
  await notifyApplicant(app.email, "rejected", { fullName: app.fullName, reason: rejectionReason });

  return mapApplication(updated);
}

async function requestChanges(id, { changeRequest, reviewNotes }, adminId) {
  const app = await getApplicationRow(id);
  assertOpen(app);

  const updated = await prisma.instructorApplication.update({
    where: { id },
    data: {
      status: "CHANGES_REQUESTED",
      changeRequest,
      reviewNotes,
      reviewedById: adminId ?? null,
      reviewedAt: new Date(),
    },
    select: APPLICATION_SELECT,
  });

  await auditLog(adminId, "INSTRUCTOR_APPLICATION_CHANGES_REQUESTED", {
    applicationId: id, email: app.email, changeRequest,
  });
  await notifyApplicant(app.email, "changes", { fullName: app.fullName, reason: changeRequest });

  return mapApplication(updated);
}

// ── Applicant email (best-effort — sendMail never throws) ───────────────────────

const TEMPLATES = {
  approved: ({ fullName }) => ({
    subject: "Your MindNavy instructor application was approved",
    text: `Hi ${fullName},\n\nYour instructor application has been approved and your account is ready.\n\n`
        + `Use "Forgot password" on the sign-in page to set your password, then you can start creating courses.\n\n— MindNavy`,
  }),
  rejected: ({ fullName, reason }) => ({
    subject: "Update on your MindNavy instructor application",
    text: `Hi ${fullName},\n\nThank you for applying. After review we are not moving forward with your application.\n\nReason: ${reason}\n\n— MindNavy`,
  }),
  changes: ({ fullName, reason }) => ({
    subject: "More information needed for your MindNavy instructor application",
    text: `Hi ${fullName},\n\nWe need a few changes before we can finish reviewing your application:\n\n${reason}\n\n`
        + `Submit the form again with the updated details and it will return to the review queue.\n\n— MindNavy`,
  }),
};

async function notifyApplicant(to, template, vars) {
  const built = TEMPLATES[template]?.(vars);
  if (!built) return;
  await sendMail({ to, subject: built.subject, text: built.text });
}

module.exports = {
  listApplications,
  getApplication,
  submitApplication,
  approveApplication,
  rejectApplication,
  requestChanges,
};
