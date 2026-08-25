import { test, expect } from '@playwright/test';

const expectedLinks = [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
];

async function setCarbonValue(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
}

async function sideNavExpanded(drawer) {
  return drawer.evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')));
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(String(viewport.width) + 'px title reveal and official Carbon application navigation', async ({ page }) => {
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
    ].every(name => customElements.get(name)));

    const title = page.locator('#projectTitleRegion');
    const input = page.locator('#roomNameInput');
    await expect(title).toHaveAttribute('data-state', 'expanded');
    await expect(input).toHaveAttribute('placeholder', '企画名を入力');
    await expect(page.locator('#projectTitleEditor,[contenteditable]')).toHaveCount(0);
    await expect(input).toHaveJSProperty('value', '');

    await setCarbonValue(page, '#roomNameInput', '紅葉ハイク最終版');
    await expect.poll(() => input.evaluate(node => node.value)).toBe('紅葉ハイク最終版');
    await expect.poll(() => page.evaluate(() => getData({ skipDomSync: true }).roomName)).toBe('紅葉ハイク最終版');

    // roomName remains the shared snapshot field. Remote/restore writes should feed the
    // same visible Carbon input directly instead of a second editable surface.
    await page.evaluate(() => {
      const snapshot = getData({ skipDomSync: true });
      snapshot.roomName = '共有された企画名';
      restore(snapshot);
    });
    await expect.poll(() => input.evaluate(node => node.value)).toBe('共有された企画名');
    expect(await page.evaluate(() => getData({ skipDomSync: true }).roomName)).toBe('共有された企画名');

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

    const header = page.locator('#app-header');
    const menu = page.locator('#overviewMenuBtn');
    const drawer = page.locator('#overviewDrawer');
    expect(await header.evaluate(node => node.tagName)).toBe('CDS-HEADER');
    expect(await menu.evaluate(node => node.tagName)).toBe('CDS-HEADER-MENU-BUTTON');
    expect(await drawer.evaluate(node => node.tagName)).toBe('CDS-SIDE-NAV');

    await menu.evaluate(node => node.click());
    await expect.poll(() => sideNavExpanded(drawer)).toBeTruthy();
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
    await reportLink.evaluate(node => node.click());
    await expect.poll(() => sideNavExpanded(drawer)).toBeFalsy();
    const reportModal = page.locator('#bugReportModal');
    await expect(reportModal).toHaveAttribute('open', '');
    await expect(reportModal.locator('cds-modal-heading')).toHaveText('バグを報告する');
    await expect(reportModal.locator('#bugReportMessage')).toHaveAttribute('label', 'バグの内容');
    await expect(reportModal.locator('#bugReportSubmitBtn')).toHaveText('送信');
    await reportModal.locator('cds-modal-close-button').evaluate(node => node.click());

    await menu.evaluate(node => node.click());
    await expect.poll(() => sideNavExpanded(drawer)).toBeTruthy();
    await menu.evaluate(node => node.click());
    await expect.poll(() => sideNavExpanded(drawer)).toBeFalsy();

    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      await expect(input).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}

test('390px title expands as the active scroll container reaches the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#projectTitleRegion') && customElements.get('cds-text-input'));

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
});
