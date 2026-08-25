import { test, expect } from '@playwright/test';

test.describe('Official Carbon ownership runtime', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('UI Shell and project title are real Carbon components', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => [
      'cds-header',
      'cds-header-menu-button',
      'cds-header-name',
      'cds-side-nav',
      'cds-side-nav-link',
      'cds-text-input'
    ].every(name => customElements.get(name)));

    expect(await page.locator('#app-header').evaluate(node => node.tagName)).toBe('CDS-HEADER');
    expect(await page.locator('#overviewMenuBtn').evaluate(node => node.tagName)).toBe('CDS-HEADER-MENU-BUTTON');
    expect(await page.locator('#overviewDrawer').evaluate(node => node.tagName)).toBe('CDS-SIDE-NAV');
    await expect(page.locator('#overviewDrawer cds-side-nav-link')).toHaveCount(4);
    await expect(page.locator('#projectTitleRegion #roomNameInput')).toBeVisible();
    await expect(page.locator('[contenteditable]')).toHaveCount(0);
    await expect(page.locator('.app-nav-drawer,.app-nav-link,.app-nav-drawer-scrim')).toHaveCount(0);

    const titleState = await page.locator('#roomNameInput').evaluate(node => ({
      hidden: node.getAttribute('aria-hidden'),
      tabIndex: node.tabIndex,
      inert: node.inert
    }));
    expect(titleState).toEqual({ hidden: null, tabIndex: 0, inert: false });

    await page.locator('#overviewMenuBtn').evaluate(node => node.click());
    await expect.poll(() => page.locator('#overviewDrawer').evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')))).toBeTruthy();

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
