const fs = require('fs');

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium';
const launchOptions = fs.existsSync(systemChromium)
  ? { executablePath: systemChromium, args: ['--no-sandbox'] }
  : undefined;

module.exports = {
  testDir: './tests',
  testMatch: 'basic-ui.spec.js',
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 10000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    launchOptions
  }
};
