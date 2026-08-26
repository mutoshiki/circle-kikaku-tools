import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width}px Carbon shell light/dark surfaces render without page overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-header') && customElements.get('cds-text-input') && document.querySelector('#projectTitleEditor'));
    await page.evaluate(() => window.executeDebugMode?.());
    await page.evaluate(() => window.switchView('list'));
    await expect(page.locator('#assignmentWorkspaceHeader')).toBeVisible();

    // Debug/sample rendering may preserve a non-zero allocation scroll position on very narrow
    // viewports. Put the active surface at its canonical visual-inspection origin before measuring
    // the expanded shell. The title reveal behavior itself is covered by its dedicated regression.
    await page.evaluate(() => {
      const top = innerWidth <= 768 ? document.querySelector('#app-layout') : document.querySelector('#top-area');
      if (!top) return;
      top.scrollTop = 0;
      top.dispatchEvent(new Event('scroll'));
    });
    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');
    await expect.poll(() => page.locator('#projectTitleRegion').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(200);

    const shellGeometry = await page.evaluate(() => {
      const header = document.querySelector('#app-header');
      const nav = document.querySelector('#app-view-navigation');
      const firstViewContent = document.querySelector('#assignmentWorkspaceHeader, #top-area > #cars-container');
      const headerRect = header.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const firstViewContentRect = firstViewContent.getBoundingClientRect();
      const tabs = [...document.querySelectorAll('#view-toggle-bar .view-tab')].filter(tab => {
        const box = tab.getBoundingClientRect();
        const style = getComputedStyle(tab);
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      const share = document.querySelector('#assignmentShareBtn');
      const shellShare = document.querySelector('#shareLinkBtn');
      const allocationSwitcher = document.querySelector('#assignmentTypeSwitcher');
      const switcher = document.querySelector('.header-app-switcher');
      const roomInput = document.querySelector('#roomNameInput');
      const titleEditor = document.querySelector('#projectTitleEditor');
      const projectTitle = document.querySelector('#projectTitleRegion');
      const tabShadow = document.querySelector('#view-toggle-bar')?.shadowRoot;
      const titleStyle = getComputedStyle(titleEditor);
      return {
        navPosition: getComputedStyle(nav).position,
        headerTag: header.tagName,
        sideNavTag: document.querySelector('#overviewDrawer')?.tagName || '',
        headerBottom: headerRect.bottom,
        projectTitleTop: projectTitle?.getBoundingClientRect().top ?? -1,
        projectTitleBottom: projectTitle?.getBoundingClientRect().bottom ?? -1,
        projectTitleHeight: projectTitle?.getBoundingClientRect().height ?? 0,
        projectTitleState: projectTitle?.dataset.state || '',
        projectTitleValue: titleEditor?.textContent || '',
        projectTitlePlaceholder: titleEditor?.getAttribute('data-placeholder') || '',
        projectTitleFontSize: titleStyle.fontSize,
        projectTitleMinHeight: titleStyle.minHeight,
        projectTitleWeight: titleStyle.fontWeight,
        contenteditableCount: document.querySelectorAll('[contenteditable]').length,
        navTop: navRect.top,
        navBottom: navRect.bottom,
        firstViewContentTop: firstViewContentRect.top,
        navHeight: navRect.height,
        headerBackground: getComputedStyle(header).backgroundColor,
        navBackground: getComputedStyle(nav).backgroundColor,
        brand: document.querySelector('cds-header-name')?.textContent?.trim() || '',
        labels: tabs.map(tab => tab.querySelector('.view-tab-label')?.textContent?.trim() || ''),
        shareVisible: share ? share.getBoundingClientRect().width > 0 && share.getBoundingClientRect().height > 0 : false,
        shellShareVisible: shellShare ? shellShare.getBoundingClientRect().width > 0 && shellShare.getBoundingClientRect().height > 0 : false,
        allocationSwitcherVisible: allocationSwitcher ? allocationSwitcher.getBoundingClientRect().width > 0 && allocationSwitcher.getBoundingClientRect().height > 0 : false,
        switcherSize: switcher ? { width: switcher.getBoundingClientRect().width, height: switcher.getBoundingClientRect().height } : null,
        roomInputVisibility: roomInput ? getComputedStyle(roomInput.closest('.app-room-field')).position : 'missing',
        visibleOverflowButtons: [...(tabShadow?.querySelectorAll('.cds--tab--overflow-nav-button') || [])].filter(button => {
          const box = button.getBoundingClientRect();
          return getComputedStyle(button).display !== 'none' && box.width > 0 && box.height > 0;
        }).length
      };
    });

    expect(shellGeometry.headerTag).toBe('CDS-HEADER');
    expect(shellGeometry.sideNavTag).toBe('CDS-SIDE-NAV');
    expect(shellGeometry.contenteditableCount).toBe(1);
    expect(shellGeometry.navPosition).not.toBe('fixed');
    expect(Math.abs(shellGeometry.projectTitleTop - shellGeometry.headerBottom)).toBeLessThanOrEqual(1);
    expect(shellGeometry.navTop).toBeGreaterThanOrEqual(shellGeometry.projectTitleBottom);
    expect(shellGeometry.projectTitleHeight).toBeGreaterThanOrEqual(200);
    expect(shellGeometry.projectTitleState).toBe('expanded');
    expect(shellGeometry.projectTitleValue).toBe('秋名山登山企画');
    expect(shellGeometry.projectTitlePlaceholder).toBe('企画名を入力');
    expect(shellGeometry.projectTitleFontSize).toBe(viewport.width <= 768 ? '42px' : '54px');
    expect(shellGeometry.projectTitleMinHeight).toBe(viewport.width <= 768 ? '56px' : '64px');
    expect(shellGeometry.projectTitleWeight).toBe('300');
    expect(shellGeometry.navHeight).toBeGreaterThanOrEqual(40);
    expect(shellGeometry.navHeight).toBeLessThanOrEqual(42);
    expect(shellGeometry.firstViewContentTop).toBeGreaterThanOrEqual(shellGeometry.projectTitleBottom);
    expect(shellGeometry.headerBackground).toBe('rgb(22, 22, 22)');
    expect(shellGeometry.navBackground).toBe('rgb(0, 0, 0)');
    expect(shellGeometry.brand).toBe('サークル企画ツール');
    expect(shellGeometry.labels).toEqual(['参加者', '車割', '班割', '精算']);
    expect(shellGeometry.shareVisible).toBeFalsy();
    expect(shellGeometry.shellShareVisible).toBeTruthy();
    expect(shellGeometry.allocationSwitcherVisible).toBeFalsy();
    expect(shellGeometry.switcherSize).toEqual({ width: 48, height: 48 });
    expect(shellGeometry.roomInputVisibility).toBe('absolute');
    expect(shellGeometry.visibleOverflowButtons).toBeLessThanOrEqual(1);

    await page.locator('#tab-team').click();
    expect(await page.evaluate(() => document.body.dataset.activePlanTemplate)).toBe('team');
    await page.locator('#tab-seisan').evaluate(node => node.click());
    await page.locator('#tab-list').evaluate(node => node.click());
    // Carbon Web Components exposes the active tab through its reflected `highlighted`
    // boolean. aria-current is not the component's selected-state contract.
    await expect(page.locator('#tab-list')).toHaveJSProperty('highlighted', true);
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
      document.querySelectorAll('.app-status-toast').forEach(node => node.remove());
    });
    await expect(page.locator('#syncStatusBadge')).toHaveCount(0);
    await expect(page.locator('.app-status-toast')).toHaveCount(0);
    await page.waitForTimeout(250);

    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      for (const view of ['participants', 'list', 'team', 'seisan']) {
        await page.evaluate(next => window.switchView(next), view);
        await expect(page.locator('#app-view-navigation')).toBeVisible();
        await expect(page.locator('#projectTitleEditor')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
        await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-${theme}-${view}.png`) });
      }
    }
  });
}
