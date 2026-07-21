/**
 * Smoke test for the Content Library endpoints (sign → upload → confirm →
 * list/search/filter → patch → delete).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var. Ensures the library bucket exists, uploads a tiny real
 * PDF through the signed-URL flow, then cleans up (content deleted — which also
 * removes the storage object — and the throwaway course archived).
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run.
 *   2. The backend server is running (default http://localhost:5001).
 *   3. Supabase storage env vars are set (same ones the server uses).
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/contentSmokeTest.js
 */

const { ensureLibraryBucket } = require("./ensureLibraryBucket");

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

// Smallest possible valid-enough PDF payload for an end-to-end upload.
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Content Library smoke test -> ${API}\n`);

  // Setup — bucket + a throwaway course for the attach test.
  const bucket = await ensureLibraryBucket();
  ok(`setup: bucket "${bucket.bucket}" ready`, true);

  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  const mkCourse = instructorId
    ? await req("POST", "/courses", { title: `CONTENT SMOKE ${new Date().toISOString()}`, instructorId, category: "Smoke", level: "Beginner" })
    : { json: null };
  const courseId = mkCourse.json?.data?.id ?? null;
  ok("setup: course created", Boolean(courseId), "course attach tests will be skipped");

  // 1. Auth + sign validation.
  console.log("\nPOST /content/sign");
  const noAuth = await req("GET", "/content", undefined, false);
  ok("no auth -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  const noName = await req("POST", "/content/sign", { fileType: "application/pdf" });
  ok("missing fileName -> 400", noName.status === 400, `got ${noName.status}`);
  const badMime = await req("POST", "/content/sign", { fileName: "pkg.zip", fileType: "application/zip" });
  ok("zip (SCORM v2) -> 400", badMime.status === 400, `got ${badMime.status}`);

  const signed = await req("POST", "/content/sign", { fileName: "Smoke Report.pdf", fileType: "application/pdf" });
  ok("sign pdf -> 200", signed.status === 200 && Boolean(signed.json?.data?.uploadUrl), `got ${signed.status}: ${signed.json?.message}`);
  ok("type derived PDF", signed.json?.data?.type === "PDF");
  ok("path under library/", String(signed.json?.data?.path ?? "").startsWith("library/"));
  const { uploadUrl, path } = signed.json?.data ?? {};
  if (!uploadUrl) process.exit(1);

  // 2. Direct upload (what the frontend does), then confirm.
  console.log("\nupload + POST /content/confirm");
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: PDF_BYTES,
  });
  ok("direct PUT to signed URL", put.ok, `got ${put.status}`);

  const badPath = await req("POST", "/content/confirm", { path: "../secrets" });
  ok("traversal path -> 400", badPath.status === 400, `got ${badPath.status}`);
  const notUploaded = await req("POST", "/content/confirm", { path: "library/00000000-0000-0000-0000-000000000000-nope.pdf" });
  ok("unknown object -> 400", notUploaded.status === 400, `got ${notUploaded.status}`);

  const confirmed = await req("POST", "/content/confirm", {
    path, title: "Smoke Report", tags: ["Smoke", "smoke", "Reports"],
  });
  const itemId = confirmed.json?.data?.id;
  ok("confirm -> 201", confirmed.status === 201 && Boolean(itemId), `got ${confirmed.status}: ${confirmed.json?.message}`);
  ok("type is PDF", confirmed.json?.data?.type === "PDF");
  ok("sizeBytes recorded", (confirmed.json?.data?.sizeBytes ?? 0) > 0, String(confirmed.json?.data?.sizeBytes));
  ok("tags deduped + lowercased", JSON.stringify(confirmed.json?.data?.tags) === JSON.stringify(["smoke", "reports"]), JSON.stringify(confirmed.json?.data?.tags));
  ok("has public fileUrl", typeof confirmed.json?.data?.fileUrl === "string" && confirmed.json.data.fileUrl.length > 0);
  if (!itemId) process.exit(1);

  // 3. List + search + filters + counts.
  console.log("\nGET /content");
  const list = await req("GET", "/content");
  ok("list -> 200", list.status === 200, `got ${list.status}`);
  ok("list contains item", (list.json?.data?.content ?? []).some((i) => i.id === itemId));
  ok("has pagination", Boolean(list.json?.data?.pagination));
  ok("has typeCounts", (list.json?.data?.typeCounts?.All ?? 0) >= 1, JSON.stringify(list.json?.data?.typeCounts));

  const bySearch = await req("GET", "/content?search=Smoke%20Report");
  ok("search finds it", (bySearch.json?.data?.content ?? []).some((i) => i.id === itemId));
  const byType = await req("GET", "/content?type=PDF");
  ok("type filter keeps it", (byType.json?.data?.content ?? []).some((i) => i.id === itemId));
  const byTag = await req("GET", "/content?tag=reports");
  ok("tag filter keeps it", (byTag.json?.data?.content ?? []).some((i) => i.id === itemId));
  const badType = await req("GET", "/content?type=MOVIE");
  ok("bad type filter -> 400", badType.status === 400, `got ${badType.status}`);

  // 4. PATCH metadata (+ server-managed guard, course attach/detach).
  console.log("\nPATCH /content/:id");
  const patched = await req("PATCH", `/content/${itemId}`, { title: "Smoke Report (edited)", tags: ["archived"] });
  ok("patch title+tags -> 200", patched.status === 200 && patched.json?.data?.title === "Smoke Report (edited)", `got ${patched.status}`);
  const patchUrl = await req("PATCH", `/content/${itemId}`, { fileUrl: "https://evil.example" });
  ok("patch fileUrl -> 400 (server-managed)", patchUrl.status === 400, `got ${patchUrl.status}`);
  const patchEmpty = await req("PATCH", `/content/${itemId}`, {});
  ok("empty patch -> 400", patchEmpty.status === 400, `got ${patchEmpty.status}`);
  const patchBadCourse = await req("PATCH", `/content/${itemId}`, { courseId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown courseId -> 400", patchBadCourse.status === 400, `got ${patchBadCourse.status}`);

  if (courseId) {
    const attach = await req("PATCH", `/content/${itemId}`, { courseId });
    ok("attach to course -> 200 with courseTitle", attach.status === 200 && typeof attach.json?.data?.courseTitle === "string", `got ${attach.status}`);
    const detach = await req("PATCH", `/content/${itemId}`, { courseId: null });
    ok("detach (courseId null) -> 200", detach.status === 200 && detach.json?.data?.courseId === null, `got ${detach.status}`);
  }

  // 5. Delete (also removes the storage object).
  console.log("\nDELETE /content/:id");
  const del = await req("DELETE", `/content/${itemId}`);
  ok("delete -> 200", del.status === 200, `got ${del.status}`);
  const delAgain = await req("DELETE", `/content/${itemId}`);
  ok("delete again -> 404", delAgain.status === 404, `got ${delAgain.status}`);
  const listAfter = await req("GET", "/content");
  ok("list no longer contains it", !(listAfter.json?.data?.content ?? []).some((i) => i.id === itemId));

  // Cleanup — archive the throwaway course.
  console.log("\nCleanup");
  if (courseId) {
    const arch = await req("DELETE", `/courses/${courseId}`);
    ok("course archived", arch.status === 200, `got ${arch.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
