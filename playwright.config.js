const fs = require('fs');

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launchOptions = systemChromium && fs.existsSync(systemChromium)
  ? { executablePath: systemChromium, args: ['--no-sandbox'] }
  : undefined;
const testPort = Number(process.env.PLAYWRIGHT_TEST_PORT || 4173);
const localOrigin = `http://127.0.0.1:${testPort}`;
const externalBaseURL = String(process.env.GOOGLE_MAPS_LIVE_BASE_URL || '').replace(/\/+$/, '');
const baseURL = externalBaseURL ? `${externalBaseURL}/` : `${localOrigin}/`;

module.exports = {
  testDir: './tests',
  testMatch: '**/*.spec.js',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  webServer: externalBaseURL ? undefined : {
    command: 'node tests/serve-static.js',
    url: `${localOrigin}/index.html`,
    reuseExistingServer: true,
    timeout: 10000
  },
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions
  }
};
