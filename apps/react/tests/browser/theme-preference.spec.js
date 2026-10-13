import { test, expect } from '@playwright/test';

const preferenceKey = 'sanpo-react:theme-preference:v1';

test('Carbon theme follows device color changes when no app override is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(key => localStorage.removeItem(key), preferenceKey);
  await page.goto('/?room=THEME-SYSTEM-FOLLOW');

  const application = page.locator('.application');
  await expect(application).toHaveClass(/cds--g100/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(application).toHaveClass(/cds--g10/);
});

test('manual theme choice persists until returning to the device setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(key => {
    if (sessionStorage.getItem('theme-preference-test-initialized')) return;
    localStorage.removeItem(key);
    sessionStorage.setItem('theme-preference-test-initialized', 'yes');
  }, preferenceKey);
  await page.goto('/?room=THEME-APP-OVERRIDE');

  const application = page.locator('.application');
  await expect(application).toHaveClass(/cds--g100/);
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'ライトモードに切り替え', exact: true }).click();
  await expect(application).toHaveClass(/cds--g10/);
  await expect(page.getByRole('button', { name: 'その他の操作' })).toBeVisible();

  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(application).toHaveClass(/cds--g10/);
  await page.reload();
  await expect(application).toHaveClass(/cds--g10/);

  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: '端末設定に合わせる', exact: true }).click();
  await expect(application).toHaveClass(/cds--g100/);
  await page.reload();
  await expect(application).toHaveClass(/cds--g100/);
});
