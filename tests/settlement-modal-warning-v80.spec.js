import { test, expect } from '@playwright/test';

test.describe('Settlement field validation v80', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  async function seedMissingSettlementCosts(page) {
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-modal') && customElements.get('cds-actionable-notification'));
    await page.evaluate(() => window.executeDebugMissingCostMode?.());
    await page.waitForTimeout(250);
    await page.locator('#tab-seisan').evaluate(node => node.click());
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
    await expect(page.locator('#seisan-car-list .seisan-car-issue')).toHaveCount(3);
  }

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

  test('multiple car warnings stay passive across settlement rerenders', async ({ page }) => {
    await seedMissingSettlementCosts(page);

    const before = await page.evaluate(() => {
      const layout = document.querySelector('#app-layout');
      layout.scrollTop = Math.min(180, Math.max(0, layout.scrollHeight - layout.clientHeight));
      const trace = { focus: 0, scrollIntoView: 0 };
      const originalFocus = HTMLElement.prototype.focus;
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      HTMLElement.prototype.focus = function focus(options) {
        if (this.closest?.('.seisan-car-issue')) trace.focus += 1;
        return originalFocus.call(this, options);
      };
      Element.prototype.scrollIntoView = function scrollIntoView(options) {
        if (this.closest?.('.seisan-car-issue')) trace.scrollIntoView += 1;
        return originalScrollIntoView.call(this, options);
      };
      window.__settlementWarningScrollTrace = { trace, layout, originalFocus, originalScrollIntoView };
      return layout.scrollTop;
    });

    await page.evaluate(() => {
      window.renderSettlementView?.();
      window.renderSettlementView?.();
    });
    await page.waitForTimeout(180);

    const after = await page.evaluate(() => {
      const { trace, layout, originalFocus, originalScrollIntoView } = window.__settlementWarningScrollTrace;
      HTMLElement.prototype.focus = originalFocus;
      Element.prototype.scrollIntoView = originalScrollIntoView;
      return {
        ...trace,
        scrollTop: layout.scrollTop,
        notificationFocus: [...document.querySelectorAll('#seisan-car-list .seisan-car-issue')].map(node => node.hasFocus)
      };
    });

    expect(after.focus).toBe(0);
    expect(after.scrollIntoView).toBe(0);
    expect(after.scrollTop).toBe(before);
    expect(after.notificationFocus).toEqual([false, false, false]);
  });

  test('save validation moves to only the first invalid field once', async ({ page }) => {
    await seedMissingSettlementCosts(page);
    await page.locator('[data-action="open-settlement-car-edit"]').first().evaluate(node => node.click());
    const modal = page.locator('#settlementCarEditModal');
    await expect(modal).toHaveJSProperty('open', true);

    await page.evaluate(() => {
      const trace = { focus: 0, invalidFocus: 0, invalidFocusOptions: [], scrollIntoView: 0 };
      const originalFocus = HTMLElement.prototype.focus;
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      const invalidHostFor = node => {
        let current = node;
        while (current) {
          if (current.matches?.('#settlementCarEditBody [invalid]')) return current;
          current = current.parentNode || current.getRootNode?.().host || null;
        }
        return null;
      };
      HTMLElement.prototype.focus = function focus(options) {
        trace.focus += 1;
        if (invalidHostFor(this)) {
          trace.invalidFocus += 1;
          trace.invalidFocusOptions.push(options || null);
        }
        return originalFocus.call(this, options);
      };
      Element.prototype.scrollIntoView = function scrollIntoView(options) {
        trace.scrollIntoView += 1;
        return originalScrollIntoView.call(this, options);
      };
      window.__settlementValidationScrollTrace = { trace, originalFocus, originalScrollIntoView };
    });

    await page.locator('#saveSettlementCarEditBtn').evaluate(node => node.click());
    await page.waitForTimeout(180);
    const after = await page.evaluate(() => {
      const { trace, originalFocus, originalScrollIntoView } = window.__settlementValidationScrollTrace;
      HTMLElement.prototype.focus = originalFocus;
      Element.prototype.scrollIntoView = originalScrollIntoView;
      return trace;
    });

    expect(after.scrollIntoView).toBe(1);
    expect(after.invalidFocus).toBe(1);
    expect(after.invalidFocusOptions).toEqual([{ preventScroll: true }]);
    await expect(modal).toHaveJSProperty('open', true);
  });
});
