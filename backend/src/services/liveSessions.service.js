const prisma = require("../config/prisma");
const { getMeetingProvider } = require("./meetings");

// ── Live Sessions service (scheduling + real Zoom meetings) ─────────────────────
//
// Same conventions as quizzes.service: reads use safe() so the tab renders empty
// (never 500s) before db push; writes verify references first (clean 400/404).
//
// Meetings: creating a ZOOM session creates a REAL Zoom meeting through the
// meetings adapter and stores { zoomMeetingId, joinUrl, startUrl }. Schedule
// edits patch the Zoom meeting FIRST (if Zoom rejects, our row is untouched —
// DB and Zoom can't diverge); deletes remove our row first, then delete the
// Zoom meeting best-effort (an orphaned Zoom meeting is logged, never a 500).
//
// Status is stored (the LM dashboard filters on the column) but OWNED by the
// schedule: every read first runs two bounded raw UPDATEs that sync drifted
// rows (UPCOMING→LIVE→ENDED) from startTime + durationMin. One field, one
// owner (IMPACT_MAP B2) — the LM dashboard and activity feed read the same
// column and stay accurate without their code changing. No endpoint accepts a
// manual status write.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[liveSessions.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

const SESSION_SELECT = {
  id: true, title: true, description: true,
  courseId: true, instructorId: true,
  startTime: true, durationMin: true, timezone: true, maxParticipants: true,
  provider: true, zoomMeetingId: true, joinUrl: true, startUrl: true,
  status: true, endedAt: true, createdAt: true, updatedAt: true,
  course: { select: { title: true } },
  instructor: { select: { fullName: true } },
};

// startUrl is the Zoom HOST link. These endpoints are admin-only, so returning
// it is fine — but it must never be forwarded to learners (contract note).
function mapSession(s) {
  return {
    id:              s.id,
    title:           s.title,
    description:     s.description ?? null,
    courseId:        s.courseId ?? null,
    courseTitle:     s.course?.title ?? null,
    instructorId:    s.instructorId ?? null,
    instructorName:  s.instructor?.fullName ?? null,
    startTime:       iso(s.startTime),
    durationMin:     s.durationMin,
    timezone:        s.timezone,
    maxParticipants: s.maxParticipants ?? null,
    provider:        s.provider,
    zoomMeetingId:   s.zoomMeetingId ?? null,
    joinUrl:         s.joinUrl ?? null,
    startUrl:        s.startUrl ?? null,
    status:          s.status,
    endedAt:         iso(s.endedAt),
    createdAt:       iso(s.createdAt),
    updatedAt:       iso(s.updatedAt),
  };
}

// endedAt (admin manual end, PATCH /:id/end) wins over the schedule
// unconditionally — once set, a session is ENDED regardless of what
// startTime+durationMin says. This is the ONLY manual override; there is
// still no way to set UPCOMING/LIVE manually.
function deriveStatus(startTime, durationMin, endedAt, now = Date.now()) {
  if (endedAt) return "ENDED";
  const start = new Date(startTime).getTime();
  const end = start + durationMin * 60 * 1000;
  if (now >= end) return "ENDED";
  if (now >= start) return "LIVE";
  return "UPCOMING";
}

// Lazy status sync — two/three bounded UPDATEs over indexed columns; rows only
// match near schedule boundaries so this is a no-op almost always. Bumping
// updatedAt on ENDED also timestamps the LM activity feed's "session completed"
// entries correctly (it reads updatedAt).
async function syncStatuses() {
  await safe(() => prisma.$executeRaw`
    UPDATE "live_sessions" SET "status" = 'ENDED', "updatedAt" = NOW()
    WHERE "status" <> 'ENDED' AND ("startTime" + make_interval(mins => "durationMin")) <= NOW()`, 0);
  await safe(() => prisma.$executeRaw`
    UPDATE "live_sessions" SET "status" = 'LIVE', "updatedAt" = NOW()
    WHERE "status" = 'UPCOMING' AND "startTime" <= NOW() AND ("startTime" + make_interval(mins => "durationMin")) > NOW()`, 0);
  await safe(() => prisma.$executeRaw`
    UPDATE "live_sessions" SET "status" = 'UPCOMING', "updatedAt" = NOW()
    WHERE "status" = 'LIVE' AND "startTime" > NOW()`, 0);
}

// Best-effort audit — never breaks the primary write (mirrors quizzes.service).
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Existence guards ────────────────────────────────────────────────────────────

async function getSessionOrThrow(id) {
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (!s) throw domainError("LIVE_SESSION_NOT_FOUND");
  return s;
}

async function assertCourseExists(courseId) {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!c) throw domainError("COURSE_NOT_FOUND");
}

// Same rule as courses.service / lm filter-options: the host must be a real,
// non-archived INSTRUCTOR.
async function assertInstructor(instructorId) {
  const u = await prisma.appUser.findUnique({
    where: { id: instructorId },
    select: { id: true, role: true, status: true },
  });
  if (!u || u.role !== "INSTRUCTOR" || u.status === "ARCHIVED") throw domainError("INSTRUCTOR_NOT_FOUND");
}

function requireMeetings() {
  const provider = getMeetingProvider();
  if (!provider.isConfigured()) throw domainError("MEETINGS_NOT_CONFIGURED");
  return provider;
}

// ── Reads ───────────────────────────────────────────────────────────────────────

