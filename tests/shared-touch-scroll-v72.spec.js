import { test, expect } from '@playwright/test';

test.describe('Retired shared allocation destination', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('legacy shared allocation URLs normalize to the ordinary app and expose no shared tab', async ({ page }) => {
    const room = `LEGACY-SHARE-${Date.now()}`;
    await page.goto(`/?room=${room}&view=sheet&allocation=team`);
    await page.waitForFunction(() => window.SanpoAssignmentWorkspace && document.querySelector('#tab-team'));
    await page.waitForFunction(() => document.querySelectorAll('#view-toggle-bar > cds-tab').length === 4);

    await expect.poll(() => new URL(page.url()).searchParams.get('room')).toBe(room);
    await expect.poll(() => new URL(page.url()).searchParams.has('view')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has('allocation')).toBe(false);
    await expect(page.locator('#tab-sheet')).toHaveCount(0);
    await expect(page.locator('#sheet-view-area')).toBeHidden();
    await expect(page.locator('#app-view-navigation')).toBeVisible();
    await expect(page.locator('#assignmentWorkspaceRandomAction')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
  });
});
