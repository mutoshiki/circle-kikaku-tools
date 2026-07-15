const { test, expect } = require('@playwright/test');

async function gotoSeededAllocation(page, width) {
  await page.route('**/firebase-config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.SANPO_FIREBASE_CONFIG = {};'
  }));
  await page.goto(`./index.html?room=CARBON-SEAT-${width}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function' && typeof window.switchView === 'function');
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForTimeout(260);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);
}

for (const width of [360, 390, 430, 768]) {
  test(`Carbon content switcher and empty-seat picker at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await gotoSeededAllocation(page, width);

    const switcher = page.locator('.car-plan-template-tabs');
    const tabs = switcher.getByRole('tab');
    await expect(switcher).toBeVisible();
    await expect(tabs).toHaveCount(2);
    const tabBoxes = await tabs.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    expect(Math.abs(tabBoxes[0].width - tabBoxes[1].width)).toBeLessThan(1);
    expect(tabBoxes.every(box => box.height >= 48)).toBeTruthy();

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(1).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: '車割' })).toHaveAttribute('aria-selected', 'true');

    await page.evaluate(() => {
      const assigned = document.querySelector('.seat-slot .member-card');
      if (assigned) document.querySelector('#waiting-list').appendChild(assigned);
      window.updateUI();
    });

    const emptySeat = page.getByRole('button', { name: '空席に未割り当てメンバーを追加' }).first();
    await expect(emptySeat).toBeVisible();
    expect((await emptySeat.boundingBox()).height).toBeGreaterThanOrEqual(48);

    const waitingBefore = await page.locator('#waiting-list .member-card').count();
    const assignedBefore = await page.locator('.seat-slot .member-card').count();
    await emptySeat.click();
    const dialog = page.getByRole('dialog', { name: '空席に追加' });
    await expect(dialog).toBeVisible();
    await dialog.locator('.seat-member-picker-option').first().click();
    await expect(page.locator('#waiting-list .member-card')).toHaveCount(waitingBefore - 1);
    await expect(page.locator('.seat-slot .member-card')).toHaveCount(assignedBefore + 1);
    await expect(dialog).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
