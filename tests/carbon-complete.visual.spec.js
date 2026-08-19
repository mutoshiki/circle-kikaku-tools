import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width}px Carbon shell light/dark surfaces render without page overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-button'));
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));

    const shellGeometry = await page.evaluate(() => {
      const header = document.querySelector('#app-header');
      const nav = document.querySelector('#app-view-navigation');
      const firstViewContent = document.querySelector('#top-area > .edit-header');
      const headerRect = header.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const firstViewContentRect = firstViewContent.getBoundingClientRect();
      const tabs = [...document.querySelectorAll('#view-toggle-bar .view-tab')];
      const share = document.querySelector('#shareLinkBtn');
      const switcher = document.querySelector('.header-app-switcher');
      const roomInput = document.querySelector('#roomNameInput');
      return {
        navPosition: getComputedStyle(nav).position,
        headerBottom: headerRect.bottom,
        navTop: navRect.top,
        navBottom: navRect.bottom,
        firstViewContentTop: firstViewContentRect.top,
        navHeight: navRect.height,
        headerBackground: getComputedStyle(header).backgroundColor,
        navBackground: getComputedStyle(nav).backgroundColor,
        brand: document.querySelector('.app-brand-title')?.textContent?.trim() || '',
        labels: tabs.map(tab => tab.querySelector('.view-tab-label')?.textContent?.trim() || ''),
        shareSize: share ? { width: share.getBoundingClientRect().width, height: share.getBoundingClientRect().height } : null,
        switcherSize: switcher ? { width: switcher.getBoundingClientRect().width, height: switcher.getBoundingClientRect().height } : null,
        roomInputVisibility: roomInput ? getComputedStyle(roomInput.closest('.app-room-field')).visibility : 'missing'
      };
    });

    expect(shellGeometry.navPosition).not.toBe('fixed');
    expect(Math.abs(shellGeometry.navTop - shellGeometry.headerBottom)).toBeLessThanOrEqual(1);
    expect(shellGeometry.navHeight).toBeGreaterThanOrEqual(47);
    expect(shellGeometry.navHeight).toBeLessThanOrEqual(49);
    expect(shellGeometry.firstViewContentTop).toBeGreaterThanOrEqual(shellGeometry.navBottom);
    expect(shellGeometry.headerBackground).toBe('rgb(22, 22, 22)');
    expect(shellGeometry.navBackground).toBe('rgb(0, 0, 0)');
    expect(shellGeometry.brand).toBe('サークル企画ツール');
    expect(shellGeometry.labels).toEqual(['共有画面', '精算', '車割', '班割']);
    expect(shellGeometry.shareSize).toEqual({ width: 48, height: 48 });
    expect(shellGeometry.switcherSize).toEqual({ width: 48, height: 48 });
    expect(shellGeometry.roomInputVisibility).toBe('hidden');

    await page.locator('#tab-team').evaluate(node => node.click());
    await expect(page.locator('#tab-team')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');
    await page.locator('#tab-list').evaluate(node => node.click());
    await expect(page.locator('#tab-list')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('car');

    const appSwitcher = page.locator('.header-app-switcher');
    await appSwitcher.click();
    await expect(appSwitcher).toHaveJSProperty('open', true);
    const menuLabels = await page.locator('.header-app-switcher > cds-menu > cds-menu-item').evaluateAll(items => items.map(item => item.getAttribute('label')));
    expect(menuLabels).toEqual(['使い方', 'サンプルデータ', expect.any(String), 'ロック']);
    await page.keyboard.press('Escape');
    await expect(appSwitcher).toHaveJSProperty('open', false);

    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      for (const view of ['list', 'sheet', 'seisan']) {
        await page.evaluate(next => window.switchView(next), view);
        await expect(page.locator('#app-view-navigation')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
        await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-${theme}-${view}.png`) });
      }
    }
  });
}
