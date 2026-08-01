const { test, expect } = require('@playwright/test');

async function installStableEnvironment(page) {
  await page.route('**/firebase-config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.SANPO_FIREBASE_CONFIG = {};'
  }));
  await page.addInitScript(() => localStorage.setItem('sanpo_coach_seen_v1', 'true'));
}

async function gotoAllocation(page, room, { seeded = true } = {}) {
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    typeof window.switchView === 'function'
    && typeof window.switchCarPlan === 'function'
    && customElements.get('cds-content-switcher')
    && customElements.get('cds-content-switcher-item')
  ));
  if (seeded) {
    await page.waitForFunction(() => typeof window.executeDebugMode === 'function');
    await page.evaluate(() => window.executeDebugMode());
    await page.waitForTimeout(260);
  }
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);
}

async function expectSelectedPlan(page, type, { expectCard = true } = {}) {
  const selectedName = type === 'team' ? '班割' : '車割';
  const selectedItem = page.locator(`cds-content-switcher-item[value="${type}"]`);
  await expect(selectedItem).toHaveAttribute('selected', '');
  await expect(page.getByRole('tab', { name: selectedName })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#cars-container')).not.toHaveAttribute('hidden', '');
  if (expectCard) {
    const card = page.locator(type === 'team' ? '.car-box.is-team-group' : '.car-box:not(.is-team-group)').first();
    await expect(card).toBeVisible();
  }
}

for (const width of [360, 390, 430, 768, 1280]) {
  test(`official Carbon content switcher and empty-seat picker at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await installStableEnvironment(page);
    await gotoAllocation(page, `CARBON-SWITCHER-${width}`);

    const switcher = page.locator('cds-content-switcher.car-plan-template-tabs');
    const items = switcher.locator('cds-content-switcher-item');
    const tabs = switcher.getByRole('tab');
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveAttribute('role', 'tablist');
    await expect(switcher).toHaveAttribute('aria-label', '車割と班割を切り替え');
    await expect(items).toHaveCount(2);
    await expect(tabs).toHaveCount(2);

    const switcherAudit = await switcher.evaluate(node => {
      const hostRect = node.getBoundingClientRect();
      const itemAudit = Array.from(node.querySelectorAll('cds-content-switcher-item')).map(item => {
        const control = item.shadowRoot?.querySelector('button[role="tab"]');
        const hostBox = item.getBoundingClientRect();
        const controlBox = control?.getBoundingClientRect();
        return {
          upgraded: item.constructor.name !== 'HTMLElement',
          hostWidth: hostBox.width,
          hostHeight: hostBox.height,
          controlWidth: controlBox?.width || 0,
          controlHeight: controlBox?.height || 0,
          controls: item.getAttribute('aria-controls'),
          name: item.textContent.trim(),
          selected: control?.getAttribute('aria-selected')
        };
      });
      return {
        upgraded: node.constructor.name !== 'HTMLElement',
        hostWidth: hostRect.width,
        hostHeight: hostRect.height,
        items: itemAudit
      };
    });
    expect(switcherAudit.upgraded).toBeTruthy();
    expect(switcherAudit.hostHeight).toBeGreaterThanOrEqual(48);
    expect(Math.abs(switcherAudit.items[0].hostWidth - switcherAudit.items[1].hostWidth)).toBeLessThan(1);
    expect(switcherAudit.items.every(item => item.upgraded && item.hostHeight >= 48 && item.controlHeight >= 48)).toBeTruthy();
    expect(switcherAudit.items.map(item => item.controls)).toEqual(['cars-container', 'cars-container']);
    expect(switcherAudit.items.map(item => item.name)).toEqual(['車割', '班割']);
    expect(switcherAudit.items.map(item => item.selected)).toEqual(['true', 'false']);

    const participantButton = page.locator('#batchOpenBtn');
    const toolbarAudit = await page.locator('.allocation-toolbar-inner').evaluate(node => {
      const switcherBox = node.querySelector('#car-plan-switcher').getBoundingClientRect();
      const buttonBox = node.querySelector('#batchOpenBtn').getBoundingClientRect();
      return {
        aligned: Math.abs(switcherBox.top - buttonBox.top) <= 1,
        noOverlap: switcherBox.right <= buttonBox.left,
        buttonHeight: buttonBox.height
      };
    });
    await expect(participantButton).toBeVisible();
    expect(toolbarAudit).toEqual({ aligned: true, noOverlap: true, buttonHeight: 48 });

    await tabs.nth(1).click();
    await expectSelectedPlan(page, 'team');
    await page.getByRole('tab', { name: '班割' }).press('ArrowLeft');
    await expectSelectedPlan(page, 'car');
    await page.getByRole('tab', { name: '車割' }).press('ArrowRight');
    await expectSelectedPlan(page, 'team');
    await page.getByRole('tab', { name: '班割' }).press('Home');
    await expectSelectedPlan(page, 'car');
    await page.getByRole('tab', { name: '車割' }).press('End');
    await expectSelectedPlan(page, 'team');

    await participantButton.focus();
    await page.keyboard.press('Tab');
    const focusAudit = await page.locator('cds-content-switcher-item[value="team"]').evaluate(item => {
      const control = item.shadowRoot?.querySelector('button[role="tab"]');
      const style = control ? getComputedStyle(control) : null;
      return {
        hostFocused: document.activeElement === item,
        controlFocused: item.shadowRoot?.activeElement === control,
        focusVisible: control?.matches(':focus-visible') || false,
        outline: style?.outlineStyle || 'none',
        boxShadow: style?.boxShadow || 'none'
      };
    });
    expect(focusAudit.hostFocused).toBeTruthy();
    expect(focusAudit.controlFocused).toBeTruthy();
    expect(focusAudit.focusVisible).toBeTruthy();
    expect(focusAudit.outline !== 'none' || focusAudit.boxShadow !== 'none').toBeTruthy();

    if (width === 390 || width === 1280) {
      const trayHandle = page.locator('#tray-handle');
      const tray = page.locator('#bottom-tray');
      if (await tray.evaluate(node => node.classList.contains('minimized'))) await trayHandle.press('Enter');
      await expect(tray).not.toHaveClass(/minimized/);
      await page.getByRole('tab', { name: '班割' }).press('ArrowLeft');
      await expectSelectedPlan(page, 'car');
      await page.getByRole('tab', { name: '車割' }).press('ArrowRight');
      await expectSelectedPlan(page, 'team');
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => customElements.get('cds-content-switcher-item') && document.querySelector('cds-content-switcher-item[selected]'));
    await page.evaluate(() => window.switchView('list'));
    await expectSelectedPlan(page, 'team');

    await page.evaluate(() => {
      const assigned = document.querySelector('.seat-slot .member-card');
      if (assigned) document.querySelector('#waiting-list').appendChild(assigned);
      window.updateUI();
    });
    const emptySeats = page.getByRole('button', { name: '空席に未割り当てメンバーを追加' });
    const emptySeatCount = await emptySeats.count();
    expect(emptySeatCount).toBeGreaterThan(0);
    const emptySeat = emptySeats.nth(0);
    await expect(emptySeat).toBeVisible();
    expect((await emptySeat.boundingBox()).height).toBeGreaterThanOrEqual(48);

    const waitingBefore = await page.locator('#waiting-list .member-card').count();
    const assignedBefore = await page.locator('.seat-slot .member-card').count();
    await emptySeat.click();
    const dialog = page.getByRole('dialog', { name: '空席に追加' });
    await expect(dialog).toBeVisible();
    const options = dialog.locator('.seat-member-picker-option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
    await options.nth(0).click();
    await expect(page.locator('#waiting-list .member-card')).toHaveCount(waitingBefore - 1);
    await expect(page.locator('.seat-slot .member-card')).toHaveCount(assignedBefore + 1);
    await expect(dialog).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('official Carbon content switcher works with an empty allocation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installStableEnvironment(page);
  await gotoAllocation(page, 'CARBON-SWITCHER-EMPTY', { seeded: false });

  await expect(page.locator('#list-empty-hint')).toBeVisible();
  await page.getByRole('tab', { name: '班割' }).click();
  await expectSelectedPlan(page, 'team', { expectCard: false });
  await expect(page.locator('#list-empty-hint')).toBeVisible();
  await page.getByRole('tab', { name: '班割' }).press('ArrowLeft');
  await expectSelectedPlan(page, 'car', { expectCard: false });
  await expect(page.locator('#list-empty-hint')).toBeVisible();
});
