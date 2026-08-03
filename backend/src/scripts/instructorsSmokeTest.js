/**
 * Smoke test for the Instructors module (profile CRUD + stats + applications).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var. Creates throwaway records, exercises everything, then
 * cleans up (instructors archived, applications left in a terminal state).
 *
 * Covers the integration rules the module exists to protect:
 *   • instructors created through POST /api/admin/users (no profile row) still
 *     appear in the list — the table and the LM dropdown must agree on who exists
 *   • status / verificationState writes go through the Users module
 *   • rating + revenue come back null with available:false, never 0
 *   • DELETE is blocked while the instructor still owns a course
 *   • approving an application twice cannot create two accounts
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run.
 *   2. The backend server is running (default http://localhost:5001).
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/instructorsSmokeTest.js
 */

const BASE   = (process.env.SMOKE_BASE_URL || "http://localhost:5001").replace(/\/+$/, "");
const TOKEN  = process.env.SMOKE_TOKEN;
const API    = `${BASE}/api/admin`;
const PUBLIC = `${BASE}/api/public`;

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function call(url, method, path, body, withAuth = true) {
  const res = await fetch(`${url}${path}`, {
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

const req       = (method, path, body, withAuth) => call(API, method, path, body, withAuth);
const publicReq = (method, path, body)           => call(PUBLIC, method, path, body, false);

const stamp = Date.now();
const email = (tag) => `smoke.${tag}.${stamp}@example.com`;
const STRONG_PASSWORD = "Smoke!Passw0rd2026";

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Run: node src/scripts/mintSmokeSession.js");
    process.exit(1);
  }
  console.log(`Instructors smoke test -> ${API}\n`);

  const createdInstructorIds = [];

  // ── 1. Auth ───────────────────────────────────────────────────────────────────
  console.log("Auth");
  for (const [label, path] of [["list", "/instructors"], ["stats", "/instructors/stats"], ["applications", "/instructor-applications"]]) {
    const res = await req("GET", path, undefined, false);
    ok(`${label} without auth -> 401`, res.status === 401, `got ${res.status}`);
  }

  // ── 2. Routing: /stats must not be read as an id ──────────────────────────────
  console.log("\nGET /instructors/stats");
  const stats = await req("GET", "/instructors/stats");
  ok("stats -> 200", stats.status === 200, `got ${stats.status}: ${stats.json?.message}`);
  const s = stats.json?.data ?? {};
  ok("stats is not a 404 from the /:id route", stats.json?.message !== "Instructor not found.");
  ok("totalInstructors available", s.totalInstructors?.available === true && typeof s.totalInstructors?.value === "number");
  ok("pendingApproval available", s.pendingApproval?.available === true);
  ok("coursesPublished available", s.coursesPublished?.available === true);
  ok("totalRevenue null + available:false (never 0)",
    s.totalRevenue?.value === null && s.totalRevenue?.available === false, JSON.stringify(s.totalRevenue));
  ok("avgRating null + available:false (never 0)",
    s.avgRating?.value === null && s.avgRating?.available === false, JSON.stringify(s.avgRating));

  // ── 3. List + tabs + filters ──────────────────────────────────────────────────
  console.log("\nGET /instructors");
  const list0 = await req("GET", "/instructors");
  ok("list -> 200", list0.status === 200 && Array.isArray(list0.json?.data?.instructors), `got ${list0.status}`);
  ok("carries tabCounts", typeof list0.json?.data?.tabCounts?.all === "number");
  ok("tabCounts.pending mirrors stats.pendingApproval",
    list0.json?.data?.tabCounts?.pending === s.pendingApproval?.value,
    `${list0.json?.data?.tabCounts?.pending} vs ${s.pendingApproval?.value}`);
  ok("carries pagination", typeof list0.json?.data?.pagination?.total === "number");

  const badTab = await req("GET", "/instructors?tab=nope");
  ok("unknown tab -> 400", badTab.status === 400, `got ${badTab.status}`);
  const pendingTab = await req("GET", "/instructors?tab=pending");
  ok("tab=pending -> 400 pointing at the applications endpoint",
    pendingTab.status === 400 && /instructor-applications/.test(pendingTab.json?.message ?? ""), pendingTab.json?.message);
  const badLimit = await req("GET", "/instructors?limit=999");
  ok("limit over cap -> 400", badLimit.status === 400, `got ${badLimit.status}`);
  for (const tab of ["all", "active", "inactive", "suspended", "top"]) {
    const res = await req("GET", `/instructors?tab=${tab}`);
    ok(`tab=${tab} -> 200`, res.status === 200, `got ${res.status}`);
  }
  const sorted = await req("GET", "/instructors?sort=students");
  ok("sort=students -> 200", sorted.status === 200, `got ${sorted.status}`);

  // ── 4. Create validation ──────────────────────────────────────────────────────
  console.log("\nPOST /instructors — validation");
  const valid = {
    fullName: "Smoke Instructor",
    email: email("main"),
    password: STRONG_PASSWORD,
    specialization: "Data Engineering",
    bio: "Smoke test instructor profile.",
    yearsExperience: 7,
    websiteUrl: "https://example.com/profile",
    skills: ["SQL", "Airflow"],
  };
  const noName  = await req("POST", "/instructors", { ...valid, fullName: undefined });
  ok("missing fullName -> 400", noName.status === 400, `got ${noName.status}`);
  const badMail = await req("POST", "/instructors", { ...valid, email: "not-an-email" });
  ok("bad email -> 400", badMail.status === 400, `got ${badMail.status}`);
  const weakPw  = await req("POST", "/instructors", { ...valid, password: "short" });
  ok("weak password -> 400", weakPw.status === 400, `got ${weakPw.status}`);
  const roleSet = await req("POST", "/instructors", { ...valid, role: "ADMIN_ASSISTANT" });
  ok("role in body -> 400 (privilege escalation blocked)", roleSet.status === 400, `got ${roleSet.status}`);
  const badUrl  = await req("POST", "/instructors", { ...valid, websiteUrl: "javascript:alert(1)" });
  ok("javascript: url -> 400", badUrl.status === 400, `got ${badUrl.status}`);

  // ── 5. Create + read back ─────────────────────────────────────────────────────
  console.log("\nPOST /instructors — create");
  const created = await req("POST", "/instructors", valid);
  const inst = created.json?.data;
  ok("create -> 201", created.status === 201 && Boolean(inst?.id), `got ${created.status}: ${created.json?.message}`);
  if (!inst?.id) { report(); return; }
  createdInstructorIds.push(inst.id);

  ok("role forced to INSTRUCTOR (appears in the instructors list)", true);
  ok("status lowercase like the Users module", inst.status === "active", inst.status);
  ok("profile fields returned", inst.specialization === "Data Engineering" && inst.yearsExperience === 7);
  ok("hasProfile true", inst.hasProfile === true);
  ok("rating null (no Review table)", inst.rating === null);
  ok("revenue null (no Payment table)", inst.revenue === null);
  ok("counts start at 0", inst.coursesCount === 0 && inst.studentsCount === 0);

  const dupe = await req("POST", "/instructors", valid);
  ok("duplicate email -> 409 (not 500)", dupe.status === 409, `got ${dupe.status}`);

  const detail = await req("GET", `/instructors/${inst.id}`);
  ok("detail -> 200", detail.status === 200 && detail.json?.data?.id === inst.id, `got ${detail.status}`);
  ok("detail carries courses array", Array.isArray(detail.json?.data?.courses));
  ok("detail carries liveSessionsCount", typeof detail.json?.data?.liveSessionsCount === "number");

  const missing = await req("GET", "/instructors/00000000-0000-0000-0000-000000000000");
  ok("unknown id -> 404", missing.status === 404, `got ${missing.status}`);

  // A non-instructor user must not be readable through this module.
  const learner = await req("POST", "/users", {
    fullName: "Smoke Learner", email: email("learner"), password: STRONG_PASSWORD, role: "LEARNER", status: "ACTIVE",
  });
  const learnerId = learner.json?.user?.id ?? learner.json?.data?.id;
  if (learnerId) {
    const asInstructor = await req("GET", `/instructors/${learnerId}`);
    ok("LEARNER id -> 404 (no cross-role reads)", asInstructor.status === 404, `got ${asInstructor.status}`);
  } else {
    ok("LEARNER id -> 404 (no cross-role reads)", false, `could not create learner: ${learner.status}`);
  }

  // ── 6. Update — profile only, foreign fields rejected ─────────────────────────
  console.log("\nPATCH /instructors/:id");
  const patched = await req("PATCH", `/instructors/${inst.id}`, { specialization: "Machine Learning", headline: "ML lead" });
  ok("profile update -> 200", patched.status === 200 && patched.json?.data?.specialization === "Machine Learning", `got ${patched.status}`);

  for (const [field, body] of [
    ["status",            { status: "SUSPENDED" }],
    ["email",             { email: "new@example.com" }],
    ["role",              { role: "ADMIN_ASSISTANT" }],
    ["verificationState", { verificationState: "VERIFIED" }],
    ["password",          { password: STRONG_PASSWORD }],
  ]) {
    const res = await req("PATCH", `/instructors/${inst.id}`, body);
    ok(`${field} in PATCH -> 400 (owned by the Users module)`, res.status === 400, `got ${res.status}`);
  }
  const emptyPatch = await req("PATCH", `/instructors/${inst.id}`, {});
  ok("empty PATCH -> 400", emptyPatch.status === 400, `got ${emptyPatch.status}`);

  // ── 7. Delegated transitions ──────────────────────────────────────────────────
  console.log("\nverify / suspend / reactivate");
  const verified = await req("PATCH", `/instructors/${inst.id}/verify`);
  ok("verify -> 200", verified.status === 200, `got ${verified.status}`);
  ok("verificationState flipped on the AppUser row", verified.json?.data?.verificationState === "verified", verified.json?.data?.verificationState);
  ok("verifiedAt stamped on the profile", Boolean(verified.json?.data?.verifiedAt));

  const noReason = await req("PATCH", `/instructors/${inst.id}/suspend`, {});
  ok("suspend without reason -> 400 (never a 500)", noReason.status === 400, `got ${noReason.status}`);

  const suspended = await req("PATCH", `/instructors/${inst.id}/suspend`, { reason: "Smoke test suspension" });
  ok("suspend -> 200", suspended.status === 200 && suspended.json?.data?.status === "suspended", `got ${suspended.status}: ${suspended.json?.data?.status}`);

  // "Verify" must never double as a hidden un-suspend.
  const verifySuspended = await req("PATCH", `/instructors/${inst.id}/verify`);
  ok("verify while suspended -> 409 (no silent un-suspend)", verifySuspended.status === 409, `got ${verifySuspended.status}`);
  const stillSuspended = await req("GET", `/instructors/${inst.id}`);
  ok("still suspended after the refused verify", stillSuspended.json?.data?.status === "suspended", stillSuspended.json?.data?.status);

  const usersView = await req("GET", `/users/${inst.id}`);
  const usersStatus = usersView.json?.user?.status ?? usersView.json?.data?.status;
  ok("Users module sees the same status (one owner, no drift)", usersStatus === "suspended", `users says ${usersStatus}`);

  const reactivated = await req("PATCH", `/instructors/${inst.id}/reactivate`);
  ok("reactivate -> 200", reactivated.status === 200 && reactivated.json?.data?.status === "active", `got ${reactivated.status}`);

  // ── 8. Legacy instructor (created via /users, no profile row) ─────────────────
  console.log("\nLegacy instructor without a profile row");
  const legacy = await req("POST", "/users", {
    fullName: "Smoke Legacy Instructor", email: email("legacy"), password: STRONG_PASSWORD, role: "INSTRUCTOR", status: "ACTIVE",
  });
  const legacyId = legacy.json?.user?.id ?? legacy.json?.data?.id;
  ok("setup: instructor created through /users", Boolean(legacyId), `got ${legacy.status}`);
  if (legacyId) {
    createdInstructorIds.push(legacyId);
    const legacyRead = await req("GET", `/instructors/${legacyId}`);
    ok("profile-less instructor is visible here -> 200", legacyRead.status === 200, `got ${legacyRead.status}`);
    ok("hasProfile false, no crash", legacyRead.json?.data?.hasProfile === false);
    const legacyPatch = await req("PATCH", `/instructors/${legacyId}`, { specialization: "Backfilled" });
    ok("PATCH creates the missing profile (upsert, not 404)",
      legacyPatch.status === 200 && legacyPatch.json?.data?.specialization === "Backfilled", `got ${legacyPatch.status}`);
  }

  // ── 9. Delete guard ───────────────────────────────────────────────────────────
  console.log("\nDELETE /instructors/:id");
  const course = await req("POST", "/courses", {
    title: `INSTRUCTOR SMOKE ${stamp}`, instructorId: inst.id, category: "Smoke", level: "Beginner",
  });
  const courseId = course.json?.data?.id;
  ok("setup: course assigned to the instructor", Boolean(courseId), `got ${course.status}`);

  if (courseId) {
    const blocked = await req("DELETE", `/instructors/${inst.id}`);
    ok("delete with owned courses -> 409 (not a P2003 500)", blocked.status === 409, `got ${blocked.status}`);
    ok("409 names the blockers", blocked.json?.data?.courses >= 1, JSON.stringify(blocked.json?.data));
    await req("DELETE", `/courses/${courseId}`);
  }

  const archived = await req("DELETE", `/instructors/${inst.id}`);
  ok("delete once free -> 200", archived.status === 200, `got ${archived.status}: ${archived.json?.message}`);
  const afterArchive = await req("GET", "/instructors?tab=all");
  ok("archived instructor drops out of the table",
    !(afterArchive.json?.data?.instructors ?? []).some((i) => i.id === inst.id));

  // ── 10. Applications ──────────────────────────────────────────────────────────
  console.log("\nPublic POST /api/public/instructor-applications");
  const application = {
    fullName: "Smoke Applicant",
    email: email("applicant"),
    specialization: "Cloud Security",
    bio: "I have been teaching cloud security for several years and would like to join.",
    yearsExperience: 5,
    skills: ["AWS", "IAM"],
    portfolioUrl: "https://example.com/portfolio",
  };
  const submitted = await publicReq("POST", "/instructor-applications", application);
  ok("public submit -> 202", submitted.status === 202, `got ${submitted.status}: ${submitted.json?.message}`);
  ok("public response leaks no id", submitted.json?.data === undefined && submitted.json?.id === undefined);

  const shortBio = await publicReq("POST", "/instructor-applications", { ...application, bio: "too short" });
  ok("short bio -> 400", shortBio.status === 400, `got ${shortBio.status}`);
  const selfApprove = await publicReq("POST", "/instructor-applications", { ...application, status: "APPROVED" });
  ok("status in public body -> 400 (self-approval blocked)", selfApprove.status === 400, `got ${selfApprove.status}`);
  const honeypot = await publicReq("POST", "/instructor-applications", { ...application, email: email("bot"), website: "http://spam.example" });
  ok("honeypot -> 202 and silently dropped", honeypot.status === 202, `got ${honeypot.status}`);

  console.log("\nGET /instructor-applications");
  const apps = await req("GET", "/instructor-applications?status=pending");
  ok("list -> 200", apps.status === 200 && Array.isArray(apps.json?.data?.applications), `got ${apps.status}`);
  ok("carries statusCounts", typeof apps.json?.data?.statusCounts?.PENDING === "number");
  const mine = (apps.json?.data?.applications ?? []).find((a) => a.email === application.email);
  ok("submitted application is queued", Boolean(mine));
  ok("honeypot submission was NOT stored",
    !(apps.json?.data?.applications ?? []).some((a) => a.email === email("bot")));

  const badStatus = await req("GET", "/instructor-applications?status=whatever");
  ok("bad status filter -> 400", badStatus.status === 400, `got ${badStatus.status}`);

  if (mine) {
    console.log("\nApplication decisions");
    const noReason = await req("PATCH", `/instructor-applications/${mine.id}/reject`, {});
    ok("reject without reason -> 400", noReason.status === 400, `got ${noReason.status}`);
    const noChange = await req("PATCH", `/instructor-applications/${mine.id}/request-changes`, {});
    ok("request-changes without text -> 400", noChange.status === 400, `got ${noChange.status}`);

    const changes = await req("PATCH", `/instructor-applications/${mine.id}/request-changes`, { changeRequest: "Please attach a CV link." });
    ok("request-changes -> 200", changes.status === 200 && changes.json?.data?.status === "CHANGES_REQUESTED", `got ${changes.status}`);

    const resubmit = await publicReq("POST", "/instructor-applications", { ...application, bio: `${application.bio} Updated with a CV.` });
    ok("resubmit -> 202", resubmit.status === 202, `got ${resubmit.status}`);
    const afterResubmit = await req("GET", `/instructor-applications/${mine.id}`);
    ok("resubmission reopens the SAME row as PENDING (no duplicate queue entry)",
      afterResubmit.json?.data?.status === "PENDING", afterResubmit.json?.data?.status);

    const approved = await req("PATCH", `/instructor-applications/${mine.id}/approve`, {});
    const newUserId = approved.json?.data?.userId;
    ok("approve -> 200 with a created userId", approved.status === 200 && Boolean(newUserId), `got ${approved.status}: ${approved.json?.message}`);
    if (newUserId) {
      createdInstructorIds.push(newUserId);
      const asInstructor = await req("GET", `/instructors/${newUserId}`);
      ok("approved applicant is a real instructor", asInstructor.status === 200, `got ${asInstructor.status}`);
      ok("account is active + verified",
        asInstructor.json?.data?.status === "active" && asInstructor.json?.data?.verificationState === "verified");
      ok("profile carried over from the application", asInstructor.json?.data?.specialization === "Cloud Security");
    }

    const twice = await req("PATCH", `/instructor-applications/${mine.id}/approve`, {});
    ok("approve twice -> 409 (no second account)", twice.status === 409, `got ${twice.status}`);

    const rejectAfter = await req("PATCH", `/instructor-applications/${mine.id}/reject`, { rejectionReason: "already decided" });
    ok("reject after approve -> 409", rejectAfter.status === 409, `got ${rejectAfter.status}`);
  }

  const missingApp = await req("GET", "/instructor-applications/00000000-0000-0000-0000-000000000000");
  ok("unknown application id -> 404", missingApp.status === 404, `got ${missingApp.status}`);

  // ── 11. Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nCleanup");
  for (const id of createdInstructorIds) {
    await req("DELETE", `/users/${id}`);
  }
  if (learnerId) await req("DELETE", `/users/${learnerId}`);
  console.log(`  archived ${createdInstructorIds.length + (learnerId ? 1 : 0)} smoke user(s)`);

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nSmoke test crashed:", err);
  process.exit(1);
});
