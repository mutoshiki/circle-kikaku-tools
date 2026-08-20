import { test, expect } from '@playwright/test';

const expectedLinks = [
  ['山歩会フォームメイカー', 'https://script.google.com/macros/s/AKfycbwveM99euD8V5dxB6xLPYlpHuIc-KJlaaP8LHffh6ZMQBnAmO6XwX_ijQG-brUgqZmj/exec'],
  ['提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ポータル', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
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

    await page.locator('#top-area').evaluate(node => {
      node.scrollTop = 80;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(title).toHaveAttribute('data-state', 'collapsed');
    expect(await title.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);

    await page.locator('#top-area').evaluate(node => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(title).toHaveAttribute('data-state', 'collapsed');

    if (viewport.width <= 390) {
      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 120, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });
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
    const actualLinks = await drawer.locator('.app-nav-link').evaluateAll(links => links.map(link => [link.textContent.trim(), link.href, link.target, link.rel]));
    expect(actualLinks).toEqual(expectedLinks.map(([label, href]) => [label, href, '_blank', 'noopener noreferrer']));
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
