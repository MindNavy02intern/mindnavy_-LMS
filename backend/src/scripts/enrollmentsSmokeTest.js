/**
 * Smoke test for the Enrollments endpoints (list/enroll/status/unenroll +
 * enrollmentLimit enforcement).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var. Creates a throwaway course, enrolls existing users into
 * it, then cleans up (enrollments deleted, course archived). No users are
 * created or modified.
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run.
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one INSTRUCTOR and two AppUsers exist.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/enrollmentsSmokeTest.js
 */

const BASE  = (process.env.SMOKE_BASE_URL || "http://localhost:5001").replace(/\/+$/, "");
const TOKEN = process.env.SMOKE_TOKEN;
const API   = `${BASE}/api/admin`;

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function req(method, path, body, withAuth = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Enrollments smoke test -> ${API}\n`);

  // Setup — instructor, a fresh course, and two existing users to enroll.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const mkCourse = await req("POST", "/courses", {
    title: `ENROLL SMOKE ${new Date().toISOString()}`,
    instructorId, category: "Smoke", level: "Beginner",
  });
  const courseId = mkCourse.json?.data?.id;
  ok("setup: course created", Boolean(courseId), `got ${mkCourse.status}`);
  if (!courseId) process.exit(1);

  const usersRes = await req("GET", "/users?page=1&limit=5");
  const userIds = (usersRes.json?.users ?? []).map((u) => u.id).filter(Boolean);
  ok("setup: found at least 2 users", userIds.length >= 2, `found ${userIds.length}`);
  if (userIds.length < 2) process.exit(1);
  const [userA, userB] = userIds;

  // 1. Auth + validation + reference guards.
  console.log("\nPOST /enrollments — validation");
  const noAuth = await req("GET", "/enrollments", undefined, false);
  ok("no auth -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  const noCourse = await req("POST", "/enrollments", { userId: userA });
  ok("missing courseId -> 400", noCourse.status === 400, `got ${noCourse.status}`);
  const noUser = await req("POST", "/enrollments", { courseId });
  ok("missing userId -> 400", noUser.status === 400, `got ${noUser.status}`);
  const badCourse = await req("POST", "/enrollments", { courseId: "00000000-0000-0000-0000-000000000000", userId: userA });
  ok("unknown courseId -> 400", badCourse.status === 400, `got ${badCourse.status}`);
  const badUser = await req("POST", "/enrollments", { courseId, userId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown userId -> 400", badUser.status === 400, `got ${badUser.status}`);

  // 2. Enroll + duplicate guard.
  console.log("\nPOST /enrollments — enroll");
  const created = await req("POST", "/enrollments", { courseId, userId: userA });
  const enrollmentId = created.json?.data?.id;
  ok("enroll -> 201", created.status === 201 && Boolean(enrollmentId), `got ${created.status}: ${created.json?.message}`);
  ok("status defaults to NOT_STARTED", created.json?.data?.status === "NOT_STARTED");
  ok("progress starts at 0", created.json?.data?.progress === 0);
  ok("carries userName", typeof created.json?.data?.userName === "string");
  ok("carries courseTitle", typeof created.json?.data?.courseTitle === "string");
  ok("carries enrolledAt", Boolean(created.json?.data?.enrolledAt));
  if (!enrollmentId) process.exit(1);

  const dup = await req("POST", "/enrollments", { courseId, userId: userA });
  ok("duplicate enroll -> 400", dup.status === 400, `got ${dup.status}`);

  // 3. List + filters + counts.
  console.log("\nGET /enrollments");
  const list = await req("GET", `/enrollments?courseId=${courseId}`);
  ok("list by courseId -> 200", list.status === 200, `got ${list.status}`);
  ok("list contains the enrollment", (list.json?.data?.enrollments ?? []).some((e) => e.id === enrollmentId));
  ok("has pagination", Boolean(list.json?.data?.pagination));
  ok("has statusCounts", list.json?.data?.statusCounts?.All >= 1, JSON.stringify(list.json?.data?.statusCounts));

  const byStatus = await req("GET", `/enrollments?courseId=${courseId}&status=NOT_STARTED`);
  ok("status filter keeps it", (byStatus.json?.data?.enrollments ?? []).some((e) => e.id === enrollmentId));
  const byUser = await req("GET", `/enrollments?userId=${userA}`);
  ok("userId filter keeps it", (byUser.json?.data?.enrollments ?? []).some((e) => e.id === enrollmentId));
  const badStatusQ = await req("GET", "/enrollments?status=dropped");
  ok("unknown status filter -> 400", badStatusQ.status === 400, `got ${badStatusQ.status}`);

  // 4. PATCH — status only; progress is learner-owned.
  console.log("\nPATCH /enrollments/:id");
  const patchProgress = await req("PATCH", `/enrollments/${enrollmentId}`, { progress: 50 });
  ok("patch progress -> 400 (learner-derived)", patchProgress.status === 400, `got ${patchProgress.status}`);
  const patchBad = await req("PATCH", `/enrollments/${enrollmentId}`, { status: "DROPPED" });
  ok("status DROPPED -> 400 (v2)", patchBad.status === 400, `got ${patchBad.status}`);
  const patchEmpty = await req("PATCH", `/enrollments/${enrollmentId}`, {});
  ok("empty patch -> 400", patchEmpty.status === 400, `got ${patchEmpty.status}`);

  const completed = await req("PATCH", `/enrollments/${enrollmentId}`, { status: "COMPLETED" });
  ok("status COMPLETED -> 200", completed.status === 200, `got ${completed.status}`);
  ok("completedAt stamped", Boolean(completed.json?.data?.completedAt));
  const reopened = await req("PATCH", `/enrollments/${enrollmentId}`, { status: "IN_PROGRESS" });
  ok("back to IN_PROGRESS -> 200", reopened.status === 200, `got ${reopened.status}`);
  ok("completedAt cleared", reopened.json?.data?.completedAt === null);

  // 5. enrollmentLimit enforcement (Wizard Step 4 setting).
  console.log("\nenrollmentLimit");
  const setLimit = await req("PATCH", `/courses/${courseId}/settings`, { enrollmentLimit: 1 });
  ok("set enrollmentLimit=1 -> 200", setLimit.status === 200, `got ${setLimit.status}`);
  const overLimit = await req("POST", "/enrollments", { courseId, userId: userB });
  ok("enroll past limit -> 400 (course full)", overLimit.status === 400 && /full/i.test(overLimit.json?.message ?? ""), `got ${overLimit.status}: ${overLimit.json?.message}`);

  // 6. Unenroll.
  console.log("\nDELETE /enrollments/:id");
  const del = await req("DELETE", `/enrollments/${enrollmentId}`);
  ok("unenroll -> 200", del.status === 200, `got ${del.status}`);
  const delAgain = await req("DELETE", `/enrollments/${enrollmentId}`);
  ok("unenroll again -> 404", delAgain.status === 404, `got ${delAgain.status}`);
  const listAfter = await req("GET", `/enrollments?courseId=${courseId}`);
  ok("list no longer contains it", !(listAfter.json?.data?.enrollments ?? []).some((e) => e.id === enrollmentId));

  // Cleanup — archive the throwaway course.
  console.log("\nCleanup");
  const arch = await req("DELETE", `/courses/${courseId}`);
  ok("course archived", arch.status === 200, `got ${arch.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
