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
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('room')).toBe(false);
  await expect(page.getByRole('button', { name: '新しい企画を作成' })).toBeVisible();
  await expect(page.getByText('この一覧は、このブラウザーで開いた企画の履歴です。他の端末とは共有されません。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '最近開いた企画はありません' })).toBeVisible();
  await expect(page.getByText('共有リンクから企画を開くと、ここに追加されます。')).toBeVisible();
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
  await expect(page.getByText('テンプレートはツールの初期設定です。作成後に「ツール」から、利用するツールやタブに固定するツールを変更できます。')).toBeVisible();
  await expect(page.getByText('このテンプレートではアクセスを制限しません。共有リンクを知っている人は企画を開けます。')).toBeVisible();
  await expect(page.getByText('作成時にタブへ固定するツール：参加者、車割、精算')).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('ブラウザ作成確認');
  await page.getByRole('button', { name: '企画を作成' }).click();
  await expect(page.getByRole('heading', { name: 'ブラウザ作成確認' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('seisan');
  await expect(page.getByRole('tab', { name: '参加者' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '車割' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '精算' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: '使い方' }).click();
  const guide = page.getByRole('dialog', { name: '使い方' });
  await expect(guide.getByText('使うツールは企画ごとに選べます。タブに固定していないツールは「ツール」から開けます。')).toBeVisible();
  await expect(guide.getByText(/人数だけで精算することもできます/)).toBeVisible();
  await guide.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('tab', { name: 'ツール' }).click();
  await expect(page.getByRole('heading', { name: '利用するツール' })).toBeVisible();
  await expect(page.getByText('この企画で利用するツールと、タブに固定するツールを設定します。')).toBeVisible();
  await expect(page.getByText('固定を解除したツールは「ツール」から開けます。利用を解除しても、保存済みデータは削除されません。')).toBeVisible();
  await page.locator('label[for="workspace-enabled-team"]').click();
  await page.locator('label[for="workspace-pinned-team"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '班割' })).toBeVisible();
});

test('custom project can have no pinned tools and opens optional tools within Tools', async ({ page }) => {
  await page.goto('/?screen=create');
  await expect(page.getByText('テンプレートはツールの初期設定です。作成後に「ツール」から、利用するツールやタブに固定するツールを変更できます。')).toBeVisible();
  await page.locator('label[for="template-custom"]').click();
  await expect(page.getByText('使うツールを選んでください。')).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('カスタム企画');
  await page.getByRole('button', { name: '企画を作成' }).click();
  await expect(page.getByRole('heading', { name: 'カスタム企画' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('tools');
  await page.locator('label[for="workspace-enabled-application-form"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('heading', { name: '応募フォーム' })).toBeVisible();
  await expect(page.getByText('企画名と実施日（登録済みの場合）をフォームメーカーに引き継ぎます。フォームメーカーで編集用メールアドレスや応募締切などを入力して作成してください。作成後は、応募回答から参加者にする人を選べます。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'フォームメーカーで作成を続ける' })).toBeVisible();
  await page.getByRole('button', { name: 'フォームメーカーで作成を続ける' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'フォームメーカーを開く準備ができません' })).toBeVisible();
  await expect(page.getByText('企画データに接続できません。通信状態を確認して、もう一度お試しください。')).toBeVisible();

  await page.getByRole('button', { name: 'ツール一覧へ戻る' }).click();
  await page.locator('label[for="workspace-enabled-submission-documents"]').click();
  await page.getByRole('button', { name: '設定を保存' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await page.locator('.project-tool-setting').filter({ hasText: '学務書類' }).getByRole('button', { name: '開く' }).click();
  await expect(page.getByText('フォームと連携済みで、作成用リンクから開いた企画では、確定した参加者の学務書類用CSVを作成できます。')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Windowsアプリのダウンロードページを開く' })).toBeVisible();
});

test('project history labels whether its timestamp is the last visit or last update', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sanpokai_portal_project_history_v1', JSON.stringify({
      version: 1,
      projects: [
        { roomId: 'LIST-ROOM-001', name: '訪問履歴の企画', lastOpenedAt: Date.UTC(2026, 9, 30, 10, 0) },
        { roomId: 'LIST-ROOM-002', name: '更新履歴の企画', updatedAt: Date.UTC(2026, 9, 29, 10, 0) },
      ],
    }));
  });
  await page.goto('/');
  await expect(page.getByText(/^最終閲覧：/)).toBeVisible();
  await expect(page.getByText(/^最終更新：/)).toBeVisible();
});

test('mountain-plan tool passes project metadata and explains the explicit date-apply action', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名（任意）').fill('登山メーカー入口確認');
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
  await expect(page.getByText('企画名と実施日を登山計画書メーカーに渡します。メーカーで企画名を確認できます。実施日は「実施日に反映」を選ぶと入力でき、入力済みの日付は上書きされません。')).toBeVisible();
});
