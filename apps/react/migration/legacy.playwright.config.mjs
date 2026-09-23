import { defineConfig, devices } from '../../../node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const output = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
export default defineConfig({
  testDir: '../../../tests',
  testMatch: ['carbon-complete.spec.js', 'assignment-workspace-refresh.spec.js', 'shared-touch-scroll-v72.spec.js', 'shell-project-title-navigation-v73.spec.js', 'settlement-cost-editor-list-v75.spec.js', 'settlement-ui-regressions-v76.spec.js', 'status-toast-policy-v79.spec.js', 'settlement-modal-warning-v80.spec.js', 'participants-tab-v83.spec.js', 'form-linked-sample.spec.js', 'empty-state-parity-v96.spec.js', 'bugfix-room-participants-drivers-v101.spec.js', 'official-carbon-runtime.spec.js'],
  timeout: 30000,
  expect: { timeout: 7000 },
  workers: 1,
  reporter: [['line'], ['json', { outputFile: join(output, 'legacy-browser-baseline.json') }]],
  outputDir: join(output, 'legacy-browser'),
  use: { baseURL: 'http://127.0.0.1:4183', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/react/tools/reference-server.mjs', cwd: fileURLToPath(new URL('../../../', import.meta.url)), url: 'http://127.0.0.1:4183', reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
