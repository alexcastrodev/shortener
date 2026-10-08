import { defineConfig, devices } from '@playwright/test';
import { API_URL, APP_URL } from './support/env.ts';

const startServers = process.env.E2E_START_SERVERS === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: APP_URL,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startServers
    ? [
        {
          command: 'bin/rails server -b 0.0.0.0 -p 3000',
          cwd: '../backend',
          url: `${API_URL}/up`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            RAILS_ENV: 'test',
            FRONTEND_URL: APP_URL,
          },
        },
        {
          command: 'npm run start',
          cwd: '../frontend',
          url: APP_URL,
          reuseExistingServer: false,
          timeout: 60_000,
          env: { PORT: '3001' },
        },
      ]
    : undefined,
});
