const { test, expect } = require('@playwright/test');

const widths = [375, 390, 430];

for (const width of widths) {
  test(`visual smoke at ${width}px light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/index.html');
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ fullPage: true, animations: 'disabled' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.screenshot({ fullPage: true, animations: 'disabled' });
  });
}
