/**
 * Smoke test for the Quizzes & Exams endpoints (quizzes + questions + reorder).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var (no secret stored in the repo). Creates a throwaway
 * course + quizzes, exercises everything, then cleans up (quizzes deleted,
 * course soft-archived).
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run (quizzes / quiz_questions tables exist).
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/quizzesSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/quizzesSmokeTest.js
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
  console.log(`Quizzes & Exams smoke test -> ${API}\n`);

  // Setup — instructor + one fresh course to attach a quiz to.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const mkCourse = await req("POST", "/courses", {
    title: `QUIZ SMOKE ${new Date().toISOString()}`,
    instructorId, category: "Smoke", level: "Beginner",
  });
  const courseId = mkCourse.json?.data?.id;
  ok("setup: course created", Boolean(courseId), `got ${mkCourse.status}`);
  if (!courseId) process.exit(1);

  // 1. Create quizzes; validation + reference guards.
  console.log("\nPOST /quizzes");
  const noTitle = await req("POST", "/quizzes", { description: "no title" });
  ok("missing title -> 400", noTitle.status === 400, `got ${noTitle.status}`);

  const created = await req("POST", "/quizzes", { title: "Smoke Quiz" });
  const quizId = created.json?.data?.id;
  ok("create -> 201", created.status === 201 && Boolean(quizId), `got ${created.status}`);
  ok("passingGrade defaults to 60", created.json?.data?.passingGrade === 60);
  ok("attemptsAllowed defaults to null (unlimited)", created.json?.data?.attemptsAllowed === null);
  ok("timeLimit defaults to null (none)", created.json?.data?.timeLimit === null);
  ok("randomizeQuestions defaults to false", created.json?.data?.randomizeQuestions === false);
  ok("questionCount starts at 0", created.json?.data?.questionCount === 0);
  if (!quizId) process.exit(1);
  console.log(`  quizId = ${quizId}`);

  const badRef = await req("POST", "/quizzes", { title: "Bad ref", courseId: "00000000-0000-0000-0000-000000000000" });
  ok("unknown courseId -> 400", badRef.status === 400, `got ${badRef.status}`);

  const attached = await req("POST", "/quizzes", { title: "Attached Quiz", courseId, passingGrade: 80, timeLimit: 30, attemptsAllowed: 3 });
  const attachedId = attached.json?.data?.id;
  ok("create attached to course -> 201", attached.status === 201 && Boolean(attachedId), `got ${attached.status}`);
  ok("attached quiz carries courseId", attached.json?.data?.courseId === courseId);

  // 2. List (+ courseId filter) + detail.
  console.log("\nGET /quizzes + ?courseId= + /:id");
  const list = await req("GET", "/quizzes");
  ok("list -> 200", list.status === 200, `got ${list.status}`);
  ok("list contains both quizzes", [quizId, attachedId].every((id) => (list.json?.data ?? []).some((q) => q.id === id)));

  const filtered = await req("GET", `/quizzes?courseId=${courseId}`);
  ok("courseId filter keeps attached quiz", (filtered.json?.data ?? []).some((q) => q.id === attachedId));
  ok("courseId filter drops unattached quiz", !(filtered.json?.data ?? []).some((q) => q.id === quizId));

  const detailEmpty = await req("GET", `/quizzes/${quizId}`);
  ok("detail -> 200", detailEmpty.status === 200, `got ${detailEmpty.status}`);
  ok("questions empty to start", Array.isArray(detailEmpty.json?.data?.questions) && detailEmpty.json.data.questions.length === 0);
  ok("totalPoints starts at 0", detailEmpty.json?.data?.totalPoints === 0);
  ok("empty quiz is autoGradable", detailEmpty.json?.data?.autoGradable === true);

  // 3. Update quiz settings; bounds + empty-patch guards.
  console.log("\nPATCH /quizzes/:id");
  const patched = await req("PATCH", `/quizzes/${quizId}`, { title: "Smoke Quiz (edited)", passingGrade: 70, randomizeQuestions: true });
  ok("patch -> 200", patched.status === 200, `got ${patched.status}`);
  ok("passingGrade updated", patched.json?.data?.passingGrade === 70);
  const badGrade = await req("PATCH", `/quizzes/${quizId}`, { passingGrade: 150 });
  ok("passingGrade 150 -> 400", badGrade.status === 400, `got ${badGrade.status}`);
  const emptyPatch = await req("PATCH", `/quizzes/${quizId}`, {});
  ok("empty patch -> 400", emptyPatch.status === 400, `got ${emptyPatch.status}`);
  const detach = await req("PATCH", `/quizzes/${attachedId}`, { courseId: null });
  ok("courseId null detaches", detach.status === 200 && detach.json?.data?.courseId === null, `got ${detach.status}`);

  // 4. Questions — one of each v1 type, plus per-type payload guards.
  console.log("\nPOST /quizzes/:id/questions (v1 types + guards)");
  const mc = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTIPLE_CHOICE", prompt: "Pick one",
    data: { options: ["A", "B", "C"], correctIndex: 1 },
  });
  ok("MULTIPLE_CHOICE -> 201", mc.status === 201, `got ${mc.status}`);
  ok("question order defaults to 0", mc.json?.data?.order === 0);
  ok("points default to 1", mc.json?.data?.points === 1);

  const mcBadIndex = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTIPLE_CHOICE", prompt: "Bad index",
    data: { options: ["A", "B"], correctIndex: 5 },
  });
  ok("MC out-of-range correctIndex -> 400", mcBadIndex.status === 400, `got ${mcBadIndex.status}`);
  const mcNoOptions = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTIPLE_CHOICE", prompt: "No options", data: { correctIndex: 0 },
  });
  ok("MC missing options -> 400", mcNoOptions.status === 400, `got ${mcNoOptions.status}`);
  const mcNoIndex = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTIPLE_CHOICE", prompt: "No correct answer", data: { options: ["A", "B"] },
  });
  ok("MC missing correctIndex -> 400", mcNoIndex.status === 400, `got ${mcNoIndex.status}`);

  const tf = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "TRUE_FALSE", prompt: "True or false?", data: { correct: true }, points: 2,
  });
  ok("TRUE_FALSE -> 201", tf.status === 201, `got ${tf.status}`);
  ok("second question order defaults to 1 (end of list)", tf.json?.data?.order === 1);
  const tfNoCorrect = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "TRUE_FALSE", prompt: "Missing answer", data: {},
  });
  ok("TF missing correct -> 400", tfNoCorrect.status === 400, `got ${tfNoCorrect.status}`);

  const ms = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTI_SELECT", prompt: "Pick all that apply",
    data: { options: ["A", "B", "C", "D"], correctIndexes: [0, 2] }, points: 3,
  });
  ok("MULTI_SELECT -> 201", ms.status === 201, `got ${ms.status}`);
  const msDup = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MULTI_SELECT", prompt: "Dup indexes",
    data: { options: ["A", "B"], correctIndexes: [0, 0] },
  });
  ok("MS duplicate correctIndexes -> 400", msDup.status === 400, `got ${msDup.status}`);

  const essay = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "ESSAY", prompt: "Explain in your own words", points: 5,
  });
  ok("ESSAY (no data) -> 201", essay.status === 201, `got ${essay.status}`);
  const essayData = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "ESSAY", prompt: "Bad essay", data: { options: ["x"] },
  });
  ok("ESSAY with data -> 400", essayData.status === 400, `got ${essayData.status}`);

  const v2Type = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "MATCHING", prompt: "v2 type", data: {},
  });
  ok("MATCHING (v2) -> 400", v2Type.status === 400, `got ${v2Type.status}`);
  const unknownType = await req("POST", `/quizzes/${quizId}/questions`, {
    type: "RIDDLE", prompt: "??", data: {},
  });
  ok("unknown type -> 400", unknownType.status === 400, `got ${unknownType.status}`);

  const mcId = mc.json?.data?.id;
  const tfId = tf.json?.data?.id;
  const essayId = essay.json?.data?.id;

  // 5. Detail derives counts live (R3): 4 questions, 1+2+3+5 points, essay = manual.
  console.log("\nGET /quizzes/:id (derived fields)");
  const detail = await req("GET", `/quizzes/${quizId}`);
  ok("questionCount = 4", detail.json?.data?.questionCount === 4, `got ${detail.json?.data?.questionCount}`);
  ok("totalPoints = 11", detail.json?.data?.totalPoints === 11, `got ${detail.json?.data?.totalPoints}`);
  ok("essay present -> autoGradable false", detail.json?.data?.autoGradable === false);

  // 6. Update a question; the (type, data) pair must travel together.
  console.log("\nPATCH /quizzes/:id/questions/:questionId");
  const qPatch = await req("PATCH", `/quizzes/${quizId}/questions/${mcId}`, { prompt: "Pick one (edited)", points: 4 });
  ok("patch prompt/points -> 200", qPatch.status === 200, `got ${qPatch.status}`);
  const typeOnly = await req("PATCH", `/quizzes/${quizId}/questions/${tfId}`, { type: "MULTIPLE_CHOICE" });
  ok("type without data -> 400", typeOnly.status === 400, `got ${typeOnly.status}`);
  const typeSwap = await req("PATCH", `/quizzes/${quizId}/questions/${tfId}`, {
    type: "MULTIPLE_CHOICE", data: { options: ["Yes", "No"], correctIndex: 0 },
  });
  ok("type+data swap -> 200", typeSwap.status === 200, `got ${typeSwap.status}`);
  ok("swapped data persisted", typeSwap.json?.data?.data?.correctIndex === 0 && typeSwap.json?.data?.type === "MULTIPLE_CHOICE");

  // 7. Cross-quiz ownership: a question can only be reached through ITS quiz.
  console.log("\nCross-quiz ownership guard");
  const otherPatch = await req("PATCH", `/quizzes/${attachedId}/questions/${mcId}`, { prompt: "hijack" });
  ok("question via wrong quiz -> 404", otherPatch.status === 404, `got ${otherPatch.status}`);

  // 8. Delete the essay — the quiz becomes fully auto-gradable.
  console.log("\nDELETE /quizzes/:id/questions/:questionId");
  const qDel = await req("DELETE", `/quizzes/${quizId}/questions/${essayId}`);
  ok("delete question -> 200", qDel.status === 200, `got ${qDel.status}`);
  const qDelAgain = await req("DELETE", `/quizzes/${quizId}/questions/${essayId}`);
  ok("delete same question again -> 404", qDelAgain.status === 404, `got ${qDelAgain.status}`);
  const afterDel = await req("GET", `/quizzes/${quizId}`);
  ok("no essay left -> autoGradable true", afterDel.json?.data?.autoGradable === true);

  // 9. Reorder — swap in ONE bulk call; response is the full quiz detail.
  console.log("\nPATCH /quizzes/:id/reorder (single bulk request)");
  const reorder = await req("PATCH", `/quizzes/${quizId}/reorder`, {
    items: [{ id: mcId, order: 2 }, { id: tfId, order: 0 }],
  });
  ok("reorder -> 200", reorder.status === 200, `got ${reorder.status}`);
  const qs = reorder.json?.data?.questions ?? [];
  ok("tf question now sorts first (order 0)", qs[0]?.id === tfId);
  ok("response carries full quiz detail", reorder.json?.data?.id === quizId && reorder.json?.data?.questionCount === 3);
  const badReorder = await req("PATCH", `/quizzes/${quizId}/reorder`, { items: [{ id: "does-not-exist", order: 0 }] });
  ok("reorder with foreign question -> 400", badReorder.status === 400, `got ${badReorder.status}`);

  // 10. 404s and auth guard.
  console.log("\n404 + auth guards");
  const missingQuiz = await req("GET", "/quizzes/00000000-0000-0000-0000-000000000000");
  ok("unknown quiz -> 404", missingQuiz.status === 404, `got ${missingQuiz.status}`);
  const noAuth = await req("GET", "/quizzes", undefined, false);
  ok("no token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  // 11. Delete quizzes (questions cascade away at the DB level).
  console.log("\nDELETE /quizzes/:id");
  const delQuiz = await req("DELETE", `/quizzes/${quizId}`);
  ok("delete quiz -> 200", delQuiz.status === 200, `got ${delQuiz.status}`);
  const gone = await req("GET", `/quizzes/${quizId}`);
  ok("deleted quiz -> 404", gone.status === 404, `got ${gone.status}`);
  await req("DELETE", `/quizzes/${attachedId}`);

  // Cleanup — soft-archive the throwaway course.
  await req("DELETE", `/courses/${courseId}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
