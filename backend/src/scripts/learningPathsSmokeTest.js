/**
 * Smoke test for the Learning Paths endpoints (paths + items + reorder).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var (no secret stored in the repo). Creates throwaway
 * courses + a path, exercises everything, then cleans up (path deleted,
 * courses soft-archived).
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run (learning_paths tables exist).
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/learningPathsSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/learningPathsSmokeTest.js
 * Optional: SMOKE_BASE_URL="http://localhost:5001" (default)
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
  console.log(`Learning Paths smoke test -> ${API}\n`);

  // Setup — instructor + two fresh courses to put in the path.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const mk = (n) => req("POST", "/courses", {
    title: `PATH SMOKE ${n} ${new Date().toISOString()}`,
    instructorId, category: "Smoke", level: "Beginner",
  });
  const [cA, cB] = [await mk("A"), await mk("B")];
  const courseA = cA.json?.data?.id;
  const courseB = cB.json?.data?.id;
  ok("setup: two courses created", Boolean(courseA) && Boolean(courseB), `got ${cA.status}/${cB.status}`);
  if (!courseA || !courseB) process.exit(1);

  // 1. Create a path; validation guard.
  console.log("\nPOST /learning-paths");
  const noTitle = await req("POST", "/learning-paths", { description: "no title" });
  ok("missing title -> 400", noTitle.status === 400, `got ${noTitle.status}`);

  const created = await req("POST", "/learning-paths", { title: "Smoke Path", description: "Onboarding journey" });
  const pathId = created.json?.data?.id;
  ok("create -> 201", created.status === 201 && Boolean(pathId), `got ${created.status}`);
  ok("sequential defaults to false", created.json?.data?.sequential === false);
  ok("itemCount starts at 0", created.json?.data?.itemCount === 0);
  if (!pathId) process.exit(1);
  console.log(`  pathId = ${pathId}`);

  // 2. List + detail.
  console.log("\nGET /learning-paths + /:id");
  const list = await req("GET", "/learning-paths");
  ok("list -> 200", list.status === 200, `got ${list.status}`);
  ok("list contains the new path", (list.json?.data ?? []).some((p) => p.id === pathId));

  const detailEmpty = await req("GET", `/learning-paths/${pathId}`);
  ok("detail -> 200", detailEmpty.status === 200, `got ${detailEmpty.status}`);
  ok("items empty to start", Array.isArray(detailEmpty.json?.data?.items) && detailEmpty.json.data.items.length === 0);

  // 3. Update the path.
  console.log("\nPATCH /learning-paths/:id");
  const patched = await req("PATCH", `/learning-paths/${pathId}`, { sequential: true, title: "Smoke Path (edited)" });
  ok("patch -> 200", patched.status === 200, `got ${patched.status}`);
  ok("sequential updated", patched.json?.data?.sequential === true);
  const emptyPatch = await req("PATCH", `/learning-paths/${pathId}`, {});
  ok("empty patch -> 400", emptyPatch.status === 400, `got ${emptyPatch.status}`);

  // 4. Add items — two courses; guards for duplicates, bad refs, bad types.
  console.log("\nPOST /learning-paths/:id/items");
  const i1 = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "COURSE", itemId: courseA });
  const i2 = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "COURSE", itemId: courseB });
  ok("add item 1 -> 201", i1.status === 201, `got ${i1.status}`);
  ok("add item 2 -> 201", i2.status === 201, `got ${i2.status}`);
  ok("item 1 order defaults to 0", i1.json?.data?.order === 0);
  ok("item 2 order defaults to 1 (end of list)", i2.json?.data?.order === 1);
  ok("item resolves course title", typeof i1.json?.data?.title === "string" && i1.json.data.title.startsWith("PATH SMOKE A"));
  ok("item resolves course status label", i1.json?.data?.status === "Draft");
  ok("item not flagged missing", i1.json?.data?.missing === false);
  const item1 = i1.json?.data?.id;
  const item2 = i2.json?.data?.id;

  const dup = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "COURSE", itemId: courseA });
  ok("duplicate item -> 400", dup.status === 400, `got ${dup.status}`);
  const badRef = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "COURSE", itemId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown course ref -> 400", badRef.status === 400, `got ${badRef.status}`);
  const badSession = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "LIVE_SESSION", itemId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown live session ref -> 400", badSession.status === 400, `got ${badSession.status}`);
  const badType = await req("POST", `/learning-paths/${pathId}/items`, { itemType: "QUIZ", itemId: courseA });
  ok("unsupported itemType -> 400", badType.status === 400, `got ${badType.status}`);

  // 5. Reorder — swap the two items in ONE bulk call; response is the full path.
  console.log("\nPATCH /learning-paths/:id/reorder (single bulk request)");
  const reorder = await req("PATCH", `/learning-paths/${pathId}/reorder`, {
    items: [{ id: item1, order: 1 }, { id: item2, order: 0 }],
  });
  ok("reorder -> 200", reorder.status === 200, `got ${reorder.status}`);
  const items = reorder.json?.data?.items ?? [];
  ok("item 2 now sorts first (order 0)", items[0]?.id === item2);
  ok("response carries full path detail", reorder.json?.data?.id === pathId && reorder.json?.data?.itemCount === 2);

  const badReorder = await req("PATCH", `/learning-paths/${pathId}/reorder`, { items: [{ id: "does-not-exist", order: 0 }] });
  ok("reorder with foreign item -> 400", badReorder.status === 400, `got ${badReorder.status}`);

  // 6. Archived course still resolves (stale-ref display, not an error).
  console.log("\nStale reference (archived course stays visible)");
  await req("DELETE", `/courses/${courseB}`); // soft-archive
  const afterArchive = await req("GET", `/learning-paths/${pathId}`);
  const archivedItem = (afterArchive.json?.data?.items ?? []).find((i) => i.itemId === courseB);
  ok("archived course item still present", Boolean(archivedItem));
  ok("archived course shows Archived status", archivedItem?.status === "Archived");
  ok("archived course not flagged missing", archivedItem?.missing === false);

  // 7. Remove an item.
  console.log("\nDELETE /learning-paths/:id/items/:itemId");
  const del = await req("DELETE", `/learning-paths/${pathId}/items/${item2}`);
  ok("remove item -> 200", del.status === 200, `got ${del.status}`);
  const afterRemove = await req("GET", `/learning-paths/${pathId}`);
  ok("item is gone", !(afterRemove.json?.data?.items ?? []).some((i) => i.id === item2));
  const delAgain = await req("DELETE", `/learning-paths/${pathId}/items/${item2}`);
  ok("remove same item again -> 404", delAgain.status === 404, `got ${delAgain.status}`);

  // 8. 404s and auth guard.
  console.log("\n404 + auth guards");
  const missingPath = await req("GET", "/learning-paths/00000000-0000-0000-0000-000000000000");
  ok("unknown path -> 404", missingPath.status === 404, `got ${missingPath.status}`);
  const noAuth = await req("GET", "/learning-paths", undefined, false);
  ok("no token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  // 9. Delete the path (items cascade away at the DB level).
  console.log("\nDELETE /learning-paths/:id");
  const delPath = await req("DELETE", `/learning-paths/${pathId}`);
  ok("delete path -> 200", delPath.status === 200, `got ${delPath.status}`);
  const gone = await req("GET", `/learning-paths/${pathId}`);
  ok("deleted path -> 404", gone.status === 404, `got ${gone.status}`);

  // Cleanup — soft-archive the remaining throwaway course.
  await req("DELETE", `/courses/${courseA}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
