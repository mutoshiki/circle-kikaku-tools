import { test, expect } from '@playwright/test';

async function seedSettlement(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-toggle') && customElements.get('cds-popover'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.switchView('seisan'));
  await page.waitForTimeout(150);
  const edit = page.locator('[data-action="open-settlement-car-edit"]').first();
  await expect(edit).toBeAttached();
  await edit.evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
}

async function openMovementSettings(page) {
  const action = page.locator('#settlementCarEditModal [data-action="open-settlement-gas-settings"]');
  await action.evaluate(node => node.click());
  const popover = page.locator('#settlementCarEditModal cds-popover.seisan-gas-settings-popover');
  await expect(popover).toHaveJSProperty('open', true);
  const surface = popover.locator('.seisan-gas-settings-surface');
  await expect(surface).toBeVisible();
  return surface;
}

for (const config of [
  { name: 'mobile light', width: 390, height: 844, dark: false },
  { name: 'mobile dark', width: 390, height: 844, dark: true },
  { name: 'desktop light', width: 1280, height: 900, dark: false },
  { name: 'desktop dark', width: 1280, height: 900, dark: true }
]) {
  test.describe(config.name, () => {
    test.use({ viewport: { width: config.width, height: config.height }, hasTouch: config.width <= 390 });

    test('cost list stays scannable and movement settings use a Carbon popover', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await seedSettlement(page);

      if (config.dark) {
        const current = await page.evaluate(() => document.documentElement.dataset.theme);
        if (current !== 'dark') {
          await page.locator('#themeToggleBtn').evaluate(node => node.click());
          await page.waitForTimeout(80);
        }
      }

      const header = page.locator('#settlementCarEditModal .seisan-cost-edit-header');
      await expect(header).toContainText('名目');
      await expect(header).toContainText('金額');
      await expect(header).toContainText('部費');
      await expect(header).toContainText('操作');
      await expect(page.locator('#settlementCarEditModal .seisan-extra-field-label')).toHaveCount(0);
      await expect(page.locator('#settlementCarEditModal cds-select[data-extra-field="type"]')).toHaveCount(0);
      await expect(page.locator('#settlementCarEditModal cds-toggle[data-extra-field="type"]')).not.toHaveCount(0);

      const row = page.locator('#settlementCarEditModal .seisan-gas-cost-row');
      await expect(row).toContainText('ガソリン代');
      const cells = row.locator(':scope > *');
      await expect(cells).toHaveCount(4);
      await expect(row.locator('.seisan-extra-field--name cds-text-input')).toHaveAttribute('readonly', '');
      await expect(row.locator('[data-carbon-icon="settings--adjust"], [data-carbon-icon-name="settings--adjust"]')).toHaveCount(1);
      await expect(row.locator('[data-settlement-gas-amount]')).toHaveCount(0);
      await expect(row.locator('cds-toggle')).toHaveCount(0);
      await expect(row.locator('.seisan-fixed-cell')).toHaveCount(2);

      const geometry = await row.evaluate(node => {
        const rowBox = node.getBoundingClientRect();
        const cells = [...node.children].map(child => {
          const box = child.getBoundingClientRect();
          return { left: box.left, right: box.right, centerY: (box.top + box.bottom) / 2 };
        });
        return { height: rowBox.height, cells };
      });
      expect(geometry.height).toBeLessThanOrEqual(64);
      expect(Math.max(...geometry.cells.map(cell => cell.centerY)) - Math.min(...geometry.cells.map(cell => cell.centerY))).toBeLessThanOrEqual(1);
      expect(geometry.cells.every((cell, index, all) => index === 0 || cell.left >= all[index - 1].right)).toBeTruthy();

      const popup = await openMovementSettings(page);
      await expect(popup.locator('[data-field="rentalType"]')).toHaveJSProperty('value', 'private');
      await expect(popup.locator('[data-field="dist"]')).toBeAttached();
      await expect(popup.locator('[data-field="eco"]')).toBeAttached();
      await expect(popup.locator('[data-field="price"]')).toBeAttached();
      await expect(popup.locator('[data-action="open-route-helper-shortcut"]')).toBeAttached();
      await expect(page.locator('#settlementGasEditPanel, #settlementGasEditModal')).toHaveCount(0);

      if (config.width <= 390) {
        const dialogBox = await page.locator('#settlementCarEditModal').evaluate(node => node.shadowRoot?.querySelector('[part="dialog"]')?.getBoundingClientRect() || node.getBoundingClientRect());
        expect(dialogBox.width).toBeLessThan(config.width);
        expect(dialogBox.height).toBeLessThan(config.height);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Settlement rental and dismissal regression', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Times rental shows movement fee then editable time fee with fixed names', async ({ page }) => {
    await seedSettlement(page);
    let popup = await openMovementSettings(page);
    const rental = popup.locator('[data-field="rentalType"]');
    await rental.locator('cds-radio-button[value="times"]').click();

    popup = page.locator('#settlementCarEditModal .seisan-gas-settings-surface');
    await expect(popup).toBeVisible();
    await expect(popup.locator('[data-field="rentalType"]')).toHaveJSProperty('value', 'times');
    await expect(popup.locator('[data-field="dist"]')).toBeAttached();
    await expect(popup.locator('[data-field="eco"]')).toHaveCount(0);
    await expect(popup.locator('[data-field="price"]')).toHaveCount(0);

    const rows = page.locator('#settlementCarEditModal .seisan-cost-edit-row');
    const movementName = rows.first().locator('.seisan-extra-field--name cds-text-input');
    await expect(movementName).toHaveJSProperty('value', 'タイムズ移動料金');
    await expect(movementName).toHaveAttribute('readonly', '');

    const timeRow = page.locator('#settlementCarEditModal .seisan-extra-row--times-time');
    await expect(timeRow.locator('[data-extra-field="name"]')).toHaveJSProperty('value', 'タイムズ時間料金');
    await expect(timeRow.locator('[data-extra-field="name"]')).toHaveAttribute('readonly', '');
    await expect(timeRow.locator('[data-extra-field="amount"]')).not.toHaveAttribute('readonly', '');
  });

  test('closing movement settings and vehicle editor leaves no modal residue', async ({ page }) => {
    await seedSettlement(page);
    const popup = await openMovementSettings(page);
    await popup.locator('[data-action="close-settlement-gas-settings"]').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal cds-popover.seisan-gas-settings-popover')).toHaveJSProperty('open', false);

    await page.locator('#settlementCarEditModal cds-modal-close-button').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => ({
      modalOpen: document.querySelectorAll('.app-modal[open]').length,
      bodyLocked: document.body.classList.contains('app-modal-open')
    }))).toEqual({ modalOpen: 0, bodyLocked: false });

    await expect(page.locator('#seisan-view-area')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight >= document.documentElement.clientHeight)).toBeTruthy();
  });
});

test.describe('Canonical share link', () => {
  test.use({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });

  test('header link copies one URL directly and never opens a copy modal', async ({ page, context }) => {
    const room = `SHARE-${Date.now()}`;
    await page.goto(`/?room=${room}`);
    await page.waitForFunction(() => typeof window.copyUrl === 'function');
    await page.locator('#shareLinkBtn').evaluate(node => node.click());
    await expect(page.locator('.app-status-toast')).toContainText('リンクをコピーしました');
    await expect(page.locator('#copy-fallback')).toHaveCount(0);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copied);
    expect(url.searchParams.get('room')).toBe(room);
    expect(url.searchParams.get('view')).toBe('sheet');

    const shared = await context.newPage();
    await shared.goto(copied);
    await shared.waitForFunction(() => document.body.classList.contains('view-mode-sheet'));
    await expect(shared.locator('body')).toHaveClass(/view-mode-sheet/);
  });
});
