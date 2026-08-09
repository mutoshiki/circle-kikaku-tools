import { test, expect } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROME_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } });
}

async function seedWaitingMembers(page, roomSuffix) {
  await page.goto(`/?room=GRIDV52${roomSuffix}`);
  await page.waitForFunction(() => customElements.get('cds-modal') && typeof window.switchView === 'function');
  await page.evaluate(() => window.switchView('list'));
  await page.locator('#list-empty-hint [data-action="open-batch"]').evaluate(node => node.click());
  await page.locator('#batchMembers').evaluate(node => {
    node.value = '未割当一郎\n未割当二郎\n未割当三郎\n未割当四郎';
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  });
  await page.locator('#executeBatchBtn').evaluate(node => node.click());
  await page.waitForFunction(() => document.querySelectorAll('#waiting-list > .member-card').length === 4);
}

async function expectStableTwoColumnGrid(page) {
  const layout = await page.evaluate(() => {
    const list = document.querySelector('#waiting-list');
    const container = document.querySelector('#waiting-list-container');
    const cards = [...list.querySelectorAll(':scope > .member-card')].slice(0, 2);
    return {
      template: getComputedStyle(list).gridTemplateColumns,
      listWidth: list.getBoundingClientRect().width,
      containerClientWidth: container.clientWidth,
      containerScrollWidth: container.scrollWidth,
      cards: cards.map(card => {
        const rect = card.getBoundingClientRect();
        const line = card.querySelector('.member-main-line');
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          width: rect.width,
          scrollWidth: card.scrollWidth,
          lineClientWidth: line?.clientWidth,
          lineScrollWidth: line?.scrollWidth
        };
      })
    };
  });

  expect(layout.template.trim().split(/\s+/)).toHaveLength(2);
  expect(layout.cards).toHaveLength(2);
  expect(Math.abs(layout.cards[0].top - layout.cards[1].top)).toBeLessThan(1);
  expect(layout.cards[1].left).toBeGreaterThan(layout.cards[0].left);
  expect(layout.containerScrollWidth).toBeLessThanOrEqual(layout.containerClientWidth + 1);
  expect(layout.cards[1].right).toBeLessThanOrEqual(layout.containerClientWidth + 1);
  for (const card of layout.cards) expect(card.scrollWidth).toBeLessThanOrEqual(card.width + 1);
}

test('未割当カードは端末境界幅でも1行2枚を維持する', async ({ page }) => {
  await seedWaitingMembers(page, `A${Date.now().toString(36)}`);

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 641, height: 900 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await expectStableTwoColumnGrid(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.WAITING_GRID_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.WAITING_GRID_SCREENSHOT_PATH, fullPage: false });
  }

  await page.setViewportSize({ width: 320, height: 720 });
  const firstMenu = page.locator('#waiting-list .person-overflow-menu').first();
  await firstMenu.click();
  await expect(firstMenu).toHaveAttribute('open', '');
  await expect(firstMenu.locator(':scope > .person-pop-menu')).toHaveCSS('display', 'block');
  await page.keyboard.press('Escape');
  await expect(firstMenu).not.toHaveAttribute('open', '');
});

test('横向きタッチ端末でも1行2枚を維持する', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  await seedWaitingMembers(page, `B${Date.now().toString(36)}`);
  await expectStableTwoColumnGrid(page);
  await context.close();
});
