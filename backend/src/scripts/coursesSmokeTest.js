/**
 * Smoke test for the Courses tab endpoints (/api/admin/courses).
 *
 * Verifies all 5 endpoints end-to-end against a RUNNING server, using a Bearer
 * token read from an environment variable (no secret is stored in the repo).
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run (the courses table exists).
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Get a token: log in via the app and copy localStorage `mn_admin_token`,
 * or call POST /api/admin/login and use the returned token.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/coursesSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/coursesSmokeTest.js
 * Optional:
 *   SMOKE_BASE_URL="http://localhost:5001"   (default)
 *
 * Note: creates one "SMOKE TEST" course then soft-archives it (leaves one
 * archived row — the API never hard-deletes).
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
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Courses smoke test -> ${API}\n`);

  // Setup — grab a real instructor id from filter-options.
  console.log("Setup: fetch an instructor from /lm/filter-options");
  const fo = await req("GET", "/lm/filter-options");
  ok("filter-options responds 200", fo.status === 200, `got ${fo.status}`);
  const instructors = fo.json?.data?.instructors ?? [];
  const instructorId = instructors[0]?.id ?? null;
  if (!instructorId) {
    console.error("\nNo INSTRUCTOR users found. Create an AppUser with role INSTRUCTOR, then re-run.");
    process.exit(1);
  }
  console.log(`  using instructorId = ${instructorId}\n`);

  // 1. POST create (Draft) + validation guards.
  console.log("POST /courses (create Draft)");
  const title = `SMOKE TEST ${new Date().toISOString()}`;
  const created = await req("POST", "/courses", { title, instructorId, category: "Smoke", level: "Beginner", tags: ["smoke"] });
  ok("create returns 201", created.status === 201, `got ${created.status}`);
  ok("created status is Draft", created.json?.data?.status === "Draft");
  const courseId = created.json?.data?.id;
  ok("created has an id", Boolean(courseId));

  const missingTitle = await req("POST", "/courses", { instructorId });
  ok("missing title -> 400", missingTitle.status === 400, `got ${missingTitle.status}`);

  const badInstructor = await req("POST", "/courses", { title: "x", instructorId: "00000000-0000-0000-0000-000000000000" });
  ok("bad instructorId -> 400/404", [400, 404].includes(badInstructor.status), `got ${badInstructor.status}`);

  // 2. GET list + statusCounts + pagination.
  console.log("\nGET /courses (list + statusCounts + pagination)");
  const list = await req("GET", "/courses?page=1&limit=10&status=Draft");
  ok("list returns 200", list.status === 200, `got ${list.status}`);
  ok("has courses array", Array.isArray(list.json?.data?.courses));
  ok("pagination has 'pages'", typeof list.json?.data?.pagination?.pages === "number");
  ok("statusCounts.all is a number", typeof list.json?.data?.statusCounts?.all === "number");

  // 3. GET one (full course).
  console.log("\nGET /courses/:id");
  const one = await req("GET", `/courses/${courseId}`);
  ok("get one returns 200", one.status === 200, `got ${one.status}`);
  ok("full course has tags array", Array.isArray(one.json?.data?.tags));

  // 4. PATCH edit.
  console.log("\nPATCH /courses/:id");
  const patched = await req("PATCH", `/courses/${courseId}`, { subtitle: "smoke subtitle", level: "Intermediate" });
  ok("patch returns 200", patched.status === 200, `got ${patched.status}`);
  ok("patch applied (level=Intermediate)", patched.json?.data?.level === "Intermediate");

  // 5. DELETE = soft archive.
  console.log("\nDELETE /courses/:id (soft archive)");
  const del = await req("DELETE", `/courses/${courseId}`);
  ok("delete returns 200", del.status === 200, `got ${del.status}`);
  ok("status becomes Archived", del.json?.data?.status === "Archived");
  const afterArchive = await req("GET", `/courses/${courseId}`);
  ok("row still exists after archive", afterArchive.status === 200);
  ok("row is Archived (not deleted)", afterArchive.json?.data?.status === "Archived");

  // 6. "All" tab must EXCLUDE the archived course.
  console.log("\nGET /courses?status=All (must exclude Archived)");
  const all = await req("GET", "/courses?status=All&limit=100");
  ok("all returns 200", all.status === 200, `got ${all.status}`);
  const archivedInAll = (all.json?.data?.courses ?? []).some((c) => c.id === courseId);
  ok("archived course NOT in All list", !archivedInAll);

  // 7. Auth guard.
  console.log("\nGET /courses without token (must 401)");
  const noAuth = await req("GET", "/courses", undefined, false);
  ok("no token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
