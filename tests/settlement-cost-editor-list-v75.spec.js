import { test, expect } from '@playwright/test';

async function seedSettlement(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-toggle'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.switchView('seisan'));
  await page.waitForTimeout(150);
  const edit = page.locator('[data-action="open-settlement-car-edit"]').first();
  await expect(edit).toBeAttached();
  await edit.evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
}

for (const config of [
  { name: 'mobile light', width: 390, height: 844, dark: false },
  { name: 'mobile dark', width: 390, height: 844, dark: true },
  { name: 'desktop light', width: 1280, height: 900, dark: false },
  { name: 'desktop dark', width: 1280, height: 900, dark: true }
]) {
  test.describe(config.name, () => {
    test.use({ viewport: { width: config.width, height: config.height }, hasTouch: config.width <= 390 });

    test('cost rows stay aligned and gasoline settings remain operable', async ({ page }) => {
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
      const cells = row.locator(':scope > *');
      await expect(cells).toHaveCount(4);
      const boxes = await cells.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).map(box => ({ top: box.top, bottom: box.bottom })));
      expect(Math.max(...boxes.map(box => box.top)) - Math.min(...boxes.map(box => box.top))).toBeLessThan(12);

      const settings = row.locator('[data-action="open-settlement-gas-settings"]');
      await settings.evaluate(node => node.click());
      const gasModal = page.locator('#settlementGasEditModal');
      await expect(gasModal).toHaveJSProperty('open', true);
      await expect(gasModal.locator('[data-field="rentalType"]')).toBeAttached();
      await expect(gasModal.locator('[data-field="dist"]')).toBeAttached();
      await expect(gasModal.locator('[data-field="eco"]')).toBeAttached();
      await expect(gasModal.locator('[data-field="price"]')).toBeAttached();
      await expect(gasModal.locator('[data-action="open-route-helper-shortcut"]')).toBeAttached();

      const toggle = page.locator('#settlementCarEditModal cds-toggle[data-extra-field="type"]').first();
      const before = await toggle.evaluate(node => node.value);
      await toggle.evaluate(node => {
        const next = !node.toggled;
        node.toggled = next;
        node.dispatchEvent(new CustomEvent('cds-toggle-changed', { bubbles: true, composed: true, detail: { toggled: next } }));
      });
      const after = await toggle.evaluate(node => node.value);
      expect(after).not.toBe(before);
      expect(['split', 'club', 'split-minus', 'club-minus']).toContain(after);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
      expect(errors).toEqual([]);
    });
  });
}
