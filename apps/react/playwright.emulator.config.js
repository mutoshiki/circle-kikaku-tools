import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './tests/browser-emulator',
  timeout: 30000,
  workers: 1,
  outputDir: join(tmpdir(), 'circle-react-migration-evidence', 'browser-emulator-results'),
  reporter: [['line']],
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'npx --no-install vite preview --host 127.0.0.1 --port 4175 --strictPort --outDir dist-emulator', url: 'http://127.0.0.1:4175', reuseExistingServer: false },
});
