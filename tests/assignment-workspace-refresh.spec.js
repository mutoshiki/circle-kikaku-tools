import { test, expect } from '@playwright/test';

async function waitForWorkspace(page) {
  await page.waitForFunction(() => customElements.get('cds-content-switcher') && window.SanpoAssignmentWorkspace);
  await expect(page.locator('#assignmentWorkspaceHeader')).toBeAttached();
}

test.describe('Unified assignment workspace', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile layout has one compact row owner and no empty waiting drawer', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));
    await page.waitForFunction(() => document.querySelector('#cars-container .member-main-line .assignment-drag-handle'));

    await expect(page.locator('#assignmentShareBtn')).toHaveCount(1);
    expect(await page.locator('#assignmentShareBtn').evaluate(node => node.tagName.toLowerCase())).toBe('cds-icon-button');

    const rowMetrics = await page.locator('#cars-container .member-main-line').first().evaluate(row => {
      const rect = row.getBoundingClientRect();
      const handle = row.querySelector('.assignment-drag-handle')?.getBoundingClientRect();
      const menu = row.querySelector('.person-overflow-menu')?.getBoundingClientRect();
      const name = row.querySelector('.member-name-text')?.getBoundingClientRect();
      const center = value => value ? value.top + value.height / 2 : null;
      return {
        height: rect.height,
        handleCenter: center(handle),
        menuCenter: center(menu),
        nameCenter: center(name)
      };
    });

    expect(rowMetrics.height).toBeGreaterThanOrEqual(48);
    expect(rowMetrics.height).toBeLessThanOrEqual(64);
    expect(Math.abs(rowMetrics.handleCenter - rowMetrics.menuCenter)).toBeLessThanOrEqual(3);
    expect(Math.abs(rowMetrics.handleCenter - rowMetrics.nameCenter)).toBeLessThanOrEqual(6);

    const actionOverflow = await page.locator('#assignmentWorkspaceActions').evaluate(node => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    }));
    expect(actionOverflow.scrollWidth).toBeLessThanOrEqual(actionOverflow.clientWidth + 1);

    await page.evaluate(() => {
      document.querySelectorAll('#waiting-list .member-card').forEach(card => card.remove());
      window.SanpoAssignmentWorkspace?.refresh?.();
    });
    await expect(page.locator('body')).toHaveClass(/assignment-waiting-empty/);
    await expect(page.locator('#bottom-tray')).toBeHidden();
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

  test('editor keeps drag plus direct move as parallel interaction paths', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));

    const passenger = page.locator('#cars-container .member-card').first();
    await expect(passenger.locator('.assignment-drag-handle')).toBeVisible();
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
