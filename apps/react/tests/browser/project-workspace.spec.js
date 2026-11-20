import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';
import { createTemplateWorkspace, workspaceCacheKey } from '../../src/services/project-workspace.js';

const preferenceKey = 'sanpo-react:theme-preference:v1';

async function submitProjectCreation(page) {
  await page.getByRole('button', { name: '企画を作成', exact: true }).click();
  return page;
}

async function openTabEditor(page) {
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'タブを編集', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  await expect(page.locator('.project-tools-manager input[type="checkbox"]').first()).toBeEnabled();
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
test('project entry ignores a legacy saved Carbon theme preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(key => localStorage.setItem(key, 'dark'), preferenceKey);
  await page.goto('/');
  const application = page.locator('.application');
  await expect(application).toHaveClass(/cds--g10/);
  await page.reload();
  await expect(application).toHaveClass(/cds--g10/);
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
  await expect(page.getByRole('tab', { name: 'タブを編集' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('room')).toBe(true);
});

test('tab editor opens from the project menu and supports direct links and browser history', async ({ page }) => {
  const room = 'TAB-EDITOR-MENU-HISTORY';
  await page.goto(`/?room=${room}&view=participants`);
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'タブを編集', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'タブを編集', exact: true });
  await expect(heading).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('tools');
  await expect(heading).toBeFocused();

  await page.goBack();
  await expect(page.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('tools');
});

test('mobile tab selection keeps the complete active label visible and follows browser history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debugSample=all-tools&view=car');
  const tabList = page.locator('.project-tool-tabs [role="tablist"]');
  const selectedTab = () => tabList.locator('[aria-selected="true"]');
  const expectSelectedTabFits = async () => {
    await expect.poll(async () => {
      const geometry = await page.evaluate(() => {
      const container = document.querySelector('.project-tool-tabs');
      const list = container?.querySelector('[role="tablist"]');
      const active = list?.querySelector('[aria-selected="true"]');
      const leftArrow = container?.querySelector('button[aria-label="Scroll left"]');
      const rightArrow = container?.querySelector('button[aria-label="Scroll right"]');
      const listBounds = list?.getBoundingClientRect();
      const activeBounds = active?.getBoundingClientRect();
      const leftBounds = leftArrow?.getBoundingClientRect();
      const rightBounds = rightArrow?.getBoundingClientRect();
      const leftVisible = leftArrow && !leftArrow.classList.contains('cds--tab--overflow-nav-button--hidden');
      const rightVisible = rightArrow && !rightArrow.classList.contains('cds--tab--overflow-nav-button--hidden');
      return { listLeft: leftVisible ? leftBounds.right : listBounds?.left, listRight: rightVisible ? rightBounds.left : listBounds?.right, activeLeft: activeBounds?.left, activeRight: activeBounds?.right, activeWidth: activeBounds?.width };
      });
      return geometry.activeWidth > 0 && geometry.activeLeft >= geometry.listLeft - 1 && geometry.activeRight <= geometry.listRight + 1;
    }).toBe(true);
  };
  const expectAtTabEnd = async (direction, atEnd) => {
    const arrow = page.locator(`.project-tool-tabs button[aria-label="Scroll ${direction}"]`);
    if (atEnd) await expect(arrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    else await expect(arrow).not.toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    const geometry = await tabList.evaluate(list => ({ left: list.scrollLeft, max: list.scrollWidth - list.clientWidth }));
    const expected = direction === 'left' ? 0 : geometry.max;
    if (atEnd) expect(Math.abs(expected - geometry.left)).toBeLessThanOrEqual(1);
    else if (direction === 'left') expect(geometry.left).toBeGreaterThan(0);
    else expect(geometry.left).toBeLessThan(geometry.max);
  };
  await expect(selectedTab()).toHaveText('車割');
  await expectSelectedTabFits();
  await expectAtTabEnd('left', await tabList.evaluate(list => list.scrollLeft <= 1));
  const beforeArrow = { view: new URL(page.url()).searchParams.get('view'), label: await selectedTab().innerText() };
  const beforeRightScroll = await tabList.evaluate(list => list.scrollLeft);
  const scrollRight = page.locator('.project-tool-tabs button[aria-label="Scroll right"]');
  await scrollRight.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(beforeArrow.view);
  await expect(selectedTab()).toHaveText(beforeArrow.label);
  await expect.poll(() => tabList.evaluate(list => list.scrollLeft)).toBeGreaterThan(beforeRightScroll);
  await expect.poll(() => page.locator('.project-tool-tabs button[aria-label="Scroll right"]').evaluate(button => button.classList.contains('cds--tab--overflow-nav-button--hidden'))).toBe(false);
  await expect.poll(async () => page.locator('.project-tool-tabs [role="tablist"]').evaluate(list => {
    const position = list.scrollLeft;
    return [...list.querySelectorAll('[role="tab"]')].some(tab => Math.abs(tab.offsetLeft - list.offsetLeft - position) <= 1);
  })).toBe(true);
  const scrollRightArrow = page.locator('.project-tool-tabs button[aria-label="Scroll right"]');
  for (let step = 0; step < 8; step += 1) {
    const position = await tabList.evaluate(list => ({ left: list.scrollLeft, max: list.scrollWidth - list.clientWidth }));
    if (position.left >= position.max - 1) break;
    await expect(scrollRightArrow).not.toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    const before = await tabList.evaluate(list => list.scrollLeft);
    await scrollRightArrow.click();
    await expect.poll(() => tabList.evaluate(list => list.scrollLeft)).toBeGreaterThan(before);
  }
  await expectAtTabEnd('right', true);
  const scrollLeft = page.locator('.project-tool-tabs button[aria-label="Scroll left"]');
  for (let step = 0; step < 8; step += 1) {
    if (await tabList.evaluate(list => list.scrollLeft <= 1)) break;
    await expect(scrollLeft).not.toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    const before = await tabList.evaluate(list => list.scrollLeft);
    await scrollLeft.click();
    await expect.poll(() => tabList.evaluate(list => list.scrollLeft)).toBeLessThan(before);
  }
  await expectAtTabEnd('left', true);
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(beforeArrow.view);
  await expect(selectedTab()).toHaveText(beforeArrow.label);
  await expect.poll(async () => page.locator('.project-tool-tabs [role="tablist"]').evaluate(list => {
    const position = list.scrollLeft;
    return [...list.querySelectorAll('[role="tab"]')].some(tab => Math.abs(tab.offsetLeft - list.offsetLeft - position) <= 1);
  })).toBe(true);
  await page.setViewportSize({ width: 320, height: 780 });
  await selectedTab().focus();
  await page.keyboard.press('ArrowRight');
  await expect(selectedTab()).toHaveText('班割');
  await expectSelectedTabFits();
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'タブを編集', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('tab', { name: '班割', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectSelectedTabFits();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
});

test('viewport resize keeps the selected project tab visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?debugSample=all-tools&view=seisan');
  const tabList = page.locator('.project-tool-tabs [role="tablist"]');
  const selectedTab = tabList.locator('[aria-selected="true"]');
  await expect(selectedTab).toHaveText('精算');

  await page.setViewportSize({ width: 320, height: 780 });
  await expect.poll(async () => {
    return page.evaluate(() => {
      const container = document.querySelector('.project-tool-tabs');
      const list = container?.querySelector('[role="tablist"]');
      const active = list?.querySelector('[aria-selected="true"]');
      const leftArrow = container?.querySelector('button[aria-label="Scroll left"]');
      const rightArrow = container?.querySelector('button[aria-label="Scroll right"]');
      const listBounds = list?.getBoundingClientRect();
      const activeBounds = active?.getBoundingClientRect();
      const leftBounds = leftArrow?.getBoundingClientRect();
      const rightBounds = rightArrow?.getBoundingClientRect();
      const leftVisible = leftArrow && !leftArrow.classList.contains('cds--tab--overflow-nav-button--hidden');
      const rightVisible = rightArrow && !rightArrow.classList.contains('cds--tab--overflow-nav-button--hidden');
      const visibleLeft = leftVisible ? leftBounds.right : listBounds?.left;
      const visibleRight = rightVisible ? rightBounds.left : listBounds?.right;
      return activeBounds?.width > 0 && activeBounds.left >= visibleLeft - 1 && activeBounds.right <= visibleRight + 1;
    });
  }).toBe(true);
  await expect(selectedTab).toHaveText('精算');
});

