import { test, expect } from '@playwright/test';

const preferenceKey = 'sanpo-react:theme-preference:v1';

for (const [screen, url] of [['project', '/?room=THEME-SYSTEM-FOLLOW'], ['project list', '/'], ['project creation', '/?screen=create']]) {
  test(`${screen} theme follows device changes and ignores legacy saved preferences`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(key => localStorage.setItem(key, 'dark'), preferenceKey);
    await page.goto(url);

    const application = page.locator('.application');
    if (screen === 'project') await expect(page.getByRole('button', { name: '企画のリンクをコピー', exact: true })).toBeVisible();
    else await expect(page.getByRole('button', { name: '企画のリンクをコピー', exact: true })).toHaveCount(0);
    await expect(application).toHaveClass(/cds--g10/);
    if (screen === 'project') await expect(page.locator('.app-header-theme')).toHaveClass(/cds--g10/);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(application).toHaveClass(/cds--g100/);
    if (screen === 'project') await expect(page.locator('.app-header-theme')).toHaveClass(/cds--g100/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(application).toHaveClass(/cds--g10/);
    if (screen === 'project') await expect(page.locator('.app-header-theme')).toHaveClass(/cds--g10/);
    await page.reload();
    await expect(application).toHaveClass(/cds--g10/);
  });
}

test('legacy light preference is ignored when the device is dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(key => localStorage.setItem(key, 'light'), preferenceKey);
  await page.goto('/?room=THEME-LEGACY-LIGHT');
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
});
