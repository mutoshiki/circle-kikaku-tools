import { test, expect } from '@playwright/test';

const expectedLinks = [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
];

async function sideNavExpanded(drawer) {
  return drawer.evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')));
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(String(viewport.width) + 'px restored title reveal and official Carbon application navigation', async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('/');
    await page.waitForFunction(() => [
      'cds-header',
      'cds-header-menu-button',
      'cds-header-name',
      'cds-side-nav',
      'cds-side-nav-link',
      'cds-text-input'
    ].every(name => customElements.get(name))
      && document.querySelector('#projectTitleEditor')
      && document.querySelector('#roomNameInput')?.dataset.projectTitleValueBridge === 'true');

    const title = page.locator('#projectTitleRegion');
    const input = page.locator('#roomNameInput');
    const editor = page.locator('#projectTitleEditor');
    await expect(title).toHaveAttribute('data-state', 'expanded');
    await expect(input).toHaveAttribute('placeholder', '企画名を入力');
    await expect(input).toHaveAttribute('aria-hidden', 'true');
    await expect(editor).toHaveAttribute('data-placeholder', '企画名を入力');
    await expect(editor).toBeVisible();
    await expect(input).toHaveJSProperty('value', '');

    const expectedTypography = viewport.width <= 768
      ? { fontSize: '42px', minHeight: '56px', lineHeight: '46.2px' }
      : { fontSize: '54px', minHeight: '64px', lineHeight: '56.7px' };
    const typography = await editor.evaluate(node => {
      const style = getComputedStyle(node);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        minHeight: style.minHeight,
        paddingBottom: style.paddingBottom
      };
    });
    expect(typography).toEqual({ ...expectedTypography, fontWeight: '300', paddingBottom: '8px' });

    await editor.fill('紅葉ハイク最終版');
    await expect.poll(() => input.evaluate(node => node.value)).toBe('紅葉ハイク最終版');
    await expect.poll(() => page.evaluate(() => getData({ skipDomSync: true }).roomName)).toBe('紅葉ハイク最終版');
    await expect(editor).toHaveText('紅葉ハイク最終版');

    // roomName remains the shared snapshot field. Remote/restore writes must update the
    // restored visual title without creating a second persistence owner.
    await page.evaluate(() => {
      const snapshot = getData({ skipDomSync: true });
      snapshot.roomName = '共有された企画名';
      restore(snapshot);
    });
    await expect.poll(() => input.evaluate(node => node.value)).toBe('共有された企画名');
    await expect(editor).toHaveText('共有された企画名');
    await expect.poll(() => page.evaluate(() => getData({ skipDomSync: true }).roomName)).toBe('共有された企画名');

    if (viewport.width <= 390) {
      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 180, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 148, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 148, pointerId: 1, isPrimary: true });
    } else {
      await page.dispatchEvent('#top-area', 'wheel', { deltaY: 120 });
    }
    await expect(title).toHaveAttribute('data-state', 'collapsed');
    await expect.poll(() => title.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);

    if (viewport.width <= 390) {
      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 120, pointerId: 2, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 152, pointerId: 2, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 152, pointerId: 2, isPrimary: true });
    } else {
      await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });
    }
    await expect(title).toHaveAttribute('data-state', 'expanded');
    await expect(editor).toBeVisible();

    const header = page.locator('#app-header');
    const menu = page.locator('#overviewMenuBtn');
    const drawer = page.locator('#overviewDrawer');
    expect(await header.evaluate(node => node.tagName)).toBe('CDS-HEADER');
    expect(await menu.evaluate(node => node.tagName)).toBe('CDS-HEADER-MENU-BUTTON');
    expect(await drawer.evaluate(node => node.tagName)).toBe('CDS-SIDE-NAV');
    await expect(drawer).not.toBeVisible();

    await menu.click();
    await expect.poll(() => sideNavExpanded(drawer)).toBeTruthy();
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox.x).toBeGreaterThanOrEqual(-1);
    expect(drawerBox.width).toBeGreaterThan(150);
    await expect(page.locator('#overviewMemoInput')).toHaveCount(0);
    await expect(page.locator('#overviewTimetableRows')).toHaveCount(0);
    const actualLinks = await drawer.locator('cds-side-nav-link[target="_blank"]').evaluateAll(links => links.map(link => [
      link.textContent.trim(),
      link.getAttribute('href'),
      link.getAttribute('target'),
      link.getAttribute('rel')
    ]));
    expect(actualLinks).toEqual(expectedLinks.map(([label, href]) => [label, href, '_blank', 'noopener noreferrer']));

    const reportLink = drawer.locator('#bugReportMenuItem');
    await expect(reportLink).toHaveText('バグを報告する');
    await reportLink.click();
    await expect.poll(() => sideNavExpanded(drawer)).toBeFalsy();
    await expect(drawer).not.toBeVisible();
    const reportModal = page.locator('#bugReportModal');
    await expect(reportModal).toHaveAttribute('open', '');
    await expect(reportModal.locator('cds-modal-heading')).toHaveText('バグを報告する');
    await expect(reportModal.locator('#bugReportMessage')).toHaveAttribute('label', 'バグの内容');
    await expect(reportModal.locator('#bugReportSubmitBtn')).toHaveText('送信');
    await reportModal.locator('cds-modal-close-button').evaluate(node => node.click());

    await menu.click();
    await expect.poll(() => sideNavExpanded(drawer)).toBeTruthy();
    await expect(drawer).toBeVisible();
    await menu.click();
    await expect.poll(() => sideNavExpanded(drawer)).toBeFalsy();
    await expect(drawer).not.toBeVisible();

    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      await expect(editor).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}

test('390px title expands as the active scroll container reaches the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#projectTitleEditor') && customElements.get('cds-text-input'));

  const title = page.locator('#projectTitleRegion');
  await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 180, pointerId: 11, isPrimary: true });
  await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 148, pointerId: 11, isPrimary: true });
  await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 148, pointerId: 11, isPrimary: true });
  await expect(title).toHaveAttribute('data-state', 'collapsed');

  await page.evaluate(() => {
    const scroller = document.getElementById('top-area');
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 24 });
    scroller.dispatchEvent(new Event('scroll'));
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event('scroll'));
  });

  await expect(title).toHaveAttribute('data-state', 'expanded');
  await expect.poll(() => title.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(1);
  await expect(page.locator('#projectTitleEditor')).toBeVisible();
});
