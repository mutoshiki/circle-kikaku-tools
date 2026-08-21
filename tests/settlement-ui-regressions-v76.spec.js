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

async function setProjectTitleCollapsed(page) {
  const region = page.locator('#projectTitleRegion');
  await expect(region).toHaveAttribute('data-state', 'expanded');
  await page.dispatchEvent('#seisan-view-area', 'pointerdown', { pointerType: 'touch', clientY: 220, pointerId: 51, isPrimary: true });
  await page.dispatchEvent('#seisan-view-area', 'pointermove', { pointerType: 'touch', clientY: 170, pointerId: 51, isPrimary: true });
  await page.dispatchEvent('#seisan-view-area', 'pointerup', { pointerType: 'touch', clientY: 170, pointerId: 51, isPrimary: true });
  await expect(region).toHaveAttribute('data-state', 'collapsed');
  await expect.poll(() => region.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
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

  test('distance, fuel economy and gas unit price use the same numeric keyboard contract', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);
    await page.locator('#settlementCarEditModal [data-action="open-settlement-gas-settings"]').evaluate(node => node.click());

    const modal = page.locator('body > #settlementGasEditModal');
    await expect(modal).toHaveJSProperty('open', true);
    for (const field of ['dist', 'eco', 'price']) {
      const input = modal.locator(`[data-field="${field}"]`);
      await expect(input).toHaveAttribute('type', 'text');
      await expect(input).toHaveAttribute('inputmode', 'numeric');
      await expect(input).toHaveAttribute('pattern', '[0-9]*');
      await expect(input).toHaveAttribute('maxlength', '4');
    }
    await expect(modal.locator('cds-modal-footer-button[data-modal-close]')).toHaveText('完了');
    await expect(modal).not.toContainText('費用編集に戻る');
  });

  test('settlement editor preserves project-title reveal state through input and modal scrolling', async ({ page }) => {
    await seedSettlement(page);
    await setProjectTitleCollapsed(page);

    const before = await page.evaluate(() => ({
      titleState: document.querySelector('#projectTitleRegion')?.dataset.state,
      headerTop: document.querySelector('#app-header')?.getBoundingClientRect().top,
      navTop: document.querySelector('#app-view-navigation')?.getBoundingClientRect().top,
      settlementTop: document.querySelector('#seisan-view-area')?.getBoundingClientRect().top,
      settlementScrollTop: document.querySelector('#seisan-view-area')?.scrollTop,
      windowScrollY: window.scrollY
    }));
    await openFirstCarEditor(page);

    const amount = page.locator('#settlementCarEditModal .seisan-extra-row [data-extra-field="amount"]').first();
    await amount.evaluate(node => {
      node.value = '777';
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });

    const modalBody = page.locator('#settlementCarEditModal > cds-modal-body.app-modal-body');
    await modalBody.dispatchEvent('pointerdown', { pointerType: 'touch', clientY: 260, pointerId: 61, isPrimary: true });
    await modalBody.dispatchEvent('pointermove', { pointerType: 'touch', clientY: 330, pointerId: 61, isPrimary: true });
    await modalBody.dispatchEvent('pointerup', { pointerType: 'touch', clientY: 330, pointerId: 61, isPrimary: true });
    await modalBody.dispatchEvent('wheel', { deltaY: -120 });
    await page.evaluate(() => {
      const settlement = document.querySelector('#seisan-view-area');
      if (settlement) settlement.scrollTop += 40;
    });
    await page.waitForTimeout(50);
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');

    await page.locator('#settlementCarEditModal > cds-modal-header > cds-modal-close-button').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({
      titleState: document.querySelector('#projectTitleRegion')?.dataset.state,
      headerTop: document.querySelector('#app-header')?.getBoundingClientRect().top,
      navTop: document.querySelector('#app-view-navigation')?.getBoundingClientRect().top,
      settlementTop: document.querySelector('#seisan-view-area')?.getBoundingClientRect().top,
      settlementScrollTop: document.querySelector('#seisan-view-area')?.scrollTop,
      windowScrollY: window.scrollY
    }));
    expect(after).toEqual(before);

    await page.dispatchEvent('#seisan-view-area', 'pointerdown', { pointerType: 'touch', clientY: 150, pointerId: 62, isPrimary: true });
    await page.dispatchEvent('#seisan-view-area', 'pointermove', { pointerType: 'touch', clientY: 205, pointerId: 62, isPrimary: true });
    await page.dispatchEvent('#seisan-view-area', 'pointerup', { pointerType: 'touch', clientY: 205, pointerId: 62, isPrimary: true });
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');
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
