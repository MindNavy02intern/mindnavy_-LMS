/**
 * Smoke test for the Live Sessions endpoints (scheduling CRUD + Zoom).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var. Creates a throwaway course, exercises everything, then
 * cleans up (sessions deleted, course archived).
 *
 * Zoom: if ZOOM_* credentials are configured on the SERVER, the full CRUD runs
 * (creating/patching/deleting a REAL Zoom meeting). If not, the test verifies
 * the clean 503 MEETINGS_NOT_CONFIGURED behavior instead and skips the CRUD leg.
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run.
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/liveSessionsSmokeTest.js
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

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Live Sessions smoke test -> ${API}\n`);

  // Setup — instructor + one fresh course to attach sessions to.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const mkCourse = await req("POST", "/courses", {
    title: `LIVE SMOKE ${new Date().toISOString()}`,
    instructorId, category: "Smoke", level: "Beginner",
  });
  const courseId = mkCourse.json?.data?.id;
  ok("setup: course created", Boolean(courseId), `got ${mkCourse.status}`);
  if (!courseId) process.exit(1);

  // 1. Auth + validation guards (none of these should reach Zoom).
  console.log("\nPOST /live-sessions — validation");
  const noAuth = await req("GET", "/live-sessions", undefined, false);
  ok("no auth -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  const valid = { title: "Smoke Session", instructorId, startTime: inOneHour(), durationMin: 30, timezone: "UTC" };

  const noTitle = await req("POST", "/live-sessions", { ...valid, title: undefined });
  ok("missing title -> 400", noTitle.status === 400, `got ${noTitle.status}`);
  const noInstructor = await req("POST", "/live-sessions", { ...valid, instructorId: undefined });
  ok("missing instructorId -> 400", noInstructor.status === 400, `got ${noInstructor.status}`);
  const badTz = await req("POST", "/live-sessions", { ...valid, timezone: "Mars/Olympus" });
  ok("bad timezone -> 400", badTz.status === 400, `got ${badTz.status}`);
  const pastStart = await req("POST", "/live-sessions", { ...valid, startTime: "2020-01-01T00:00:00Z" });
  ok("past startTime -> 400", pastStart.status === 400, `got ${pastStart.status}`);
  const v2Provider = await req("POST", "/live-sessions", { ...valid, provider: "MEET" });
  ok("provider MEET -> 400 (v2)", v2Provider.status === 400, `got ${v2Provider.status}`);
  const badCourse = await req("POST", "/live-sessions", { ...valid, courseId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown courseId -> 400", badCourse.status === 400, `got ${badCourse.status}`);
  const badHost = await req("POST", "/live-sessions", { ...valid, instructorId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown instructorId -> 400", badHost.status === 400, `got ${badHost.status}`);

  // 2. List always works (seeded rows or empty).
  console.log("\nGET /live-sessions");
  const list0 = await req("GET", "/live-sessions");
  ok("list -> 200", list0.status === 200 && Array.isArray(list0.json?.data), `got ${list0.status}`);
  const badStatus = await req("GET", "/live-sessions?status=paused");
  ok("bad status filter -> 400", badStatus.status === 400, `got ${badStatus.status}`);

  // 3. Create — full Zoom CRUD if configured, clean 503 otherwise.
  console.log("\nPOST /live-sessions — create (Zoom)");
  const created = await req("POST", "/live-sessions", { ...valid, courseId, description: "smoke", maxParticipants: 100 });

  if (created.status === 503) {
    ok("Zoom not configured -> clean 503 with message", Boolean(created.json?.message?.includes("ZOOM")), created.json?.message);
    console.log("  (skipping Zoom CRUD leg — set ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET to run it)");
  } else {
    const s = created.json?.data;
    ok("create -> 201", created.status === 201 && Boolean(s?.id), `got ${created.status}: ${created.json?.message}`);
    if (s?.id) {
      ok("has real joinUrl", typeof s.joinUrl === "string" && s.joinUrl.includes("zoom.us"), s.joinUrl);
      ok("has startUrl (host link)", typeof s.startUrl === "string" && s.startUrl.length > 0);
      ok("has zoomMeetingId", /^\d+$/.test(String(s.zoomMeetingId)));
      ok("status derived UPCOMING", s.status === "UPCOMING", s.status);
      ok("carries courseTitle", typeof s.courseTitle === "string");
      ok("carries instructorName", typeof s.instructorName === "string");

      console.log("\nGET /live-sessions/:id + filters");
      const detail = await req("GET", `/live-sessions/${s.id}`);
      ok("detail -> 200", detail.status === 200 && detail.json?.data?.id === s.id, `got ${detail.status}`);
      const filtered = await req("GET", `/live-sessions?status=upcoming&courseId=${courseId}`);
      ok("status+courseId filter finds it", (filtered.json?.data ?? []).some((x) => x.id === s.id));

      console.log("\nPATCH /live-sessions/:id");
      const patched = await req("PATCH", `/live-sessions/${s.id}`, { title: "Smoke Session (edited)", durationMin: 45 });
      ok("patch schedule -> 200 (Zoom synced)", patched.status === 200 && patched.json?.data?.durationMin === 45, `got ${patched.status}: ${patched.json?.message}`);
      const patchStatus = await req("PATCH", `/live-sessions/${s.id}`, { status: "ENDED" });
      ok("patch status -> 400 (server-managed)", patchStatus.status === 400, `got ${patchStatus.status}`);
      const patchUrl = await req("PATCH", `/live-sessions/${s.id}`, { joinUrl: "https://evil.example" });
      ok("patch joinUrl -> 400 (server-managed)", patchUrl.status === 400, `got ${patchUrl.status}`);
      const emptyPatch = await req("PATCH", `/live-sessions/${s.id}`, {});
      ok("empty patch -> 400", emptyPatch.status === 400, `got ${emptyPatch.status}`);

      console.log("\nDELETE /live-sessions/:id");
      const del = await req("DELETE", `/live-sessions/${s.id}`);
      ok("delete -> 200 (Zoom meeting removed)", del.status === 200, `got ${del.status}`);
      const gone = await req("GET", `/live-sessions/${s.id}`);
      ok("deleted session -> 404", gone.status === 404, `got ${gone.status}`);
    }
  }

  const missing = await req("GET", "/live-sessions/00000000-0000-0000-0000-000000000000");
  ok("unknown id -> 404", missing.status === 404, `got ${missing.status}`);

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
