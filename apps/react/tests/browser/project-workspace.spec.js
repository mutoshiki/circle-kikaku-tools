import { test, expect } from '@playwright/test';

const preferenceKey = 'sanpo-react:theme-preference:v1';

test('project entry follows system Carbon theme preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(key => localStorage.removeItem(key), preferenceKey);
  await page.goto('/');
  const application = page.locator('.application');
  await expect(application).toHaveClass(/cds--g100/);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(application).toHaveClass(/cds--g10/);
});

test('project entry honors a saved Carbon theme preference', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, 'dark'), preferenceKey);
  await page.goto('/');
  const application = page.locator('.application');
  await expect(application).toHaveClass(/cds--g100/);
  await page.reload();
  await expect(application).toHaveClass(/cds--g100/);
});

test('root lists browser-local projects without generating a room id', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '企画', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('room')).toBe(false);
  await expect(page.getByRole('button', { name: '新しい企画を作成' })).toBeVisible();
  const headerBottom = await page.locator('.app-header').evaluate(element => element.getBoundingClientRect().bottom);
  const mainTop = await page.locator('#main-content').evaluate(element => element.getBoundingClientRect().top);
  expect(mainTop).toBeGreaterThanOrEqual(headerBottom);
});

test('legacy=1 keeps a direct way back to the original four-tab project screen', async ({ page }) => {
  await page.goto('/?legacy=1');
  await expect(page.getByRole('tab', { name: '参加者' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '車割' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '班割' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '精算' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'ツール' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('room')).toBe(true);
});

test('create flow saves template intent once and opens the selected existing app view', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.getByLabel('企画名').fill('ブラウザ作成確認');
  await page.getByRole('button', { name: '企画を作成' }).click();
  await expect(page.getByRole('heading', { name: 'ブラウザ作成確認' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('seisan');
  await expect(page.getByRole('tab', { name: '参加者' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '車割' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '精算' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'ツール' }).click();
  await expect(page.getByRole('heading', { name: '利用できるツール' })).toBeVisible();
  await page.locator('label[for="workspace-enabled-team"]').click();
  await page.locator('label[for="workspace-pinned-team"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '班割' })).toBeVisible();
});

test('custom project can have no pinned tools and opens optional tools within Tools', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名').fill('カスタム企画');
  await page.getByRole('button', { name: '企画を作成' }).click();
  await expect(page.getByRole('heading', { name: 'カスタム企画' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('tools');
  await page.locator('label[for="workspace-enabled-application-form"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('heading', { name: '応募フォーム' })).toBeVisible();
  await expect(page.getByText('この企画に応募フォームを作成し、応募者情報を企画へ連携します。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'この企画に応募フォームを作成' })).toBeVisible();
  await page.getByRole('button', { name: 'この企画に応募フォームを作成' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'フォームメーカーを開けません' })).toBeVisible();
  await expect(page.getByText('企画ルームに接続できません。通信を確認してください。')).toBeVisible();
});

test('mountain-plan tool passes only project metadata in the supported handoff fragment', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名').fill('登山メーカー入口確認');
  await page.getByRole('button', { name: '企画を作成' }).click();
  await page.locator('label[for="workspace-enabled-mountain-plan"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await page.getByRole('button', { name: '開く' }).click();
  const link = page.getByRole('link', { name: '企画情報を引き継いで開く' });
  const href = new URL(await link.getAttribute('href'));
  expect(`${href.origin}${href.pathname}`).toBe('https://mutoshiki.github.io/tozan-keikaku-syo-maker/');
  expect(JSON.parse(new URLSearchParams(href.hash.slice(1)).get('sanpo-project'))).toEqual({
    version: 1,
    roomId: new URL(page.url()).searchParams.get('room'),
    projectName: '登山メーカー入口確認企画',
    eventDate: '',
  });
  await expect(page.getByText(/参加者情報は送信しません/)).toBeVisible();
});
