import { test, expect } from '@playwright/test';

test.describe('Official Carbon ownership runtime', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Carbon shell stays real while project title keeps the restored visual editor', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => [
      'cds-header',
      'cds-header-menu-button',
      'cds-header-name',
      'cds-side-nav',
      'cds-side-nav-link',
      'cds-text-input'
    ].every(name => customElements.get(name)) && document.querySelector('#projectTitleEditor'));

    expect(await page.locator('#app-header').evaluate(node => node.tagName)).toBe('CDS-HEADER');
    expect(await page.locator('#overviewMenuBtn').evaluate(node => node.tagName)).toBe('CDS-HEADER-MENU-BUTTON');
    expect(await page.locator('#overviewDrawer').evaluate(node => node.tagName)).toBe('CDS-SIDE-NAV');
    await expect(page.locator('#overviewDrawer cds-side-nav-link')).toHaveCount(4);

    const input = page.locator('#roomNameInput');
    const editor = page.locator('#projectTitleEditor');
    await expect(editor).toBeVisible();
    await expect(input).toHaveAttribute('aria-hidden', 'true');
    await expect(editor).toHaveAttribute('data-placeholder', '企画名を入力');
    const titleStyle = await editor.evaluate(node => {
      const style = getComputedStyle(node);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        minHeight: style.minHeight,
        paddingBottom: style.paddingBottom
      };
    });
    expect(titleStyle).toEqual({
      fontSize: '42px',
      fontWeight: '300',
      lineHeight: '46.2px',
      minHeight: '56px',
      paddingBottom: '8px'
    });

    await editor.fill('紅葉ハイク');
    await expect.poll(() => input.evaluate(node => node.value)).toBe('紅葉ハイク');
    await expect(editor).toHaveText('紅葉ハイク');

    const drawer = page.locator('#overviewDrawer');
    await expect(drawer).not.toBeVisible();
    await page.locator('#overviewMenuBtn').evaluate(node => node.click());
    await expect.poll(() => drawer.evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')))).toBeTruthy();
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox.x).toBeGreaterThanOrEqual(-1);
    expect(drawerBox.width).toBeGreaterThan(150);

    await page.locator('#bugReportMenuItem').evaluate(node => node.click());
    await expect(page.locator('#bugReportModal')).toHaveAttribute('open', '');
  });

  test('participant import help uses Carbon Accordion and Data Table', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-accordion') && customElements.get('cds-table'));
    await page.evaluate(() => window.openBatchModal());
    await expect(page.locator('#batchImportModal')).toHaveAttribute('open', '');

    await expect(page.locator('#batchImportHelpAccordion')).toHaveCount(1);
    await expect(page.locator('#batchImportHelpAccordion > cds-accordion-item')).toHaveCount(2);
    await expect(page.locator('#batchImportHelpAccordion details')).toHaveCount(0);
    await expect(page.locator('#batchImportHelpAccordion table')).toHaveCount(0);
    await expect(page.locator('#batchImportHelpAccordion cds-table.batch-auto-rule-table')).toHaveCount(1);
    await expect(page.locator('#batchImportHelpAccordion cds-table-header-cell')).toHaveCount(4);
    await expect(page.locator('#batchImportHelpAccordion cds-table-row')).toHaveCount(3);
  });
});
