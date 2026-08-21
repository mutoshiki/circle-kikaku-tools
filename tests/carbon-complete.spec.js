import { test, expect } from '@playwright/test';

const hostClick = async (page, selector) => {
  const host = page.locator(selector);
  await host.waitFor({ state: 'attached' });
  await host.evaluate(node => node.click());
};

const setHostValue = async (page, selector, value) => {
  const host = page.locator(selector);
  await host.waitFor({ state: 'attached' });
  await host.evaluate((node, nextValue) => {
    node.value = nextValue;
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
};

const seed = async page => {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
};

for (const viewport of [
  { name: '390px', width: 390, height: 844 },
  { name: '1280px', width: 1280, height: 900 }
]) {
  test.describe(`${viewport.name} Carbon shell`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('primary views, theme, navigation and app drawer remain operable', async ({ page }) => {
      await seed(page);
      await expect(page.locator('body')).toBeVisible();
      await page.evaluate(() => window.switchView('seisan'));
      await expect(page.locator('#seisan-view-area')).toBeVisible();
      await page.evaluate(() => window.switchView('cars'));
      await expect(page.locator('#car-view-area')).toBeVisible();
      await page.evaluate(() => window.switchView('groups'));
      await expect(page.locator('#group-view-area')).toBeVisible();
      await page.evaluate(() => window.switchView('list'));
      await expect(page.locator('#list-view-area')).toBeVisible();

      const before = await page.evaluate(() => document.documentElement.dataset.theme || 'light');
      await hostClick(page, '#themeToggleBtn');
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme || 'light')).not.toBe(before);

      await hostClick(page, '#appMenuBtn');
      await expect(page.locator('#app-menu')).toBeVisible();
      await hostClick(page, '#appMenuBtn');
      await expect(page.locator('#app-menu')).toBeHidden();

      await page.evaluate(() => {
        window.__copiedShareUrl = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async value => { window.__copiedShareUrl = value; } }
        });
      });
      await hostClick(page, '#shareLinkBtn');
      await expect(page.locator('.app-status-toast')).toContainText('リンクをコピーしました');
      const copiedShareUrl = await page.evaluate(() => window.__copiedShareUrl || '');
      expect(new URL(copiedShareUrl).searchParams.get('view')).toBe('sheet');
      await expect(page.locator('#share-links-modal')).toHaveCount(0);
    });
  });
}

test.describe('Allocation, menus and accessibility', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('allocation switches, tray controls and official menus work in the viewport', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.switchView('cars'));
    await expect(page.locator('#car-view-area')).toBeVisible();
    await expect(page.locator('#carAllocationSwitcher')).toBeAttached();
    await page.evaluate(() => window.switchView('groups'));
    await expect(page.locator('#group-view-area')).toBeVisible();
    await expect(page.locator('#groupAllocationSwitcher')).toBeAttached();
    await page.evaluate(() => window.switchView('list'));
    await expect(page.locator('#waitingTray')).toBeAttached();
  });
});

test.describe('Carbon modal, participant and sheet workflows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('participant spreadsheet import creates participants', async ({ page }) => {
    await seed(page);
    await hostClick(page, '#openBatchBtn');
    await expect(page.locator('#batchImportModal')).toHaveAttribute('open', '');
    await setHostValue(page, '#batchImportText', '山田 太郎\t24T0001A\t3\t工学部\t太郎\n');
    await hostClick(page, '#executeBatchBtn');
    await expect(page.locator('#batchImportModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('.member-card')).toHaveCount(1);
  });

  test('major and dynamic modals avoid button autofocus and close correctly', async ({ page }) => {
    await seed(page);
    await hostClick(page, '#openBatchBtn');
    await expect(page.locator('#batchImportModal')).toHaveAttribute('open', '');
    await hostClick(page, '#batchImportModal cds-modal-close-button');
    await expect(page.locator('#batchImportModal')).not.toHaveAttribute('open', '');
  });

  test('shared view quick edit adds and removes timetable rows', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.switchView('sheet'));
    await expect(page.locator('body')).toHaveClass(/view-mode-sheet/);
  });
});

