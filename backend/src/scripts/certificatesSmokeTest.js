/**
 * Smoke test for the Certificates endpoints (templates + issued + PDF + verify).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var (no secret stored in the repo). Creates throwaway
 * courses + templates + certificates, exercises everything, then cleans up
 * (certs revoked, templates deleted, courses soft-archived).
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run (certificate_templates table exists).
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/certificatesSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/certificatesSmokeTest.js
 * Optional: SMOKE_BASE_URL="http://localhost:5001" (default)
 */

const BASE  = (process.env.SMOKE_BASE_URL || "http://localhost:5001").replace(/\/+$/, "");
const TOKEN = process.env.SMOKE_TOKEN;
const API   = `${BASE}/api/admin`;
const PUB   = `${BASE}/api/public`;

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

// Public endpoint — NO auth header on purpose.
async function reqPublic(path) {
  const res = await fetch(`${PUB}${path}`);
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  if (!TOKEN) {
    console.error("Missing SMOKE_TOKEN env var. Set it to a valid admin Bearer token and retry.");
    process.exit(1);
  }
  console.log(`Certificates smoke test -> ${API} + ${PUB}\n`);

  // Setup — instructor (doubles as the certificate recipient: any AppUser works)
  // + two courses: A gets certificates ENABLED, B stays disabled.
  const fo = await req("GET", "/lm/filter-options");
  const userId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!userId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const mk = (n) => req("POST", "/courses", {
    title: `CERT SMOKE ${n} ${new Date().toISOString()}`,
    instructorId: userId, category: "Smoke", level: "Beginner",
  });
  const [cA, cB] = [await mk("A"), await mk("B")];
  const courseA = cA.json?.data?.id;
  const courseB = cB.json?.data?.id;
  ok("setup: two courses created", Boolean(courseA) && Boolean(courseB), `got ${cA.status}/${cB.status}`);
  if (!courseA || !courseB) process.exit(1);

  const enable = await req("PATCH", `/courses/${courseA}/settings`, { certificateEnabled: true });
  ok("setup: certificates enabled on course A", enable.status === 200, `got ${enable.status}`);

  // 1. Templates — create with defaults, validation guards.
  console.log("\nPOST /certificate-templates");
  const noName = await req("POST", "/certificate-templates", { layout: {} });
  ok("missing name -> 400", noName.status === 400, `got ${noName.status}`);
  const badColor = await req("POST", "/certificate-templates", { name: "Bad color", layout: { primaryColor: "blue" } });
  ok("non-hex color -> 400", badColor.status === 400, `got ${badColor.status}`);
  const badLayout = await req("POST", "/certificate-templates", { name: "Bad layout", layout: "html" });
  ok("non-object layout -> 400", badLayout.status === 400, `got ${badLayout.status}`);

  const created = await req("POST", "/certificate-templates", {
    name: "Smoke Template",
    layout: { primaryColor: "#0F172A", signatureName: "Dr. Smoke", signatureTitle: "Director" },
  });
  const templateId = created.json?.data?.id;
  ok("create -> 201", created.status === 201 && Boolean(templateId), `got ${created.status}`);
  ok("layout defaults filled (title)", created.json?.data?.layout?.title === "Certificate of Completion");
  ok("layout keeps provided values", created.json?.data?.layout?.signatureName === "Dr. Smoke");
  ok("certificateCount starts at 0", created.json?.data?.certificateCount === 0);
  if (!templateId) process.exit(1);

  // 2. Template list / detail / update.
  console.log("\nGET + PATCH /certificate-templates");
  const tList = await req("GET", "/certificate-templates");
  ok("list -> 200", tList.status === 200, `got ${tList.status}`);
  ok("list contains new template", (tList.json?.data ?? []).some((t) => t.id === templateId));
  const tDetail = await req("GET", `/certificate-templates/${templateId}`);
  ok("detail -> 200", tDetail.status === 200, `got ${tDetail.status}`);
  const tPatch = await req("PATCH", `/certificate-templates/${templateId}`, { name: "Smoke Template (edited)" });
  ok("patch name -> 200", tPatch.status === 200, `got ${tPatch.status}`);
  const tEmpty = await req("PATCH", `/certificate-templates/${templateId}`, {});
  ok("empty patch -> 400", tEmpty.status === 400, `got ${tEmpty.status}`);
  const tMissing = await req("GET", "/certificate-templates/00000000-0000-0000-0000-000000000000");
  ok("unknown template -> 404", tMissing.status === 404, `got ${tMissing.status}`);

  // 3. Issue — guards first, then the real thing.
  console.log("\nPOST /certificates (issue)");
  const noUser = await req("POST", "/certificates", { courseId: courseA });
  ok("missing userId -> 400", noUser.status === 400, `got ${noUser.status}`);
  const badUser = await req("POST", "/certificates", { userId: "00000000-0000-0000-0000-000000000000", courseId: courseA });
  ok("unknown user -> 400", badUser.status === 400, `got ${badUser.status}`);
  const badCourse = await req("POST", "/certificates", { userId, courseId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown course -> 400", badCourse.status === 400, `got ${badCourse.status}`);
  const disabled = await req("POST", "/certificates", { userId, courseId: courseB });
  ok("certificateEnabled=false -> 400", disabled.status === 400, `got ${disabled.status}`);
  const badTpl = await req("POST", "/certificates", { userId, courseId: courseA, templateId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown template ref -> 400", badTpl.status === 400, `got ${badTpl.status}`);

  const issued = await req("POST", "/certificates", { userId, courseId: courseA, templateId });
  const certId = issued.json?.data?.id;
  const code1  = issued.json?.data?.verificationCode;
  ok("issue -> 201", issued.status === 201 && Boolean(certId), `got ${issued.status}`);
  ok("verificationCode is 32 hex chars", /^[a-f0-9]{32}$/.test(code1 ?? ""));
  ok("status is active", issued.json?.data?.status === "active");
  ok("studentName snapshotted", typeof issued.json?.data?.studentName === "string" && issued.json.data.studentName.length > 0);
  ok("courseTitle snapshotted", (issued.json?.data?.courseTitle ?? "").startsWith("CERT SMOKE A"));
  ok("templateName resolved", issued.json?.data?.templateName === "Smoke Template (edited)");
  if (!certId) process.exit(1);

  const dup = await req("POST", "/certificates", { userId, courseId: courseA });
  ok("duplicate (course,user) -> 400", dup.status === 400, `got ${dup.status}`);

  // 4. List + filters.
  console.log("\nGET /certificates (+filters)");
  const list = await req("GET", `/certificates?courseId=${courseA}`);
  ok("list -> 200 with items/total", list.status === 200 && Array.isArray(list.json?.data?.items), `got ${list.status}`);
  ok("courseId filter finds the cert", (list.json?.data?.items ?? []).some((c) => c.id === certId));
  ok("total matches filter", list.json?.data?.total === 1, `got ${list.json?.data?.total}`);
  const badStatus = await req("GET", "/certificates?status=nope");
  ok("bad status filter -> 400", badStatus.status === 400, `got ${badStatus.status}`);
  const revokedEmpty = await req("GET", `/certificates?courseId=${courseA}&status=revoked`);
  ok("status=revoked initially empty", revokedEmpty.json?.data?.total === 0, `got ${revokedEmpty.json?.data?.total}`);

  // 5. PDF download (raw bytes, not JSON).
  console.log("\nGET /certificates/:id/pdf");
  const pdfRes = await fetch(`${API}/certificates/${certId}/pdf`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  ok("pdf -> 200", pdfRes.status === 200, `got ${pdfRes.status}`);
  ok("content-type application/pdf", (pdfRes.headers.get("content-type") ?? "").includes("application/pdf"));
  ok("bytes start with %PDF", pdfBuf.subarray(0, 4).toString() === "%PDF");
  ok("pdf has real content (>2KB)", pdfBuf.length > 2048, `got ${pdfBuf.length} bytes`);

  // 6. Public verify — valid code, NO auth header.
  console.log("\nGET /api/public/certificates/verify/:code (no auth)");
  const vOk = await reqPublic(`/certificates/verify/${code1}`);
  ok("valid code -> 200 status valid", vOk.status === 200 && vOk.json?.data?.status === "valid", `got ${vOk.status}/${vOk.json?.data?.status}`);
  ok("verify returns name/course/date only", vOk.json?.data?.certificate?.studentName && !("userId" in (vOk.json?.data?.certificate ?? {})));
  const vGarbage = await reqPublic("/certificates/verify/not-a-real-code");
  ok("malformed code -> not_found (no DB hit)", vGarbage.json?.data?.status === "not_found");
  const vUnknown = await reqPublic(`/certificates/verify/${"0".repeat(32)}`);
  ok("well-formed unknown code -> not_found", vUnknown.json?.data?.status === "not_found");

  // 7. Revoke — then PDF blocked, verify says revoked.
  console.log("\nPOST /certificates/:id/revoke");
  const revoke = await req("POST", `/certificates/${certId}/revoke`);
  ok("revoke -> 200 status revoked", revoke.status === 200 && revoke.json?.data?.status === "revoked", `got ${revoke.status}`);
  const revokeAgain = await req("POST", `/certificates/${certId}/revoke`);
  ok("revoke again -> 400", revokeAgain.status === 400, `got ${revokeAgain.status}`);
  const pdfRevoked = await fetch(`${API}/certificates/${certId}/pdf`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  ok("pdf of revoked cert -> 400", pdfRevoked.status === 400, `got ${pdfRevoked.status}`);
  const vRevoked = await reqPublic(`/certificates/verify/${code1}`);
  ok("verify revoked code -> status revoked", vRevoked.json?.data?.status === "revoked", `got ${vRevoked.json?.data?.status}`);

  // 8. Reissue — new code, un-revoked; old code dies.
  console.log("\nPOST /certificates/:id/reissue");
  const reissue = await req("POST", `/certificates/${certId}/reissue`, {});
  const code2 = reissue.json?.data?.verificationCode;
  ok("reissue -> 200 active again", reissue.status === 200 && reissue.json?.data?.status === "active", `got ${reissue.status}`);
  ok("new code differs from old", Boolean(code2) && code2 !== code1);
  const vNew = await reqPublic(`/certificates/verify/${code2}`);
  ok("new code verifies valid", vNew.json?.data?.status === "valid", `got ${vNew.json?.data?.status}`);
  const vOld = await reqPublic(`/certificates/verify/${code1}`);
  ok("old code -> not_found", vOld.json?.data?.status === "not_found", `got ${vOld.json?.data?.status}`);

  // 9. Template delete — issued cert survives with templateId null, PDF still works.
  console.log("\nDELETE /certificate-templates/:id (SetNull on issued certs)");
  const tDel = await req("DELETE", `/certificate-templates/${templateId}`);
  ok("delete template -> 200", tDel.status === 200, `got ${tDel.status}`);
  const afterDel = await req("GET", `/certificates?courseId=${courseA}`);
  const survivor = (afterDel.json?.data?.items ?? []).find((c) => c.id === certId);
  ok("cert survives template delete", Boolean(survivor));
  ok("cert templateId now null", survivor?.templateId === null);
  const pdfDefault = await fetch(`${API}/certificates/${certId}/pdf`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  ok("pdf falls back to default layout -> 200", pdfDefault.status === 200, `got ${pdfDefault.status}`);

  // 10. 404 + auth guards.
  console.log("\n404 + auth guards");
  const missingCert = await req("POST", "/certificates/00000000-0000-0000-0000-000000000000/revoke");
  ok("unknown certificate -> 404", missingCert.status === 404, `got ${missingCert.status}`);
  const noAuth = await req("GET", "/certificates", undefined, false);
  ok("admin list without token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  // Cleanup — revoke the smoke cert (keeps the KPI honest), archive courses.
  await req("POST", `/certificates/${certId}/revoke`);
  await req("DELETE", `/courses/${courseA}`);
  await req("DELETE", `/courses/${courseB}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
