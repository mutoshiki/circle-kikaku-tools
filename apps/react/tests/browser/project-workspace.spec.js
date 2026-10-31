import { test, expect } from '@playwright/test';

const preferenceKey = 'sanpo-react:theme-preference:v1';

async function submitProjectCreation(page) {
  await page.getByRole('button', { name: '企画を作成', exact: true }).click();
  return page;
}

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
  await expect(page.getByRole('link', { name: '新しい企画を作成' })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: '新しい企画を作成' })).toHaveAttribute('rel', 'noopener');
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
  await expect(page.getByText('ツールの表示は、作成後も変更できます。')).toBeVisible();
  await expect(page.getByText('個人利用でも非公開にはなりません。共有リンクを知っている人は企画を見られます。')).toHaveCount(0);
  await expect(page.getByText('最初に表示：参加者、車割、精算')).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('ブラウザ作成確認');
  const projectPage = await submitProjectCreation(page);
  await expect(projectPage.getByRole('heading', { name: 'ブラウザ作成確認' })).toBeVisible();
  expect(new URL(projectPage.url()).searchParams.get('view')).toBe('seisan');
  await expect(projectPage.getByRole('tab', { name: '参加者' })).toBeVisible();
  await expect(projectPage.getByRole('tab', { name: '車割' })).toBeVisible();
  await expect(projectPage.getByRole('tab', { name: '精算' })).toHaveAttribute('aria-selected', 'true');
  await projectPage.getByRole('button', { name: 'その他の操作' }).click();
  await projectPage.getByRole('menuitem', { name: '使い方' }).click();
  const guide = projectPage.getByRole('dialog', { name: '使い方' });
  await expect(guide.getByText('使うツールは企画ごとに選べます。')).toBeVisible();
  await expect(guide.getByText(/人数だけでも精算できます/)).toBeVisible();
  await guide.getByRole('button', { name: '閉じる' }).click();
  await projectPage.getByRole('tab', { name: 'ツール' }).click();
  await expect(projectPage.getByRole('heading', { name: '利用するツール' })).toBeVisible();
  await expect(projectPage.getByText('使うツールと、タブに表示するツールを選びます。')).toBeVisible();
  await expect(projectPage.getByText('タブに表示しないツールは「ツール」から開けます。データは残ります。')).toBeVisible();
  await expect(projectPage.getByRole('heading', { name: 'タブの順序' })).toHaveCount(0);
  await projectPage.locator('label[for="workspace-enabled-team"]').click();
  await projectPage.locator('label[for="workspace-pinned-team"]').click();
  await projectPage.getByRole('button', { name: '設定を保存' }).click();
  await expect(projectPage.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await expect(projectPage.getByRole('tab', { name: '班割' })).toBeVisible();
});

