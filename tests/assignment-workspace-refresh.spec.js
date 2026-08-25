import { test, expect } from '@playwright/test';

async function waitForWorkspace(page) {
  await page.waitForFunction(() => window.SanpoAssignmentWorkspace && document.querySelector('#assignmentWorkspaceHeader'));
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

test.describe('Assignment workspace refresh', () => {
  test.use({ viewport: { width: 428, height: 926 } });

  test('primary toolbar is 参加者 → 車割 → 班割 → 精算 and allocation has no local type switcher/title', async ({ page }) => {
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

  test('retired gender, rename, drag and cross-car move concepts are absent', async ({ page }) => {
    await loadSampleWorkspace(page);

    await expect(page.locator('#optFemale, #optMale')).toHaveCount(0);
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
      await expect(menu).toHaveJSProperty('open', true);
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
    const ownerRoleItem = ownerMenu.locator('[data-person-action="driver"]');
    await expect(ownerRoleItem).toHaveAttribute('label', '運転手を外す');
    await ownerRoleItem.evaluate(node => node.click());
    await expect(owner).toHaveAttribute('data-driver', 'false');
    await expect(owner.locator('.driver-role-tag')).toHaveCount(0);
    expect(await firstCar.locator('[data-driver="true"]').count()).toBeGreaterThanOrEqual(2);
  });

  test('mobile workspace stays compact and never widens the viewport', async ({ page }) => {
    await loadSampleWorkspace(page);

    const geometry = await page.evaluate(() => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const actions = document.querySelector('#assignmentWorkspaceActions');
      const controls = ['fillEmptySeatsBtn', 'shuffleAssignBtn', 'traySettingsBtn']
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(node => ({ id: node.id, ...rect(node) }));
      const member = document.querySelector('#cars-container .seat-slot > .member-card');
      const memberRow = member?.querySelector('.member-main-line');
      return {
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        topAreaWidth: document.querySelector('#top-area')?.scrollWidth || 0,
        toolbar: rect(actions),
        controls,
        member: member ? rect(member) : null,
        memberRow: memberRow ? rect(memberRow) : null
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.topAreaWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.controls).toHaveLength(3);
    geometry.controls.forEach(control => expectRectInside(control, geometry.toolbar));
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

  test('shared allocation keeps its selected car/team context without reintroducing a local switcher', async ({ page }) => {
    const room = `ASSIGN-SHARE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`);
    await waitForWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));
    await page.locator('#tab-team').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');

    const shareUrl = await page.evaluate(() => window.createSharedViewUrl());
    const shareParams = new URL(shareUrl).searchParams;
    expect(shareParams.get('room')).toBe(room);
    expect(shareParams.get('view')).toBe('sheet');
    expect(shareParams.get('allocation')).toBe('team');

    await page.goto(shareUrl);
    await waitForWorkspace(page);
    await expect(page.locator('body')).toHaveClass(/assignment-readonly/);
    await expect.poll(() => page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');
    await expect(page.locator('#assignmentTypeSwitcher')).toHaveCount(0);
    await expect(page.locator('#app-view-navigation')).toBeHidden();
    await expect(page.locator('#assignmentWorkspaceActions')).toBeHidden();
    await expect(page.locator('#assignmentShareBtn')).toBeHidden();
    await expect(page.locator('.assignment-group-menu')).toHaveCount(0);
    await expect(page.locator('.person-overflow-menu:visible')).toHaveCount(0);
    await expect(page.locator('#bottom-tray')).toBeHidden();
    await expect(page.locator('.car-name-label').first()).toContainText('1班');
  });
});