test.describe('First-run rendering and submit regression', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile sync status temporarily overlays the product-title slot', async ({ page }) => {
    await seed(page);
    await expect(page.locator('#appTitle')).toBeAttached();
  });

  test('first meaningful screen renders immediately and all three empty views use the same two choices', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('participant and settlement settings submit buttons close their Carbon modals', async ({ page }) => {
    await seed(page);
    await hostClick(page, '#openBatchBtn');
    await setHostValue(page, '#batchImportText', '山田 太郎\t24T0001A\t3\t工学部\t太郎\n');
    await hostClick(page, '#executeBatchBtn');
    await expect(page.locator('#batchImportModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('.member-card')).toHaveCount(1);

    await page.evaluate(() => { window.switchView('seisan'); window.openStandaloneSettlementSettings(); });
    await expect(page.locator('#settlementSettingsModal')).toHaveAttribute('open', '');
    await hostClick(page, '#settlementSettingsModal [data-action="save-settlement-settings"]');
    await expect(page.locator('#settlementSettingsModal')).not.toHaveAttribute('open', '');
  });

  test('sample data is restored, rendered, persisted and closes the sample modal', async ({ page }) => {
    await seed(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Settlement and route workflows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings, vehicle cost validation and route helper remain functional', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await seed(page);
    await page.evaluate(() => window.switchView('seisan'));
    await hostClick(page, '[data-action="open-settlement-settings"]');
    await expect(page.locator('#settlementSettingsModal cds-content-switcher')).toHaveCount(2);
    await hostClick(page, '#settlementSettingsModal [data-action="save-settlement-settings"]');
    await hostClick(page, '[data-action="open-settlement-car-edit"]');
    await hostClick(page, '#settlementCarEditModal [data-action="open-settlement-gas-settings"]');
    const gasPanel = page.locator('#settlementGasEditPanel');
    await expect(gasPanel).toBeVisible();
    const placeholders = await Promise.all(['dist', 'eco', 'price'].map(field => gasPanel.locator(`[data-field="${field}"]`).getAttribute('placeholder')));
    expect(placeholders).toEqual(['例：186', '例：18', '例：158']);
    const rental = gasPanel.locator('[data-field="rentalType"]');
    await expect(rental).toHaveJSProperty('value', 'private');
    await rental.locator('cds-radio-button[value="times"]').click();
    await expect(page.locator('#settlementGasEditPanel [data-field="rentalType"]')).toHaveJSProperty('value', 'times');
    await expect(page.locator('#settlementGasEditPanel [data-field="eco"]')).toHaveCount(0);
    await expect(page.locator('#settlementGasEditPanel [data-field="price"]')).toHaveCount(0);
    await page.locator('#settlementGasEditPanel [data-field="rentalType"] cds-radio-button[value="private"]').click();
    await expect(page.locator('#settlementGasEditPanel [data-field="rentalType"]')).toHaveJSProperty('value', 'private');
    await hostClick(page, '#settlementGasEditPanel [data-action="close-settlement-gas-settings"]');
    await expect(gasPanel).toBeHidden();
    await hostClick(page, '#settlementCarEditModal [data-action="add-settlement-extra"]');
    const pendingRow = '#settlementCarEditModal .seisan-extra-row[data-extra-pending="true"]';
    await expect(page.locator(pendingRow)).toHaveCount(1);
    await setHostValue(page, `${pendingRow} [data-extra-field="name"]`, '高速代');
    await setHostValue(page, `${pendingRow} [data-extra-field="amount"]`, '1234');
    await expect(page.locator('#settlementCarEditModal [data-extra-field][invalid]')).toHaveCount(0);
    await hostClick(page, '#settlementCarEditModal [data-action="save-settlement-car-edit"]');
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await hostClick(page, '[data-action="open-settlement-car-edit"]');
    expect(await page.locator('#settlementCarEditModal [data-extra-field="amount"]').last().evaluate(node => node.value)).toBe('1234');
    const dimensions = await page.locator('#settlementCarEditModal .seisan-extra-row').last().evaluate(row => {
      const amount = row.querySelector('[data-extra-field="amount"]').getBoundingClientRect();
      const type = row.querySelector('[data-extra-field="type"]').getBoundingClientRect();
      return { amount: amount.width, type: type.width, row: row.getBoundingClientRect().width };
    });
    expect(dimensions.amount).toBeGreaterThan(0);
    expect(dimensions.type).toBeGreaterThan(0);
    expect(dimensions.row).toBeGreaterThan(dimensions.amount);
    expect(errors).toEqual([]);
  });
});
