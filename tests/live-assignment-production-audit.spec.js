import { test, expect } from '@playwright/test';

const PROD = 'https://mutoshiki.github.io/circle-kikaku-tools/';

async function waitForProductionWorkspace(page) {
  await page.waitForFunction(() => customElements.get('cds-content-switcher') && window.SanpoAssignmentWorkspace, null, { timeout: 60000 });
  await expect(page.locator('#assignmentWorkspaceHeader')).toBeAttached({ timeout: 30000 });
}

test.describe('Production Assignment Workspace audit', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('actual GitHub Pages URL has the intended mobile density', async ({ page }, testInfo) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err)));

    await page.goto(`${PROD}?qa=live-assignment-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForProductionWorkspace(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));
    await page.waitForFunction(() => document.querySelector('#cars-container .member-main-line .assignment-drag-handle'), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const diagnostics = await page.evaluate(() => {
      const rect = node => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const visible = node => {
        if (!node) return false;
        const s = getComputedStyle(node);
        const r = node.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const actions = document.querySelector('#assignmentWorkspaceActions');
      const rows = [...document.querySelectorAll('#cars-container .member-main-line')].slice(0, 12);
      const occupiedCards = rows.map(row => row.closest('.member-card')).filter(Boolean);
      const occupiedSlots = occupiedCards.map(card => card.closest('.seat-slot')).filter(Boolean);
      const groupCards = [...document.querySelectorAll('#cars-container .car-box')];
      const controls = ['fillEmptySeatsBtn', 'shuffleAssignBtn', 'traySettingsBtn']
        .map(id => document.getElementById(id))
        .filter(visible)
        .map(node => ({ id: node.id, ...rect(node) }));
      return {
        href: location.href,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        header: rect(document.querySelector('#assignmentWorkspaceHeader')),
        actions: rect(actions),
        controls,
        rowHeights: rows.map(row => rect(row)?.height),
        occupiedCardHeights: occupiedCards.map(card => rect(card)?.height),
        occupiedSlotHeights: occupiedSlots.map(slot => rect(slot)?.height),
        cardWidths: groupCards.map(card => rect(card)?.width),
        waitingCount: document.querySelectorAll('#waiting-list .member-card').length,
        bottomTrayVisible: visible(document.querySelector('#bottom-tray')),
        workspaceSummary: document.querySelector('#assignmentWorkspaceSummary')?.textContent?.trim() || '',
        title: document.querySelector('#projectTitleEditor')?.textContent?.trim() || ''
      };
    });

    console.log('LIVE_ASSIGNMENT_DIAGNOSTICS', JSON.stringify(diagnostics));
    console.log('LIVE_ASSIGNMENT_CONSOLE_ERRORS', JSON.stringify(consoleErrors));
    console.log('LIVE_ASSIGNMENT_PAGE_ERRORS', JSON.stringify(pageErrors));

    const top = await page.screenshot({ fullPage: false });
    await testInfo.attach('live-assignment-top', { body: top, contentType: 'image/png' });
    await page.locator('#cars-container .car-box').last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const lower = await page.screenshot({ fullPage: false });
    await testInfo.attach('live-assignment-lower', { body: lower, contentType: 'image/png' });
    const full = await page.screenshot({ fullPage: true });
    await testInfo.attach('live-assignment-full', { body: full, contentType: 'image/png' });

    expect(diagnostics.documentWidth).toBeLessThanOrEqual(diagnostics.viewportWidth + 1);
    expect(diagnostics.bodyWidth).toBeLessThanOrEqual(diagnostics.viewportWidth + 1);
    expect(diagnostics.rowHeights.length).toBeGreaterThan(0);
    diagnostics.rowHeights.forEach(height => {
      expect(height).toBeGreaterThanOrEqual(55);
      expect(height).toBeLessThanOrEqual(57);
    });
    expect(diagnostics.occupiedCardHeights.length).toBeGreaterThan(0);
    diagnostics.occupiedCardHeights.forEach(height => {
      expect(height).toBeGreaterThanOrEqual(55);
      expect(height).toBeLessThanOrEqual(57);
    });
    expect(diagnostics.occupiedSlotHeights.length).toBeGreaterThan(0);
    diagnostics.occupiedSlotHeights.forEach(height => {
      expect(height).toBeGreaterThanOrEqual(55);
      expect(height).toBeLessThanOrEqual(57);
    });
    expect(diagnostics.controls).toHaveLength(3);
    diagnostics.controls.forEach(control => {
      expect(control.left ?? control.x).toBeGreaterThanOrEqual(diagnostics.actions.x - 1);
      expect(control.right).toBeLessThanOrEqual(diagnostics.actions.right + 1);
      expect(control.height).toBeGreaterThanOrEqual(47);
      expect(control.height).toBeLessThanOrEqual(49);
    });
    expect(diagnostics.actions.height).toBeLessThanOrEqual(57);
    if (diagnostics.waitingCount === 0) expect(diagnostics.bottomTrayVisible).toBeFalsy();
    expect(pageErrors).toEqual([]);
  });
});
