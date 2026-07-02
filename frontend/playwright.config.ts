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
      testMatch: /(dashboard|roles|users|organization|groups|invitations|access-policies|stats-consistency|role-templates|user-role-assignments|learning-management|lm-overview|courses-tab)(\.full)?\.spec\.ts/,
      use: { storageState: 'tests/setup/.auth.json' },
      dependencies: ['setup'],
    },
  ],
})
