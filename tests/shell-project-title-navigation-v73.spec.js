import { test, expect } from '@playwright/test';

const expectedLinks = [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
];

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(String(viewport.width) + 'px title reveal and application navigation', async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#projectTitleEditor') && customElements.get('cds-icon-button'));

    const title = page.locator('#projectTitleRegion');
    const editor = page.locator('#projectTitleEditor');
    await expect(title).toHaveAttribute('data-state', 'expanded');
    await expect(editor).toHaveAttribute('data-placeholder', '企画名を入力');
    await expect(title.locator('.carbon-icon,[data-carbon-icon]')).toHaveCount(0);
    expect((await editor.textContent())?.trim()).toBe('');

    await editor.click();
    await page.keyboard.type('紅葉ハイク');
    await expect.poll(() => page.locator('#roomNameInput').evaluate(node => node.value)).toBe('紅葉ハイク');
    expect((await editor.textContent())?.trim()).toBe('紅葉ハイク');

    // The exact value that existed before the local edit is a stale remote echo and must
    // not erase the title during its short debounce/write window.
    await page.evaluate(() => { document.getElementById('roomNameInput').value = ''; });
    await expect.poll(() => page.locator('#roomNameInput').evaluate(node => node.value)).toBe('紅葉ハイク');
    await expect(editor).toHaveText('紅葉ハイク');

    // Once editing focus is released, a genuinely different shared title is a concurrent
    // remote edit and must flow through even if this client never received a same-value echo
    // for its own save. The stale-echo guard must never become a permanent remote-write lock.
    await editor.evaluate(node => node.blur());
    await page.evaluate(() => { document.getElementById('roomNameInput').value = '共有された企画名'; });
    await expect.poll(() => page.locator('#roomNameInput').evaluate(node => node.value)).toBe('共有された企画名');
    await expect(editor).toHaveText('共有された企画名');

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

    const menu = page.locator('#overviewMenuBtn');
    await menu.click();
    const drawer = page.locator('#overviewDrawer');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#overviewMemoInput')).toHaveCount(0);
    await expect(page.locator('#overviewTimetableRows')).toHaveCount(0);
    const actualLinks = await drawer.locator('.app-nav-link[target="_blank"]').evaluateAll(links => links.map(link => [link.textContent.trim(), link.href, link.target, link.rel]));
    expect(actualLinks).toEqual(expectedLinks.map(([label, href]) => [label, href, '_blank', 'noopener noreferrer']));

    const reportLink = drawer.locator('#bugReportMenuItem');
    await expect(reportLink).toHaveText('バグを報告する');
    await reportLink.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    const reportModal = page.locator('#bugReportModal');
    await expect(reportModal).toHaveAttribute('open', '');
    await expect(reportModal.locator('cds-modal-heading')).toHaveText('バグを報告する');
    await expect(reportModal.locator('#bugReportMessage')).toHaveAttribute('label', 'バグの内容');
    await expect(reportModal.locator('#bugReportSubmitBtn')).toHaveText('送信');
    await reportModal.locator('cds-modal-close-button').click();

    await menu.click();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

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
  await page.waitForFunction(() => document.querySelector('#projectTitleRegion'));

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
