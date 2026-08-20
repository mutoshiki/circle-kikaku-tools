import { test, expect } from '@playwright/test';

test.describe('Shared view native touch scrolling', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('one-finger swipe scrolls and the Carbon overflow fade clears at the bottom', async ({ page }) => {
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
    await expect.poll(() => area.evaluate(node => node.classList.contains('sheet-has-more-below'))).toBe(true);
    expect(await area.evaluate(node => {
      const style = getComputedStyle(node);
      return style.maskImage !== 'none' || style.webkitMaskImage !== 'none';
    })).toBeTruthy();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('shared canvas has no bounding box');
    const x = Math.round(box.x + box.width * 0.5);
    const startY = Math.round(Math.min(box.y + box.height - 96, 720));
    const endY = Math.round(Math.max(box.y + 120, startY - 300));
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY, radiusX: 6, radiusY: 6, force: 1 }]
    });
    for (let step = 1; step <= 6; step += 1) {
      const y = Math.round(startY + ((endY - startY) * step) / 6);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, radiusX: 6, radiusY: 6, force: 1 }]
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(() => area.evaluate(node => node.scrollTop)).toBeGreaterThan(20);

    await area.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => area.evaluate(node => node.classList.contains('sheet-has-more-below'))).toBe(false);
  });
});
