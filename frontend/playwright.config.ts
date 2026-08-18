import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'unauthenticated',
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: 'authenticated',
      testMatch: /(dashboard|dashboard-kpis|roles|users|organization|groups|invitations|access-policies|stats-consistency|role-templates|user-role-assignments|learning-management|lm-overview|courses-tab|roles-permissions-deep-link|lm-deep-link|courses-invalidation|course-upload|course-builder|course-video-upload|course-settings|course-preview|course-submit|course-approval|categories|course-basic-info|learning-paths|quizzes|certificates|certificate-placeholders|live-sessions|enrollments|content-library|instructors|instructor-stats-cards|instructor-applications|instructor-panel-analytics|instructor-phase-b|instructor-phase-cd|learners|competencies|reports|reports-schedule|finance|notifications|integrations|system-settings|user-courses-tab|user-more-tab|profile-page)(\.full)?\.spec\.ts/,
      use: { storageState: 'tests/setup/.auth.json' },
      dependencies: ['setup'],
    },
  ],
})