async function listSessions({ status, courseId, instructorId } = {}) {
  await syncStatuses();
  const rows = await safe(
    () => prisma.liveSession.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(courseId ? { courseId } : {}),
        ...(instructorId ? { instructorId } : {}),
      },
      orderBy: { startTime: "desc" },
      take: 500,
      select: SESSION_SELECT,
    }),
    [],
  );
  return rows.map(mapSession);
}

async function getSession(id) {
  await syncStatuses();
  const s = await prisma.liveSession.findUnique({ where: { id }, select: SESSION_SELECT });
  if (!s) throw domainError("LIVE_SESSION_NOT_FOUND");
  return mapSession(s);
}

// ── Writes ──────────────────────────────────────────────────────────────────────

async function createSession(data, adminId) {
  if (data.courseId) await assertCourseExists(data.courseId);
  await assertInstructor(data.instructorId);

  // Zoom first: if meeting creation fails there is nothing to roll back.
  const meetings = requireMeetings();
  const meeting = await meetings.createMeeting({
    title: data.title,
    startTime: data.startTime,
    durationMin: data.durationMin,
    timezone: data.timezone,
  });

  let session;
  try {
    session = await prisma.liveSession.create({
      data: {
        title:           data.title,
        description:     data.description,
        courseId:        data.courseId,
        instructorId:    data.instructorId,
        startTime:       data.startTime,
        durationMin:     data.durationMin,
        timezone:        data.timezone,
        maxParticipants: data.maxParticipants,
        provider:        data.provider,
        zoomMeetingId:   meeting.meetingId,
        joinUrl:         meeting.joinUrl,
        startUrl:        meeting.startUrl,
        status:          deriveStatus(data.startTime, data.durationMin, null),
      },
      select: SESSION_SELECT,
    });
  } catch (err) {
    // Compensate: don't leave a Zoom meeting nobody can reach from the app.
    await meetings.deleteMeeting(meeting.meetingId).catch((zErr) =>
      console.error("[liveSessions] orphaned Zoom meeting", meeting.meetingId, "-", zErr.message));
    throw err;
  }

  await auditLog(adminId, "LIVE_SESSION_CREATED", {
    sessionId: session.id, title: session.title, courseId: session.courseId, zoomMeetingId: meeting.meetingId,
  });
  return mapSession(session);
}

async function updateSession(id, data, adminId) {
  const current = await getSessionOrThrow(id);
  if (data.courseId) await assertCourseExists(data.courseId);
  if (data.instructorId) await assertInstructor(data.instructorId);

  // Schedule fields Zoom must know about. Patch Zoom BEFORE our row: a Zoom
  // rejection leaves the DB untouched, so the two never diverge.
  const scheduleChanged = ["title", "startTime", "durationMin", "timezone"]
    .some((k) => data[k] !== undefined);
  if (scheduleChanged && current.zoomMeetingId) {
    await requireMeetings().updateMeeting(current.zoomMeetingId, {
      title:       data.title,
      startTime:   data.startTime,
      durationMin: data.durationMin,
      timezone:    data.timezone,
    });
  }

  // Keep the stored status truthful against the (possibly new) schedule —
  // but if this session was already manually ended (endedAt set), editing
  // its schedule must NOT revive it back to UPCOMING/LIVE. deriveStatus()
  // checks current.endedAt first, same as every other status computation.
  const startTime = data.startTime ?? current.startTime;
  const durationMin = data.durationMin ?? current.durationMin;
  const session = await prisma.liveSession.update({
    where: { id },
    data: { ...data, status: deriveStatus(startTime, durationMin, current.endedAt) },
    select: SESSION_SELECT,
  });

  await auditLog(adminId, "LIVE_SESSION_UPDATED", { sessionId: id, fields: Object.keys(data) });
  return mapSession(session);
}

async function deleteSession(id, adminId) {
  const current = await getSessionOrThrow(id);

  // Our row first — cancellation must always succeed for the admin. The Zoom
  // meeting is then removed best-effort; a failure is an orphan to log, not a 500.
  await prisma.liveSession.delete({ where: { id } });
  if (current.zoomMeetingId) {
    const meetings = getMeetingProvider();
    if (meetings.isConfigured()) {
      await meetings.deleteMeeting(current.zoomMeetingId).catch((err) =>
        console.error("[liveSessions] failed to delete Zoom meeting", current.zoomMeetingId, "-", err.message));
    }
  }

  await auditLog(adminId, "LIVE_SESSION_DELETED", { sessionId: id, zoomMeetingId: current.zoomMeetingId });
  return { id };
}

// Manual admin override — end a LIVE (or UPCOMING) session early, ahead of
// its scheduled startTime+durationMin window. DB-only: does NOT call Zoom to
// force-end the real meeting (v1 scope, matches what was asked — the Zoom
// call itself is going through the same meeting:update scope that's
// currently broken on this account anyway; add it as a follow-up once that's
// resolved, via meetings.updateMeeting-style best-effort call here).
async function endSession(id, adminId) {
  await syncStatuses(); // truthful current status before deciding "already ended"
  const current = await getSessionOrThrow(id);
  if (current.status === "ENDED") throw domainError("ALREADY_ENDED");

  const session = await prisma.liveSession.update({
    where: { id },
    data: { endedAt: new Date(), status: "ENDED" },
    select: SESSION_SELECT,
  });

  await auditLog(adminId, "LIVE_SESSION_MANUALLY_ENDED", { sessionId: id });
  return mapSession(session);
}

module.exports = {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  endSession,
};
