import { test, expect } from '@playwright/test';

test('main views and Carbon shell remain operational', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button'));
  await page.evaluate(() => window.executeDebugMode?.());
  for (const view of ['list','sheet','seisan']) {
    await page.evaluate(next => window.switchView(next), view);
    await expect(page.locator('#app-view-navigation')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
  }
  await page.evaluate(() => window.switchView('list'));
  await page.locator('#bottom-tray').evaluate(node => { node.style.display = ''; });
  await page.locator('.tray-settings-dropdown cds-overflow-menu').evaluate(node => node.shadowRoot?.querySelector('button')?.click());
  await expect(page.locator('.tray-settings-dropdown cds-overflow-menu')).toHaveJSProperty('open', true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tray-settings-dropdown cds-overflow-menu')).toHaveJSProperty('open', false);
  expect(errors).toEqual([]);
});

test('major settlement modals open and close', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-modal'));
  await page.evaluate(() => { window.executeDebugMode?.(); window.switchView('seisan'); });
  await page.locator('[data-action="open-settlement-car-edit"]').first().evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open','');
  await page.locator('#settlementCarEditModal cds-modal-close-button').evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open','');
  await page.evaluate(() => window.openSettlementSettings?.());
  await expect(page.locator('#settlementSettingsModal')).toHaveAttribute('open','');
});
