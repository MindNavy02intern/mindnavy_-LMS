const prisma = require("../config/prisma");
const { getOwnedCourses } = require("../utils/ownershipGuard");

// ── Instructor Students service (Phase 4, blueprint 2.5) ────────────────────────
//
// "My Students" = learners enrolled in ANY course this instructor owns. Nothing
// in learners.service/enrollments.service can filter by instructor (Step 0
// audit — see blueprint 2.5's own [NEEDS NEW ENDPOINT] note), so this is a
// fresh module, not a thin wrapper: look up Course.instructorId=self, collect
// ids, then join CourseEnrollment through that id set.
//
// Read-only by design (Part 3 spec): no reset-progress/unenroll/grade writes
// here — blueprint 2.5 documents those as instructor actions, but this phase
// scopes to GET-only, matching the task's explicit "NO edit/suspend/delete
// actions" instruction. Flagged as a follow-up gap, not silently built.
//
// PRIVACY RULE (blueprint 2.5 side panel): a student's progress/assessments/
// attendance shown here must be scoped to THIS instructor's own courses/
// quizzes/sessions only — never the student's full cross-instructor history.
// Every read below intersects against getOwnedCourses(instructorId) before
// touching CourseEnrollment/QuizAttempt/SessionAttendance.

function domainError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorStudents.service] query failed:", err.message);
    return fallback;
  }
}

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

const ENROLLMENT_SELECT = {
  id: true, courseId: true, userId: true, progress: true, status: true,
  createdAt: true, completedAt: true,
  course: { select: { id: true, title: true } },
  user: { select: { id: true, fullName: true, email: true, avatar: true } },
};

function mapStudentEnrollmentRow(e) {
  return {
    enrollmentId:  e.id,
    studentId:     e.userId,
    studentName:   e.user?.fullName ?? null,
    studentEmail:  e.user?.email ?? null,
    studentAvatar: e.user?.avatar ?? null,
    courseId:      e.courseId,
    courseTitle:   e.course?.title ?? null,
    progress:      e.progress,
    status:        e.status,
    enrolledAt:    iso(e.createdAt),
    completedAt:   iso(e.completedAt),
  };
}

// ── List: one row per (student, my-course) enrollment ───────────────────────────

async function listMyStudents(instructorId, { search, courseId, status, page, limit } = {}) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = ownCourses.map((c) => c.id);

  if (ownIds.length === 0) {
    return { students: [], courses: [], pagination: buildPagination(0, 1, limit ?? 20) };
  }

  // A courseId that isn't one of the instructor's own must yield zero rows,
  // never another instructor's students — intersect, don't trust the client.
  const scopedCourseIds = courseId ? (ownIds.includes(courseId) ? [courseId] : []) : ownIds;

  // "A student" means an AppUser with role=LEARNER — same definition
  // assertMyStudent() enforces below. Without this filter, any other-role
  // AppUser with a stray CourseEnrollment row into one of the instructor's
  // courses (e.g. test/seed data) would appear in this list but then 404 on
  // GET /students/:id, which filters by role=LEARNER — list and detail must
  // agree on who counts as "my students."
  const where = {
    courseId: { in: scopedCourseIds },
    ...(status ? { status } : {}),
    user: {
      role: "LEARNER",
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email:    { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };

  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows] = await Promise.all([
    safe(() => prisma.courseEnrollment.count({ where }), 0),
    safe(() => prisma.courseEnrollment.findMany({
      where, skip, take, orderBy: { createdAt: "desc" }, select: ENROLLMENT_SELECT,
    }), []),
  ]);

  return {
    students: rows.map(mapStudentEnrollmentRow),
    courses: ownCourses.map((c) => ({ id: c.id, title: c.title })),
    pagination: buildPagination(total, p, l),
  };
}

// ── Ownership guard: student must be enrolled in ≥1 of MY courses ──────────────

async function assertMyStudent(instructorId, studentId) {
  const student = await prisma.appUser.findFirst({
    where: { id: studentId, role: "LEARNER" },
    select: { id: true, fullName: true, email: true, avatar: true },
  });
  if (!student) throw domainError("STUDENT_NOT_FOUND", 404);

  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = ownCourses.map((c) => c.id);
  if (ownIds.length === 0) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  const enrolledInMine = await prisma.courseEnrollment.count({
    where: { userId: studentId, courseId: { in: ownIds } },
  });
  if (enrolledInMine === 0) throw domainError("FORBIDDEN_NOT_OWNER", 403);

  return { student, ownIds };
}

// ── Detail: identity + progress in MY courses ONLY ──────────────────────────────