test('overflow arrows follow one, four, and all visible project tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debugSample=all-tools&view=participants');
  const tabList = page.locator('.project-tool-tabs [role="tablist"]');
  const leftArrow = page.locator('.project-tool-tabs button[aria-label="Scroll left"]');
  const rightArrow = page.locator('.project-tool-tabs button[aria-label="Scroll right"]');
  await openTabEditor(page);
  for (const id of ['application-form', 'submission-documents', 'mountain-plan', 'car', 'team', 'settlement']) {
    const checkbox = page.locator(`#workspace-tab-visible-${id}`);
    if (await checkbox.isChecked()) await page.locator(`label[for="workspace-tab-visible-${id}"]`).click();
  }
  await page.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(leftArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
  await expect(rightArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);

  await openTabEditor(page);
  for (const id of ['car', 'team', 'settlement']) {
    const checkbox = page.locator(`#workspace-tab-visible-${id}`);
    if (!await checkbox.isChecked()) await page.locator(`label[for="workspace-tab-visible-${id}"]`).click();
  }
  await page.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(leftArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
  const width = await tabList.evaluate(list => ({ scroll: list.scrollWidth, visible: list.clientWidth }));
  if (width.scroll > width.visible + 1) {
    await expect(rightArrow).not.toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    while (await tabList.evaluate(list => list.scrollLeft < list.scrollWidth - list.clientWidth - 1)) {
      const before = await tabList.evaluate(list => list.scrollLeft);
      await rightArrow.click();
      await expect.poll(() => tabList.evaluate(list => list.scrollLeft)).toBeGreaterThan(before);
    }
    await expect(rightArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
    await expect.poll(() => tabList.evaluate(list => Math.abs(list.scrollWidth - list.clientWidth - list.scrollLeft))).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(leftArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
  await expect(rightArrow).toHaveClass(/cds--tab--overflow-nav-button--hidden/);
});

test('create flow saves template intent once and starts a personal project on participants', async ({ page }) => {
  await page.goto('/?screen=create');
  await expect(page.getByText('ツールの表示は、作成後も変更できます。')).toBeVisible();
  await expect(page.getByText('個人利用でも非公開にはなりません。共有リンクを知っている人は企画を見られます。')).toHaveCount(0);
  await expect(page.getByText('最初に表示：参加者、車割、精算')).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('ブラウザ作成確認');
  const projectPage = await submitProjectCreation(page);
  await expect(projectPage.getByRole('heading', { name: 'ブラウザ作成確認' })).toBeVisible();
  expect(new URL(projectPage.url()).searchParams.get('view')).toBe('participants');
  await expect(projectPage.getByRole('tab', { name: '参加者' })).toBeVisible();
  await expect(projectPage.getByRole('tab', { name: '車割' })).toBeVisible();
  await expect(projectPage.getByRole('tab', { name: '参加者' })).toHaveAttribute('aria-selected', 'true');
  await projectPage.getByRole('button', { name: 'その他の操作' }).click();
  await projectPage.getByRole('menuitem', { name: '使い方' }).click();
  const guide = projectPage.getByRole('dialog', { name: '使い方' });
  await expect(guide.getByText('表示するタブは企画ごとに変更できます。')).toBeVisible();
  await expect(guide.getByText(/人数だけでも精算できます/)).toBeVisible();
  await guide.getByRole('button', { name: '閉じる' }).click();
  await openTabEditor(projectPage);
  await expect(projectPage.getByRole('heading', { name: '表示するタブ' })).toBeVisible();
  await expect(projectPage.getByRole('group', { name: '表示するタブ' })).toBeVisible();
  await expect(projectPage.getByText('使うツールと、タブに表示するツールを選びます。')).toHaveCount(0);
  await expect(projectPage.locator('.project-tools-manager input[type="checkbox"]')).toHaveCount(7);
  await expect(projectPage.getByRole('button', { name: '設定を保存' })).toHaveCount(0);
  await expect(projectPage.getByRole('button', { name: '変更を取り消す' })).toHaveCount(0);
  await projectPage.locator('label[for="workspace-tab-visible-team"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-team')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(projectPage.getByRole('tab', { name: '班割' })).toBeVisible();
  await expect(projectPage.getByRole('status').filter({ hasText: '保存しました' })).toHaveCount(0);
  await openTabEditor(projectPage);
  await projectPage.locator('label[for="workspace-tab-visible-team"]').click();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(projectPage.getByRole('tab', { name: '班割' })).toHaveCount(0);
});

test('a hidden tool link opens its tab editor row without changing the saved setting', async ({ page }) => {
  const room = 'HIDDEN-TOOL-DEEP-LINK';
  const key = `sanpo-workspace:v1:${encodeURIComponent(room)}`;
  const initial = {
    schemaVersion: 1,
    template: null,
    tools: {
      participants: { enabled: true, pinned: true },
      settlement: { enabled: true, pinned: true },
      'mountain-plan': { enabled: true, pinned: false },
    },
    tabOrder: ['participants', 'settlement'],
    revision: 4,
    createdAt: 100,
    updatedAt: 200,
  };
  await page.addInitScript(({ storageKey, workspace }) => localStorage.setItem(storageKey, JSON.stringify(workspace)), { storageKey: key, workspace: initial });
  await page.goto(`/?room=${room}&view=mountain-plan`);
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  const row = page.locator('.project-tool-setting').filter({ has: page.getByLabel('登山計画書') });
  await expect(row).toHaveAttribute('data-highlighted', 'true');
  await expect(page.getByLabel('登山計画書')).not.toBeChecked();
  const stored = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
  expect(stored.revision).toBe(4);
  expect(stored.tools['mountain-plan']).toEqual({ enabled: true, pinned: false });
});

test('a tool hidden in another tab returns the active page to the editor without deleting data', async ({ page, context }) => {
  const room = 'TAB-ACTIVE-HIDDEN-REMOTE';
  const key = `sanpo-workspace:v1:${encodeURIComponent(room)}`;
  const initial = {
    schemaVersion: 1,
    template: null,
    tools: {
      participants: { enabled: true, pinned: true },
      settlement: { enabled: true, pinned: true },
      'mountain-plan': { enabled: true, pinned: true },
    },
    tabOrder: ['participants', 'settlement', 'mountain-plan'],
    revision: 1,
    createdAt: 100,
    updatedAt: 200,
  };
  await page.addInitScript(({ storageKey, workspace }) => localStorage.setItem(storageKey, JSON.stringify(workspace)), { storageKey: key, workspace: initial });
  await page.goto(`/?room=${room}&view=mountain-plan`);
  await expect(page.getByRole('tab', { name: '登山計画書' })).toHaveAttribute('aria-selected', 'true');

  const peer = await context.newPage();
  await peer.goto(`/?room=${room}&view=tools`);
  await expect(peer.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  await expect(peer.locator('#workspace-tab-visible-mountain-plan')).toBeChecked();
  await peer.locator('label[for="workspace-tab-visible-mountain-plan"]').click();

  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  const stored = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
  expect(stored.tools['mountain-plan']).toEqual({ enabled: false, pinned: false });
  expect(stored.tabOrder).toEqual(['participants', 'settlement']);
  await expect(peer.getByRole('tab', { name: '登山計画書' })).toHaveCount(0);
});

test('tab visibility save failure keeps the prior setting and explains the failure', async ({ page }) => {
  const room = 'TAB-EDITOR-SAVE-FAILURE';
  const key = `sanpo-workspace:v1:${encodeURIComponent(room)}`;
  const initial = {
    schemaVersion: 1,
    template: null,
    tools: { participants: { enabled: true, pinned: true }, settlement: { enabled: true, pinned: true } },
    tabOrder: ['participants', 'settlement'],
    revision: 2,
    createdAt: 100,
    updatedAt: 200,
  };
  await page.addInitScript(({ storageKey, workspace }) => {
    localStorage.setItem(storageKey, JSON.stringify(workspace));
    const originalSetItem = Storage.prototype.setItem;
    window.__workspaceWriteAttempts = 0;
    Storage.prototype.setItem = function (candidateKey, value) {
      if (candidateKey === storageKey) {
        window.__workspaceWriteAttempts += 1;
        if (window.__failWorkspaceWrites) throw new DOMException('Storage is unavailable', 'QuotaExceededError');
      }
      return originalSetItem.call(this, candidateKey, value);
    };
    window.__failWorkspaceWrites = true;
  }, { storageKey: key, workspace: initial });
  await page.goto(`/?room=${room}&view=tools`);
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  const teamLabel = page.locator('label[for="workspace-tab-visible-team"]');
  const teamCheckbox = page.locator('#workspace-tab-visible-team');
  await expect(teamLabel).toBeVisible();
  await page.evaluate(() => { window.__workspaceWriteAttempts = 0; });
  await teamLabel.click();
  await expect(page.getByText('タブの変更を保存できませんでした。', { exact: true })).toBeVisible();
  await expect(teamCheckbox).not.toBeChecked();
  await expect(page.getByRole('tab', { name: '班割', exact: true })).toHaveCount(0);
  const persisted = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
  expect(persisted.revision).toBe(2);
  expect(persisted.tools.team).toBeUndefined();
  expect(await page.evaluate(() => window.__workspaceWriteAttempts)).toBe(1);
});

test('custom project adds optional features to the tab strip', async ({ page }) => {
  await page.goto('/?screen=create');
  await expect(page.getByText('ツールの表示は、作成後も変更できます。')).toBeVisible();
  await page.locator('label[for="template-custom"]').click();
  await expect(page.getByText('最初に表示するタブを選んでください。')).toBeVisible();
  await expect(page.getByRole('group', { name: '最初に表示するタブ' })).toBeVisible();
  await page.getByLabel('企画名（任意）').fill('カスタム企画');
  const projectPage = await submitProjectCreation(page);
  await expect(projectPage.getByRole('heading', { name: 'カスタム企画' })).toBeVisible();
  expect(new URL(projectPage.url()).searchParams.get('view')).toBe('tools');
  await projectPage.locator('label[for="workspace-tab-visible-application-form"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-application-form')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await projectPage.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(projectPage.locator('.form-maker-page')).toBeVisible();
  await expect(projectPage.locator('.form-maker-page')).toHaveClass(/form-maker-page--embedded/);
  await expect(projectPage.getByRole('button', { name: /フォームを作成/ })).toBeVisible();

  await openTabEditor(projectPage);
  await projectPage.locator('label[for="workspace-tab-visible-submission-documents"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-submission-documents')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await projectPage.getByRole('tab', { name: '学務書類' }).click();
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
  await openTabEditor(projectPage);
  await projectPage.locator('label[for="workspace-tab-visible-application-form"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-application-form')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await projectPage.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(projectPage.locator('.form-maker-page')).toBeVisible();
  await expect(projectPage.getByRole('button', { name: /応募フォームを作成/ })).toBeDisabled();
  expect(productionRequests).toEqual([]);
});

test('hiding and restoring a mountain workspace preserves its draft', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-custom"]').click();
  await page.getByLabel('企画名（任意）').fill('下書き保持の確認');
  const projectPage = await submitProjectCreation(page);
  await openTabEditor(projectPage);
  if (!await projectPage.locator('#workspace-tab-visible-participants').isChecked()) {
    await projectPage.locator('label[for="workspace-tab-visible-participants"]').click();
  }
  await projectPage.locator('label[for="workspace-tab-visible-mountain-plan"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-mountain-plan')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await projectPage.getByRole('tab', { name: '登山計画書' }).click();
  await expect(projectPage.locator('.mountain-plan-inline')).toBeVisible();
  await projectPage.locator('#eventDate').fill('2026-12-20');
  await openTabEditor(projectPage);
  await projectPage.locator('label[for="workspace-tab-visible-mountain-plan"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-mountain-plan')).not.toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(projectPage.getByRole('tab', { name: '登山計画書' })).toHaveCount(0);
  await expect(projectPage.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
  await openTabEditor(projectPage);
  await projectPage.locator('label[for="workspace-tab-visible-mountain-plan"]').click();
  await expect(projectPage.locator('#workspace-tab-visible-mountain-plan')).toBeChecked();
  await projectPage.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await projectPage.getByRole('tab', { name: '登山計画書' }).click();
  await expect(projectPage.locator('#eventDate')).toHaveValue('2026-12-20');
});

test('all-tools debug sample is isolated and usable across project tools', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const externalWrites = [];
  page.on('request', request => {
    if (/firebaseio\.com|script\.google\.com|forms\.google\.com|googleapis\.com|debug-ai\.example\.invalid/i.test(request.url())) externalWrites.push(request.url());
  });
  const sampleContact = JSON.stringify({ plannerName: 'debug contact sentinel' });
  await page.addInitScript(value => { localStorage.setItem('tozanContactsV2', value); window.TOZAN_AI_ENDPOINT = 'https://debug-ai.example.invalid/analyze'; }, sampleContact);
  await page.addInitScript(() => {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('sanpo-debug-sample:all-tools:v2:')) sessionStorage.removeItem(key);
    }
  });
  await page.goto('/?debugSample=all-tools&view=participants');
  await expect(page.getByRole('heading', { name: '秋の登山企画（サンプル）' })).toBeVisible();
  await expect(page.locator('.debug-sample-banner')).toHaveCount(0);
  await expect(page.getByText('架空データです。外部には送信されません。')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '初期状態に戻す' })).toHaveCount(0);
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await expect(page.getByRole('menuitem', { name: 'サンプルを初期状態に戻す' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  for (const label of ['応募フォーム', '学務書類', '登山計画書', '参加者', '車割', '班割', '精算']) {
    await expect(page.getByRole('tab', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('tab', { name: 'タブを編集' })).toHaveCount(0);
  await page.getByRole('button', { name: '参加者を選び直す' }).click();
  await expect(page.getByText('森田 玲奈', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '車割' }).click();
  await expect(page.locator('.allocation-overcapacity-notice')).toHaveCount(0);
  for (const carName of ['A車', 'B車', 'C車']) {
    await expect(page.getByRole('heading', { name: carName, exact: true })).toBeVisible();
  }
  await expect(page.getByText('13人・3台')).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: '車割' }).getByText('佐藤 花子', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '班割' }).click();
  await expect(page.locator('.allocation-overcapacity-notice')).toHaveCount(0);
  for (const teamName of ['A班', 'B班', 'C班']) {
    await expect(page.getByRole('heading', { name: teamName, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('tabpanel', { name: '班割' }).getByRole('status')).toContainText('全員割り当て済み');
  await expect(page.getByRole('tabpanel', { name: '班割' }).getByText('佐藤 花子', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '精算' }).click();
  await expect(page.getByRole('heading', { name: '佐藤 花子車' })).toBeVisible();
  await expect(page.locator('.settlement-car-total strong').filter({ hasText: '¥2,900' })).toBeVisible();
  const sampleCarSummary = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: '佐藤 花子車' }) });
  await expect(sampleCarSummary.locator('.settlement-car-total strong')).toHaveText('¥2,900');
  await expect(sampleCarSummary.locator('.settlement-car-amount-category')).toHaveText('全額集金から');
  await page.getByRole('button', { name: /佐藤 花子車.*支払いの内訳/ }).click();
  const samplePayment = page.locator('.settlement-car').filter({ hasText: '佐藤 花子車' });
  await expect(samplePayment.getByText('ガソリン代', { exact: true })).toBeVisible();
  await expect(samplePayment.getByText('車出し協力代', { exact: true })).toBeVisible();
  await expect(samplePayment.getByText('運転手の集金分', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(page.locator('.form-maker-page')).toBeVisible();
  await expect(page.locator('.form-maker-page h1')).toHaveText('応募フォーム');
  await expect(page.getByText('「秋の登山企画（サンプル）」に連携する応募フォームを作成します。')).toHaveCount(0);
  await expect(page.getByText('この企画には応募フォームが連携済みです')).toHaveCount(0);
  await expect(page.getByLabel('企画名（必須）')).toHaveValue('秋の登山企画（サンプル）');
  await expect(page.getByLabel('メールアドレス（必須）')).toHaveValue('sample-editor@example.invalid');
  await expect(page.getByLabel('実施日（任意）')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByLabel('応募締切日（任意）')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByLabel('企画の説明（任意）')).toHaveValue(/集合場所：新宿駅西口。集合時刻：6:30/);
  await expect(page.getByText('作成したGoogleフォームの編集権限を、このアドレスに共有します。')).toHaveCount(0);
  const sampleSave = page.getByRole('button', { name: '入力内容を保存' });
  await expect(sampleSave).toBeEnabled();
  await page.getByLabel('企画の説明（任意）').fill('サンプルの説明を編集しました。');
  await sampleSave.click();
  await expect(page.getByText('入力内容をサンプルとして保存しました。')).toBeVisible();
  await page.getByRole('tab', { name: '参加者' }).click();
  await page.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(page.getByLabel('企画の説明（任意）')).toHaveValue('サンプルの説明を編集しました。');
  await expect(page.getByRole('button', { name: '応募フォームを作成' })).toHaveCount(0);
  await page.getByRole('tab', { name: '学務書類' }).click();
  await page.getByRole('button', { name: 'CSVをプレビュー' }).click();
  const csvPreview = page.getByRole('dialog', { name: 'サンプルCSVプレビュー' });
  await expect(csvPreview.locator('pre')).toContainText('学籍番号');
  await expect(csvPreview.locator('pre')).toContainText('氏名');
  await expect(csvPreview).toContainText('ファイルの作成・外部送信は行いません');
  await csvPreview.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('tab', { name: '登山計画書' }).click();
  await expect(page.getByText('下書きを保存しました')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible();
  await expect(page.getByText('「任意」の表示がない項目は必須です。入力内容はPDFに記載されます。')).toHaveCount(0);
  await expect(page.locator('label[for="eventDate"]')).toContainText('（必須）');
  await expect(page.getByText('必須項目を入力してください。')).toHaveCount(0);
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
});

test('embedded form maker validates user fields before adding reserved project credentials', async ({ page }) => {
  const jobId = 'a'.repeat(32);
  const token = `h_${'b'.repeat(64)}`;
  await page.addInitScript(({ jobId, token }) => {
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      prepareApplicationForm: async ({ roomId, room }) => ({
        roomId,
        jobId,
        token,
        projectName: room.roomName || '新しい企画',
        eventDate: '',
      }),
      formMakerSession: {
        async prepare() { return { accepting: true }; },
        async listJobs() { return []; },
        async getJob() { return null; },
        async enqueue(input, options) {
          window.__formMakerTestJob = { input, options };
          return { ...options, state: 'queued' };
        },
        getHandoffToken() { return ''; },
      },
    };
  }, { jobId, token });

  await page.goto('/?screen=create');
  await page.locator('label[for="template-circle-event"]').click();
  await page.getByLabel('企画名（任意）').fill('応募フォーム動作確認');
  const projectPage = await submitProjectCreation(page);
  await projectPage.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(projectPage.getByLabel('企画名（必須）')).toHaveValue('応募フォーム動作確認');
  await projectPage.getByLabel('フォーム編集者のメールアドレス（必須）').fill('editor@example.test');
  await projectPage.getByRole('button', { name: '応募フォームを作成' }).click();
  await expect.poll(() => projectPage.evaluate(() => window.__formMakerTestJob || null)).toMatchObject({
    input: {
      planName: '応募フォーム動作確認',
      editorEmail: 'editor@example.test',
      targetRoomId: expect.any(String),
      targetRoomJobId: jobId,
      targetRoomCapability: token,
    },
    options: { jobId },
  });
  await expect(projectPage.getByText('連携する企画の情報を確認できません。企画画面からフォームメーカーを開き直してください。')).toHaveCount(0);
});

test('project form links stay scoped to the current project and remain available to participants', async ({ page, context }, testInfo) => {
  const roomId = 'PROJECT-SCOPED-FORM-LINKS';
  const formUrl = 'https://docs.google.com/forms/d/e/CurrentProjectForm123/viewform';
  const room = structuredClone(fixture);
  room.roomName = '現在の企画';
  room.cars = [];
  room.waiting = [];
  room.participants = {};
  room.meta = {
    ...room.meta,
    applicationSync: { kind: 'formApplicationSync', version: 2, projectId: roomId, title: room.roomName, formUrl, responseCount: 0, applicants: {} },
  };
  const roomKey = `sanpo-react:v1:${roomId}:room`;
  const workspaceKey = workspaceCacheKey(roomId);
  await page.addInitScript(({ roomKey, room, workspaceKey, workspace }) => {
    localStorage.setItem(roomKey, JSON.stringify(room));
    localStorage.setItem(workspaceKey, JSON.stringify(workspace));
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      formMakerSession: {
        async prepare() { return { accepting: true }; },
        async listJobs() { return [{ jobId: 'OTHER-PROJECT-JOB', projectId: 'OTHER-PROJECT', planName: '別企画のフォーム', state: 'completed', result: { formUrl: 'https://docs.google.com/forms/d/e/OtherProjectForm123/viewform', editUrl: 'https://docs.google.com/forms/d/OtherProjectForm123/edit' } }]; },
        async getJob() { return null; },
        async enqueue() { throw new Error('This test must not create a form'); },
        getHandoffToken() { return ''; },
      },
    };
  }, { roomKey, room, workspaceKey, workspace: createTemplateWorkspace({ templateId: 'circle-event' }) });
  if (testInfo.project.name.startsWith('webkit')) {
    await page.addInitScript(() => {
      let copiedText = '';
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(value) { copiedText = value; }, async readText() { return copiedText; } } });
    });
  } else {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await page.goto(`/?room=${roomId}&view=application-form`);

  const currentForm = page.getByRole('region', { name: 'この企画の応募フォーム' });
  await expect(currentForm).toBeVisible();
  await expect(currentForm.getByRole('link', { name: /応募ページを開く/ })).toHaveAttribute('href', formUrl);
  await expect(currentForm.getByRole('button', { name: '応募フォームを作成', exact: true })).toHaveCount(0);
  await expect(page.getByText('別企画のフォーム', { exact: true })).toHaveCount(0);
  await expect(currentForm.getByRole('link', { name: /Googleフォームで編集/ })).toHaveCount(0);
  await expect(currentForm.getByRole('link', { name: /回答シートを開く/ })).toHaveCount(0);
  await currentForm.getByRole('button', { name: '応募リンクをコピー', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(formUrl);

  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('heading', { name: '応募フォームへの回答はまだありません', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '応募リンクをコピー', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(formUrl);

  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await page.getByRole('button', { name: '参加者タブへ', exact: true }).click();
  await expect(page.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('dialog', { name: '参加者を登録' })).toHaveCount(0);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByRole('button', { name: '人数だけで精算', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '参加者タブへ', exact: true }).click();
  await expect(page.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('dialog', { name: '参加者を登録' })).toHaveCount(0);
});

test('offline form maker preview explains that creation is unavailable without implying recovery timing', async ({ page }) => {
  await page.addInitScript(() => {
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      formMakerSession: {
        async prepare() { return { accepting: false, acceptanceMode: 'paused', previewOnly: true }; },
        async listJobs() { return []; },
        async getJob() { return null; },
        async enqueue() { throw new Error('offline preview must not submit'); },
        getHandoffToken() { return ''; },
      },
    };
  });
  await page.goto('/?screen=create');
  await page.locator('label[for="template-circle-event"]').click();
  await page.getByLabel('企画名（任意）').fill('プレビュー確認');
  await submitProjectCreation(page);
  await page.getByRole('tab', { name: '応募フォーム' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'このプレビューではフォームを作成できません。' })).toBeVisible();
  await expect(page.getByText('現在、新しいフォームを作成できません')).toHaveCount(0);
  await expect(page.getByText(/時間をおいて/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '応募フォームを作成', exact: true })).toBeDisabled();
});

