import { test, expect } from '@playwright/test';
import { createRoomStore } from '../../src/store/room-store.js';
import { navigateToProjectSection } from './project-navigation.js';

async function seed(page, id) {
  const store = createRoomStore({ clock: { now: () => 1000 } });
  store.command('addParticipants', { people: [{ name: 'A', driver: true }, { name: 'B', driver: true }, { name: 'C', grade: 2 }, { name: 'D' }, { name: 'E' }] });
  store.command('rename', { name: '当日朝の割り当て確認用の長い企画名' });
  const fixed = Object.values(store.getSnapshot().participants).find(person => person.name === 'C');
  store.command('editParticipant', { id: fixed.id, changes: { locked: true } });
  const room = store.getSnapshot();
  const ids = Object.fromEntries(Object.values(room.participants).map(p => [p.name, p.id]));
  const groups = { a: room.allocations.car.placements[ids.A].groupId, b: room.allocations.car.placements[ids.B].groupId };
  await page.addInitScript(({ id, room }) => { const key = `sanpo-react:v1:${id}:room`; if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(room)); }, { id, room });
  await page.goto(`/?room=${id}&section=organization-car`);
  return { ids, groups };
}
const roomAt = (page, id) => page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)), id);

async function choosePerson(page, name, touch = false) {
  const radio = page.getByRole('radio', { name: `${name}を選択`, exact: true });
  // Carbon's native input is covered by its associated visible label. Exercise that
  // public HTML relationship, without forcing a pointer through the appearance.
  const label = page.locator(`label[for="${await radio.getAttribute('id')}"]`);
  if (touch) await label.tap();
  else { await radio.focus(); await page.keyboard.press('Space'); }
  await expect(radio).toBeChecked();
}

test('manual assignment and correction use direct moves and keep independent team state', async ({ page }, info) => {
  const id = `PHASE-E-MANUAL-${info.project.name}`;
  const { ids, groups } = await seed(page, id);
  const mobile = info.project.use.viewport.width < 1056;
  if (mobile) {
    await expect(page.getByRole('list', { name: 'A車の参加者' })).toHaveCount(0);
    await page.getByRole('link', { name: 'A車の詳細', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'A車', exact: true })).toBeFocused();
    await page.getByRole('link', { name: '参加者を割り当て', exact: true }).click();
  }
  await choosePerson(page, 'C', mobile);
  if (!mobile) await page.getByRole('combobox', { name: '割り当て先', exact: true }).selectOption(groups.a);
  await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
  await expect.poll(async () => (await roomAt(page, id)).allocations.car.placements[ids.C].groupId).toBe(groups.a);
  if (mobile) await page.getByRole('link', { name: 'A車に戻る', exact: true }).click();
  await page.getByRole('button', { name: 'Cの移動', exact: true }).click();
  const move = page.getByRole('form', { name: 'Cの移動' });
  await move.getByRole('combobox', { name: '移動先', exact: true }).selectOption(groups.b);
  await move.getByRole('button', { name: '車へ移動', exact: true }).click();
  if (mobile) {
    await page.getByRole('link', { name: '車割に戻る', exact: true }).click();
    await page.getByRole('link', { name: 'B車の詳細', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Cの移動', exact: true }).click();
  const beforeCancel = (await roomAt(page, id)).allocations;
  await page.getByRole('form', { name: 'Cの移動' }).getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect((await roomAt(page, id)).allocations).toEqual(beforeCancel);
  await expect(page.getByRole('button', { name: 'Cの移動', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Cの移動', exact: true }).click();
  await page.getByRole('form', { name: 'Cの移動' }).getByRole('button', { name: '車へ移動', exact: true }).click();
  const after = await roomAt(page, id);
  expect(after.allocations.car.placements[ids.C].kind).toBe('waiting');
  expect(after.participants[ids.C].locked).toBe(true);
  expect(Object.values(after.allocations.team.placements).every(p => p.kind === 'waiting')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('selected candidate survives resize and full destinations cannot be selected', async ({ page }, info) => {
  const id = `PHASE-E-CAPACITY-${info.project.name}`;
  const { ids, groups } = await seed(page, id);
  await page.getByRole('link', { name: 'A車へ参加者を割り当て', exact: true }).click();
  await choosePerson(page, 'C', !!info.project.use.hasTouch);
  const url = page.url();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('radio', { name: 'Cを選択', exact: true })).toBeChecked();
  expect(page.url()).toBe(url);
  await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
  await choosePerson(page, 'D', !!info.project.use.hasTouch);
  await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
  await choosePerson(page, 'E', !!info.project.use.hasTouch);
  await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
  await page.getByRole('link', { name: 'A車に戻る', exact: true }).click();
  await page.getByRole('link', { name: '車割に戻る', exact: true }).click();
  await page.getByRole('button', { name: 'Bの移動', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '移動先', exact: true }).getByRole('option', { name: 'A車（空き0人）', exact: true })).toBeDisabled();
  expect((await roomAt(page, id)).allocations.car.placements[ids.B].groupId).toBe(groups.b);
});

test('allocation group URLs restore across refresh/history and resize does not change destination', async ({ page }, info) => {
  const id = `PHASE-E-URL-${info.project.name}`;
  const { groups } = await seed(page, id);
  await page.getByRole('link', { name: 'A車の詳細', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`task=group.*group=${groups.a}`));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'A車', exact: true })).toBeVisible();
  const url = page.url();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(page.url()).toBe(url);
  await page.getByRole('link', { name: '参加者を割り当て', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'A車', exact: true })).toBeFocused();
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'A車へ割り当て', exact: true })).toBeFocused();
  await navigateToProjectSection(page, '参加者');
  expect(new URL(page.url()).searchParams.has('group')).toBe(false);
  expect(new URL(page.url()).searchParams.has('task')).toBe(false);
});

