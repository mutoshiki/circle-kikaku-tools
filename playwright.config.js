import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_TEST_PORT || 4173);
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
    reuseExistingServer: true,
    timeout: 30_000,
    env: { PLAYWRIGHT_TEST_PORT: String(port) }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
