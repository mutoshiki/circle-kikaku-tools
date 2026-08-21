import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });

const stagingConfigText = process.env.SANPO_STAGING_FIREBASE_CONFIG || '';
const stagingConfig = stagingConfigText ? JSON.parse(stagingConfigText) : null;

test.describe('staging bug report end-to-end submission', () => {
  test.skip(process.env.SANPO_BUG_REPORT_STAGING !== '1', 'Set SANPO_BUG_REPORT_STAGING=1 for the authorized staging smoke test.');
  test.skip(!stagingConfig, 'Set SANPO_STAGING_FIREBASE_CONFIG.');
  test.skip(stagingConfig?.projectId === 'sanpokai-tool', 'Refusing production Firebase project in staging smoke test.');
  test.setTimeout(60_000);

  test('saves a uniquely identifiable report for email verification', async ({ page }) => {
    const marker = `BUG-MAIL-${Date.now().toString(36).toUpperCase()}`;
    const port = process.env.PLAYWRIGHT_TEST_PORT || '4173';
    const room = `BUGSTG${Date.now().toString(36).toUpperCase()}`;

    await page.route('**/firebase-config.js', route => route.fulfill({
      contentType: 'application/javascript',
      body: `window.SANPO_FIREBASE_CONFIG = ${JSON.stringify(stagingConfig)};`
    }));
    await page.goto(`http://127.0.0.1:${port}/?room=${room}`);
    await page.waitForFunction(() => document.querySelector('#syncStatusBadge')?.dataset.status === 'connected', null, { timeout: 30_000 });

    await page.locator('#projectTitleEditor').fill('バグ通知staging確認');
    await page.locator('#overviewMenuBtn').click();
    await page.locator('#bugReportMenuItem').click();
    await expect(page.locator('#bugReportModal')).toHaveAttribute('open', '');
    await page.locator('#bugReportMessage textarea').fill(`${marker} staging report-to-email verification`);
    await page.locator('#bugReportSubmitBtn').click();
    await expect(page.locator('#appStatusToast')).toContainText('送信しました');

    console.log(`BUG_REPORT_STAGING_MARKER=${marker}`);
  });
});
