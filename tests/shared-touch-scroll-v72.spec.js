import { test, expect } from '@playwright/test';

test.describe('Shared view native touch scrolling', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

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
    const y = Math.round(Math.min(Math.max(box.y + 160, 220), 640));
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.synthesizeScrollGesture', {
      x,
      y,
      yDistance: -320,
      speed: 900,
      gestureSourceType: 'touch',
      preventFling: true
    });

    await expect.poll(() => area.evaluate(node => node.scrollTop)).toBeGreaterThan(20);

    await area.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => area.evaluate(node => node.classList.contains('sheet-has-more-below'))).toBe(false);
  });
});
