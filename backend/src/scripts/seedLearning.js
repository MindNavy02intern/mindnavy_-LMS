/**
 * Seed sample Learning Management data (instructors, courses, enrollments,
 * content, certificates, live sessions) so the Courses tab and the LM Overview
 * show realistic data instead of empty states.
 *
 * Talks straight to the database via Prisma — no server or token needed.
 * Safe to re-run: everything is upserted by a fixed `seed-*` id / unique key,
 * so it never creates duplicates.
 *
 * Run (from the backend folder):
 *   node src/scripts/seedLearning.js
 */

const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const prisma = require("../config/prisma");

async function main() {
  console.log("Seeding Learning Management sample data...\n");

  // ── Instructors ────────────────────────────────────────────────────────────
  // Upserted by email (the real unique key) — `id` is only used on first
  // insert. Always read `.id` back off the upsert result rather than trusting
  // a locally-generated candidate: on re-run the row already exists under
  // whatever id it was first created with, and the courses below must point
  // at that REAL id, not a fresh randomUUID() that was never written.
  const instructorSeeds = [
    { email: "instructor1.seed@mindnavy.com", fullName: "Sarah Johnson" },
    { email: "instructor2.seed@mindnavy.com", fullName: "David Lee" },
  ];
  const [sarah, david] = await Promise.all(instructorSeeds.map((i) =>
    prisma.appUser.upsert({
      where: { email: i.email },
      update: {},
      create: { id: crypto.randomUUID(), email: i.email, fullName: i.fullName, role: "INSTRUCTOR", status: "ACTIVE", verificationState: "VERIFIED" },
    })
  ));

  // ── Learners ───────────────────────────────────────────────────────────────
  const learners = [
    { id: "seed-learner-1", email: "learner1.seed@mindnavy.com", fullName: "Alice Brown" },
    { id: "seed-learner-2", email: "learner2.seed@mindnavy.com", fullName: "Bob Green" },
    { id: "seed-learner-3", email: "learner3.seed@mindnavy.com", fullName: "Carol White" },
    { id: "seed-learner-4", email: "learner4.seed@mindnavy.com", fullName: "Dan Black" },
  ];
  for (const l of learners) {
    await prisma.appUser.upsert({
      where: { email: l.email },
      update: {},
      create: { id: l.id, email: l.email, fullName: l.fullName, role: "LEARNER", status: "ACTIVE", verificationState: "VERIFIED" },
    });
  }

  // ── Courses (varied status / level / category) ─────────────────────────────
  const courses = [
    { id: "seed-course-1", title: "Complete React Developer", category: "Development", level: "ADVANCED",     status: "PUBLISHED", instructorId: sarah.id, tags: ["react", "frontend"] },
    { id: "seed-course-2", title: "Intro to Python",          category: "Development", level: "BEGINNER",     status: "PUBLISHED", instructorId: david.id, tags: ["python"] },
    { id: "seed-course-3", title: "UI/UX Fundamentals",       category: "Design",      level: "INTERMEDIATE", status: "DRAFT",     instructorId: sarah.id, tags: ["design"] },
    { id: "seed-course-4", title: "Marketing 101",            category: "Business",    level: "BEGINNER",     status: "PENDING",   instructorId: david.id, tags: ["marketing"] },
    { id: "seed-course-5", title: "Advanced Node.js",         category: "Development", level: "ADVANCED",     status: "DRAFT",     instructorId: sarah.id, tags: ["node"] },
    { id: "seed-course-6", title: "Legacy Course",            category: "Business",    level: "BEGINNER",     status: "ARCHIVED",  instructorId: david.id, tags: [] },
  ];
  for (const c of courses) {
    await prisma.course.upsert({ where: { id: c.id }, update: {}, create: { ...c, createdBy: null } });
  }

  // ── Enrollments (drive enrolledCount + completion + progress chart) ────────
  const now = new Date();
  const enrollments = [
    { courseId: "seed-course-1", userId: "seed-learner-1", progress: 100, status: "COMPLETED",   completedAt: now },
    { courseId: "seed-course-1", userId: "seed-learner-2", progress: 60,  status: "IN_PROGRESS" },
    { courseId: "seed-course-1", userId: "seed-learner-3", progress: 0,   status: "NOT_STARTED" },
    { courseId: "seed-course-2", userId: "seed-learner-1", progress: 40,  status: "IN_PROGRESS" },
    { courseId: "seed-course-2", userId: "seed-learner-4", progress: 100, status: "COMPLETED",   completedAt: now },
    { courseId: "seed-course-2", userId: "seed-learner-2", progress: 20,  status: "OVERDUE" },
    { courseId: "seed-course-3", userId: "seed-learner-3", progress: 10,  status: "IN_PROGRESS" },
  ];
  for (const e of enrollments) {
    await prisma.courseEnrollment.upsert({
      where: { courseId_userId: { courseId: e.courseId, userId: e.userId } },
      update: {},
      create: e,
    });
  }

  // ── Content items (drive content-stats) ────────────────────────────────────
  const contents = [
    { id: "seed-content-1", courseId: "seed-course-1", title: "Intro video",  type: "VIDEO" },
    { id: "seed-content-2", courseId: "seed-course-1", title: "Hooks PDF",    type: "PDF" },
    { id: "seed-content-3", courseId: "seed-course-1", title: "Quiz 1",       type: "QUIZ" },
    { id: "seed-content-4", courseId: "seed-course-2", title: "Setup doc",    type: "DOCUMENT" },
    { id: "seed-content-5", courseId: "seed-course-2", title: "SCORM pack",   type: "SCORM" },
    { id: "seed-content-6", courseId: "seed-course-2", title: "Lesson video", type: "VIDEO" },
  ];
  for (const ct of contents) {
    await prisma.courseContent.upsert({ where: { id: ct.id }, update: {}, create: ct });
  }

  // ── Certificates (for the completed enrollments) ───────────────────────────
  const certificates = [
    { courseId: "seed-course-1", userId: "seed-learner-1" },
    { courseId: "seed-course-2", userId: "seed-learner-4" },
  ];
  for (const cert of certificates) {
    await prisma.certificate.upsert({
      where: { courseId_userId: { courseId: cert.courseId, userId: cert.userId } },
      update: {},
      create: cert,
    });
  }

  // ── Live sessions ──────────────────────────────────────────────────────────
  const DAY = 24 * 60 * 60 * 1000;
  const sessions = [
    { id: "seed-session-1", title: "React Q&A",        courseId: "seed-course-1", startTime: new Date(now.getTime() + 2 * DAY), status: "UPCOMING" },
    { id: "seed-session-2", title: "Python Workshop",  courseId: "seed-course-2", startTime: new Date(now.getTime() + 5 * DAY), status: "UPCOMING" },
    { id: "seed-session-3", title: "Past React Recap", courseId: "seed-course-1", startTime: new Date(now.getTime() - 3 * DAY), status: "ENDED" },
  ];
  for (const s of sessions) {
    await prisma.liveSession.upsert({ where: { id: s.id }, update: {}, create: s });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const [instCount, courseCount, enrollCount, contentCount, certCount, sessionCount] = await Promise.all([
    prisma.appUser.count({ where: { role: "INSTRUCTOR" } }),
    prisma.course.count(),
    prisma.courseEnrollment.count(),
    prisma.courseContent.count(),
    prisma.certificate.count(),
    prisma.liveSession.count(),
  ]);

  console.log("Done. Current totals in the database:");
  console.log(`  instructors:   ${instCount}`);
  console.log(`  courses:       ${courseCount}`);
  console.log(`  enrollments:   ${enrollCount}`);
  console.log(`  content items: ${contentCount}`);
  console.log(`  certificates:  ${certCount}`);
  console.log(`  live sessions: ${sessionCount}`);
  console.log("\nInstructor ids you can use when creating a course:");
  console.log(`  ${sarah.id}  (Sarah Johnson)`);
  console.log(`  ${david.id}  (David Lee)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
