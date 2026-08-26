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

async function openMovementSettings(page) {
  await page.locator('#settlementCarEditModal [data-action="open-settlement-gas-settings"]').evaluate(node => node.click());
  const modal = page.locator('body > #settlementGasEditModal');
  await expect(modal).toHaveCount(1);
  await expect(modal).toHaveJSProperty('open', true);
  await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
  return modal;
}

async function closeMovementSettings(page) {
  const modal = page.locator('body > #settlementGasEditModal');
  await modal.locator('cds-modal-footer-button[data-modal-close]').evaluate(node => node.click());
  await expect(modal).toHaveCount(0);
  await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
}

async function setCarbonTextValue(locator, value) {
  await locator.evaluate((node, next) => {
    node.value = next;
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
}

async function settlementViewport(page) {
  return page.evaluate(() => ({
    titleState: document.querySelector('#projectTitleRegion')?.dataset.state,
    appScrollTop: Math.round(document.querySelector('#app-layout')?.scrollTop || 0),
    documentTop: Math.round(document.scrollingElement?.scrollTop || 0),
    windowScrollY: Math.round(window.scrollY || 0),
    seisanTop: Math.round(document.querySelector('#seisan-view-area')?.getBoundingClientRect().top || 0)
  }));
}

async function confirmDecision(page) {
  const modal = page.locator('#appConfirmModal');
  await expect(modal).toHaveJSProperty('open', true);
  await modal.locator('[data-role="ok"]').evaluate(node => node.click());
  await expect(modal).not.toHaveAttribute('open', '');
}

test.describe('Settlement UI regressions v76', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('settlement remains a normal fourth destination and survives refresh', async ({ page }) => {
    await page.goto('/');
    await waitForCarbon(page);
    await page.waitForFunction(() => document.querySelectorAll('#view-toggle-bar > cds-tab').length === 4);
    await expect(page.locator('#view-toggle-bar > cds-tab')).toHaveCount(4);
    await expect(page.locator('#tab-sheet')).toHaveCount(0);

    await page.locator('#tab-seisan').evaluate(node => node.click());
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('seisan');
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));
    await expect(page.locator('#seisan-view-area')).toBeVisible();
    await expect(page.locator('#tab-seisan')).toHaveAttribute('aria-current', 'page');
  });

  test('mobile settlement uses the app layout as its natural scroll owner', async ({ page }) => {
    await seedSettlement(page);
    const ownership = await page.evaluate(() => ({
      appOverflow: getComputedStyle(document.querySelector('#app-layout')).overflowY,
      seisanOverflow: getComputedStyle(document.querySelector('#seisan-view-area')).overflowY,
      revealBound: document.documentElement.dataset.projectTitleRevealBound,
      titleState: document.querySelector('#projectTitleRegion')?.dataset.state
    }));
    expect(ownership.appOverflow).toBe('auto');
    expect(ownership.seisanOverflow).toBe('visible');
    expect(ownership.revealBound).toBe('true');
    expect(ownership.titleState).toBe('expanded');

    await page.evaluate(() => {
      const layout = document.querySelector('#app-layout');
      layout.scrollTop = Math.min(180, Math.max(0, layout.scrollHeight - layout.clientHeight));
    });
    const after = await settlementViewport(page);
    expect(after.appScrollTop).toBeGreaterThanOrEqual(0);
    expect(after.documentTop).toBe(0);
    expect(after.windowScrollY).toBe(0);
  });

  test('driver editor input can close without leaving the settlement page in a broken state', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);

    const amount = page.locator('#settlementCarEditModal .seisan-extra-list .seisan-extra-row [data-extra-field="amount"]').first();
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

  test('explicit car-cost save commits and closes the editor', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);

    const amount = page.locator('#settlementCarEditModal .seisan-extra-list .seisan-extra-row [data-extra-field="amount"]').first();
    await amount.evaluate(node => {
      node.value = '433';
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await page.locator('#saveSettlementCarEditBtn').click();

    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('#seisan-car-list .seisan-car-summary-row').first()).toBeVisible();
    await expect(page.locator('#seisan-car-list')).toContainText('433');
  });

  test('distance, fuel economy and gas unit price use the same numeric keyboard contract', async ({ page }) => {
    await seedSettlement(page);
    await openFirstCarEditor(page);
    const modal = await openMovementSettings(page);

    for (const field of ['dist', 'eco', 'price']) {
      const input = modal.locator(`[data-field="${field}"]`);
      await expect(input).toHaveAttribute('type', 'text');
      await expect(input).toHaveAttribute('inputmode', 'numeric');
      await expect(input).toHaveAttribute('pattern', '[0-9]*');
      await expect(input).toHaveAttribute('maxlength', '4');
    }
    await expect(modal.locator('cds-modal-footer-button[data-modal-close]')).toHaveText('完了');
    await expect(modal).not.toContainText('費用編集に戻る');
    await closeMovementSettings(page);
  });

  test('nested movement editor returns to settlement without changing the natural page structure', async ({ page }) => {
    await seedSettlement(page);
    await page.evaluate(() => {
      const layout = document.querySelector('#app-layout');
      layout.scrollTop = Math.min(120, Math.max(0, layout.scrollHeight - layout.clientHeight));
    });
    const before = await settlementViewport(page);

    await openFirstCarEditor(page);
    const movementModal = await openMovementSettings(page);
    await setCarbonTextValue(movementModal.locator('[data-field="dist"]'), '186');
    await setCarbonTextValue(movementModal.locator('[data-field="eco"]'), '18');
    await setCarbonTextValue(movementModal.locator('[data-field="price"]'), '158');
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    await closeMovementSettings(page);

    await expect(page.locator('#settlementCarEditModal .seisan-gas-cost-row [data-extra-field="amount"]')).not.toHaveJSProperty('value', '');
    await page.locator('#settlementCarEditModal > cds-modal-header > cds-modal-close-button').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');
    await expect(page.locator('#seisan-settings-summary')).toBeVisible();
    const after = await settlementViewport(page);
    expect(Math.abs(after.appScrollTop - before.appScrollTop)).toBeLessThanOrEqual(2);
  });

  test('collection checkbox and driver-paid toggle do not jump the app scroll position', async ({ page }) => {
    await seedSettlement(page);
    await page.evaluate(() => {
      const layout = document.querySelector('#app-layout');
      layout.scrollTop = Math.min(160, Math.max(0, layout.scrollHeight - layout.clientHeight));
    });
    const beforeCollection = await settlementViewport(page);

    const collection = page.locator('cds-checkbox[data-settlement-paid-name]:not([disabled])').first();
    await expect(collection).toBeAttached();
    await collection.evaluate(node => {
      node.checked = !node.checked;
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await confirmDecision(page);
    const afterCollection = await settlementViewport(page);
    expect(Math.abs(afterCollection.appScrollTop - beforeCollection.appScrollTop)).toBeLessThanOrEqual(2);

    const beforeDriver = await settlementViewport(page);
    const driverToggle = page.locator('[data-settlement-driver-paid-name]').first();
    await expect(driverToggle).toBeVisible();
    const driverControl = driverToggle.locator('button[role="switch"]');
    await expect(driverControl).toBeVisible();
    await driverControl.evaluate(node => node.click());
    await confirmDecision(page);
    const afterDriver = await settlementViewport(page);
    expect(Math.abs(afterDriver.appScrollTop - beforeDriver.appScrollTop)).toBeLessThanOrEqual(2);
    await expect(page.locator('#seisan-car-list .seisan-car-summary-row').first()).toBeVisible();
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

  test('blank space beside a settlement action is inert', async ({ page }) => {
    await seedSettlement(page);
    const ignored = await page.locator('#seisan-car-list .seisan-car-summary-actions').first().evaluate(node => {
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
      return node.dispatchEvent(click) === false;
    });
    expect(ignored).toBeTruthy();
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('#seisan-car-list .seisan-car-summary-row').first()).toBeVisible();
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
