import { test, expect } from '@playwright/test';

test.describe('Settlement field validation v80', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('new expense stays neutral until save, then uses Carbon field-level validation', async ({ page }) => {
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

    const pending = modal.locator('[data-extra-pending="true"]');
    await expect(pending).toHaveCount(1);
    const name = pending.locator('[data-extra-field="name"]');
    const amount = pending.locator('[data-extra-field="amount"]');

    // A newly-added row is still being edited. Carbon invalid state should not
    // appear until the user attempts to save the incomplete form.
    await expect(name).not.toHaveAttribute('invalid', '');
    await expect(name).not.toHaveAttribute('invalid-text', '名目を入力してください');
    await expect(amount).not.toHaveAttribute('invalid', '');
    await expect(amount).not.toHaveAttribute('invalid-text', '金額を入力してください');

    await page.locator('#saveSettlementCarEditBtn').evaluate(node => node.click());

    await expect(modal).toHaveJSProperty('open', true);
    await expect(modal.locator('.seisan-car-edit-alert')).toHaveCount(0);

    const validatedPending = modal.locator('[data-extra-pending="true"]');
    const validatedName = validatedPending.locator('[data-extra-field="name"]');
    const validatedAmount = validatedPending.locator('[data-extra-field="amount"]');
    await expect(validatedName).toHaveAttribute('invalid', '');
    await expect(validatedName).toHaveAttribute('invalid-text', '名目を入力してください');
    await expect(validatedAmount).toHaveAttribute('invalid', '');
    await expect(validatedAmount).toHaveAttribute('invalid-text', '金額を入力してください');

    await validatedName.evaluate(host => {
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