async function getMyStudent(instructorId, studentId) {
  const { student, ownIds } = await assertMyStudent(instructorId, studentId);

  const enrollments = await safe(() => prisma.courseEnrollment.findMany({
    where: { userId: studentId, courseId: { in: ownIds } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, courseId: true, progress: true, status: true,
      completedAt: true, updatedAt: true, createdAt: true,
      course: { select: { title: true } },
    },
  }), []);

  return {
    id:       student.id,
    fullName: student.fullName,
    email:    student.email,
    avatar:   student.avatar ?? null,
    // Deliberately scoped to THIS instructor's own courses — never the
    // student's enrollments in another instructor's courses (privacy rule,
    // blueprint 2.5 side panel).
    courses: enrollments.map((e) => ({
      enrollmentId: e.id,
      courseId:     e.courseId,
      courseTitle:  e.course?.title ?? null,
      progress:     e.progress,
      status:       e.status,
      enrolledAt:   iso(e.createdAt),
      completedAt:  iso(e.completedAt),
      updatedAt:    iso(e.updatedAt),
    })),
  };
}

// ── Assessments: quiz attempts filtered to MY quizzes only ──────────────────────

async function getMyStudentAssessments(instructorId, studentId, { page, limit } = {}) {
  const { ownIds } = await assertMyStudent(instructorId, studentId);

  const myQuizzes = await safe(() => prisma.quiz.findMany({
    where: { courseId: { in: ownIds } },
    select: { id: true },
  }), []);
  const quizIds = myQuizzes.map((q) => q.id);

  const { skip, take, page: p, limit: l } = paginate(page, limit);
  const where = { userId: studentId, quizId: { in: quizIds } };

  const [total, rows] = quizIds.length
    ? await Promise.all([
        safe(() => prisma.quizAttempt.count({ where }), 0),
        safe(() => prisma.quizAttempt.findMany({
          where, orderBy: { createdAt: "desc" }, skip, take,
          select: {
            id: true, quizId: true, status: true, score: true, feedback: true,
            attemptNo: true, submittedAt: true, gradedAt: true, createdAt: true,
            quiz: { select: { title: true, passingGrade: true, course: { select: { id: true, title: true } } } },
          },
        }), []),
      ])
    : [0, []];

  return {
    assessments: rows.map((a) => ({
      id:           a.id,
      quizId:       a.quizId,
      quizTitle:    a.quiz?.title ?? null,
      passingGrade: a.quiz?.passingGrade ?? null,
      courseId:     a.quiz?.course?.id ?? null,
      courseTitle:  a.quiz?.course?.title ?? null,
      status:       a.status,
      score:        a.score,
      feedback:     a.feedback ?? null,
      attemptNo:    a.attemptNo,
      submittedAt:  iso(a.submittedAt),
      gradedAt:     iso(a.gradedAt),
      createdAt:    iso(a.createdAt),
    })),
    pagination: buildPagination(total, p, l),
  };
}

// ── Attendance: session records filtered to MY live sessions only ──────────────

async function getMyStudentAttendance(instructorId, studentId, { page, limit } = {}) {
  await assertMyStudent(instructorId, studentId);

  const mySessions = await safe(() => prisma.liveSession.findMany({
    where: { instructorId },
    select: { id: true },
  }), []);
  const sessionIds = mySessions.map((s) => s.id);

  const { skip, take, page: p, limit: l } = paginate(page, limit);
  const where = { userId: studentId, sessionId: { in: sessionIds } };

  const [total, rows, statusGroups] = sessionIds.length
    ? await Promise.all([
        safe(() => prisma.sessionAttendance.count({ where }), 0),
        safe(() => prisma.sessionAttendance.findMany({
          where, orderBy: { createdAt: "desc" }, skip, take,
          select: {
            id: true, status: true, joinedAt: true, leftAt: true, durationMin: true,
            participationScore: true, createdAt: true,
            session: { select: { id: true, title: true, startTime: true } },
          },
        }), []),
        safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where, _count: { _all: true } }), []),
      ])
    : [0, [], []];

  const summary = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const g of statusGroups) {
    const key = g.status.toLowerCase();
    if (key in summary) summary[key] = g._count._all;
  }

  return {
    records: rows.map((r) => ({
      id:                 r.id,
      sessionId:          r.session?.id ?? null,
      sessionTitle:       r.session?.title ?? null,
      sessionStartTime:   iso(r.session?.startTime ?? null),
      status:             r.status,
      joinedAt:           iso(r.joinedAt),
      leftAt:             iso(r.leftAt),
      durationMin:        r.durationMin,
      participationScore: r.participationScore,
      createdAt:          iso(r.createdAt),
    })),
    summary,
    pagination: buildPagination(total, p, l),
  };
}

