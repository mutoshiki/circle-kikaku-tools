import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const output = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
// See tests/browser/font-readiness.js: actual font loads are asserted separately.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 7000 },
  workers: 1,
  reporter: [['line'], ['json', { outputFile: join(output, 'react-browser.json') }]],
  outputDir: join(output, 'react-browser'),
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit-mobile', use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } } },
  ],
});
