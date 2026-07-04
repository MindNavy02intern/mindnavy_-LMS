/**
 * Smoke test for the Course Builder endpoints (sections + lessons + reorder).
 *
 * Exercises every endpoint end-to-end against a RUNNING server, using a Bearer
 * token from an env var (no secret stored in the repo). Creates a throwaway
 * course, builds it, then soft-archives the course at the end.
 *
 * Prerequisites:
 *   1. `npx prisma db push` has been run (course_sections + lessons tables exist).
 *   2. The backend server is running (default http://localhost:5001).
 *   3. At least one AppUser with role INSTRUCTOR exists.
 *
 * Run (PowerShell):
 *   $env:SMOKE_TOKEN="<admin token>"; node src/scripts/courseBuilderSmokeTest.js
 * Run (bash):
 *   SMOKE_TOKEN="<admin token>" node src/scripts/courseBuilderSmokeTest.js
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
  console.log(`Course Builder smoke test -> ${API}\n`);

  // Setup — instructor + a fresh course to build.
  const fo = await req("GET", "/lm/filter-options");
  const instructorId = fo.json?.data?.instructors?.[0]?.id ?? null;
  if (!instructorId) {
    console.error("No INSTRUCTOR users found. Create one, then re-run.");
    process.exit(1);
  }
  const createdCourse = await req("POST", "/courses", {
    title: `BUILDER SMOKE ${new Date().toISOString()}`,
    instructorId, category: "Smoke", level: "Beginner",
  });
  const courseId = createdCourse.json?.data?.id;
  ok("setup: course created", createdCourse.status === 201 && Boolean(courseId), `got ${createdCourse.status}`);
  if (!courseId) process.exit(1);
  console.log(`  courseId = ${courseId}\n`);

  // 1. Sections start empty.
  console.log("GET /courses/:courseId/sections (empty)");
  const empty = await req("GET", `/courses/${courseId}/sections`);
  ok("returns 200", empty.status === 200, `got ${empty.status}`);
  ok("empty array to start", Array.isArray(empty.json?.data) && empty.json.data.length === 0);

  // 2. Create two sections.
  console.log("\nPOST /courses/:courseId/sections");
  const s1 = await req("POST", `/courses/${courseId}/sections`, { title: "Section One" });
  const s2 = await req("POST", `/courses/${courseId}/sections`, { title: "Section Two" });
  ok("create section 1 -> 201", s1.status === 201, `got ${s1.status}`);
  ok("create section 2 -> 201", s2.status === 201, `got ${s2.status}`);
  const sec1 = s1.json?.data?.id;
  const sec2 = s2.json?.data?.id;
  ok("section 1 order defaults to 0", s1.json?.data?.order === 0);
  ok("section 2 order defaults to 1 (end of list)", s2.json?.data?.order === 1);

  // 3. Add a TEXT lesson and a VIDEO_URL lesson; reject a bad video URL.
  console.log("\nPOST /sections/:sectionId/lessons");
  const textLesson = await req("POST", `/sections/${sec1}/lessons`, { title: "Intro", type: "TEXT", content: "Hello world" });
  ok("text lesson -> 201", textLesson.status === 201, `got ${textLesson.status}`);
  ok("text lesson type is TEXT", textLesson.json?.data?.type === "TEXT");

  const videoLesson = await req("POST", `/sections/${sec1}/lessons`, {
    title: "Watch", type: "VIDEO_URL", content: "https://example.com/video.mp4", durationMin: 12,
  });
  ok("video lesson -> 201", videoLesson.status === 201, `got ${videoLesson.status}`);
  ok("video lesson keeps URL in content", videoLesson.json?.data?.content === "https://example.com/video.mp4");

  const badVideo = await req("POST", `/sections/${sec1}/lessons`, { title: "Bad", type: "VIDEO_URL", content: "not-a-url" });
  ok("invalid video URL -> 400", badVideo.status === 400, `got ${badVideo.status}`);

  const lessonText  = textLesson.json?.data?.id;
  const lessonVideo = videoLesson.json?.data?.id;

  // 4. Edit a lesson (prefill/patch).
  console.log("\nPATCH /lessons/:id");
  const patched = await req("PATCH", `/lessons/${lessonText}`, { title: "Intro (edited)" });
  ok("patch -> 200", patched.status === 200, `got ${patched.status}`);
  ok("title updated", patched.json?.data?.title === "Intro (edited)");

  // 5. Reorder: move the video lesson to section 2 and swap section order — ONE call.
  console.log("\nPATCH /courses/:courseId/reorder (single bulk request)");
  const reorder = await req("PATCH", `/courses/${courseId}/reorder`, {
    sections: [{ id: sec1, order: 1 }, { id: sec2, order: 0 }],
    lessons:  [{ id: lessonVideo, sectionId: sec2, order: 0 }],
  });
  ok("reorder -> 200", reorder.status === 200, `got ${reorder.status}`);
  const tree = reorder.json?.data ?? [];
  const movedInto = tree.find((s) => s.id === sec2);
  ok("video lesson moved into section 2", movedInto?.lessons?.some((l) => l.id === lessonVideo));
  ok("section 2 now sorts first (order 0)", tree[0]?.id === sec2);

  // 6. Reorder rejects a section from another course (or a made-up id).
  const badReorder = await req("PATCH", `/courses/${courseId}/reorder`, { sections: [{ id: "does-not-exist", order: 0 }] });
  ok("reorder with foreign section -> 400", badReorder.status === 400, `got ${badReorder.status}`);

  // 7. Delete a lesson.
  console.log("\nDELETE /lessons/:id");
  const delLesson = await req("DELETE", `/lessons/${lessonText}`);
  ok("delete lesson -> 200", delLesson.status === 200, `got ${delLesson.status}`);

  // 8. Delete a section → its remaining lessons cascade away.
  console.log("\nDELETE /sections/:id (cascade)");
  const delSection = await req("DELETE", `/sections/${sec2}`);
  ok("delete section -> 200", delSection.status === 200, `got ${delSection.status}`);
  const afterDelete = await req("GET", `/courses/${courseId}/sections`);
  const stillThere = (afterDelete.json?.data ?? []).some((s) => s.id === sec2);
  ok("deleted section is gone", !stillThere);
  // The video lesson lived in sec2 → it must be gone too (DB cascade).
  const orphan = (afterDelete.json?.data ?? []).some((s) => (s.lessons ?? []).some((l) => l.id === lessonVideo));
  ok("cascade removed the section's lessons", !orphan);

  // 9. 404s and auth guard.
  console.log("\n404 + auth guards");
  const missingCourse = await req("GET", "/courses/00000000-0000-0000-0000-000000000000/sections");
  ok("unknown course -> 404", missingCourse.status === 404, `got ${missingCourse.status}`);
  const noAuth = await req("GET", `/courses/${courseId}/sections`, undefined, false);
  ok("no token -> 401", noAuth.status === 401, `got ${noAuth.status}`);

  // Cleanup — soft-archive the throwaway course (API never hard-deletes courses).
  await req("DELETE", `/courses/${courseId}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
