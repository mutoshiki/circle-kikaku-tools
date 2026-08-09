import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width}px light/dark surfaces render without page overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-button'));
    await page.evaluate(() => window.executeDebugMode?.());
    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      for (const view of ['list', 'sheet', 'seisan']) {
        await page.evaluate(next => window.switchView(next), view);
        await expect(page.locator('#app-view-navigation')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
        await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-${theme}-${view}.png`) });
      }
    }
  });
}
