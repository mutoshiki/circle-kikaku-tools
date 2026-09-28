import { defineConfig, devices } from '@playwright/test';

const baseURL = String(process.env.REACT_PRODUCTION_SMOKE_BASE_URL || '');
const mode = String(process.env.REACT_PRODUCTION_SMOKE_MODE || '');
const room = String(process.env.REACT_PRODUCTION_SMOKE_ROOM || '');
const expectedPath = mode === 'compatibility' ? '/circle-kikaku-tools/react/' : mode === 'root' ? '/circle-kikaku-tools/' : '';
const parsed = baseURL ? new URL(baseURL) : null;
if (parsed?.origin !== 'https://mutoshiki.github.io' || parsed.pathname !== expectedPath || !room || !/^P9A93LMQ$/.test(room)) {
  throw new Error('Production smoke requires the approved GitHub Pages URL and the reserved empty smoke room.');
}

export default defineConfig({
  testDir: './tests/production',
  testMatch: '**/*.spec.js',
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: [['line']],
  outputDir: process.env.RUNNER_TEMP ? `${process.env.RUNNER_TEMP}/react-production-smoke-results` : './production-smoke-results',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 20000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'production-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'production-webkit-mobile', use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } } },
  ],
});
