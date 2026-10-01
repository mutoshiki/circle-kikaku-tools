import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';
import { navigateToProjectSection } from './project-navigation.js';
import { expectFontsLoaded } from './font-readiness.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const register = page => page.getByRole('form', { name: '参加者を登録' });
async function saved(page, room) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), `sanpo-react:v1:${room}:room`); }

test('manual registration has one commit, validates inline and recovers draft through URL history', async ({ page }) => {
  const room = 'PHASE-D-MANUAL';
  await page.goto(`/?room=${room}`);
  const launcher = page.getByRole('button', { name: '参加者を追加', exact: true });
  await launcher.click();
  await expect(page).toHaveURL(/task=import/);
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録' })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  const names = page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true });
  await expect(names).toBeFocused();
  await expect(names).toHaveAttribute('aria-invalid', 'true');
  await names.fill('田中\n佐藤');
  await expect(page.getByRole('status').filter({ hasText: '登録する参加者 2人' })).toBeVisible();
  expect(Object.values((await saved(page, room))?.participants || {})).toHaveLength(0);
  await page.reload();
  await expect(names).toHaveValue('田中\n佐藤');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeFocused();
  await page.goForward();
  await expect(names).toHaveValue('田中\n佐藤');
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeVisible();
  expect(Object.values((await saved(page, room)).participants).map(p => p.name).sort()).toEqual(['佐藤', '田中']);
  await launcher.click();
  await expect(names).toHaveValue('');
  await names.fill('取り消す入力');
  await register(page).getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(names).toHaveValue('');
});

test('paste review is editable inline and source changes cannot reuse stale corrections', async ({ page }) => {
  const room = 'PHASE-D-PASTE';
  await page.goto(`/?room=${room}&section=participants&task=import`);
  await page.getByRole('radio', { name: '表データを貼り付け', exact: true }).check({ force: true });
  const source = page.getByRole('textbox', { name: 'Googleフォームの回答を貼り付け', exact: true });
  await source.fill('名前\t学年\t車出し\n元の名前\t2\tいいえ');
  const corrected = page.getByRole('textbox', { name: '1人目の名前', exact: true });
  await expect(corrected).toHaveValue('元の名前');
  await corrected.fill('修正した名前');
  await page.getByRole('checkbox', { name: '1人目の車出し', exact: true }).check({ force: true });
  await page.reload();
  await expect(corrected).toHaveValue('修正した名前');
  await source.fill('名前\t学年\t車出し\n新しい名前\t3\tいいえ');
  await expect(corrected).toHaveValue('新しい名前');
  await expect(page.getByRole('checkbox', { name: '1人目の車出し', exact: true })).not.toBeChecked();
  await corrected.fill('');
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(corrected).toHaveAttribute('aria-invalid', 'true');
  await expect(corrected).toBeFocused();
  await corrected.fill('登録後の名前');
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeVisible();
  expect(Object.values((await saved(page, room)).participants).map(p => [p.name, p.grade])).toEqual([['登録後の名前', 3]]);
});

test('confirmed list and manual add remain available; selection cancel and collapsed filters preserve context', async ({ page }) => {
  const room = 'PHASE-D-LINKED';
  await page.addInitScript(({ id, data }) => { const key = `sanpo-react:v1:${id}:room`; if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)); }, { id: room, data: fixture });
  await page.goto(`/?room=${room}`);
  await expect(page.getByRole('list', { name: '参加者一覧' })).toBeVisible();
  await expect(page.getByRole('button', { name: '参加者を追加' })).toBeVisible();
  await page.getByRole('button', { name: '参加者を選び直す' }).click();
  const original = await saved(page, room);
  await page.getByRole('checkbox', { name: '仮参加者G', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect((await saved(page, room)).participants).toEqual(original.participants);
  await page.getByRole('button', { name: '絞り込み', exact: true }).click();
  await page.getByLabel('学年', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: '絞り込み', exact: true }).click();
  await expect(page.getByText('学年: 1年', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '参加者を追加' }).click();
  await page.getByRole('link', { name: '参加者に戻る', exact: true }).click();
  await expect(page.getByText('学年: 1年', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '条件を解除', exact: true }).click();
  await expect(page.getByText('学年: 1年', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '参加者を追加' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true }).fill('連携企画への手動追加');
  await expect(page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true })).toHaveValue('連携企画への手動追加');
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(page.getByRole('list', { name: '参加者一覧' })).toContainText('連携企画への手動追加');
  expect((await saved(page, room)).meta.applicationSync).toEqual(original.meta.applicationSync);
});

test('primary navigation exits participant child tasks and browser history restores the task', async ({ page }) => {
  await page.goto('/?room=PHASE-D-TASK-NAV&section=participants&task=import');
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録' })).toBeVisible();
  await navigateToProjectSection(page, '参加者');
  expect(new URL(page.url()).searchParams.has('task')).toBe(false);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録' })).toBeFocused();
  await navigateToProjectSection(page, '班割');
  expect(new URL(page.url()).searchParams.has('task')).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '班割', exact: true })).toBeVisible();
});

