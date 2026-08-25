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

async function openMovementSettings(page) {
  const action = page.locator('#settlementCarEditModal [data-action="open-settlement-gas-settings"]');
  await action.evaluate(node => node.click());
  const modal = page.locator('body > #settlementGasEditModal');
  await expect(modal).toHaveCount(1);
  await expect(modal).toHaveJSProperty('open', true);
  await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.app-modal[open]').length)).toBe(1);
  const surface = modal.locator('#settlementGasEditPanel');
  await expect(surface).toBeVisible();
  return { modal, surface };
}

async function closeMovementSettings(page) {
  const modal = page.locator('body > #settlementGasEditModal');
  await modal.locator('cds-modal-footer-button[data-modal-close]').evaluate(node => node.click());
  await expect(modal).toHaveCount(0);
  await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.app-modal[open]').length)).toBe(1);
}

async function setCarbonTextValue(locator, value) {
  await locator.evaluate((node, next) => {
    node.value = next;
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
}

for (const config of [
  { name: 'mobile light', width: 390, height: 844, dark: false },
  { name: 'mobile dark', width: 390, height: 844, dark: true },
  { name: 'desktop light', width: 1280, height: 900, dark: false },
  { name: 'desktop dark', width: 1280, height: 900, dark: true }
]) {
  test.describe(config.name, () => {
    test.use({ viewport: { width: config.width, height: config.height }, hasTouch: config.width <= 390 });

    test('cost list stays scannable and movement settings use one small Carbon modal', async ({ page }) => {
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
      await expect(row.locator('.seisan-extra-field--name cds-text-input')).toHaveJSProperty('value', 'ガソリン代');
      const cells = row.locator(':scope > *');
      await expect(cells).toHaveCount(4);
      await expect(row.locator('.seisan-extra-field--name cds-text-input')).toHaveAttribute('readonly', '');
      await expect(row.locator('.seisan-extra-field--amount cds-text-input')).toHaveAttribute('readonly', '');
      await expect(row.locator('.seisan-extra-field--amount [data-action="open-settlement-gas-settings"]')).toHaveCount(0);
      await expect(row.locator('.seisan-extra-field--action [data-action="open-settlement-gas-settings"]')).toHaveCount(1);
      await expect(row.locator('.seisan-extra-field--action [data-carbon-icon="settings--adjust"], .seisan-extra-field--action [data-carbon-icon-name="settings--adjust"]')).toHaveCount(1);
      await expect(row.locator('.seisan-extra-field--action [data-carbon-icon="trash-can"], .seisan-extra-field--action [data-carbon-icon-name="trash-can"]')).toHaveCount(0);
      await expect(row.locator('cds-toggle[data-extra-field="type"]')).toHaveCount(1);
      await expect(row.locator('cds-toggle[data-extra-field="type"]')).not.toHaveAttribute('disabled', '');

      const geometry = await row.evaluate(node => {
        const rowBox = node.getBoundingClientRect();
        const cells = [...node.children].map(child => {
          const box = child.getBoundingClientRect();
          return { left: box.left, right: box.right, centerY: (box.top + box.bottom) / 2 };
        });
        const toggle = node.querySelector('cds-toggle')?.getBoundingClientRect();
        const amount = node.querySelector('.seisan-extra-field--amount cds-text-input')?.getBoundingClientRect();
        const action = node.querySelector('.seisan-extra-field--action cds-icon-button')?.getBoundingClientRect();
        return {
          height: rowBox.height,
          cells,
          toggleCenterY: toggle ? (toggle.top + toggle.bottom) / 2 : null,
          amountCenterY: amount ? (amount.top + amount.bottom) / 2 : null,
          actionSize: action ? { width: action.width, height: action.height } : null
        };
      });
      expect(geometry.height).toBeLessThanOrEqual(64);
      expect(Math.max(...geometry.cells.map(cell => cell.centerY)) - Math.min(...geometry.cells.map(cell => cell.centerY))).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.toggleCenterY - geometry.amountCenterY)).toBeLessThanOrEqual(2);
      expect(geometry.cells.every((cell, index, all) => index === 0 || cell.left >= all[index - 1].right)).toBeTruthy();
      expect(geometry.actionSize.width).toBeGreaterThanOrEqual(44);
      expect(geometry.actionSize.height).toBeGreaterThanOrEqual(44);

      const normalAmount = page.locator('#settlementCarEditModal .seisan-extra-list .seisan-extra-row [data-extra-field="amount"]').first();
      const movementAmount = row.locator('.seisan-calculated-amount-input');
      if (await normalAmount.count()) {
        const amountBoxes = await Promise.all([
          normalAmount.evaluate(node => node.getBoundingClientRect().toJSON()),
          movementAmount.evaluate(node => node.getBoundingClientRect().toJSON())
        ]);
        expect(Math.abs(amountBoxes[0].height - amountBoxes[1].height)).toBeLessThanOrEqual(1);
      }

      const { modal, surface } = await openMovementSettings(page);
      await expect(surface.locator('[data-field="rentalType"]')).toHaveJSProperty('value', 'private');
      await expect(surface.locator('cds-radio-button[value="private"]')).toHaveAttribute('label-text', '自家用車');
      await expect(surface.locator('cds-radio-button[value="times"]')).toHaveAttribute('label-text', 'タイムズ');
      await expect(surface.locator('[data-field="dist"]')).toBeAttached();
      await expect(surface.locator('[data-field="eco"]')).toBeVisible();
      await expect(surface.locator('[data-field="price"]')).toBeVisible();
      await expect(surface.locator('[data-action="open-route-helper-shortcut"]')).toBeAttached();
      await expect(page.locator('cds-popover.seisan-gas-settings-popover')).toHaveCount(0);

      if (config.width <= 390) {
        const dialogBox = await modal.evaluate(node => node.shadowRoot?.querySelector('[part="dialog"]')?.getBoundingClientRect() || node.getBoundingClientRect());
        expect(dialogBox.width).toBeLessThan(config.width);
        expect(dialogBox.height).toBeLessThan(config.height);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Settlement rental and dismissal regression', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('automatic movement amount is visible, read-only, and its club toggle changes accounting', async ({ page }) => {
    await seedSettlement(page);
    const { surface } = await openMovementSettings(page);
    await setCarbonTextValue(surface.locator('[data-field="dist"]'), '100');
    await setCarbonTextValue(surface.locator('[data-field="eco"]'), '10');
    await setCarbonTextValue(surface.locator('[data-field="price"]'), '150');
    await closeMovementSettings(page);

    const row = page.locator('#settlementCarEditModal .seisan-gas-cost-row');
    const amount = row.locator('[data-extra-field="amount"]');
    await expect(amount).toHaveJSProperty('value', '1500');
    await expect(amount).toHaveAttribute('readonly', '');
    const toggle = row.locator('cds-toggle[data-extra-field="type"]');
    const before = await page.evaluate(() => {
      const data = getRoomDataOnly();
      const state = ensureSettlementState();
      const calc = calculateSettlement(data, state).cars[0];
      return { movementBaseType: calc.movementBaseType, splitPay: calc.splitPay, clubPay: calc.clubPay };
    });
    expect(before.movementBaseType).toBe('split');

    await toggle.click();
    await expect.poll(() => page.evaluate(() => {
      const data = getRoomDataOnly();
      const state = ensureSettlementState();
      const calc = calculateSettlement(data, state).cars[0];
      return { movementBaseType: calc.movementBaseType, splitPay: calc.splitPay, clubPay: calc.clubPay };
    })).toEqual(expect.objectContaining({ movementBaseType: 'club' }));

    const after = await page.evaluate(() => {
      const data = getRoomDataOnly();
      const state = ensureSettlementState();
      const calc = calculateSettlement(data, state).cars[0];
      return { movementBaseType: calc.movementBaseType, splitPay: calc.splitPay, clubPay: calc.clubPay };
    });
    expect(after.clubPay).toBeGreaterThan(before.clubPay);
    expect(after.splitPay).toBeLessThan(before.splitPay);
  });

  test('Times rental shows movement fee then editable time fee with fixed name and no trash', async ({ page }) => {
    await seedSettlement(page);
    const { surface } = await openMovementSettings(page);
    const rental = surface.locator('[data-field="rentalType"]');
    await rental.locator('cds-radio-button[value="times"]').click();

    await expect(surface.locator('[data-field="rentalType"]')).toHaveJSProperty('value', 'times');
    await expect(surface.locator('[data-times-helper]')).toHaveText('移動距離から移動料金を自動で計算できます。');
    await expect(surface.locator('[data-times-helper]')).toBeVisible();
    await expect(surface.locator('[data-field="dist"]')).toBeAttached();
    await expect(surface.locator('[data-field="eco"]')).toBeHidden();
    await expect(surface.locator('[data-field="price"]')).toBeHidden();
    await setCarbonTextValue(surface.locator('[data-field="dist"]'), '100');

    await closeMovementSettings(page);

    const rows = page.locator('#settlementCarEditModal .seisan-cost-edit-row');
    const movementRow = rows.first();
    const movementName = movementRow.locator('.seisan-extra-field--name cds-text-input');
    await expect(movementName).toHaveJSProperty('value', 'タイムズ移動料金');
    await expect(movementName).toHaveAttribute('readonly', '');
    await expect(movementRow.locator('[data-extra-field="amount"]')).toHaveJSProperty('value', '1600');
    await expect(movementRow.locator('[data-extra-field="amount"]')).toHaveAttribute('readonly', '');
    await expect(movementRow.locator('[data-extra-field="type"]')).not.toHaveAttribute('disabled', '');
    await expect(movementRow.locator('.seisan-extra-field--action [data-action="open-settlement-gas-settings"]')).toHaveCount(1);
    await expect(movementRow.locator('.seisan-extra-field--action [data-carbon-icon="trash-can"]')).toHaveCount(0);

    const timeRow = page.locator('#settlementCarEditModal .seisan-extra-row--times-time');
    await expect(timeRow.locator('[data-extra-field="name"]')).toHaveJSProperty('value', 'タイムズ時間料金');
    await expect(timeRow.locator('[data-extra-field="name"]')).toHaveAttribute('readonly', '');
    await expect(timeRow.locator('[data-extra-field="amount"]')).not.toHaveAttribute('readonly', '');
    await expect(timeRow.locator('[data-extra-field="type"]')).not.toHaveAttribute('disabled', '');
    await expect(timeRow.locator('.seisan-extra-field--action cds-icon-button')).toHaveCount(0);
  });

  test('keyboard viewport resize does not move the app shell or leave a white-gap state', async ({ page }) => {
    await seedSettlement(page);
    const before = await page.evaluate(() => ({
      headerTop: document.querySelector('#app-header')?.getBoundingClientRect().top,
      bodyTop: document.body.getBoundingClientRect().top,
      scrollY: window.scrollY
    }));

    const amount = page.locator('#settlementCarEditModal .seisan-extra-list .seisan-extra-row [data-extra-field="amount"]').first();
    await amount.evaluate(node => {
      node.value = '321';
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await expect(amount).toHaveJSProperty('value', '321');
    await page.waitForTimeout(120);

    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);

    const during = await page.evaluate(() => ({
      headerTop: document.querySelector('#app-header')?.getBoundingClientRect().top,
      bodyTop: document.body.getBoundingClientRect().top,
      scrollY: window.scrollY,
      headerConnected: !!document.querySelector('#app-header')?.isConnected,
      settlementConnected: !!document.querySelector('#seisan-view-area')?.isConnected
    }));
    expect(during.headerTop).toBe(before.headerTop);
    expect(during.bodyTop).toBe(before.bodyTop);
    expect(during.scrollY).toBe(before.scrollY);
    expect(during.headerConnected).toBeTruthy();
    expect(during.settlementConnected).toBeTruthy();

    await page.locator('#settlementCarEditModal > cds-modal-header > cds-modal-close-button').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => ({
      modalOpen: document.querySelectorAll('.app-modal[open]').length,
      bodyLocked: document.body.classList.contains('app-modal-open')
    }))).toEqual({ modalOpen: 0, bodyLocked: false });
    await expect(page.locator('#app-header')).toBeVisible();
    await expect(page.locator('#seisan-view-area')).toBeVisible();
    const after = await page.evaluate(() => ({
      headerTop: document.querySelector('#app-header')?.getBoundingClientRect().top,
      bodyTop: document.body.getBoundingClientRect().top,
      scrollY: window.scrollY
    }));
    expect(after).toEqual(before);
  });

  test('closing movement settings and vehicle editor leaves no modal residue', async ({ page }) => {
    await seedSettlement(page);
    await openMovementSettings(page);
    await closeMovementSettings(page);

    await page.locator('#settlementCarEditModal > cds-modal-header > cds-modal-close-button').evaluate(node => node.click());
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => ({
      modalOpen: document.querySelectorAll('.app-modal[open]').length,
      bodyLocked: document.body.classList.contains('app-modal-open')
    }))).toEqual({ modalOpen: 0, bodyLocked: false });

    await expect(page.locator('#app-header')).toBeVisible();
    await expect(page.locator('#seisan-view-area')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight >= document.documentElement.clientHeight)).toBeTruthy();
  });
});

test.describe('Canonical share link', () => {
  test.use({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });

  test('header link copies the ordinary room URL directly and never opens a copy modal', async ({ page, context }) => {
    const room = `SHARE-${Date.now()}`;
    await page.goto(`/?room=${room}`);
    await page.waitForFunction(() => typeof window.copyUrl === 'function');
    await page.locator('#shareLinkBtn').evaluate(node => node.click());
    await expect(page.locator('#appStatusToast')).toContainText('リンクをコピーしました');
    await expect(page.locator('#copy-fallback')).toHaveCount(0);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copied);
    expect(url.searchParams.get('room')).toBe(room);
    expect(url.searchParams.has('view')).toBe(false);
    expect(url.searchParams.has('allocation')).toBe(false);

    const shared = await context.newPage();
    await shared.goto(copied);
    await shared.waitForFunction(() => window.SanpoAssignmentWorkspace && document.querySelectorAll('#view-toggle-bar > cds-tab').length === 4);
    await expect(shared.locator('body')).not.toHaveClass(/view-mode-sheet/);
    await expect(shared.locator('#tab-sheet')).toHaveCount(0);
    await expect(shared.locator('#app-view-navigation')).toBeVisible();
  });
});
