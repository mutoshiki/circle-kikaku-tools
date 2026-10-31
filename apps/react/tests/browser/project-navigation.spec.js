import { test, expect } from '@playwright/test';

test('opening the site shows the project list and opening a recent project uses a new tab', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sanpokai_portal_project_history_v1', JSON.stringify({ version: 1, projects: [{ roomId: 'OPEN-ME-001', name: '別タブで開く企画' }] })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: /別タブで開く企画/ }).click();
  const projectTab = await popupPromise;
  await expect(projectTab).toHaveURL(/room=OPEN-ME-001/);
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toBeVisible();
});

test('creating a project opens it in a new tab and leaves the project list available', async ({ page }) => {
  await page.goto('/');
  const createTabPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: '新しい企画を作成', exact: true }).click();
  const projectTab = await createTabPromise;
  await expect(projectTab.getByRole('heading', { name: '新しい企画', exact: true })).toBeVisible();
  await projectTab.getByLabel('企画名（任意）').fill('新しいタブの企画');
  await projectTab.getByRole('button', { name: '企画を作成', exact: true }).click();
  await expect(projectTab.getByRole('heading', { name: '新しいタブの企画', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toBeVisible();
});

test('project name is shown in the header and can be changed from its menu', async ({ page }) => {
  await page.goto('/?room=HEADER-NAME-001');
  await expect(page.locator('.app-header .cds--header__name')).toContainText('企画名未設定');
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '企画一覧へ' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '変更', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '企画名を変更', exact: true }).click();
  await page.getByRole('textbox', { name: '企画名' }).fill('ヘッダーから変更');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.app-header .cds--header__name')).toContainText('ヘッダーから変更');
});