test('announcement is a durable page with generated output, local draft and contextual clipboard retry', async ({ page }) => {
  const room = 'PHASE-D-ANNOUNCEMENT';
  await page.addInitScript(({ id, data }) => {
    const key = `sanpo-react:v1:${id}:room`; if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { if (!window.__allowCopy) throw new Error('denied'); window.__copiedAnnouncement = value; } } });
  }, { id: room, data: fixture });
  await page.goto(`/?room=${room}`);
  await page.getByRole('link', { name: '発表文を作成', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者発表文を作成' })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('補足事項', { exact: true }).fill('集合場所を再確認');
  await page.reload();
  await expect(page.getByLabel('補足事項', { exact: true })).toHaveValue('集合場所を再確認');
  const preview = await page.getByLabel('発表文プレビュー', { exact: true }).inputValue();
  expect(preview).toContain('集合場所を再確認');
  await page.getByRole('button', { name: '発表文をコピー', exact: true }).click();
  await expect(page.getByText('発表文をコピーできませんでした', { exact: true })).toBeVisible();
  await expect(page.getByLabel('補足事項', { exact: true })).toHaveValue('集合場所を再確認');
  await page.evaluate(() => { window.__allowCopy = true; });
  await page.getByRole('button', { name: '発表文をコピー', exact: true }).click();
  expect(await page.evaluate(() => window.__copiedAnnouncement)).toBe(preview);
  await expect(page.getByText('発表文をコピーしました', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '参加者に戻る', exact: true }).click();
  await expect(page.getByRole('link', { name: '発表文を作成', exact: true })).toBeFocused();
});

test('draft storage failure keeps input during parent round trip and explains limited recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('sanpo-ui:participant-task:')) throw new Error('quota'); return set.call(this, key, value); };
  });
  await page.goto('/?room=PHASE-D-QUOTA&section=participants&task=import');
  const names = page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true });
  await names.fill('再読込前に保持');
  await expect(page.getByRole('status').filter({ hasText: '再読み込みすると失われる可能性' })).toBeVisible();
  await page.getByRole('link', { name: '参加者に戻る', exact: true }).click();
  await page.getByRole('button', { name: '参加者を追加' }).click();
  await expect(names).toHaveValue('再読込前に保持');
  await expect(page.getByRole('status').filter({ hasText: '再読み込みすると失われる可能性' })).toBeVisible();
});

test('confirmed list presents current participant attributes and manual edits remain searchable', async ({ page }) => {
  const data = createReference().migrateAppData(fixture);
  await page.addInitScript(data => localStorage.setItem('sanpo-react:v1:PHASE-D-READ-EDIT:room', JSON.stringify(data)), data);
  await page.goto('/?room=PHASE-D-READ-EDIT');
  await expect(page.getByRole('list', { name: '参加者一覧' })).not.toContainText('車出し可・同乗');
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録', exact: true })).toBeFocused();
  await register(page).getByLabel('参加者（改行区切り）', { exact: true }).fill('手動追加の人');
  await register(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
  await page.getByRole('button', { name: '手動追加の人の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を編集', exact: true });
  await dialog.getByLabel('名前', { exact: true }).fill('確定後に変更した名前');
  await dialog.getByLabel('学年', { exact: true }).selectOption('4');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('list', { name: '参加者一覧' })).toContainText('確定後に変更した名前');
  await page.getByRole('searchbox', { name: '名前を検索' }).fill('確定後に変更した名前');
  await expect(page.getByRole('list', { name: '参加者一覧' })).toContainText('4年');
});

test('task forms keep page alignment and reachable actions in both themes and short viewports', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?room=PHASE-D-GEOMETRY&section=participants&task=import');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') { await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え', exact: true }).click(); }
    const form = register(page);
    const names = form.getByRole('textbox', { name: '参加者（改行区切り）', exact: true });
    const bounds = await form.boundingBox();
    const field = await names.boundingBox();
    expect(field.x).toBeGreaterThanOrEqual(bounds.x);
    expect(field.x + field.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    await names.fill('キーボード入力 確認');
    await expectFontsLoaded(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await page.getByRole('banner').boundingBox()).y).toBe(0);
    await page.screenshot({ path: join(tmpdir(), `phase-d-registration-${testInfo.project.name}-${theme}.png`), fullPage: true });
    await page.setViewportSize({ width: testInfo.project.use.viewport.width, height: 500 });
    const submit = form.getByRole('button', { name: '参加者を登録', exact: true });
    await submit.scrollIntoViewIfNeeded();
    await submit.focus();
    await expect(submit).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize(testInfo.project.use.viewport);
  }
  expect(errors).toEqual([]);
});

test('same-name applicants have distinct selection labels and touch controls remain usable', async ({ page }, info) => {
  const data = structuredClone(fixture), applicants = Object.values(data.meta.applicationSync.applicants);
  applicants[applicants.length - 1].name = applicants[0].name;
  const duplicateName = applicants[0].name;
  await page.addInitScript(data => localStorage.setItem('sanpo-react:v1:PHASE-D-DUPLICATE:room', JSON.stringify(data)), data);
  await page.goto('/?room=PHASE-D-DUPLICATE');
  const edit = page.getByRole('button', { name: '参加者を選び直す' });
  if (info.project.use.hasTouch) await edit.tap(); else await edit.click();
  const controls = page.getByRole('checkbox');
  const labels = await controls.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  const matching = labels.filter(label => label.startsWith(`${duplicateName}（`));
  expect(matching).toHaveLength(2); expect(new Set(matching).size).toBe(2);
  const cancel = page.getByRole('button', { name: 'キャンセル', exact: true });
  if (info.project.use.hasTouch) await cancel.tap(); else await cancel.click();
  await expect(edit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