test('embedded form name and project header stay in sync without committing during IME composition', async ({ page }) => {
  await page.goto('/?screen=create');
  await page.locator('label[for="template-circle-event"]').click();
  await page.getByLabel('企画名（任意）').fill('名前同期の確認');
  const projectPage = await submitProjectCreation(page);
  await projectPage.getByRole('tab', { name: '応募フォーム' }).click();
  const formName = projectPage.getByLabel('企画名（必須）');
  await expect(formName).toHaveValue('名前同期の確認');

  await formName.focus();
  await formName.dispatchEvent('compositionstart');
  await formName.fill('変換中の企画名');
  await expect(projectPage.getByRole('banner')).toContainText('名前同期の確認');
  await formName.dispatchEvent('compositionend', { data: '変換中の企画名' });
  await expect(projectPage.getByRole('banner')).toContainText('名前同期の確認');
  await formName.evaluate(element => element.blur());
  await expect(projectPage.getByRole('banner')).toContainText('変換中の企画名');

  await projectPage.getByRole('button', { name: 'その他の操作' }).click();
  await projectPage.getByRole('menuitem', { name: '企画名を変更' }).click();
  const renameDialog = projectPage.getByRole('dialog', { name: '企画名を変更' });
  await renameDialog.getByRole('textbox', { name: '企画名' }).fill('ヘッダーから変更');
  await renameDialog.getByRole('button', { name: '保存' }).click();
  await expect(formName).toHaveValue('ヘッダーから変更');
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
  await expect(projectPage.locator('.mountain-plan-workspace')).toHaveClass(/mountain-plan-workspace--embedded/);
  await expect.poll(() => projectPage.getByRole('heading', { name: '基本情報' }).evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
  await expect(projectPage.getByRole('heading', { name: '基本情報' })).toBeVisible();
  const embeddedInsets = await projectPage.evaluate(() => {
    const heading = document.querySelector('.mountain-plan-workspace #step-heading-1').getBoundingClientRect();
    const eventDateLabel = document.querySelector('.mountain-plan-workspace label[for="eventDate"]').getBoundingClientRect();
    const eventDate = document.querySelector('.mountain-plan-workspace #eventDate').getBoundingClientRect();
    return { headingLeft: heading.left, headingRight: heading.right, eventDateLabelLeft: eventDateLabel.left, eventDateLabelRight: eventDateLabel.right, eventDateLeft: eventDate.left, eventDateRight: eventDate.right, viewportWidth: innerWidth };
  });
  expect(embeddedInsets.headingLeft).toBeGreaterThanOrEqual(16);
  expect(embeddedInsets.headingRight).toBeLessThanOrEqual(embeddedInsets.viewportWidth - 16);
  expect(embeddedInsets.eventDateLabelLeft).toBeGreaterThanOrEqual(16);
  expect(embeddedInsets.eventDateLabelRight).toBeLessThanOrEqual(embeddedInsets.viewportWidth - 16);
  expect(embeddedInsets.eventDateLeft).toBeGreaterThanOrEqual(16);
  expect(embeddedInsets.eventDateRight).toBeLessThanOrEqual(embeddedInsets.viewportWidth - 16);
  await expect(projectPage.getByRole('link', { name: '登山計画書を作成' })).toHaveCount(0);
  await expect(projectPage.getByRole('tab', { name: 'タブを編集' })).toHaveCount(0);
  await projectPage.getByRole('tab', { name: '参加者' }).click();
  await expect(projectPage.getByRole('heading', { name: '参加者が登録されていません' })).toBeVisible();
  await expect(projectPage.getByText('応募フォームを作成するか、参加者を手動で追加できます。', { exact: true })).toBeVisible();
  await expect(projectPage.getByRole('button', { name: '参加者を手動で追加', exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