// ── Certificates: issued for MY courses only ────────────────────────────────────

async function getMyStudentCertificates(instructorId, studentId, { page, limit } = {}) {
  const { ownIds } = await assertMyStudent(instructorId, studentId);

  const { skip, take, page: p, limit: l } = paginate(page, limit);
  const where = { userId: studentId, courseId: { in: ownIds } };

  const [total, rows] = await Promise.all([
    safe(() => prisma.certificate.count({ where }), 0),
    safe(() => prisma.certificate.findMany({
      where, orderBy: { issuedAt: "desc" }, skip, take,
      select: {
        id: true, courseId: true, verificationCode: true,
        issuedAt: true, revokedAt: true, expiresAt: true,
        course: { select: { title: true } },
      },
    }), []),
  ]);

  return {
    certificates: rows.map((c) => ({
      id:               c.id,
      courseId:         c.courseId,
      courseTitle:      c.course?.title ?? null,
      verificationCode: c.verificationCode,
      status:           c.revokedAt ? "revoked" : c.expiresAt && c.expiresAt.getTime() <= Date.now() ? "expired" : "active",
      issuedAt:         iso(c.issuedAt),
      revokedAt:        iso(c.revokedAt),
      expiresAt:        iso(c.expiresAt),
    })),
    pagination: buildPagination(total, p, l),
  };
}

// ── Activity: quiz attempts + session attendance for MY content only ───────────
// Deliberately excludes login events (AppUserSession) — a login is an
// account-level event with no course/instructor link, so it isn't "this
// instructor's content" activity; showing it here would leak a student's
// platform-wide usage pattern to every instructor they have a single class
// with. Mirrors learners.service.js's getLearnerActivity shape (merge +
// sort + paginate in memory) but scoped to the two content-linked types.

async function getMyStudentActivity(instructorId, studentId, { page, limit } = {}) {
  const { ownIds } = await assertMyStudent(instructorId, studentId);

  const myQuizzes = await safe(() => prisma.quiz.findMany({ where: { courseId: { in: ownIds } }, select: { id: true } }), []);
  const quizIds = myQuizzes.map((q) => q.id);
  const mySessions = await safe(() => prisma.liveSession.findMany({ where: { instructorId }, select: { id: true } }), []);
  const sessionIds = mySessions.map((s) => s.id);

  const FETCH_WINDOW = 200; // bounded, same shape as learners.service.js's own window
  const [attempts, attendance] = await Promise.all([
    quizIds.length
      ? safe(() => prisma.quizAttempt.findMany({
          where: { userId: studentId, quizId: { in: quizIds } },
          orderBy: { createdAt: "desc" }, take: FETCH_WINDOW,
          select: { id: true, createdAt: true, status: true, score: true, quiz: { select: { title: true } } },
        }), [])
      : [],
    sessionIds.length
      ? safe(() => prisma.sessionAttendance.findMany({
          where: { userId: studentId, sessionId: { in: sessionIds } },
          orderBy: { createdAt: "desc" }, take: FETCH_WINDOW,
          select: { id: true, createdAt: true, status: true, session: { select: { title: true } } },
        }), [])
      : [],
  ]);

  const events = [
    ...attempts.map((a) => ({
      id: `quiz_attempt:${a.id}`,
      type: "quiz_attempt",
      title: `Attempted quiz "${a.quiz?.title ?? 'Untitled'}"${a.score != null ? ` — scored ${a.score}` : ''}`,
      createdAt: a.createdAt,
    })),
    ...attendance.map((r) => ({
      id: `session_attended:${r.id}`,
      type: "session_attended",
      title: r.status === "PRESENT" ? `Attended "${r.session?.title ?? 'session'}"`
        : r.status === "LATE" ? `Joined late to "${r.session?.title ?? 'session'}"`
        : `Marked ${r.status.toLowerCase()} for "${r.session?.title ?? 'session'}"`,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const { skip, take, page: p, limit: l } = paginate(page, limit);
  const pageEvents = events.slice(skip, skip + take);

  return {
    events: pageEvents.map((e) => ({ id: e.id, type: e.type, title: e.title, createdAt: iso(e.createdAt) })),
    pagination: buildPagination(events.length, p, l),
  };
}

module.exports = {
  listMyStudents,
  getMyStudent,
  getMyStudentAssessments,
  getMyStudentAttendance,
  getMyStudentCertificates,
  getMyStudentActivity,
};
