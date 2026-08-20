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
      const projectTitle = document.querySelector('#projectTitleRegion');
      const projectTitleEditor = document.querySelector('#projectTitleEditor');
      const tabShadow = document.querySelector('#view-toggle-bar')?.shadowRoot;
      return {
        navPosition: getComputedStyle(nav).position,
        headerBottom: headerRect.bottom,
        projectTitleTop: projectTitle?.getBoundingClientRect().top ?? -1,
        projectTitleBottom: projectTitle?.getBoundingClientRect().bottom ?? -1,
        projectTitleHeight: projectTitle?.getBoundingClientRect().height ?? 0,
        projectTitleState: projectTitle?.dataset.state || '',
        projectTitleEditorText: projectTitleEditor?.textContent || '',
        projectTitlePlaceholder: projectTitleEditor?.dataset.placeholder || '',
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
        roomInputVisibility: roomInput ? getComputedStyle(roomInput.closest('.app-room-field')).position : 'missing',
        visibleOverflowButtons: [...(tabShadow?.querySelectorAll('.cds--tab--overflow-nav-button') || [])].filter(button => {
          const box = button.getBoundingClientRect();
          return getComputedStyle(button).display !== 'none' && box.width > 0 && box.height > 0;
        }).length
      };
    });

    expect(shellGeometry.navPosition).not.toBe('fixed');
    expect(Math.abs(shellGeometry.projectTitleTop - shellGeometry.headerBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(shellGeometry.navTop - shellGeometry.projectTitleBottom)).toBeLessThanOrEqual(1);
    expect(shellGeometry.projectTitleHeight).toBeGreaterThanOrEqual(200);
    expect(shellGeometry.projectTitleState).toBe('expanded');
    expect(shellGeometry.projectTitleEditorText).toBe('秋名山登山企画');
    expect(shellGeometry.projectTitlePlaceholder).toBe('企画名を入力');
    expect(shellGeometry.navHeight).toBeGreaterThanOrEqual(40);
    expect(shellGeometry.navHeight).toBeLessThanOrEqual(42);
    expect(shellGeometry.firstViewContentTop).toBeGreaterThanOrEqual(shellGeometry.navBottom);
    expect(shellGeometry.headerBackground).toBe('rgb(22, 22, 22)');
    expect(shellGeometry.navBackground).toBe('rgb(0, 0, 0)');
    expect(shellGeometry.brand).toBe('サークル企画ツール');
    expect(shellGeometry.labels).toEqual(['共有画面', '精算', '車割', '班割']);
    expect(shellGeometry.shareSize).toEqual({ width: 48, height: 48 });
    expect(shellGeometry.switcherSize).toEqual({ width: 48, height: 48 });
    expect(shellGeometry.roomInputVisibility).toBe('absolute');
    expect(shellGeometry.visibleOverflowButtons).toBe(0);

    await page.dispatchEvent('#top-area', 'wheel', { deltaY: 120 });
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');
    await expect.poll(() => page.locator('#projectTitleRegion').evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');

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
    await page.mouse.move(Math.min(viewport.width - 24, 200), 140);
    await page.evaluate(() => {
      const active = document.activeElement;
      active?.blur?.();
      document.querySelector('.header-app-switcher')?.blur?.();
    });
    await expect(page.locator('#syncStatusBadge')).not.toHaveClass(/is-visible/, { timeout: 5000 });
    await page.waitForTimeout(250);

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