test('empty allocation uses participant task rather than another registration owner', async ({ page }, info) => {
  await page.goto(`/?room=PHASE-E-EMPTY-${info.project.name}&section=organization-team`);
  await expect(page.getByRole('heading', { level: 1, name: '班割', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '参加者へ', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeFocused();
});

test('random review states actual scope and cancel never changes allocations', async ({ page }, info) => {
  const id = `PHASE-E-RANDOM-${info.project.name}`;
  await seed(page, id);
  const before = (await roomAt(page, id)).allocations;
  await page.getByRole('button', { name: 'ランダム割り当て', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'ランダム割り当て', exact: true });
  await expect(dialog).toContainText('対象 2人');
  await expect(dialog).toContainText('固定 1人');
  await expect(dialog).toContainText('運転手 2人');
  await expect(dialog).toContainText('空き枠 6人');
  await expect(dialog).toContainText('固定した未割り当て 1人');
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect((await roomAt(page, id)).allocations).toEqual(before);
  await expect(page.getByRole('button', { name: 'ランダム割り当て', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'ランダム割り当て', exact: true }).click();
  await dialog.getByRole('button', { name: 'ランダムに割り当て', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '車割', exact: true })).toBeFocused();
  const after = (await roomAt(page, id));
  expect(Object.values(after.allocations.car.placements).filter(p => p.kind === 'waiting')).toHaveLength(1);
  expect(Object.values(after.allocations.team.placements).every(p => p.kind === 'waiting')).toBe(true);
});

test('group limits validate with associated focus and waiting actions remain available', async ({ page }, info) => {
  const id = `PHASE-E-EDIT-${info.project.name}`;
  const { ids } = await seed(page, id);
  if (info.project.use.viewport.width < 1056) await page.getByRole('link', { name: '未割り当て 3人を確認', exact: true }).click();
  await page.getByRole('button', { name: 'Cの操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '固定を解除', exact: true }).click();
  await expect.poll(async () => (await roomAt(page, id)).participants[ids.C].locked).toBe(false);
  await page.getByRole('button', { name: '車を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '車を追加', exact: true });
  const limit = dialog.getByRole('spinbutton', { name: '割り当て人数の上限（全員を含む）', exact: true });
  await expect(limit).toHaveValue('4');
  await limit.fill('1');
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(limit).toHaveAttribute('aria-invalid', 'true');
  await expect(limit).toBeFocused();
  await expect(limit).toHaveAttribute('aria-describedby', /.+/);
  await limit.fill('100');
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(Object.values((await roomAt(page, id)).allocations.car.groups).some(g => g.capacity === 99)).toBe(true);
  await navigateToProjectSection(page, '班割');
  await page.getByRole('button', { name: '班を追加', exact: true }).click();
  const team = page.getByRole('dialog', { name: '班を追加', exact: true });
  await expect(team.getByRole('spinbutton', { name: '割り当て人数の上限（全員を含む）', exact: true })).toHaveValue('6');
  await team.getByRole('button', { name: '追加', exact: true }).click();
  await expect(team).toHaveCount(0);
  expect(Object.values((await roomAt(page, id)).allocations.team.groups)[0].capacity).toBe(5);
});

test('presentation is read-only, private-safe and clipboard failure leaves selectable current text', async ({ page }, info) => {
  const id = `PHASE-E-PRESENT-${info.project.name}`;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { if (!window.__allowCopy) throw new Error('denied'); window.__allocationCopy = text; } } });
  });
  await seed(page, id);
  await page.getByRole('link', { name: '結果を確認・コピー', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '車割の結果', exact: true })).toBeFocused();
  const preview = page.getByRole('textbox', { name: '割当結果プレビュー', exact: true });
  await expect(preview).toHaveAttribute('readonly', '');
  const text = await preview.inputValue();
  expect(text).toContain('A車（1人 / 上限4人）');
  expect(text).toContain('運転手：A');
  expect(text).toContain('未割り当て 3人');
  expect(text).not.toMatch(/2年|固定|ランダム割当を使用|ランダム割り当てを使用|p_[a-z0-9]+/);
  await expect(page.getByRole('button', { name: '車を追加', exact: true })).toHaveCount(0);
  const copy = page.getByRole('button', { name: '車割をコピー', exact: true });
  await copy.click();
  await expect(page.getByText('車割をコピーできませんでした', { exact: true })).toBeVisible();
  await expect(preview).toHaveValue(text);
  await page.evaluate(() => { window.__allowCopy = true; });
  await copy.click();
  expect(await page.evaluate(() => window.__allocationCopy)).toBe(text);
  await page.reload();
  await expect(preview).toHaveValue(text);
  await page.getByRole('link', { name: '車割に戻る', exact: true }).click();
  await expect(page.getByRole('link', { name: '結果を確認・コピー', exact: true })).toBeFocused();
});

test('presentation preserves duplicate identities and missing roles rather than inventing completion', async ({ page }, info) => {
  const id = `PHASE-E-DUPLICATE-${info.project.name}`;
  const store = createRoomStore();
  store.command('addParticipants', { people: [{ name: '同名A', driver: true }, { name: '同名B' }, { name: '未割当', memo: '秘密のメモ', grade: 3, flag: 'red' }] });
  const room = store.getSnapshot();
  const [owner, member] = Object.values(room.participants).filter(p => p.name.startsWith('同名'));
  for (const person of [owner, member]) store.command('editParticipant', { id: person.id, changes: { name: '同名' } });
  const groupId = room.allocations.car.placements[owner.id].groupId;
  store.command('move', { id: member.id, type: 'car', groupId });
  store.command('role', { id: owner.id, type: 'car', driver: false });
  await page.addInitScript(({ id, room }) => localStorage.setItem(`sanpo-react:v1:${id}:room`, JSON.stringify(room)), { id, room: store.getSnapshot() });
  await page.goto(`/?room=${id}&section=organization-car&task=presentation`);
  await expect(page.getByRole('heading', { level: 1, name: '車割の結果', exact: true })).toBeVisible();
  await expect(page.getByText('同名の参加者がいます', { exact: true })).toBeVisible();
  const text = await page.getByRole('textbox', { name: '割当結果プレビュー', exact: true }).inputValue();
  expect(text.match(/・同名/g)).toHaveLength(2);
  expect(text).toContain('運転手が設定されていません');
  expect(text).not.toMatch(/秘密のメモ|3年|red|精算完了|割当完了/);
  await expect(page.getByRole('button', { name: '車割をコピー', exact: true })).toBeEnabled();
});
