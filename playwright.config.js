import { defineConfig, devices } from '@playwright/test';
import { assertTestFirebaseTarget } from './tools/test-firebase-target.mjs';

const port = Number(process.env.PLAYWRIGHT_TEST_PORT || 4173);
assertTestFirebaseTarget();
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'node tools/serve-static.mjs',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PLAYWRIGHT_TEST_PORT: String(port),
      SANPO_TEST_FIREBASE_TARGET: process.env.SANPO_TEST_FIREBASE_TARGET,
      SANPO_TEST_FIREBASE_PROJECT_ID: process.env.SANPO_TEST_FIREBASE_PROJECT_ID,
      SANPO_TEST_FIREBASE_DATABASE_URL: process.env.SANPO_TEST_FIREBASE_DATABASE_URL,
      SANPO_STAGING_FIREBASE_CONFIG: process.env.SANPO_STAGING_FIREBASE_CONFIG,
    }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
