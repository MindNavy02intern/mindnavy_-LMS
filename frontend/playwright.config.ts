/// <reference types="node" />
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Admin login for the suite comes from the environment, never from the repo
// (this repository is public). Put them in frontend/tests/.env.e2e (gitignored):
//   E2E_ADMIN_EMAIL=...
//   E2E_ADMIN_PASSWORD=...
// or export them in your shell. The file is optional — shell values work too.
try {
  process.loadEnvFile(fileURLToPath(new URL('./tests/.env.e2e', import.meta.url)))
} catch {
  // no file — fall back to the shell environment
}

export default defineConfig({
  testDir: './tests',

  use: {
    baseURL: 'http://localhost:5173',
    // Fixed browser identity so the backend can recognise the test browser as
    // a trusted device (new-device verification is server-enforced). Run
    // `npm run trust:test-device` in backend/ once; must match TEST_USER_AGENT
    // in backend/src/scripts/trustTestDevice.js.
    userAgent: 'MindNavy-Playwright',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    {
      name: 'unauthenticated',
      testMatch: /auth\.spec\.ts/,
    },

    {
      name: 'authenticated',
      testMatch:
        /(dashboard|dashboard-kpis|roles|users|organization|groups|invitations|access-policies|stats-consistency|role-templates|user-role-assignments|learning-management|lm-overview|courses-tab|roles-permissions-deep-link|role-activity-audit|lm-deep-link|courses-invalidation|course-upload|course-builder|course-video-upload|course-settings|course-preview|course-submit|course-approval|categories|course-basic-info|learning-paths|quizzes|certificates|certificate-placeholders|live-sessions|enrollments|content-library|instructors|instructor-stats-cards|instructor-applications|instructor-panel-analytics|instructor-phase-b|instructor-phase-cd|instructor-auth|instructor-dashboard|instructor-courses|instructor-course-builder-parity|instructor-live-sessions|instructor-students|instructor-phase5|instructor-phase6|learners|competencies|reports|reports-schedule|finance|notifications|integrations|system-settings|user-courses-tab|user-more-tab|profile-page|admin-message-thread)(\.full)?\.spec\.ts/,
      use: {
        storageState: 'tests/setup/.auth.json',
      },
      dependencies: ['setup'],
    },
  ],
})