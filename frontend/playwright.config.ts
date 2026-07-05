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
      testMatch: /(dashboard|dashboard-kpis|roles|users|organization|groups|invitations|access-policies|stats-consistency|role-templates|user-role-assignments|learning-management|lm-overview|courses-tab|roles-permissions-deep-link|lm-deep-link|courses-invalidation|course-upload)(\.full)?\.spec\.ts/,
      use: { storageState: 'tests/setup/.auth.json' },
      dependencies: ['setup'],
    },
  ],
})
