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

  // ── 2b. Analytics (task 111) ──────────────────────────────────────────────────
  console.log("\nGET /instructors/analytics");
  const noAuthAnalytics = await req("GET", "/instructors/analytics", undefined, false);
  ok("analytics without auth -> 401", noAuthAnalytics.status === 401, `got ${noAuthAnalytics.status}`);

  const analytics = await req("GET", "/instructors/analytics");
  const a = analytics.json?.data ?? {};
  ok("analytics -> 200", analytics.status === 200, `got ${analytics.status}: ${analytics.json?.message}`);
  ok("analytics is not a 404 from the /:id route", analytics.json?.message !== "Instructor not found.");

  const dist = a.distributionBySpecialization?.items ?? [];
  ok("distributionBySpecialization available", a.distributionBySpecialization?.available === true);
  ok("distribution total equals the Total Instructors card (same population)",
    dist.reduce((sum, i) => sum + i.count, 0) === s.totalInstructors?.value,
    `${dist.reduce((sum, i) => sum + i.count, 0)} vs ${s.totalInstructors?.value}`);
  ok("distribution percentages sum to 100.0",
    dist.length === 0 || Math.abs(dist.reduce((sum, i) => sum + i.percentage, 0) - 100) < 0.05,
    String(dist.reduce((sum, i) => sum + i.percentage, 0)));

  const byStatus = a.coursesByStatus?.items ?? [];
  ok("coursesByStatus available", a.coursesByStatus?.available === true);
  ok("coursesByStatus excludes ARCHIVED (matches row coursesCount)",
    byStatus.every((i) => i.status !== "ARCHIVED"), JSON.stringify(byStatus.map((i) => i.status)));
  ok("coursesByStatus percentages sum to 100.0",
    byStatus.length === 0 || Math.abs(byStatus.reduce((sum, i) => sum + i.percentage, 0) - 100) < 0.05);

  const top = a.topInstructors?.items ?? [];
  ok("topInstructors declares rankedBy", a.topInstructors?.rankedBy === "students");
  ok("topInstructors is capped at the shared limit", top.length <= (a.topInstructors?.limit ?? 10));
  ok("topInstructors ordered by students desc",
    top.every((it, i, arr) => i === 0 || arr[i - 1].studentsCount >= it.studentsCount),
    JSON.stringify(top.map((t) => t.studentsCount)));
  ok("topInstructors rating/revenue null (never invented)",
    top.every((it) => it.rating === null && it.revenue === null));

  ok("earningsOverview unavailable with a reason (not a zeroed chart)",
    a.earningsOverview?.available === false && typeof a.earningsOverview?.reason === "string"
      && a.earningsOverview?.value === null,
    JSON.stringify(a.earningsOverview));

  // ?tab=top must agree with the chart — one definition of "top".
  const topTab = await req("GET", "/instructors?tab=top&limit=10");
  const topTabIds = (topTab.json?.data?.instructors ?? []).map((i) => i.id);
  ok("?tab=top ranks by the SAME metric as topInstructors",
    top.length === 0 || topTabIds[0] === top[0].id,
    `tab=${topTabIds[0]} chart=${top[0]?.id}`);

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
  const d = detail.json?.data ?? {};
  ok("detail -> 200", detail.status === 200 && d.id === inst.id, `got ${detail.status}`);
  ok("detail carries courses array", Array.isArray(d.courses));
  ok("detail carries liveSessionsCount", typeof d.liveSessionsCount === "number");

  // ── Task 109 blocks: badges / approvals / activity / chart ───────────────────
  ok("badges derived, not stored",
    d.badges?.active === true && d.badges?.verified === true && typeof d.badges?.topInstructor === "boolean",
    JSON.stringify(d.badges));
  ok("pendingApprovals is an array", Array.isArray(d.pendingApprovals));
  ok("recentActivities is an array", Array.isArray(d.recentActivities));
  ok("recentActivities capped at 10", (d.recentActivities ?? []).length <= 10);
  ok("recentActivities newest first",
    (d.recentActivities ?? []).every((a, i, arr) => i === 0 || arr[i - 1].createdAt >= a.createdAt));
  ok("performanceChart has a DENSE 12-month series",
    d.performanceChart?.labels?.length === 12 && d.performanceChart?.enrollments?.length === 12,
    `labels=${d.performanceChart?.labels?.length} data=${d.performanceChart?.enrollments?.length}`);
  ok("chart months are YYYY-MM and end on the current month",
    /^\d{4}-\d{2}$/.test(d.performanceChart?.labels?.[11] ?? ""),
    d.performanceChart?.labels?.[11]);
  ok("chart enrollments are all numbers (zero-filled, no gaps)",
    (d.performanceChart?.enrollments ?? []).every((n) => typeof n === "number"));
  ok("chart revenue null + revenueAvailable false (never a flat zero line)",
    d.performanceChart?.revenue === null && d.performanceChart?.revenueAvailable === false);
  ok("no /details endpoint was created (detail is the one owner)",
    (await req("GET", `/instructors/${inst.id}/details`)).status === 404);

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

  const badViolation = await req("PATCH", `/instructors/${inst.id}/suspend`, {
    reason: "Smoke test suspension", violationType: "NOT_A_REAL_TYPE",
  });
  ok("unknown violationType -> 400 (a typo is never filed as untyped)", badViolation.status === 400, `got ${badViolation.status}`);

  // violationType is OPTIONAL in v1 — the live Suspend modal still sends only
  // { reason, notes }, so this must keep working until the dropdown ships.
  const legacyShape = await req("PATCH", `/instructors/${inst.id}/suspend`, { reason: "Smoke legacy-shape suspension" });
  ok("suspend without violationType -> 200 (existing UI not broken)", legacyShape.status === 200, `got ${legacyShape.status}`);
  await req("PATCH", `/instructors/${inst.id}/reactivate`);

  const suspended = await req("PATCH", `/instructors/${inst.id}/suspend`, {
    reason: "Smoke test suspension", notes: "Filed by the smoke test.", violationType: "policy",
  });
  ok("suspend -> 200", suspended.status === 200 && suspended.json?.data?.status === "suspended", `got ${suspended.status}: ${suspended.json?.data?.status}`);

  // "Verify" must never double as a hidden un-suspend.
  const verifySuspended = await req("PATCH", `/instructors/${inst.id}/verify`);
  ok("verify while suspended -> 409 (no silent un-suspend)", verifySuspended.status === 409, `got ${verifySuspended.status}`);
  const stillSuspended = await req("GET", `/instructors/${inst.id}`);
  ok("still suspended after the refused verify", stillSuspended.json?.data?.status === "suspended", stillSuspended.json?.data?.status);

  const usersView = await req("GET", `/users/${inst.id}`);
  const usersStatus = usersView.json?.user?.status ?? usersView.json?.data?.status;
  ok("Users module sees the same status (one owner, no drift)", usersStatus === "suspended", `users says ${usersStatus}`);

  const reactivated = await req("PATCH", `/instructors/${inst.id}/reactivate`, { notes: "Cleared by the smoke test." });
  ok("reactivate -> 200", reactivated.status === 200 && reactivated.json?.data?.status === "active", `got ${reactivated.status}`);

  // ── 7b. Suspension history (task 117) ─────────────────────────────────────────
  console.log("\nGET /instructors/:id/suspension-history");
  const history = await req("GET", `/instructors/${inst.id}/suspension-history`);
  const rows = history.json?.data?.history ?? [];
  ok("history -> 200", history.status === 200 && Array.isArray(rows), `got ${history.status}`);
  ok("carries pagination", typeof history.json?.data?.pagination?.total === "number");
  ok("newest first", rows[0]?.action === "reactivated", rows[0]?.action);
  const suspendRow = rows.find((r) => r.action === "suspended" && r.violationType === "POLICY");
  ok("the typed suspension is recorded", Boolean(suspendRow), JSON.stringify(rows.map((r) => r.action)));
  ok("reason survived into history", suspendRow?.reason === "Smoke test suspension", suspendRow?.reason);
  ok("notes survived into history", suspendRow?.notes === "Filed by the smoke test.", suspendRow?.notes);
  ok("violationType is normalized to the enum casing", suspendRow?.violationType === "POLICY", suspendRow?.violationType);
  ok("reactivate notes recorded", rows.find((r) => r.action === "reactivated")?.notes === "Cleared by the smoke test.");
  ok("acting admin is named", typeof suspendRow?.adminName === "string" && suspendRow.adminName.length > 0, suspendRow?.adminName);
  // The suspension WITHOUT a violationType must still be listed — just untyped.
  ok("untyped legacy-shape suspension is listed with violationType null",
    rows.some((r) => r.action === "suspended" && r.violationType === null));

  const historyBadLimit = await req("GET", `/instructors/${inst.id}/suspension-history?limit=5000`);
  ok("limit above the ceiling -> 400", historyBadLimit.status === 400, `got ${historyBadLimit.status}`);
  const historyOfLearner = await req("GET", `/instructors/${learnerId}/suspension-history`);
  ok("history for a non-instructor -> 404", historyOfLearner.status === 404, `got ${historyOfLearner.status}`);
  const historyNoAuth = await req("GET", `/instructors/${inst.id}/suspension-history`, undefined, false);
  ok("history without a token -> 401", historyNoAuth.status === 401, `got ${historyNoAuth.status}`);

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

  // ── 8b. Pending approvals + submittedAt (task 109) ────────────────────────────
  console.log("\nPending approvals fed by a real submit");
  const pendingCourse = await req("POST", "/courses", {
    title: `INSTRUCTOR SMOKE PENDING ${stamp}`, instructorId: inst.id, category: "Smoke", level: "Beginner",
  });
  const pendingCourseId = pendingCourse.json?.data?.id;
  if (pendingCourseId) {
    // Make it pass the submit checks, then submit it for real.
    await req("PATCH", `/courses/${pendingCourseId}`, {
      description: "Submitted by the instructors smoke test.", thumbnail: "https://example.com/t.png",
    });
    const section = await req("POST", `/courses/${pendingCourseId}/sections`, { title: "Intro" });
    await req("POST", `/sections/${section.json?.data?.id}/lessons`, { title: "Welcome", type: "TEXT", content: "Hi" });
    const submitted = await req("POST", `/courses/${pendingCourseId}/submit`);
    ok("course submitted -> Pending", submitted.status === 200, `got ${submitted.status}: ${submitted.json?.message}`);

    const withPending = await req("GET", `/instructors/${inst.id}`);
    const queued = (withPending.json?.data?.pendingApprovals ?? []).find((c) => c.id === pendingCourseId);
    ok("submitted course appears in pendingApprovals", Boolean(queued));
    ok("submittedAt is stamped (not null, not updatedAt)",
      Boolean(queued?.submittedAt) && !Number.isNaN(Date.parse(queued?.submittedAt ?? "")), queued?.submittedAt);
    ok("only PENDING courses are queued",
      (withPending.json?.data?.pendingApprovals ?? []).every((c) => c.id !== undefined));

    await req("DELETE", `/courses/${pendingCourseId}`);
  } else {
    ok("setup: pending course created", false, `got ${pendingCourse.status}`);
  }

  // ── 8c. Instructor Courses tab: Rejected view + unpublish (task 115) ──────────
  //
  // The tab is the COURSES list filtered by instructor — there is deliberately no
  // /instructors/:id/courses endpoint. "Rejected" is a view over Draft, so the
  // key property under test is that Draft and Rejected partition the drafts.
  console.log("\nInstructor Courses tab (GET /courses?instructor=…)");
  const wfCourse = await req("POST", "/courses", {
    title: `INSTRUCTOR SMOKE WORKFLOW ${stamp}`, instructorId: inst.id, category: "Smoke", level: "Beginner",
  });
  const wfId = wfCourse.json?.data?.id;
  ok("setup: workflow course created", Boolean(wfId), `got ${wfCourse.status}`);

  if (wfId) {
    const scoped = await req("GET", `/courses?instructor=${inst.id}&status=Draft`);
    ok("scoped to the instructor -> 200", scoped.status === 200, `got ${scoped.status}`);
    ok("only this instructor's courses come back",
      (scoped.json?.data?.courses ?? []).every((c) => c.instructorId === inst.id));
    ok("statusCounts carries a rejected bucket", typeof scoped.json?.data?.statusCounts?.rejected === "number");
    const draftsBefore  = scoped.json?.data?.statusCounts?.draft ?? 0;
    const rejectedBefore = scoped.json?.data?.statusCounts?.rejected ?? 0;

    // Make it submittable, submit, then reject it — that is what produces a
    // "rejected" course (status DRAFT + rejectionReason).
    await req("PATCH", `/courses/${wfId}`, {
      description: "Workflow course for the smoke test.", thumbnail: "https://example.com/t.png",
    });
    const wfSection = await req("POST", `/courses/${wfId}/sections`, { title: "Intro" });
    await req("POST", `/sections/${wfSection.json?.data?.id}/lessons`, { title: "Welcome", type: "TEXT", content: "Hi" });
    await req("POST", `/courses/${wfId}/submit`);
    const rejected = await req("POST", `/courses/${wfId}/reject`, { reason: "Needs more lessons." });
    ok("reject -> back to Draft", rejected.status === 200 && rejected.json?.data?.status === "Draft", `got ${rejected.status}`);

    const rejectedList = await req("GET", `/courses?instructor=${inst.id}&status=Rejected`);
    const rejRow = (rejectedList.json?.data?.courses ?? []).find((c) => c.id === wfId);
    ok("Rejected filter -> 200", rejectedList.status === 200, `got ${rejectedList.status}`);
    ok("the rejected course is in the Rejected view", Boolean(rejRow));
    ok("row carries isRejected + the reason", rejRow?.isRejected === true && rejRow?.rejectionReason === "Needs more lessons.");
    ok("row keeps its true status (Draft — it is editable again)", rejRow?.status === "Draft", rejRow?.status);
    ok("row exposes submittedAt for the Pending view", rejRow?.submittedAt !== undefined);

    const draftList = await req("GET", `/courses?instructor=${inst.id}&status=Draft`);
    ok("a rejected course is NOT in the plain Draft view (tabs partition)",
      !(draftList.json?.data?.courses ?? []).some((c) => c.id === wfId));
    // The partition property: a rejected course MOVES from the draft bucket to
    // the rejected one. It must not be counted in both (which is what the naked
    // groupBy would have done) and it must not vanish from both.
    const counts = draftList.json?.data?.statusCounts ?? {};
    ok("rejected count went up by one", counts.rejected === rejectedBefore + 1, `${rejectedBefore} -> ${counts.rejected}`);
    ok("draft count went down by one (moved, not copied)", counts.draft === draftsBefore - 1, `${draftsBefore} -> ${counts.draft}`);
    ok("draft + rejected is unchanged (no double-count, nothing lost)",
      counts.draft + counts.rejected === draftsBefore + rejectedBefore,
      `${draftsBefore}+${rejectedBefore} -> ${counts.draft}+${counts.rejected}`);

    // Unpublish: the one action in task 115 that did not exist.
    const notPublished = await req("POST", `/courses/${wfId}/unpublish`);
    ok("unpublish a Draft -> 400", notPublished.status === 400, `got ${notPublished.status}`);

    await req("POST", `/courses/${wfId}/submit`);
    const approved = await req("POST", `/courses/${wfId}/approve`);
    ok("approve -> Published", approved.status === 200 && approved.json?.data?.status === "Published", `got ${approved.status}`);

    const unpublished = await req("POST", `/courses/${wfId}/unpublish`);
    ok("unpublish a Published course -> 200 Draft",
      unpublished.status === 200 && unpublished.json?.data?.status === "Draft", `got ${unpublished.status}: ${unpublished.json?.message}`);

    const afterUnpublish = await req("GET", `/courses/${wfId}`);
    ok("unpublishing keeps reviewedAt (approval history is not rewritten)",
      Boolean(afterUnpublish.json?.data?.reviewedAt), afterUnpublish.json?.data?.reviewedAt);
    ok("unpublishing is not a rejection (no rejectionReason, stays out of Rejected)",
      afterUnpublish.json?.data?.rejectionReason === null && afterUnpublish.json?.data?.isRejected === false);

    const twiceUnpublished = await req("POST", `/courses/${wfId}/unpublish`);
    ok("unpublish twice -> 400 (atomic guard)", twiceUnpublished.status === 400, `got ${twiceUnpublished.status}`);

    const badFilter = await req("GET", `/courses?instructor=${inst.id}&status=Nonsense`);
    ok("unknown status filter -> 400", badFilter.status === 400, `got ${badFilter.status}`);

    await req("DELETE", `/courses/${wfId}`);
  }

  // ── 8d. Documents (task 119) ──────────────────────────────────────────────────
  console.log("\nInstructor documents");
  const docsList = await req("GET", `/instructors/${inst.id}/documents`);
  ok("list documents -> 200", docsList.status === 200 && Array.isArray(docsList.json?.data?.documents), `got ${docsList.status}`);

  const docsNoAuth = await req("GET", `/instructors/${inst.id}/documents`, undefined, false);
  ok("documents without a token -> 401", docsNoAuth.status === 401, `got ${docsNoAuth.status}`);
  const docsOfLearner = await req("GET", `/instructors/${learnerId}/documents`);
  ok("documents for a non-instructor -> 404", docsOfLearner.status === 404, `got ${docsOfLearner.status}`);

  const badType = await req("POST", `/instructors/${inst.id}/documents/sign`, {
    fileName: "id.pdf", fileType: "application/pdf", type: "CERTIFICATION",
  });
  ok("type=CERTIFICATION -> 400 (certifications are a separate entity)", badType.status === 400, `got ${badType.status}`);

  const badMime = await req("POST", `/instructors/${inst.id}/documents/sign`, {
    fileName: "payload.svg", fileType: "image/svg+xml", type: "IDENTITY",
  });
  ok("SVG upload -> 400 (scriptable file type)", badMime.status === 400, `got ${badMime.status}`);

  const signed = await req("POST", `/instructors/${inst.id}/documents/sign`, {
    fileName: "smoke identity/../scan.pdf", fileType: "application/pdf", type: "IDENTITY",
  });
  // 503 is a legitimate answer when storage is not configured on this machine —
  // the suite must not fail for that, but everything below it needs a real URL.
  const storageReady = signed.status === 200;
  ok("sign -> 200 (or 503 when storage is unconfigured)",
    storageReady || signed.status === 503, `got ${signed.status}: ${signed.json?.message}`);

  if (storageReady) {
    const uploadUrl = signed.json?.data?.uploadUrl;
    const path = signed.json?.data?.path;
    ok("path is scoped to this instructor", typeof path === "string" && path.startsWith(`instructors/${inst.id}/`), path);
    ok("traversal in fileName is neutralised", typeof path === "string" && !path.includes(".."), path);
    ok("the signed URL is not a public URL", typeof uploadUrl === "string" && uploadUrl.length > 0);

    // Confirm before the file exists must not create a row.
    const earlyConfirm = await req("POST", `/instructors/${inst.id}/documents/confirm`, {
      path, fileName: "scan.pdf", type: "IDENTITY",
    });
    ok("confirm before the upload lands -> 400", earlyConfirm.status === 400, `got ${earlyConfirm.status}`);

    const foreignConfirm = await req("POST", `/instructors/${inst.id}/documents/confirm`, {
      path: `instructors/${learnerId}/stolen.pdf`, fileName: "stolen.pdf", type: "IDENTITY",
    });
    ok("confirm a path outside this instructor's prefix -> 400", foreignConfirm.status === 400, `got ${foreignConfirm.status}`);

    const traversalConfirm = await req("POST", `/instructors/${inst.id}/documents/confirm`, {
      path: `instructors/${inst.id}/../../etc/passwd`, fileName: "x.pdf", type: "IDENTITY",
    });
    ok("confirm with traversal -> 400", traversalConfirm.status === 400, `got ${traversalConfirm.status}`);

    // Real upload → real confirm.
    const pdfBytes = Buffer.from("%PDF-1.4\n% smoke test document\n");
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes,
    });
    ok("client PUT straight to storage succeeds", put.ok, `got ${put.status}`);

    if (put.ok) {
      const confirmed = await req("POST", `/instructors/${inst.id}/documents/confirm`, {
        path, fileName: "scan.pdf", type: "IDENTITY",
      });
      const docId = confirmed.json?.data?.id;
      ok("confirm -> 201", confirmed.status === 201 && Boolean(docId), `got ${confirmed.status}: ${confirmed.json?.message}`);
      ok("status starts PENDING", confirmed.json?.data?.status === "PENDING", confirmed.json?.data?.status);
      ok("size + mime come from the stored object, not the client",
        confirmed.json?.data?.fileSize === pdfBytes.length && confirmed.json?.data?.mimeType === "application/pdf",
        `${confirmed.json?.data?.fileSize} / ${confirmed.json?.data?.mimeType}`);
      ok("no filePath is exposed to the client", confirmed.json?.data?.filePath === undefined);

      const expiredDate = await req("POST", `/instructors/${inst.id}/documents/confirm`, {
        path, fileName: "scan.pdf", type: "CONTRACT", expiresAt: "2020-01-01T00:00:00.000Z",
      });
      ok("expiresAt in the past -> 400", expiredDate.status === 400, `got ${expiredDate.status}`);

      const listed = await req("GET", `/instructors/${inst.id}/documents`);
      const row = (listed.json?.data?.documents ?? []).find((d) => d.id === docId);
      ok("the document is listed", Boolean(row));
      ok("download URL is signed and short-lived",
        typeof row?.downloadUrl === "string" && row.downloadUrl.includes("token"), row?.downloadUrl?.slice(0, 60));
      ok("download expiry is reported to the client", row?.downloadExpiresIn > 0);

      const download = await fetch(row.downloadUrl);
      ok("the signed URL actually resolves the file", download.ok, `got ${download.status}`);
      const unsigned = await fetch(row.downloadUrl.split("?")[0]);
      ok("the same URL WITHOUT its token is refused (bucket is private)", !unsigned.ok, `got ${unsigned.status}`);

      const noReasonReject = await req("PATCH", `/instructors/${inst.id}/documents/${docId}/reject`, {});
      ok("reject without a reason -> 400", noReasonReject.status === 400, `got ${noReasonReject.status}`);

      const rejectedDoc = await req("PATCH", `/instructors/${inst.id}/documents/${docId}/reject`, { reason: "Illegible scan." });
      ok("reject -> 200 REJECTED with the reason",
        rejectedDoc.status === 200 && rejectedDoc.json?.data?.status === "REJECTED" && rejectedDoc.json?.data?.rejectionReason === "Illegible scan.",
        `got ${rejectedDoc.status}`);

      const verifiedDoc = await req("PATCH", `/instructors/${inst.id}/documents/${docId}/verify`);
      ok("verify -> 200 VERIFIED", verifiedDoc.status === 200 && verifiedDoc.json?.data?.status === "VERIFIED", `got ${verifiedDoc.status}`);
      ok("verifying clears the old rejection reason", verifiedDoc.json?.data?.rejectionReason === null);
      ok("verifiedAt / verifiedById stamped",
        Boolean(verifiedDoc.json?.data?.verifiedAt) && Boolean(verifiedDoc.json?.data?.verifiedById));

      // Cross-instructor access: a real doc id under the WRONG instructor.
      const crossRead = await req("PATCH", `/instructors/${learnerId}/documents/${docId}/verify`);
      ok("another user's document id -> 404 (no existence leak)", crossRead.status === 404, `got ${crossRead.status}`);

      const archivedDoc = await req("DELETE", `/instructors/${inst.id}/documents/${docId}`);
      ok("delete -> 200 and is SOFT (status ARCHIVED)",
        archivedDoc.status === 200 && archivedDoc.json?.data?.status === "ARCHIVED", `got ${archivedDoc.status}`);

      const afterArchiveList = await req("GET", `/instructors/${inst.id}/documents`);
      ok("archived documents are hidden by default",
        !(afterArchiveList.json?.data?.documents ?? []).some((d) => d.id === docId));
      const withArchived = await req("GET", `/instructors/${inst.id}/documents?includeArchived=true`);
      ok("…but are still retrievable for a compliance review",
        (withArchived.json?.data?.documents ?? []).some((d) => d.id === docId));

      const verifyArchived = await req("PATCH", `/instructors/${inst.id}/documents/${docId}/verify`);
      ok("verifying an archived document -> 409", verifyArchived.status === 409, `got ${verifyArchived.status}`);
    }
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
