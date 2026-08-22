import { test, expect } from '@playwright/test';

test.describe('Settlement field validation v80', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('invalid added cost stays in the modal and uses Carbon field-level validation only', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));

    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-modal') && customElements.get('cds-text-input'));
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
    await expect(modal.locator('.seisan-car-edit-alert')).toHaveCount(0);

    const pending = modal.locator('[data-extra-pending="true"]');
    const name = pending.locator('[data-extra-field="name"]');
    const amount = pending.locator('[data-extra-field="amount"]');
    await expect(name).toHaveAttribute('invalid', '');
    await expect(name).toHaveAttribute('invalid-text', '名目を入力してください');
    await expect(amount).toHaveAttribute('invalid', '');
    await expect(amount).toHaveAttribute('invalid-text', '金額を入力してください');

    await name.evaluate(host => {
      host.value = '駐車場';
      host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await page.locator('#saveSettlementCarEditBtn').evaluate(node => node.click());

    const updatedPending = modal.locator('[data-extra-pending="true"]');
    await expect(updatedPending.locator('[data-extra-field="name"]')).not.toHaveAttribute('invalid', '');
    await expect(updatedPending.locator('[data-extra-field="amount"]')).toHaveAttribute('invalid', '');
    await expect(updatedPending.locator('[data-extra-field="amount"]')).toHaveAttribute('invalid-text', '金額を入力してください');
    await expect(modal.locator('.seisan-car-edit-alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
