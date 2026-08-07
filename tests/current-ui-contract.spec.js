import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-menu'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('.app-status-toast').forEach(node => node.classList.remove('visible')));
}

async function hostClick(page, selector, index = 0) {
  const locator = page.locator(selector).nth(index);
  await expect(locator).toBeAttached();
  if (await locator.evaluate(node => node.tagName === 'CDS-OVERFLOW-MENU')) await locator.click();
  else await locator.evaluate(node => node.click());
  await page.waitForTimeout(100);
}

async function setHostValue(page, selector, value, index = -1) {
  const locator = page.locator(selector).nth(index);
  await locator.evaluate((node, next) => {
    node.value = next;
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
  await page.waitForTimeout(60);
}

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`${viewport.width}px current Carbon shell`, () => {
    test.use({ viewport });

    test('views, theme, purpose-specific sharing and overview remain operable', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await seed(page);

      for (const view of ['list', 'sheet', 'seisan']) {
        await page.evaluate(next => window.switchView(next), view);
        await expect(page.locator('#app-view-navigation')).toBeVisible();
        await expectNoDocumentOverflow(page);
      }

      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      await hostClick(page, '#themeToggleBtn');
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before);

      await hostClick(page, '#shareLinkBtn');
      await expect(page.locator('#share-links-modal')).toHaveAttribute('open', '');
      await expect(page.locator('#share-links-modal .share-link-option')).toHaveCount(2);
      await expect(page.locator('#share-links-modal')).toContainText('車割・班割（発表用リンク）');
      await expect(page.locator('#share-links-modal')).toContainText('精算用リンク');
      await page.locator('#share-links-modal cds-modal-close-button').evaluate(node => node.click());
      await expect(page.locator('#share-links-modal')).toHaveCount(0);

      await hostClick(page, '#overviewMenuBtn');
      await expect(page.locator('#overviewDrawer')).toHaveAttribute('aria-hidden', 'false');
      const rows = await page.locator('.overview-timetable-row').count();
      await hostClick(page, '#overviewTimetableAddBtn');
      await expect(page.locator('.overview-timetable-row')).toHaveCount(rows + 1);
      await setHostValue(page, '#overviewMemoInput', 'Carbon完成確認');
      await hostClick(page, '#overviewDrawerCloseBtn');
      await expect(page.locator('#overviewDrawer')).toHaveAttribute('aria-hidden', 'true');
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Current mobile workflows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shared view quick edit adds and removes the visible timetable row', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.switchView('sheet'));
    await hostClick(page, '#sheet-quick-edit-btn');
    await expect(page.locator('body')).toHaveClass(/quick-edit-mode/);

    const rows = page.locator('#sheet-view-area .sheet-timetable-edit-row');
    const before = await rows.count();
    const add = page.locator('#sheet-view-area [data-action="add-sheet-timetable-row"]');
    await expect(add).toBeVisible();
    await add.evaluate(node => node.click());
    await expect(rows).toHaveCount(before + 1);

    await page.locator('#sheet-view-area .sheet-timetable-delete').last().evaluate(node => node.click());
    await expect(rows).toHaveCount(before);
    await hostClick(page, '#sheet-quick-edit-btn');
    await expect(page.locator('body')).not.toHaveClass(/quick-edit-mode/);
    await expectNoDocumentOverflow(page);
  });

  test('all empty views use the same two Carbon entry choices', async ({ page }) => {
    const room = `FIRST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => customElements.get('cds-button'));

    const cases = [
      ['list', '#list-empty-hint .app-entry-choice'],
      ['sheet', '#sheet-content .app-entry-choice'],
      ['seisan', '#seisan-empty-state .app-entry-choice']
    ];
    for (const [view, selector] of cases) {
      await page.evaluate(next => window.switchView(next), view);
      const empty = page.locator(selector);
      await expect(empty).toBeVisible();
      await expect(empty.locator('cds-button')).toHaveCount(2);
      await expect(empty).toContainText('参加者登録');
      await expect(empty).toContainText('推奨');
      await expect(empty).toContainText('もしくは');
      await expect(empty).toContainText('人数だけで精算');
      await expect(empty.locator('[data-carbon-icon]')).toHaveCount(0);
    }
  });

  test('active settlement editor retains and validates a newly added blank cost row', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.switchView('seisan'));
    await hostClick(page, '[data-action="open-settlement-car-edit"]');
    await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');

    await hostClick(page, '#settlementCarEditModal [data-action="add-settlement-extra"]');
    await expect(page.locator('#settlementCarEditModal .seisan-extra-row[data-extra-pending="true"]')).toHaveCount(1);
    await hostClick(page, '#settlementCarEditModal [data-action="save-settlement-car-edit"]');

    await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
    await expect(page.locator('#settlementCarEditModal [data-extra-field][invalid]')).toHaveCount(2);
    await setHostValue(page, '#settlementCarEditModal [data-extra-field="name"]', '高速代');
    await setHostValue(page, '#settlementCarEditModal [data-extra-field="amount"]', '1234');
    await expect(page.locator('#settlementCarEditModal [data-extra-field][invalid]')).toHaveCount(0);
  });
});
