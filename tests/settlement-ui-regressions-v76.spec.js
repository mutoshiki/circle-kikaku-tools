import { test, expect } from '@playwright/test';

async function waitForCarbon(page) {
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-toggle'));
}

async function seedSettlement(page) {
  await page.goto('/');
  await waitForCarbon(page);
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.locator('#tab-seisan').evaluate(node => node.click());
  await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
}

async function openFirstCarEditor(page) {
  const edit = page.locator('[data-action="open-settlement-car-edit"]').first();
  await expect(edit).toBeVisible();
  await edit.evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
}

test.describe('Settlement UI regressions v76', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('active page survives refresh instead of returning to car allocation', async ({ page }) => {
    await page.goto('/');
    await waitForCarbon(page);

    await page.locator('#tab-seisan').evaluate(node => node.click());
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('seisan');
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
    await expect(page.locator('#seisan-view-area')).toBeVisible();

    await page.locator('#tab-sheet').evaluate(node => node.click());
    await page.waitForFunction(() => document.body.classList.contains('view-mode-sheet'));
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('sheet');
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('view-mode-sheet'));
    await expect(page.locator('#sheet-view-area')).toBeVisible();
  });

  test('driver editor input can close without leaving the settlement page in a broken state', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);

    const amount = page.locator('#settlementCarEditModal .seisan-extra-row [data-extra-field="amount"]').first();
    await expect(amount).toBeAttached();
    await amount.evaluate(node => {
      node.value = '432';
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await page.locator('#settlementCarEditModal > cds-modal-header > cds-modal-close-button').evaluate(node => node.click());

    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => ({
      modalOpen: document.querySelectorAll('.app-modal[open]').length,
      bodyLocked: document.body.classList.contains('app-modal-open'),
      editingLock: typeof settlementEditingLock === 'boolean' ? settlementEditingLock : null,
      renderDeferred: typeof settlementRenderDeferred === 'boolean' ? settlementRenderDeferred : null
    }))).toEqual({ modalOpen: 0, bodyLocked: false, editingLock: false, renderDeferred: false });
    await expect(page.locator('#seisan-settings-summary')).toBeVisible();
    await expect(page.locator('#seisan-car-list .seisan-car-summary-row').first()).toBeVisible();
    await expect(page.locator('#seisan-collection-list')).toBeVisible();
  });

  test('gas unit price uses numeric keyboard contract and movement settings finishes with 完了', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);
    await page.locator('#settlementCarEditModal [data-action="open-settlement-gas-settings"]').evaluate(node => node.click());

    const modal = page.locator('body > #settlementGasEditModal');
    await expect(modal).toHaveJSProperty('open', true);
    const price = modal.locator('[data-field="price"]');
    await expect(price).toHaveAttribute('type', 'text');
    await expect(price).toHaveAttribute('inputmode', 'numeric');
    await expect(price).toHaveAttribute('pattern', '[0-9]*');
    await expect(modal.locator('cds-modal-footer-button[data-modal-close]')).toHaveText('完了');
    await expect(modal).not.toContainText('費用編集に戻る');
  });

  test('modal scroll gestures do not reveal the project title behind the popup', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);
    await page.evaluate(() => {
      const region = document.querySelector('#projectTitleRegion');
      if (region) region.dataset.state = 'collapsed';
    });

    await page.locator('#settlementCarEditModal').dispatchEvent('wheel', { deltaY: -120 });
    await page.locator('#settlementCarEditModal').dispatchEvent('pointerdown', { pointerType: 'touch', clientY: 300 });
    await page.locator('#settlementCarEditModal').dispatchEvent('pointermove', { pointerType: 'touch', clientY: 360 });
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');
  });

  test('driver payment headline is one aligned row and positive amounts have no plus sign', async ({ page }) => {
    await seedSettlement(page);
    const headline = page.locator('#seisan-car-list .seisan-car-summary-headline').first();
    const alignment = await headline.evaluate(node => {
      const name = node.querySelector('.seisan-car-summary-name')?.getBoundingClientRect();
      const toggle = node.querySelector('.seisan-car-payment-toggle')?.getBoundingClientRect();
      const edit = node.querySelector('.seisan-edit-btn')?.getBoundingClientRect();
      const center = box => box ? (box.top + box.bottom) / 2 : null;
      return { name: center(name), toggle: center(toggle), edit: center(edit) };
    });
    expect(Math.max(alignment.name, alignment.toggle, alignment.edit) - Math.min(alignment.name, alignment.toggle, alignment.edit)).toBeLessThanOrEqual(4);

    const visibleSigns = await page.locator('#seisan-car-list .seisan-amount-sign:not(.is-blank)').allTextContents();
    expect(visibleSigns.every(sign => sign.trim() === '−')).toBeTruthy();
    expect(await page.locator('#seisan-car-list').textContent()).not.toContain('＋');
  });

  test('collection rows show collection amounts and obsolete settlement cards are absent', async ({ page }) => {
    await seedSettlement(page);
    await expect(page.locator('#seisan-summary')).toHaveCount(0);
    await expect(page.locator('#seisan-share-preview')).toHaveCount(0);
    await expect(page.locator('#seisan-collection-list .seisan-check-note').first()).toBeVisible();
    const notes = await page.locator('#seisan-collection-list .seisan-check-note').allTextContents();
    expect(notes.some(note => note.includes('集金する金額') || note.includes('対象外') || note.includes('差し引き済み'))).toBeTruthy();
    expect(notes.some(note => /(?:対象外|差し引き済み).*¥0/.test(note))).toBeTruthy();
    expect(notes.every(note => !/車$/.test(note.trim()))).toBeTruthy();
  });
});
