const fs = require('fs');

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium';
const launchOptions = fs.existsSync(systemChromium)
  ? { executablePath: systemChromium, args: ['--no-sandbox'] }
  : undefined;

module.exports = {
  testDir: './tests',
  testMatch: '**/*.spec.js',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  webServer: {
    command: 'node tests/serve-static.js',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 10000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions
  }
};
