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
