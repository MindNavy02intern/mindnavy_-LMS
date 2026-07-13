/**
 * Smoke test for the Course Wizard workflow + Categories endpoints:
 *   PATCH /courses/:id/settings · GET /courses/:id/preview
 *   POST  /courses/:id/submit | /approve | /reject
 *   GET/POST/PATCH/DELETE /categories · /lm/filter-options integration
 * Also proves the security lock: generic PATCH /courses/:id rejects `status`
 * and settings fields.
 *
 * Exercises everything end-to-end against a RUNNING server, using a Bearer
 * token from an env var (no secret stored in the repo). Creates throwaway
 * courses/categories and archives/deletes them at the end.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/courseWizardSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/courseWizardSmokeTest.js
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

// Create a Draft course and fill it until it passes the submit checks.
async function createSubmittableCourse(instructorId, title) {
  const created = await req("POST", "/courses", { title, instructorId, category: "Smoke", level: "Beginner" });
  const id = created.json?.data?.id;
  if (!id) throw new Error(`course create failed (${created.status})`);
  await req("PATCH", `/courses/${id}`, {
    description: "Smoke test description.",
    thumbnail: "https://example.com/thumb.png",
  });
  const section = await req("POST", `/courses/${id}/sections`, { title: "Section 1" });
  await req("POST", `/sections/${section.json?.data?.id}/lessons`, { title: "Lesson 1", type: "TEXT", content: "Hello" });
  return id;
}

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Course Wizard + Categories smoke test -> ${API}\n`);

  // Setup — an instructor and a bare Draft course.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const stamp = new Date().toISOString();
  const created = await req("POST", "/courses", { title: `WIZARD SMOKE ${stamp}`, instructorId, category: "Smoke" });
  const courseId = created.json?.data?.id;
  ok("setup: course created as Draft", created.status === 201 && Boolean(courseId), `got ${created.status}`);
  if (!courseId) process.exit(1);

  // 0. Auth.
  console.log("\nAuth");
  const noAuth = await req("GET", `/courses/${courseId}/preview`, undefined, false);
  ok("preview without token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  // 1. Security lock: status + settings fields are rejected by the generic PATCH.
  console.log("\nGeneric PATCH lock");
  const s1 = await req("PATCH", `/courses/${courseId}`, { status: "Published" });
  ok("PATCH {status} -> 400 (escape hatch locked)", s1.status === 400, `got ${s1.status}`);
  const s2 = await req("PATCH", `/courses/${courseId}`, { price: 999 });
  ok("PATCH {price} -> 400 (settings not accepted here)", s2.status === 400, `got ${s2.status}`);

  // 2. Settings (Step 4).
  console.log("\nPATCH /courses/:id/settings");
  const p1 = await req("PATCH", `/courses/${courseId}/settings`, { isFree: false });
  ok("paid without price -> 400", p1.status === 400, `got ${p1.status}`);
  const p2 = await req("PATCH", `/courses/${courseId}/settings`, {
    isFree: false, price: 4999, currency: "usd", enrollmentLimit: 100,
    visibility: "Private", certificateEnabled: true, dripContentEnabled: true,
    accessRules: { requiresEnrollment: true, startDate: "2026-08-01T00:00:00.000Z" },
    seoTitle: "Smoke SEO", seoDescription: "Smoke SEO description",
  });
  ok("full valid settings -> 200", p2.status === 200, `got ${p2.status} ${p2.json?.message ?? ""}`);
  ok("currency normalized to USD", p2.json?.data?.currency === "USD", `got ${p2.json?.data?.currency}`);
  ok("visibility label Private", p2.json?.data?.visibility === "Private", `got ${p2.json?.data?.visibility}`);
  const p3 = await req("PATCH", `/courses/${courseId}/settings`, { accessRules: { hack: true } });
  ok("unknown accessRules key -> 400", p3.status === 400, `got ${p3.status}`);
  const p4 = await req("PATCH", `/courses/${courseId}/settings`, { isFree: true });
  ok("back to free -> 200, price cleared", p4.status === 200 && p4.json?.data?.price === null, `got ${p4.status} price=${p4.json?.data?.price}`);
  const p5 = await req("PATCH", `/courses/${courseId}/settings`, { visibility: "Sneaky" });
  ok("bad visibility -> 400", p5.status === 400, `got ${p5.status}`);
  const p6 = await req("PATCH", `/courses/${courseId}/settings`, { accessRules: null });
  ok("accessRules: null clears -> 200", p6.status === 200 && p6.json?.data?.accessRules === null,
    `got ${p6.status} rules=${JSON.stringify(p6.json?.data?.accessRules)}`);

  // 3. Submit (Step 6) — failures first, then success.
  console.log("\nPOST /courses/:id/submit");
  const sub1 = await req("POST", `/courses/${courseId}/submit`);
  ok("unready course -> 400 with errors[]", sub1.status === 400 && Array.isArray(sub1.json?.errors) && sub1.json.errors.length >= 3,
    `got ${sub1.status} errors=${JSON.stringify(sub1.json?.errors)}`);

  await req("PATCH", `/courses/${courseId}`, { description: "Now described.", thumbnail: "https://example.com/t.png" });
  const sec = await req("POST", `/courses/${courseId}/sections`, { title: "Intro" });
  await req("POST", `/sections/${sec.json?.data?.id}/lessons`, { title: "Welcome", type: "TEXT", content: "Hi" });
  const sub2 = await req("POST", `/courses/${courseId}/submit`);
  ok("ready course -> 200 Pending", sub2.status === 200 && sub2.json?.data?.status === "Pending", `got ${sub2.status} ${sub2.json?.data?.status}`);
  const sub3 = await req("POST", `/courses/${courseId}/submit`);
  ok("submit twice -> 400 (only Draft)", sub3.status === 400, `got ${sub3.status}`);

  // 4. Preview (Step 5).
  console.log("\nGET /courses/:id/preview");
  const pre = await req("GET", `/courses/${courseId}/preview`);
  ok("preview -> 200 { course, sections }",
    pre.status === 200 && pre.json?.data?.course?.id === courseId && Array.isArray(pre.json?.data?.sections) && pre.json.data.sections.length >= 1,
    `got ${pre.status}`);
  ok("preview exposes settings", pre.json?.data?.course?.settings?.visibility === "Private", `got ${JSON.stringify(pre.json?.data?.course?.settings)}`);
  const preBad = await req("GET", "/courses/00000000-0000-0000-0000-000000000000/preview");
  ok("preview unknown course -> 404", preBad.status === 404, `got ${preBad.status}`);

  // 5. Approve.
  console.log("\nPOST /courses/:id/approve");
  const ap1 = await req("POST", `/courses/${courseId}/approve`);
  ok("approve Pending -> 200 Published", ap1.status === 200 && ap1.json?.data?.status === "Published", `got ${ap1.status}`);
  const ap2 = await req("POST", `/courses/${courseId}/approve`);
  ok("approve twice -> 400 (only Pending)", ap2.status === 400, `got ${ap2.status}`);

  // 6. Reject flow on a second course.
  console.log("\nPOST /courses/:id/reject");
  const course2 = await createSubmittableCourse(instructorId, `WIZARD SMOKE B ${stamp}`);
  await req("POST", `/courses/${course2}/submit`);
  const rj1 = await req("POST", `/courses/${course2}/reject`, {});
  ok("reject without reason -> 400", rj1.status === 400, `got ${rj1.status}`);
  const rj2 = await req("POST", `/courses/${course2}/reject`, { reason: "Thumbnail is a placeholder." });
  ok("reject Pending -> 200 Draft", rj2.status === 200 && rj2.json?.data?.status === "Draft", `got ${rj2.status}`);
  const detail = await req("GET", `/courses/${course2}`);
  ok("rejectionReason visible on course detail", detail.json?.data?.rejectionReason === "Thumbnail is a placeholder.",
    `got ${detail.json?.data?.rejectionReason}`);
  const resub = await req("POST", `/courses/${course2}/submit`);
  ok("resubmit after reject -> 200 Pending", resub.status === 200, `got ${resub.status}`);
  const detail2 = await req("GET", `/courses/${course2}`);
  ok("rejectionReason cleared on resubmit", detail2.json?.data?.rejectionReason === null, `got ${detail2.json?.data?.rejectionReason}`);

  // 7. Categories.
  console.log("\n/categories CRUD + hierarchy guards");
  const rootName = `Smoke Root ${Date.now()}`;
  const c1 = await req("POST", "/categories", { name: rootName });
  const rootId = c1.json?.data?.id;
  ok("create root -> 201", c1.status === 201 && Boolean(rootId), `got ${c1.status}`);
  const c2 = await req("POST", "/categories", { name: rootName.toUpperCase() });
  ok("duplicate name (case-insensitive) -> 400", c2.status === 400, `got ${c2.status}`);
  const c3 = await req("POST", "/categories", { name: "Smoke Child", parentId: rootId });
  const childId = c3.json?.data?.id;
  ok("create subcategory -> 201", c3.status === 201 && Boolean(childId), `got ${c3.status}`);
  const c4 = await req("POST", "/categories", { name: "Too Deep", parentId: childId });
  ok("grandchild -> 400 (2-level cap)", c4.status === 400, `got ${c4.status}`);
  const c5 = await req("PATCH", `/categories/${childId}`, { parentId: childId });
  ok("self-parent -> 400", c5.status === 400, `got ${c5.status}`);
  const c6 = await req("DELETE", `/categories/${rootId}`);
  ok("delete root with child -> 400", c6.status === 400, `got ${c6.status}`);

  const linked = await req("POST", "/courses", { title: `WIZARD SMOKE C ${stamp}`, instructorId, categoryId: childId });
  ok("course created with categoryId, string synced", linked.status === 201 && linked.json?.data?.category === "Smoke Child",
    `got ${linked.status} category=${linked.json?.data?.category}`);
  const course3 = linked.json?.data?.id;

  const c7 = await req("DELETE", `/categories/${childId}`);
  ok("delete category with courses -> 400", c7.status === 400, `got ${c7.status}`);
  const c8 = await req("PATCH", `/categories/${childId}`, { name: "Smoke Child Renamed" });
  ok("rename -> 200", c8.status === 200, `got ${c8.status}`);
  const course3Detail = await req("GET", `/courses/${course3}`);
  ok("rename resynced course.category string", course3Detail.json?.data?.category === "Smoke Child Renamed",
    `got ${course3Detail.json?.data?.category}`);

  const tree = await req("GET", "/categories");
  const rootNode = (tree.json?.data ?? []).find((n) => n.id === rootId);
  ok("GET tree: root has nested child with courseCount", rootNode?.children?.[0]?.id === childId && rootNode.children[0].courseCount === 1,
    `got ${JSON.stringify(rootNode?.children)}`);

  // Link semantics: bare known string auto-links; explicit categoryId:null wins.
  const auto = await req("POST", "/courses", { title: `WIZARD SMOKE D ${stamp}`, instructorId, category: "Smoke Child Renamed" });
  ok("create with bare known string auto-links", auto.status === 201 && auto.json?.data?.categoryId === childId,
    `got categoryId=${auto.json?.data?.categoryId}`);
  const course4 = auto.json?.data?.id;
  const unlink = await req("PATCH", `/courses/${course4}`, { categoryId: null, category: "Smoke Child Renamed" });
  ok("explicit categoryId:null wins over string", unlink.status === 200 && unlink.json?.data?.categoryId === null,
    `got categoryId=${unlink.json?.data?.categoryId}`);

  const fo2 = await req("GET", "/lm/filter-options");
  ok("filter-options includes new category", (fo2.json?.data?.categories ?? []).includes("Smoke Child Renamed"),
    `got ${(fo2.json?.data?.categories ?? []).length} categories`);

  // 8. Dashboard course KPIs are live (submit/approve invalidations have a target).
  console.log("\nDashboard course analytics");
  // NB: this endpoint spreads the payload at the top level ({ success, ...data }).
  const dash = await req("GET", "/dashboard/analytics");
  const ca = dash.json?.courseAnalytics;
  ok("courseAnalytics counts are live (published ≥ 1 after approve)",
    dash.status === 200 && ca && ca.activeCourses >= 1 && ca.totalCourses >= ca.activeCourses,
    `got ${dash.status} ${JSON.stringify(ca)}`);

  // Cleanup — unlink + delete categories, archive courses.
  console.log("\nCleanup");
  await req("PATCH", `/courses/${course3}`, { categoryId: null, category: "Smoke" });
  const d1 = await req("DELETE", `/categories/${childId}`);
  const d2 = await req("DELETE", `/categories/${rootId}`);
  ok("categories deleted once empty", d1.status === 200 && d2.status === 200, `got ${d1.status}/${d2.status}`);
  for (const id of [courseId, course2, course3, course4]) await req("DELETE", `/courses/${id}`);
  console.log("  throwaway courses archived");

  console.log(`\nDone: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error("Smoke test crashed:", err); process.exit(1); });
