import { test, expect } from '@playwright/test';

async function waitForWorkspace(page) {
  await page.waitForFunction(() => customElements.get('cds-content-switcher') && window.SanpoAssignmentWorkspace);
  await expect(page.locator('#assignmentWorkspaceHeader')).toBeAttached();
}

async function loadSampleWorkspace(page) {
  await page.goto('/');
  await waitForWorkspace(page);
  await page.evaluate(() => window.executeDebugMode?.());
  await page.evaluate(() => window.switchView('list'));
  await page.waitForFunction(() => document.querySelector('#cars-container .member-main-line'));
  await page.evaluate(() => window.SanpoAssignmentWorkspace?.refresh?.());
}

function expectRectInside(inner, outer, tolerance = 1) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
}

test.describe('Unified assignment workspace', () => {
  // iPhone 13/14 Pro Max class viewport. The production screenshots that exposed
  // the broken horizontal layout were wider than the old 390px-only regression.
  test.use({ viewport: { width: 428, height: 926 } });

  test('mobile workspace is one compact column with no card drag or lower waiting drawer', async ({ page }) => {
    await loadSampleWorkspace(page);

    await expect(page.locator('#assignmentShareBtn')).toHaveCount(1);
    expect(await page.locator('#assignmentShareBtn').evaluate(node => node.tagName.toLowerCase())).toBe('cds-icon-button');

    await expect(page.locator('.assignment-drag-handle')).toHaveCount(0);
    await expect(page.locator('#bottom-tray')).toBeHidden();

    const layout = await page.evaluate(() => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const member = document.querySelector('#cars-container .seat-slot > .member-card');
      const memberRow = member?.querySelector('.member-main-line');
      const memberSlot = member?.closest('.seat-slot');
      const emptySlot = document.querySelector('#cars-container .seat-slot.assignment-empty-seat');
      const emptyLabel = emptySlot?.querySelector('.assignment-empty-label');
      const carGrid = document.querySelector('#cars-container .car-layout-grid');
      const firstCard = document.querySelector('#cars-container .car-box');
      return {
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        topAreaWidth: document.querySelector('#top-area')?.scrollWidth || 0,
        member: member ? rect(member) : null,
        memberRow: memberRow ? rect(memberRow) : null,
        memberSlot: memberSlot ? rect(memberSlot) : null,
        emptySlot: emptySlot ? rect(emptySlot) : null,
        emptyLabel: emptyLabel?.textContent?.trim() || '',
        carGridMinHeight: carGrid ? getComputedStyle(carGrid).minHeight : null,
        firstCardHeight: firstCard ? rect(firstCard).height : 0,
        firstCardRows: firstCard ? firstCard.querySelectorAll('.driver-seat, .seat-slot').length : 0
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.topAreaWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.member).not.toBeNull();
    expect(layout.memberRow).not.toBeNull();
    expect(layout.memberSlot).not.toBeNull();
    expect(layout.member.height).toBeGreaterThanOrEqual(55);
    expect(layout.member.height).toBeLessThanOrEqual(57);
    expect(layout.memberRow.height).toBeGreaterThanOrEqual(55);
    expect(layout.memberRow.height).toBeLessThanOrEqual(57);
    expect(layout.memberSlot.height).toBeGreaterThanOrEqual(55);
    expect(layout.memberSlot.height).toBeLessThanOrEqual(57);
    expect(layout.emptySlot).not.toBeNull();
    expect(layout.emptySlot.height).toBeGreaterThanOrEqual(55);
    expect(layout.emptySlot.height).toBeLessThanOrEqual(57);
    expect(layout.emptyLabel).toBe('空席');
    expect(layout.carGridMinHeight).toBe('0px');
    // No legacy 164px/expanding grid should inject a giant blank band between rows.
    expect(layout.firstCardHeight).toBeLessThanOrEqual(49 + layout.firstCardRows * 57 + 4);

    const member = page.locator('#cars-container .seat-slot > .member-card').first();
    const box = await member.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(360);
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20);
    await page.waitForTimeout(80);
    await page.mouse.up();
    await expect(page.locator('.manual-drag-float')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/manual-card-dragging/);
  });

  test('unassigned pool stays hidden but remains usable through direct Move and empty-seat picker', async ({ page }) => {
    await loadSampleWorkspace(page);

    const passenger = page.locator('#cars-container .member-card').first();
    const movedName = (await passenger.getAttribute('data-name')) || '';
    const overflow = passenger.locator('cds-overflow-menu.person-overflow-menu');
    await overflow.click();
    await expect(overflow).toHaveJSProperty('open', true);

    const move = overflow.locator('cds-menu-item.assignment-person-move-menu');
    await expect(move).toHaveCount(1);
    const waitingTarget = move.locator('[data-assignment-move-target="waiting"]');
    await expect(waitingTarget).toHaveCount(1);
    await waitingTarget.evaluate(node => node.click());

    await expect.poll(() => page.locator('#waiting-list .member-card').count()).toBeGreaterThan(0);
    await expect(page.locator('#bottom-tray')).toBeHidden();
    await expect(page.locator('#assignmentWorkspaceSummary')).toContainText('未配置');

    const emptySeat = page.locator('#cars-container .seat-slot.assignment-empty-seat').first();
    await expect(emptySeat).toBeVisible();
    await expect(emptySeat.locator('.assignment-empty-label')).toHaveText('空席');
    await emptySeat.locator('.seat-add-btn').click();

    await expect(page.locator('#seatMemberPickerModal')).toBeVisible();
    const pickerOption = page.locator('#seatMemberPickerList .seat-member-picker-option').filter({ hasText: movedName }).first();
    await expect(pickerOption).toBeVisible();
    await pickerOption.click();

    await expect(page.locator('#seatMemberPickerModal')).toBeHidden();
    await expect(emptySeat.locator('.member-card')).toHaveCount(1);
    await expect(page.locator('#bottom-tray')).toBeHidden();
  });

  test('428px toolbar and mobile action sheets never widen the page', async ({ page }) => {
    await loadSampleWorkspace(page);

    const geometry = await page.evaluate(() => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const actions = document.querySelector('#assignmentWorkspaceActions');
      const controls = ['fillEmptySeatsBtn', 'shuffleAssignBtn', 'traySettingsBtn']
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(node => ({ id: node.id, ...rect(node) }));
      return {
        toolbar: rect(actions),
        controls,
        viewport: { left: 0, right: innerWidth },
        documentWidth: document.documentElement.scrollWidth,
        topAreaWidth: document.querySelector('#top-area')?.scrollWidth || 0
      };
    });

    expect(geometry.controls).toHaveLength(3);
    geometry.controls.forEach(control => {
      expectRectInside(control, geometry.toolbar);
      expect(control.height).toBeGreaterThanOrEqual(47);
      expect(control.height).toBeLessThanOrEqual(49);
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport.right + 1);
    expect(geometry.topAreaWidth).toBeLessThanOrEqual(geometry.viewport.right + 1);

    await page.locator('#traySettingsBtn').click();
    await expect(page.locator('#autoAssignPopover')).toHaveJSProperty('open', true);
    const settingsRect = await page.locator('#autoAssignMenu').evaluate(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    });
    expect(settingsRect.left).toBeGreaterThanOrEqual(-1);
    expect(settingsRect.right).toBeLessThanOrEqual(429);
    expect(settingsRect.width).toBeLessThanOrEqual(429);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(429);
    await page.keyboard.press('Escape');

    const groupMenu = page.locator('.assignment-group-menu').first();
    await groupMenu.click();
    await expect(groupMenu).toHaveJSProperty('open', true);
    const groupSurface = await groupMenu.locator('cds-menu').evaluate(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    });
    expect(groupSurface.left).toBeGreaterThanOrEqual(-1);
    expect(groupSurface.right).toBeLessThanOrEqual(429);
    expect(groupSurface.width).toBeLessThanOrEqual(429);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(429);
  });

  test('very narrow phones wrap actions instead of overflowing horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loadSampleWorkspace(page);

    const result = await page.evaluate(() => {
      const actions = document.querySelector('#assignmentWorkspaceActions');
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        toolbar: rect(actions),
        fill: rect(document.getElementById('fillEmptySeatsBtn')),
        shuffle: rect(document.getElementById('shuffleAssignBtn')),
        settings: rect(document.getElementById('traySettingsBtn')),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth
      };
    });

    expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
    expectRectInside(result.fill, result.toolbar);
    expectRectInside(result.shuffle, result.toolbar);
    expectRectInside(result.settings, result.toolbar);
    expect(result.shuffle.top).toBeGreaterThan(result.fill.top);
  });

  test('shared link reuses the workspace as read-only and preserves team/car context', async ({ page }) => {
    const room = `ASSIGN-SHARE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`);
    await waitForWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));
    await page.locator('#assignmentTypeSwitcher cds-content-switcher-item[value="team"]').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');

    const shareUrl = await page.evaluate(() => window.createSharedViewUrl());
    const shareParams = new URL(shareUrl).searchParams;
    expect(shareParams.get('room')).toBe(room);
    expect(shareParams.get('view')).toBe('sheet');
    expect(shareParams.get('allocation')).toBe('team');

    await page.goto(shareUrl);
    await waitForWorkspace(page);
    await page.waitForFunction(() => document.querySelector('#projectTitleEditor'));
    await expect(page.locator('body')).toHaveClass(/assignment-readonly/);
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');
    await expect(page.locator('#top-area')).toBeVisible();
    await expect(page.locator('#sheet-view-area')).toBeHidden();
    await expect(page.locator('#app-view-navigation')).toBeHidden();
    await expect(page.locator('#assignmentTypeSwitcher')).toBeVisible();
    await expect(page.locator('#assignmentWorkspaceActions')).toBeHidden();
    await expect(page.locator('#assignmentShareBtn')).toBeHidden();
    await expect(page.locator('.assignment-drag-handle')).toHaveCount(0);
    await expect(page.locator('.assignment-group-menu')).toHaveCount(0);
    await expect(page.locator('.person-overflow-menu:visible')).toHaveCount(0);
    await expect(page.locator('#bottom-tray')).toBeHidden();

    const capacityControl = page.locator('.capacity-edit-pill').first();
    await expect(capacityControl).toBeVisible();
    await expect(capacityControl.locator('.capacity-count')).toBeVisible();
    await expect(capacityControl).toHaveAttribute('aria-disabled', 'true');
    expect(await capacityControl.evaluate(node => node.tabIndex)).toBe(-1);
    expect(await capacityControl.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');

    await expect(page.locator('#roomNameInput')).toHaveJSProperty('readOnly', true);
    const titleEditor = page.locator('#projectTitleEditor');
    await expect(titleEditor).toBeVisible();
    await expect(titleEditor).toHaveAttribute('contenteditable', 'false');
    await expect(titleEditor).toHaveAttribute('aria-readonly', '');
    expect(await titleEditor.evaluate(node => node.tabIndex)).toBe(-1);
    await expect(page.locator('#assignmentWorkspaceSummary')).toContainText('未配置');

    await page.locator('#assignmentTypeSwitcher cds-content-switcher-item[value="car"]').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('car');
    await expect(page.locator('.car-name-label').first()).toContainText('1号車');
  });

  test('editor keeps direct Move as the only member relocation path', async ({ page }) => {
    await loadSampleWorkspace(page);

    const passenger = page.locator('#cars-container .member-card').first();
    await expect(passenger.locator('.assignment-drag-handle')).toHaveCount(0);
    const overflow = passenger.locator('cds-overflow-menu.person-overflow-menu');
    await overflow.click();
    await expect(overflow).toHaveJSProperty('open', true);
    const move = overflow.locator('cds-menu-item.assignment-person-move-menu');
    await expect(move).toHaveCount(1);
    const targets = await move.locator('[data-assignment-move-target]').evaluateAll(items => items.map(item => item.getAttribute('label')));
    expect(targets).toContain('未配置');
    expect(targets.some(label => /号車$/.test(label || ''))).toBeTruthy();
  });
});
