import { test, expect } from '@playwright/test';

test.describe('Settlement modal warning v80', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('invalid added cost shows a visible Carbon warning inside the open vehicle editor', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));

    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-modal') && customElements.get('cds-inline-notification'));
    await page.evaluate(() => window.executeDebugMode?.());
    await page.waitForTimeout(250);
    await page.evaluate(() => window.switchView('seisan'));
    await page.waitForTimeout(150);

    const edit = page.locator('[data-action="open-settlement-car-edit"]').first();
    await expect(edit).toBeAttached();
    await edit.evaluate(node => node.click());

    const modal = page.locator('#settlementCarEditModal');
    await expect(modal).toHaveJSProperty('open', true);
    await modal.locator('[data-action="add-settlement-extra"]').evaluate(node => node.click());
    await expect(modal.locator('[data-extra-pending="true"]')).toHaveCount(1);

    await page.locator('#saveSettlementCarEditBtn').evaluate(node => node.click());

    await expect(modal).toHaveJSProperty('open', true);
    const warning = modal.locator('.seisan-car-edit-alert cds-inline-notification');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('kind', 'error');
    await expect(warning.locator('[slot="title"]')).toHaveText('入力内容を確認してください');
    await expect(warning.locator('[slot="subtitle"]')).toContainText('追加した諸経費が未入力です');
    expect(errors).toEqual([]);
  });
});
