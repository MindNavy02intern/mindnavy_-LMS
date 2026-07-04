/**
 * Smoke test for the Uploads endpoints (/api/admin/uploads).
 *
 * Two layers:
 *   A) Always-on: auth guard + input validation + Phase-1 "video coming soon" +
 *      path-scoping on delete. These pass whether or not Supabase is configured.
 *   B) Live flow (only if storage is configured): sign → PUT a tiny image to the
 *      signed URL → confirm (verifies object + sets Course.thumbnail) → delete.
 *
 * Prerequisites:
 *   1. Backend server running (default http://localhost:5001).
 *   2. At least one AppUser with role INSTRUCTOR (to create a throwaway course).
 *   3. For layer B only: @supabase/supabase-js installed in the backend, SUPABASE_URL
 *      + SUPABASE_SERVICE_ROLE_KEY set, and the course-thumbnails bucket created.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/uploadsSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/uploadsSmokeTest.js
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

// A 1x1 transparent PNG (smallest valid image) for the live upload path.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Uploads smoke test -> ${API}\n`);

  // Need a real course id for path scoping + confirm.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) { console.error("No INSTRUCTOR users found. Create one, then re-run."); process.exit(1); }
  const createdCourse = await req("POST", "/courses", {
    title: `UPLOAD SMOKE ${new Date().toISOString()}`, instructorId, category: "Smoke", level: "Beginner",
  });
  const courseId = createdCourse.json?.data?.id;
  ok("setup: course created", createdCourse.status === 201 && Boolean(courseId), `got ${createdCourse.status}`);
  if (!courseId) process.exit(1);

  // ── A) Always-on checks ──────────────────────────────────────────────────────
  console.log("\nValidation + auth guards");

  const noAuth = await req("POST", "/uploads/sign", { fileName: "a.png", fileType: "image/png", kind: "thumbnail", courseId }, false);
  ok("sign without token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  const missingFields = await req("POST", "/uploads/sign", { kind: "thumbnail", courseId });
  ok("sign missing fileName/fileType -> 400", missingFields.status === 400, `got ${missingFields.status}`);

  const badMime = await req("POST", "/uploads/sign", { fileName: "a.pdf", fileType: "application/pdf", kind: "thumbnail", courseId });
  ok("sign disallowed mime -> 400", badMime.status === 400, `got ${badMime.status}`);

  const videoKind = await req("POST", "/uploads/sign", { fileName: "v.mp4", fileType: "video/mp4", kind: "video", courseId });
  ok("sign video kind -> 400 (Phase 1: coming soon)", videoKind.status === 400, `got ${videoKind.status}`);

  const badPath = await req("DELETE", `/uploads?path=${encodeURIComponent("../secret")}`);
  ok("delete traversal path -> 400", badPath.status === 400, `got ${badPath.status}`);

  // ── B) Live flow — only if storage is configured ─────────────────────────────
  console.log("\nLive sign/confirm/delete (only if Supabase is configured)");
  const sign = await req("POST", "/uploads/sign", { fileName: "thumb.png", fileType: "image/png", kind: "thumbnail", courseId });

  if (sign.status === 503) {
    console.log("  … storage not configured — skipping live upload flow (this is fine for Phase 1).");
  } else {
    ok("sign -> 200", sign.status === 200, `got ${sign.status}`);
    const { uploadUrl, path } = sign.json?.data ?? {};
    ok("sign returns uploadUrl + path", Boolean(uploadUrl) && Boolean(path));

    if (uploadUrl && path) {
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/png" }, body: PNG_1x1 });
      ok("PUT file to signed URL succeeds", put.ok, `got ${put.status}`);

      const confirm = await req("POST", "/uploads/confirm", { courseId, path, kind: "thumbnail" });
      ok("confirm -> 200", confirm.status === 200, `got ${confirm.status}`);
      ok("confirm returns a url", typeof confirm.json?.data?.url === "string");

      const course = await req("GET", `/courses/${courseId}`);
      ok("Course.thumbnail was set", Boolean(course.json?.data?.thumbnail));

      const del = await req("DELETE", `/uploads?path=${encodeURIComponent(path)}`);
      ok("delete uploaded object -> 200", del.status === 200, `got ${del.status}`);
    }
  }

  // Cleanup.
  await req("DELETE", `/courses/${courseId}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