test('custom project can have no pinned tools and opens optional tools within Tools', async ({ page }) => {
  await page.goto('/?screen=create');
  await expect(page.getByText('ツールの表示は、作成後も変更できます。')).toBeVisible();
  await page.locator('label[for="template-custom"]').click();
  await expect(page.getByText('使うツールを選んでください。')).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('カスタム企画');
  const projectPage = await submitProjectCreation(page);
  await expect(projectPage.getByRole('heading', { name: 'カスタム企画' })).toBeVisible();
  expect(new URL(projectPage.url()).searchParams.get('view')).toBe('tools');
  await projectPage.locator('label[for="workspace-enabled-application-form"]').click();
  await projectPage.getByRole('button', { name: '設定を保存' }).click();
  await expect(projectPage.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await projectPage.getByRole('button', { name: '開く' }).click();
  await expect(projectPage.locator('.form-maker-page')).toBeVisible();
  await expect(projectPage.getByText('「カスタム企画」に連携する応募フォームを作成します。')).toBeVisible();
  await expect(projectPage.getByRole('button', { name: /フォームを作成/ })).toBeVisible();

  await projectPage.getByRole('button', { name: 'ツール一覧へ戻る' }).click();
  await projectPage.locator('label[for="workspace-enabled-submission-documents"]').click();
  await projectPage.getByRole('button', { name: '設定を保存' }).click();
  await expect(projectPage.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await projectPage.locator('.project-tool-setting').filter({ hasText: '学務書類' }).getByRole('button', { name: '開く' }).click();
  await expect(projectPage.getByText('確定した参加者のCSVを作成します。')).toBeVisible();
  await expect(projectPage.getByRole('link', { name: '学務書類作成ツールをダウンロード' })).toBeVisible();
});

test('offline form workspace does not contact the production form service', async ({ page }) => {
  const productionRequests = [];
  page.on('request', request => {
    if (/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseio\.com/i.test(request.url())) productionRequests.push(request.url());
  });
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名（任意）').fill('ローカル確認');
  const projectPage = await submitProjectCreation(page);
  await projectPage.getByRole('tab', { name: 'ツール' }).click();
  await projectPage.locator('label[for="workspace-enabled-application-form"]').click();
  await projectPage.getByRole('button', { name: '設定を保存' }).click();
  await expect(projectPage.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await projectPage.locator('.project-tool-setting').filter({ hasText: '応募フォーム' }).getByRole('button', { name: '開く' }).click();
  await expect(projectPage.locator('.form-maker-page')).toBeVisible();
  await expect(projectPage.getByRole('button', { name: /応募フォームを作成/ })).toBeDisabled();
  expect(productionRequests).toEqual([]);
});

test('unpinning a mountain workspace does not discard input when returning to Tools', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名（任意）').fill('下書き保持の確認');
  const projectPage = await submitProjectCreation(page);
  await projectPage.getByRole('tab', { name: 'ツール' }).click();
  await projectPage.locator('label[for="workspace-enabled-mountain-plan"]').click();
  await projectPage.getByRole('button', { name: '設定を保存' }).click();
  await expect(projectPage.getByRole('status').filter({ hasText: 'ツール設定を保存しました' })).toBeVisible();
  await projectPage.locator('.project-tool-setting').filter({ hasText: '登山計画書' }).getByRole('button', { name: '開く' }).click();
  await expect(projectPage.locator('.mountain-plan-inline')).toBeVisible();
  await projectPage.locator('#eventDate').fill('2026-12-20');
  await projectPage.getByRole('button', { name: 'ツール一覧へ戻る' }).click();
  await projectPage.locator('.project-tool-setting').filter({ hasText: '登山計画書' }).getByRole('button', { name: '開く' }).click();
  await expect(projectPage.locator('#eventDate')).toHaveValue('2026-12-20');
});

test('all-tools debug sample is isolated and usable across project tools', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const externalWrites = [];
  page.on('request', request => {
    if (/firebaseio\.com|script\.google\.com|forms\.google\.com|googleapis\.com|debug-ai\.example\.invalid/i.test(request.url())) externalWrites.push(request.url());
  });
  const sampleContact = JSON.stringify({ plannerName: 'debug contact sentinel' });
  await page.addInitScript(value => { localStorage.setItem('tozanContactsV2', value); window.TOZAN_AI_ENDPOINT = 'https://debug-ai.example.invalid/analyze'; }, sampleContact);
  await page.goto('/?debugSample=all-tools&view=participants');
  await expect(page.getByRole('heading', { name: 'デバッグ用サンプル企画' })).toBeVisible();
  await expect(page.locator('.debug-sample-banner')).toHaveCount(0);
  await expect(page.getByText('架空データです。外部には送信されません。')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '初期状態に戻す' })).toHaveCount(0);
  for (const label of ['応募フォーム', '学務書類', '登山計画書', '参加者', '車割', '班割', '精算', 'ツール']) {
    await expect(page.getByRole('tab', { name: label })).toBeVisible();
  }
  await page.getByRole('button', { name: '参加者を選び直す' }).click();
  await expect(page.getByText('応募者01', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(page.getByText('フォームの作成・送信は行われません。')).toBeVisible();
  await expect(page.getByRole('button', { name: /フォームを作成/ })).toHaveCount(0);
  await page.getByRole('tab', { name: '学務書類' }).click();
  await page.getByRole('button', { name: 'CSVをプレビュー' }).click();
  const csvPreview = page.getByRole('dialog', { name: 'サンプルCSVプレビュー' });
  await expect(csvPreview.locator('pre')).toContainText('学籍番号');
  await expect(csvPreview.locator('pre')).toContainText('氏名');
  await expect(csvPreview).toContainText('ファイルの作成・外部送信は行いません');
  await csvPreview.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('tab', { name: '登山計画書' }).click();
  await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible();
  await expect(page.getByText(/から実施日を反映しました/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '実施日に反映' })).toHaveCount(0);
  await expect(page.locator('#rememberContacts')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('tozanContactsV2'))).toBe(sampleContact);
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S9sAAAAASUVORK5CYII=', 'base64');
  await page.locator('#route-file-input').setInputFiles({ name: 'sample-route.png', mimeType: 'image/png', buffer: tinyPng });
  await page.locator('#itinerary-file-input').setInputFiles({ name: 'sample-itinerary.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(page.locator('#route-upload-list img')).toHaveCount(2);
  await expect(page.locator('#itinerary-upload-list img')).toHaveCount(2);
  await expect.poll(() => externalWrites).toEqual([]);
  await expect(page.getByRole('status').filter({ hasText: '下書きを保存しました' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#eventDate')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator('.draft-controls__menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '今すぐ保存' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下書きを書き出す' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下書きを読み込む' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下書きを削除' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'サンプルを読み直す' })).toHaveCount(0);
  await expect(page.locator('.draft-controls')).toHaveCount(0);
  await page.getByRole('tab', { name: '参加者' }).click();
  await expect(page.getByRole('heading', { name: /応募者/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page.getByRole('tab', { name: '登山計画書' }).click();
  await expect.poll(() => externalWrites).toEqual([]);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(key => key.startsWith('sanpo-react:v1:'))).toBe(false);
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'サンプルを初期状態に戻す' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'デバッグ用サンプルを初期状態に戻しました。' })).toBeVisible();
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

test('mountain-plan opens inline without leaving the project tabs', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/?screen=create');
  await page.locator('label[for="template-circle-mountain"]').click();
  await page.getByLabel('企画名（任意）').fill('登山メーカー入口確認');
  const projectPage = await submitProjectCreation(page);
  await projectPage.getByRole('tab', { name: '登山計画書' }).click();
  await expect(projectPage.locator('.mountain-plan-inline')).toBeVisible();
  await expect(projectPage.getByRole('heading', { name: '基本情報' })).toBeVisible();
  await expect(projectPage.getByRole('link', { name: '登山計画書を作成' })).toHaveCount(0);
  await expect(projectPage.getByRole('tab', { name: 'ツール' })).toBeVisible();
  await projectPage.getByRole('tab', { name: '参加者' }).click();
  await expect(projectPage.getByRole('heading', { name: '参加者を登録して始める' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
