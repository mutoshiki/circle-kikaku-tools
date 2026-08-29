import { test, expect } from '@playwright/test';

async function waitForWorkspace(page) {
  await page.waitForFunction(() => window.SanpoAssignmentWorkspace && document.querySelector('#assignmentWorkspaceHeader'));
  await page.waitForFunction(() => document.querySelector('#tab-team') && document.querySelector('#tab-participants'));
}

async function loadSampleWorkspace(page) {
  await page.goto('/');
  await waitForWorkspace(page);
  await page.evaluate(() => window.executeDebugMode?.());
  await page.evaluate(() => window.switchView('list'));
  await page.waitForFunction(() => document.querySelector('#cars-container .member-main-line'));
  await page.evaluate(() => window.SanpoAssignmentWorkspace?.refresh?.());
}

async function expectPersonMenuOpen(menu) {
  await expect.poll(() => menu.evaluate(node => (
    node.matches?.(':popover-open') === true
    || node.open === true
    || node.hasAttribute('open')
  ))).toBe(true);
}

function expectRectInside(inner, outer, tolerance = 1) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
}

test.describe('Assignment workspace refresh', () => {
  test.use({ viewport: { width: 428, height: 926 } });

  test('primary toolbar is 参加者 → 車割 → 班割 → 精算 with no allocation-local switcher or shared-view destination', async ({ page }) => {
    await loadSampleWorkspace(page);

    const nav = await page.locator('#view-toggle-bar > cds-tab').evaluateAll(tabs => tabs.map(tab => ({
      id: tab.id,
      label: tab.textContent?.trim() || '',
      hidden: tab.hidden
    })));
    expect(nav).toEqual([
      { id: 'tab-participants', label: '参加者', hidden: false },
      { id: 'tab-list', label: '車割', hidden: false },
      { id: 'tab-team', label: '班割', hidden: false },
      { id: 'tab-seisan', label: '精算', hidden: false }
    ]);

    await expect(page.locator('#tab-sheet')).toHaveCount(0);
    await expect(page.locator('#assignmentTypeSwitcher')).toHaveCount(0);
    await expect(page.locator('#car-plan-switcher')).toBeHidden();
    await expect(page.locator('#assignmentWorkspaceHeader h1, #assignmentWorkspaceHeader h2, #assignmentWorkspaceHeader h3')).toHaveCount(0);
    await expect(page.locator('#assignmentWorkspaceHeader')).not.toContainText('車割・班割');

    await page.locator('#tab-team').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');
    await expect(page.locator('#tab-team')).toHaveAttribute('aria-current', 'page');

    await page.locator('#tab-list').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('car');
    await expect(page.locator('#tab-list')).toHaveAttribute('aria-current', 'page');
  });

  test('bulk allocation is one random action with no settings, fill, gender, rename, move or drag controls', async ({ page }) => {
    await loadSampleWorkspace(page);

    await expect(page.locator('#assignmentWorkspaceRandomAction > #shuffleAssignBtn')).toHaveCount(1);
    await expect(page.locator('#shuffleAssignBtn')).toContainText('ランダム割り当て');
    await expect(page.locator('.assignment-workspace-summary-primary')).toContainText('未割り当て');
    await expect(page.locator('.assignment-workspace-summary-secondary')).toContainText('13人・3台');
    await expect(page.locator('#fillEmptySeatsBtn, #traySettingsBtn, #autoAssignPopover, #autoAssignMenu, #optFemale, #optMale, #optGrade, #clearAllBtn')).toHaveCount(0);
    await expect(page.locator('[data-person-action="name"], [data-person-action="gender"]')).toHaveCount(0);
    await expect(page.locator('.assignment-drag-handle, .assignment-person-move-menu, [data-assignment-move-target]')).toHaveCount(0);
    await expect(page.locator('.capacity-display')).toHaveCount(3);
    await expect.poll(() => page.locator('.capacity-display').evaluateAll(nodes => nodes.every(node => !node.hasAttribute('data-action')))).toBe(true);
    await expect(page.locator('.capacity-count').first()).toContainText('人');
    await expect(page.locator('.assignment-group-menu').first()).toHaveAttribute('aria-label', '1号車の操作');
    await expect(page.locator('#bottom-tray')).toBeHidden();

    const snapshot = await page.evaluate(() => JSON.stringify(window.SanpoCanonicalState?.get?.() || {}));
    expect(snapshot).not.toContain('"gender"');
    expect(snapshot).not.toContain('"driverGender"');
  });

  test('driver role can be toggled for multiple people and role rows stay first after rerender', async ({ page }) => {
    await loadSampleWorkspace(page);

    const firstCar = page.locator('#cars-container .car-box').first();
    const members = firstCar.locator('.seat-slot > .member-card');
    expect(await members.count()).toBeGreaterThanOrEqual(2);

    for (let index = 0; index < 2; index += 1) {
      const member = members.nth(index);
      const menu = member.locator('cds-overflow-menu.person-overflow-menu');
      await menu.click();
      await expectPersonMenuOpen(menu);
      const roleItem = menu.locator('[data-person-action="driver"]');
      await expect(roleItem).toHaveAttribute('label', '運転手にする');
      await roleItem.evaluate(node => node.click());
      await expect(member).toHaveAttribute('data-driver', 'true');
      await expect(member.locator('.driver-role-tag')).toHaveText('運転手');
    }

    const roleCountBefore = await firstCar.locator('[data-driver="true"]').count();
    expect(roleCountBefore).toBeGreaterThanOrEqual(3);

    await page.evaluate(() => {
      window.syncActiveCarPlanFromDom?.();
      window.renderActiveCarPlanToDom?.();
      window.SanpoAssignmentWorkspace?.refresh?.();
    });
    await page.waitForFunction(() => document.querySelectorAll('#cars-container .car-box:first-child [data-driver="true"]').length >= 3);

    const order = await firstCar.evaluate(box => {
      const rows = Array.from(box.querySelectorAll('.car-layout-grid > .driver-seat, .car-layout-grid > .seat-slot'));
      return rows.map(row => {
        const person = row.matches('.driver-seat') ? row : row.querySelector(':scope > .member-card');
        return person ? person.dataset.driver === 'true' : null;
      }).filter(value => value !== null);
    });
    const firstNonDriver = order.indexOf(false);
    const lastDriver = order.lastIndexOf(true);
    if (firstNonDriver >= 0) expect(lastDriver).toBeLessThan(firstNonDriver);

    const owner = firstCar.locator('.driver-seat');
    const ownerMenu = owner.locator('cds-overflow-menu.person-overflow-menu');
    await ownerMenu.click();
    await expectPersonMenuOpen(ownerMenu);
    const ownerRoleItem = ownerMenu.locator('[data-person-action="driver"]');
    await expect(ownerRoleItem).toHaveAttribute('label', '運転手を外す');
    await ownerRoleItem.evaluate(node => node.click());
    await expect(owner).toHaveAttribute('data-driver', 'false');
    await expect(owner.locator('.driver-role-tag')).toHaveCount(0);
    expect(await firstCar.locator('[data-driver="true"]').count()).toBeGreaterThanOrEqual(2);
  });

  test('canonical role, lock, shuffle and scroll owners stay stable through real menu actions', async ({ page }) => {
    await loadSampleWorkspace(page);

    const owner = page.locator('#cars-container .car-box').first().locator('.driver-seat').first();
    const ownerId = await owner.getAttribute('data-participant-id');
    expect(ownerId).toBeTruthy();
    await page.evaluate(() => {
      const layout = document.getElementById('app-layout');
      layout.scrollTop = Math.min(180, Math.max(0, layout.scrollHeight - layout.clientHeight));
      layout.dispatchEvent(new Event('scroll'));
    });

    const ownerMenu = owner.locator('cds-overflow-menu.person-overflow-menu');
    await ownerMenu.click();
    await expectPersonMenuOpen(ownerMenu);
    const scrollBefore = await page.evaluate(() => document.getElementById('app-layout')?.scrollTop || 0);
    await ownerMenu.locator('[data-person-action="driver"]').evaluate(node => node.click());
    await expect.poll(() => page.locator(`.driver-seat[data-participant-id="${ownerId}"]`).getAttribute('data-driver')).toBe('false');
    const scrollAfterRole = await page.evaluate(() => document.getElementById('app-layout')?.scrollTop || 0);
    expect(scrollAfterRole).toBe(scrollBefore);

    const canonicalAfterRole = await page.evaluate(id => {
      const room = window.SanpoCanonicalState?.get?.();
      const placement = room?.allocations?.[room.activeAllocationType]?.placements?.[id];
      return { kind: placement?.kind, driver: placement?.driver, hasLegacyDriverKind: Object.values(room?.allocations?.[room.activeAllocationType]?.placements || {}).some(item => item?.kind === 'driver') };
    }, ownerId);
    expect(canonicalAfterRole).toEqual({ kind: 'member', driver: false, hasLegacyDriverKind: false });

    const ownerAfterRole = page.locator(`.driver-seat[data-participant-id="${ownerId}"]`);
    const ownerReturnMenu = ownerAfterRole.locator('cds-overflow-menu.person-overflow-menu');
    await ownerReturnMenu.click();
    await expectPersonMenuOpen(ownerReturnMenu);
    await ownerReturnMenu.locator('[data-person-action="return"]').evaluate(node => node.click());
    await expect(page.locator('#appConfirmModal')).toHaveAttribute('open', '');
    await page.locator('#appConfirmModal [data-role="ok"]').evaluate(node => node.click());
    await expect(page.locator(`#waiting-list .member-card[data-participant-id="${ownerId}"]`)).toHaveCount(1);
    await expect.poll(() => page.evaluate(id => {
      const room = window.SanpoCanonicalState?.get?.();
      return room?.allocations?.[room.activeAllocationType]?.placements?.[id]?.kind;
    }, ownerId)).toBe('waiting');

    const driverCard = page.locator('#cars-container .member-card[data-driver="false"]').first();
    const driverId = await driverCard.getAttribute('data-participant-id');
    const driverMenu = driverCard.locator('cds-overflow-menu.person-overflow-menu');
    await driverMenu.click();
    await expectPersonMenuOpen(driverMenu);
    await driverMenu.locator('[data-person-action="driver"]').evaluate(node => node.click());
    const driverPlacementBefore = await page.evaluate(id => {
      const room = window.SanpoCanonicalState?.get?.();
      return structuredClone(room?.allocations?.[room.activeAllocationType]?.placements?.[id]);
    }, driverId);

    await page.locator('#shuffleAssignBtn').evaluate(node => node.click());
    await expect(page.locator('#appConfirmModal')).toHaveAttribute('open', '');
    await page.locator('#appConfirmModal [data-role="ok"]').evaluate(node => node.click());
    await expect.poll(() => page.evaluate(() => document.querySelector('#appConfirmModal')?.open === false || !document.querySelector('#appConfirmModal')?.hasAttribute('open'))).toBe(true);
    const shuffleResult = await page.evaluate(({ driverId: stableDriverId }) => {
      const room = window.SanpoCanonicalState?.get?.();
      const allocation = room?.allocations?.[room.activeAllocationType];
      return {
        driver: structuredClone(allocation?.placements?.[stableDriverId]),
        legacyKinds: Object.values(allocation?.placements || {}).filter(item => item?.kind === 'driver').length
      };
    }, { driverId });
    expect(shuffleResult.driver).toEqual(driverPlacementBefore);
    expect(shuffleResult.legacyKinds).toBe(0);
  });

  test('mobile workspace stays compact with one action and never widens the viewport', async ({ page }) => {
    await loadSampleWorkspace(page);

    const geometry = await page.evaluate(() => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const actions = document.querySelector('#assignmentWorkspaceRandomAction');
      const shuffle = document.getElementById('shuffleAssignBtn');
      const member = document.querySelector('#cars-container .seat-slot > .member-card');
      const memberRow = member?.querySelector('.member-main-line');
      return {
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        topAreaWidth: document.querySelector('#top-area')?.scrollWidth || 0,
        toolbar: rect(actions),
        shuffle: rect(shuffle),
        member: member ? rect(member) : null,
        memberRow: memberRow ? rect(memberRow) : null
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.topAreaWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expectRectInside(geometry.shuffle, geometry.toolbar);
    expect(geometry.shuffle.height).toBeGreaterThanOrEqual(47);
    expect(geometry.shuffle.height).toBeLessThanOrEqual(49);
    expect(geometry.member?.height).toBeGreaterThanOrEqual(55);
    expect(geometry.member?.height).toBeLessThanOrEqual(57);
    expect(geometry.memberRow?.height).toBeGreaterThanOrEqual(55);
    expect(geometry.memberRow?.height).toBeLessThanOrEqual(57);
  });

  test('mobile title uses the same natural scroll owner instead of collapsing 240px from a tiny gesture', async ({ page }) => {
    await loadSampleWorkspace(page);

    const initial = await page.evaluate(() => ({
      revealBound: document.documentElement.dataset.projectTitleRevealBound,
      titleState: document.getElementById('projectTitleRegion')?.dataset.state,
      appOverflowY: getComputedStyle(document.getElementById('app-layout')).overflowY,
      topOverflowY: getComputedStyle(document.getElementById('top-area')).overflowY
    }));
    expect(initial.revealBound).toBe('true');
    expect(initial.titleState).toBe('expanded');
    expect(initial.appOverflowY).toBe('auto');
    expect(initial.topOverflowY).toBe('visible');

    await page.evaluate(() => {
      const layout = document.getElementById('app-layout');
      layout.scrollTop = 24;
      layout.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(80);
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');
  });

  test('Carbon allocation borders, empty-seat notification width and pointer menu cleanup stay theme-aware', async ({ page }) => {
    await loadSampleWorkspace(page);

    const appSwitcher = page.locator('.header-app-switcher');
    await appSwitcher.click();
    const themeToggle = page.locator('#themeToggleBtn');
    if (await themeToggle.getAttribute('label') === 'ダークモードに切り替え') await themeToggle.click();
    await page.waitForTimeout(80);

    const darkBorders = await page.evaluate(() => {
      const car = document.querySelector('#cars-container .car-box');
      const row = document.querySelector('#cars-container .seat-slot');
      return {
        theme: document.documentElement.dataset.theme,
        carBorder: getComputedStyle(car).borderColor,
        rowBorder: getComputedStyle(row).borderBottomColor,
        carToken: getComputedStyle(car).getPropertyValue('--cds-border-subtle').trim()
      };
    });
    expect(darkBorders.theme).toBe('dark');
    expect(darkBorders.carBorder).toBe('rgb(82, 82, 82)');
    expect(darkBorders.rowBorder).toBe('rgb(82, 82, 82)');
    expect(darkBorders.carToken).toBe('#525252');

    const firstCar = page.locator('#cars-container .car-box').first();
    const extraCapacity = await firstCar.evaluate(box => Number(box.dataset.capacity || 0) + 1);
    const groupMenu = firstCar.locator('.assignment-group-menu');
    await groupMenu.click();
    await expectPersonMenuOpen(groupMenu);
    await groupMenu.locator('[data-assignment-group-action="capacity"]').evaluate(node => node.click());
    await page.locator('#editModalInput input').fill(String(extraCapacity));
    await page.locator('#saveEditBtn').click();
    const emptyRow = page.locator('#cars-container .assignment-empty-seats-row').first();
    await emptyRow.waitFor({ state: 'visible' });
    await expect(emptyRow).toContainText('参加者を追加');
    await expect(emptyRow).toHaveAttribute('aria-controls', /assignment-seat-candidates-/);
    await emptyRow.click();
    await expect(page.locator('.assignment-seat-disclosure').first()).toHaveAttribute('aria-label', '1号車に追加');
    const candidateCount = await page.locator('.assignment-candidate-item').count();
    if (candidateCount > 0) {
      await expect(page.locator('.assignment-candidate-item').first()).toHaveAttribute('aria-label', /を1号車に追加$/);
      await expect(page.locator('.assignment-candidate-add').first()).toHaveAttribute('data-carbon-icon-name', 'add');
    } else {
      await expect(page.locator('.assignment-seat-notification')).toBeVisible();
    }
    const notificationGeometry = await page.evaluate(() => {
      const notice = document.querySelector('.assignment-seat-notification').getBoundingClientRect();
      const disclosure = document.querySelector('.assignment-seat-disclosure').getBoundingClientRect();
      return { noticeWidth: notice.width, disclosureWidth: disclosure.width };
    });
    expect(notificationGeometry.noticeWidth).toBeCloseTo(notificationGeometry.disclosureWidth, 1);

    const menu = firstCar.locator('.person-overflow-menu').first();
    await menu.click();
    await expectPersonMenuOpen(menu);
    await page.locator('#assignmentWorkspaceSummary').click();
    await expect.poll(() => menu.evaluate(node => {
      const button = node.shadowRoot?.querySelector('button');
      return {
        open: node.open === true || node.hasAttribute('open'),
        background: button ? getComputedStyle(button).backgroundColor : null,
        focusVisible: button?.matches(':focus-visible') || false
      };
    })).toEqual({ open: false, background: 'rgba(0, 0, 0, 0)', focusVisible: false });
  });

  test('share action copies the normal room URL and legacy special allocation links normalize back to the normal app', async ({ page }) => {
    const room = `ASSIGN-SHARE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`);
    await waitForWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.locator('#tab-team').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');

    const shareUrl = await page.evaluate(() => window.createSharedViewUrl());
    const shareParams = new URL(shareUrl).searchParams;
    expect(shareParams.get('room')).toBe(room);
    expect(shareParams.has('view')).toBe(false);
    expect(shareParams.has('allocation')).toBe(false);

    await page.goto(`/?room=${room}&view=sheet&allocation=team`);
    await waitForWorkspace(page);
    await expect.poll(() => new URL(page.url()).searchParams.has('view')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has('allocation')).toBe(false);
    await expect(page.locator('body')).not.toHaveClass(/assignment-readonly/);
    await expect(page.locator('#app-view-navigation')).toBeVisible();
    await expect(page.locator('#assignmentWorkspaceRandomAction')).toBeVisible();
    await expect(page.locator('#shareLinkBtn')).toBeVisible();
    await expect(page.locator('#tab-sheet')).toHaveCount(0);
  });
});
