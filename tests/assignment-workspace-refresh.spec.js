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

    await expect(page.locator('#assignmentWorkspaceActions > #shuffleAssignBtn')).toHaveCount(1);
    await expect(page.locator('#shuffleAssignBtn')).toContainText('ランダムに割り当て');
    await expect(page.locator('#fillEmptySeatsBtn, #traySettingsBtn, #autoAssignPopover, #autoAssignMenu, #optFemale, #optMale, #optGrade, #clearAllBtn')).toHaveCount(0);
    await expect(page.locator('[data-person-action="name"], [data-person-action="gender"]')).toHaveCount(0);
    await expect(page.locator('.assignment-drag-handle, .assignment-person-move-menu, [data-assignment-move-target]')).toHaveCount(0);
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

  test('mobile workspace stays compact with one action and never widens the viewport', async ({ page }) => {
    await loadSampleWorkspace(page);

    const geometry = await page.evaluate(() => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const actions = document.querySelector('#assignmentWorkspaceActions');
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
    await expect(page.locator('#assignmentWorkspaceActions')).toBeVisible();
    await expect(page.locator('#shareLinkBtn')).toBeVisible();
    await expect(page.locator('#tab-sheet')).toHaveCount(0);
  });
});
