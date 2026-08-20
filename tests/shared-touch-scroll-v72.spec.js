import { test, expect } from '@playwright/test';

test.describe('Shared view responsive scrolling', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('shared view is browser-scrollable, allows touch pan-y, and clears the Carbon overflow fade at the bottom', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-button'));
    await page.evaluate(() => window.executeDebugMode?.());
    await page.waitForTimeout(250);
    await page.evaluate(() => window.switchView('sheet'));

    const area = page.locator('#sheet-view-area');
    const canvas = page.locator('#sheet-canvas');
    await expect(area).toBeVisible();
    await expect.poll(() => area.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(80);

    expect(await canvas.evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y');
    expect(await area.evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y');
    await expect.poll(() => area.evaluate(node => node.classList.contains('sheet-has-more-below'))).toBe(true);
    expect(await area.evaluate(node => {
      const style = getComputedStyle(node);
      return style.maskImage !== 'none' || style.webkitMaskImage !== 'none';
    })).toBeTruthy();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('shared canvas has no bounding box');
    const x = Math.round(box.x + box.width * 0.5);
    const y = Math.round(Math.min(Math.max(box.y + 160, 220), 640));
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 360);

    await expect.poll(() => area.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop || 0)).toBe(0);

    await area.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => area.evaluate(node => node.classList.contains('sheet-has-more-below'))).toBe(false);
  });
});
