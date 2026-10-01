import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRoomStore } from '../../src/store/room-store.js';
import { fixture, createReference, semanticRoom } from '../reference.mjs';
import { navigateToProjectSection } from '../browser/project-navigation.js';

const base = 'http://127.0.0.1:9008', ns = 'demo-circle-react-default-rtdb';
const headers = { Authorization: 'Bearer owner' };
const urlFor = id => `${base}/rooms/${id}.json?ns=${ns}`;
const rulesUrl = `${base}/.settings/rules.json?ns=${ns}`;
const originalRules = JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json', import.meta.url)));
// Windows Playwright 1.61's multi-context routed-WebSocket trace finalization
// fails with truncated ZIP/file-stream errors. No behavior assertion is skipped:
// retain observable-result attachments here and four-project visual evidence.
// trace is worker-scoped, so this override applies only to this new test file.
test.use({ trace: process.platform === 'win32' ? 'off' : 'retain-on-failure' });
const complete = page => page.getByRole('definition').filter({ hasText: /^同期完了$/ });
const local = (page, id) => page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)), id);
const receiptAt = (page, id, type = 'car') => page.evaluate(({ id, type }) => JSON.parse(localStorage.getItem(`sanpo-ui:participant-task:v1:${id}:allocation:${type}`) || 'null')?.data?.receipt || null, { id, type });
const migrate = createRoomStore().domain.migrate;
function schema6Data(room) {
  const data = structuredClone(room);
  delete data.activeAllocationType; delete data.trayMinimized;
  return data;
}
// RTDB omits empty maps. Compare the same canonical boundary that both current
// clients and protected legacy readers consume, not JSON serialization details.
const shared = async (request, id) => migrate(await (await request.get(urlFor(id), { headers })).json());
function setup() {
  const store = createRoomStore({ initial: createReference().migrateAppData(fixture) });
  const ids = Object.fromEntries(Object.values(store.getSnapshot().participants).map(p => [p.name.replace('仮参加者', ''), p.id]));
  store.command('editParticipant', { id: ids.B, changes: { locked: false } });
  for (const id of [ids.B, ids.C]) store.command('move', { id, type: 'car' });
  return { store, ids, groupId: store.getSnapshot().allocations.car.placements[ids.A].groupId };
}
async function choose(page, name) {
  const radio = page.getByRole('radio', { name: `${name}を選択`, exact: true });
  await page.locator(`label[for="${await radio.getAttribute('id')}"]`).click();
  await expect(radio).toBeChecked();
}
async function enter(page, id, query = '') {
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log('E browser:', message.text()); });
  await page.goto(`/?room=${id}&section=organization-car${query}`);
  await expect(complete(page)).toBeVisible();
}
async function deny(request, id) {
  const rules = structuredClone(originalRules);
  rules.rules.rooms.$roomId['.write'] += ` && $roomId != '${id}'`;
  expect((await request.put(rulesUrl, { headers, data: rules })).ok()).toBe(true);
}
async function heldSocket(page, direction = 'out') {
  let held = false;
  const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    const source = direction === 'out' ? socket : server;
    const destination = direction === 'out' ? server : socket;
    source.onMessage(message => { if (held) pending.push(() => destination.send(message)); else destination.send(message); });
  });
  return {
    hold() { held = true; }, count: () => pending.length,
    release() { held = false; pending.splice(0).forEach(send => send()); },
  };
}

test('rejected shuffle survives refresh and retries the exact result, not a new allocation', async ({ page, request }, info) => {
  const id = `ESHAREDRANDOM${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store } = setup(), initial = store.getSnapshot();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(initial) })).ok()).toBe(true);
  try {
    await enter(page, id);
    const ready = await shared(request, id);
    await deny(request, id);
    await page.getByRole('button', { name: 'ランダム割り当て', exact: true }).click();
    await page.getByRole('dialog', { name: 'ランダム割り当て', exact: true }).getByRole('button', { name: 'ランダムに割り当て', exact: true }).click();
    await expect(page.getByRole('button', { name: '共有保存を再試行', exact: true })).toBeVisible();
    const original = await receiptAt(page, id);
    expect(original.canRetry).toBe(true);
    const expected = store.domain.migrate(store.domain.sync.applyEntityPatchToObject(initial, original.patch));
    expect(semanticRoom((await shared(request, id)).allocations)).toEqual(semanticRoom(initial.allocations));
    await page.reload();
    await page.getByRole('link', { name: '結果を確認・コピー', exact: true }).click();
    await expect(page.getByRole('button', { name: '車割をコピー', exact: true })).toBeDisabled();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await page.getByRole('button', { name: '共有保存を再試行', exact: true }).click();
    await expect(page.getByRole('button', { name: '車割をコピー', exact: true })).toBeEnabled();
    const saved = await shared(request, id);
    expect(semanticRoom(saved.allocations.car)).toEqual(semanticRoom(expected.allocations.car));
    expect(semanticRoom(saved.allocations.team)).toEqual(semanticRoom(initial.allocations.team));
    expect(semanticRoom(saved.settlement)).toEqual(semanticRoom(initial.settlement));
    expect(saved.meta).toEqual(ready.meta);
    expect(await receiptAt(page, id)).toBeNull();
  } finally {
    await page.close();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
  }
});

test('group creation retry retains its identity after reload and later independent team changes', async ({ page, request }, info) => {
  const id = `ESHAREDGROUP${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids } = setup(), initial = store.getSnapshot();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(initial) })).ok()).toBe(true);
  try {
    await enter(page, id); await deny(request, id);
    await page.getByRole('button', { name: '車を追加', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '車を追加', exact: true });
    await dialog.getByRole('combobox', { name: '運転手', exact: true }).selectOption(ids.B);
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '共有保存を再試行', exact: true })).toBeVisible();
    const groupId = (await local(page, id)).allocations.car.placements[ids.B].groupId;
    await page.reload();
    const other = createRoomStore({ initial: await shared(request, id) });
    other.command('createGroup', { type: 'team', ownerId: ids.C, capacity: 5 });
    expect((await request.put(urlFor(id), { headers, data: schema6Data(other.getSnapshot()) })).ok()).toBe(true);
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await page.getByRole('button', { name: '共有保存を再試行', exact: true }).click();
    await expect.poll(async () => (await shared(request, id)).allocations.car.placements[ids.B].groupId).toBe(groupId);
    const saved = await shared(request, id);
    expect(Object.keys(saved.allocations.car.groups)).toHaveLength(3);
    expect(saved.allocations.team.placements[ids.C].driver).toBe(true);
    await page.reload(); await expect(complete(page)).toBeVisible();
    expect(await receiptAt(page, id)).toBeNull();
  } finally {
    await page.close();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
  }
});

test('applied participant edit freezes submitted fields while pending and after denial until exact retry', async ({ page, request }, info) => {
  const id = `ESHAREDEDIT${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids } = setup();
  const socket = await heldSocket(page);
  expect((await request.put(urlFor(id), { headers, data: schema6Data(store.getSnapshot()) })).ok()).toBe(true);
  try {
    await enter(page, id, '&task=unassigned');
    await deny(request, id);
    await page.getByRole('button', { name: '仮参加者Bの操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '参加者を編集', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '参加者を編集', exact: true });
    const name = dialog.getByRole('textbox', { name: '名前', exact: true });
    const memo = dialog.getByRole('textbox', { name: 'メモ', exact: true });
    await name.fill('送信した名前'); await memo.fill('送信したメモ');
    socket.hold();
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(socket.count).toBeGreaterThan(0);
    for (const field of [name, memo, dialog.getByRole('combobox', { name: '学年', exact: true }), dialog.getByRole('combobox', { name: 'しるし', exact: true }), dialog.getByRole('checkbox', { name: '固定', exact: true }), dialog.getByRole('checkbox', { name: '運転手', exact: true })]) await expect(field).toBeDisabled();
    socket.release();
    await expect(dialog.getByRole('button', { name: '共有保存を再試行', exact: true })).toBeVisible();
    await expect(name).toBeDisabled(); await expect(memo).toBeDisabled();
    await expect(name).toHaveValue('送信した名前'); await expect(memo).toHaveValue('送信したメモ');
    expect((await shared(request, id)).participants[ids.B].name).toBe('仮参加者B');
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await dialog.getByRole('button', { name: '共有保存を再試行', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await shared(request, id);
    expect(saved.participants[ids.B].name).toBe('送信した名前');
    expect(saved.participants[ids.B].memo).toBe('送信したメモ');
    expect(await receiptAt(page, id)).toBeNull();
  } finally {
    socket.release(); await page.close();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
  }
});

test('two clients compete for the last slot and display canonical outcome without compensating writes', async ({ browser, request }, info) => {
  const id = `ESHAREDSLOT${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids } = setup();
  // A is a linked applicant driver: its form-owned capacity is reconciled.
  // Test a manually controlled group so a metadata update is not mistaken for
  // last-slot normalization. Keep that protected linkage behavior intact.
  const groupId = store.getSnapshot().allocations.car.placements[ids.D].groupId;
  store.command('move', { id: ids.E, type: 'car' });
  store.command('capacity', { type: 'car', groupId, capacity: 1 });
  const initial = store.getSnapshot();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(initial) })).ok()).toBe(true);
  const a = await browser.newContext(info.project.use), b = await browser.newContext(info.project.use);
  let holdA, holdB;
  try {
    const pageA = await a.newPage(), pageB = await b.newPage();
    holdA = await heldSocket(pageA); holdB = await heldSocket(pageB);
    await Promise.all([enter(pageA, id, `&task=assign&group=${groupId}`), enter(pageB, id, `&task=assign&group=${groupId}`)]);
    await choose(pageA, '仮参加者B'); await choose(pageB, '仮参加者C');
    holdA.hold(); holdB.hold();
    await pageA.getByRole('button', { name: '車へ割り当て', exact: true }).click();
    await pageB.getByRole('button', { name: '車へ割り当て', exact: true }).click();
    await expect.poll(holdA.count).toBeGreaterThan(0); await expect.poll(holdB.count).toBeGreaterThan(0);
    // Both commands were prepared against the same last slot. Fix commit order
    // so the later-clock move must be normalized, rather than requiring an
    // adjustment notice for a different operation that changes an earlier save.
    holdA.release(); await expect(complete(pageA)).toBeVisible(); holdB.release();
    await expect(complete(pageA)).toBeVisible(); await expect(complete(pageB)).toBeVisible();
    const saved = await shared(request, id);
    expect([ids.B, ids.C].filter(pid => saved.allocations.car.placements[pid].groupId === groupId)).toHaveLength(1);
    expect(semanticRoom((await local(pageA, id)).allocations)).toEqual(semanticRoom(saved.allocations));
    expect(semanticRoom((await local(pageB, id)).allocations)).toEqual(semanticRoom(saved.allocations));
    await expect.poll(async () => [await receiptAt(pageA, id), await receiptAt(pageB, id)].filter(receipt => receipt?.disposition === 'adjusted').length).toBe(1);
    expect(semanticRoom(saved.settlement)).toEqual(semanticRoom(initial.settlement));
    expect(semanticRoom(saved.participants)).toEqual(semanticRoom(initial.participants));
    // Keep both observable results as text here; the four-project offline gate
    // captures light/dark geometry. Taking screenshots of both routed-WebSocket
    // contexts stalls Windows WebKit's capture/tracing, not allocation behavior.
    await info.attach('last-slot-client-a', { body: await pageA.locator('main').innerText(), contentType: 'text/plain' });
    await info.attach('last-slot-client-b', { body: await pageB.locator('main').innerText(), contentType: 'text/plain' });
  } finally {
    await Promise.all([a.close(), b.close()]);
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
  }
});

test('random scope changes require another explicit decision; live results update from another client', async ({ browser, request }, info) => {
  const id = `ESHAREDSCOPE${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids } = setup(), initial = store.getSnapshot();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(initial) })).ok()).toBe(true);
  const a = await browser.newContext(info.project.use), b = await browser.newContext(info.project.use);
  try {
    const pageA = await a.newPage(), pageB = await b.newPage();
    await Promise.all([enter(pageA, id), enter(pageB, id, '&task=unassigned')]);
    await pageA.getByRole('button', { name: 'ランダム割り当て', exact: true }).click();
    const review = pageA.getByRole('dialog', { name: 'ランダム割り当て', exact: true });
    await pageB.getByRole('button', { name: '仮参加者Fの操作', exact: true }).click();
    await pageB.getByRole('menuitem', { name: 'ランダム割り当てで固定', exact: true }).click();
    await expect.poll(async () => (await local(pageA, id)).participants[ids.F].locked).toBe(true);
    const before = await shared(request, id);
    await review.getByRole('button', { name: 'ランダムに割り当て', exact: true }).click();
    await expect(review.getByRole('status')).toContainText('割り当てが変更されました');
    expect((await shared(request, id)).syncOperations).toEqual(before.syncOperations);
    await review.getByRole('button', { name: 'ランダムに割り当て', exact: true }).click();
    await expect(review).toHaveCount(0);
    await pageA.getByRole('link', { name: '結果を確認・コピー', exact: true }).click();
    const preview = pageA.getByRole('textbox', { name: '割当結果プレビュー', exact: true });
    const oldText = await preview.inputValue();
    await pageB.getByRole('button', { name: '仮参加者Fの操作', exact: true }).click();
    await pageB.getByRole('menuitem', { name: '参加者を編集', exact: true }).click();
    const editor = pageB.getByRole('dialog', { name: '参加者を編集', exact: true });
    await editor.getByRole('textbox', { name: '名前', exact: true }).fill('変更後の参加者F');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(preview).not.toHaveValue(oldText);
    await expect(preview).toHaveValue(/変更後の参加者F/);
    expect((await shared(request, id)).participants[ids.F].locked).toBe(true);
  } finally {
    await a.close(); await b.close();
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
  }
});

test('late acknowledgement after navigation does not steal focus and recovered receipt resolves on return', async ({ page, request }, info) => {
  const id = `ESHAREDLATE${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, groupId } = setup();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(store.getSnapshot()) })).ok()).toBe(true);
  const hold = await heldSocket(page, 'in');
  try {
    await enter(page, id, `&task=assign&group=${groupId}`);
    await choose(page, '仮参加者C'); hold.hold();
    await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
    await expect.poll(hold.count).toBeGreaterThan(0);
    await navigateToProjectSection(page, '参加者');
    await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '参加者を登録', exact: true })).toBeFocused();
    const field = page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true });
    await field.fill('継続する入力');
    await expect(field).toBeFocused();
    hold.release();
    await expect(complete(page)).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(field).toBeFocused(); await expect(field).toHaveValue('継続する入力');
    await navigateToProjectSection(page, '車割');
    await page.getByRole('link', { name: '結果を確認・コピー', exact: true }).click();
    await expect(page.getByRole('button', { name: '車割をコピー', exact: true })).toBeEnabled();
    expect(await receiptAt(page, id)).toBeNull();
  } finally { hold.release(); await page.close(); expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true); }
});

test('reset invalidates an in-flight move and deleted deep group falls back only after initial load', async ({ page, request }, info) => {
  const id = `ESHAREDRESET${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids, groupId } = setup(), initial = store.getSnapshot();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(initial) })).ok()).toBe(true);
  const hold = await heldSocket(page);
  try {
    await enter(page, id, `&task=assign&group=${groupId}`);
    await choose(page, '仮参加者B'); hold.hold();
    await page.getByRole('button', { name: '車へ割り当て', exact: true }).click();
    await expect.poll(hold.count).toBeGreaterThan(0);
    const reset = structuredClone(initial); reset.resetGeneration++;
    expect((await request.put(urlFor(id), { headers, data: schema6Data(reset) })).ok()).toBe(true);
    hold.release();
    await expect(page.getByRole('status').filter({ hasText: '企画がリセットされました' })).toBeVisible();
    expect((await shared(request, id)).allocations.car.placements[ids.B].kind).toBe('waiting');
    await page.getByRole('button', { name: '現在の結果を確認した', exact: true }).click();
    const current = createRoomStore({ initial: await shared(request, id) });
    const deletedId = current.getSnapshot().allocations.car.placements[ids.D].groupId;
    await page.goto(`/?room=${id}&section=organization-car&task=group&group=${deletedId}`);
    await expect(complete(page)).toBeVisible();
    current.command('deleteGroup', { type: 'car', groupId: deletedId });
    expect((await request.put(urlFor(id), { headers, data: schema6Data(current.getSnapshot()) })).ok()).toBe(true);
    await expect(page).not.toHaveURL(/group=/);
    await page.goto(`/?room=${id}&section=organization-car&task=group&group=${deletedId}&handoffToken=synthetic-e`);
    await expect(page).not.toHaveURL(/group=/);
    expect(new URL(page.url()).searchParams.get('room')).toBe(id);
    expect(new URL(page.url()).searchParams.get('handoffToken')).toBe('synthetic-e');
    await expect(page.getByRole('heading', { level: 1, name: '車割', exact: true })).toBeVisible();
  } finally { hold.release(); await page.close(); expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true); }
});

test('linked vehicle dialogs explain form reconciliation without changing protected ownership', async ({ page, request }, info) => {
  const id = `ESHAREDLINKED${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, groupId } = setup();
  expect((await request.put(urlFor(id), { headers, data: schema6Data(store.getSnapshot()) })).ok()).toBe(true);
  try {
    await enter(page, id, `&task=group&group=${groupId}`);
    await page.getByRole('button', { name: '仮参加者A車の操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '人数の上限を変更', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '人数の上限を変更', exact: true });
    await expect(editor).toContainText('応募フォーム');
    await editor.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await page.getByRole('button', { name: '仮参加者A車の操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '削除', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '仮参加者A車を削除しますか？', exact: true });
    await expect(confirmation).toContainText('車が再作成される');
    await confirmation.getByRole('button', { name: 'キャンセル', exact: true }).click();
    expect((await shared(request, id)).allocations.car.groups[groupId].capacity).toBe(3);
  } finally { await page.close(); expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true); }
});

test('remote capacity and person changes invalidate only the current move and restore a surviving focus target', async ({ page, request }, info) => {
  const id = `ESHAREDSTALE${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const { store, ids, groupId } = setup();
  const target = store.getSnapshot().allocations.car.placements[ids.D].groupId;
  store.command('move', { id: ids.B, type: 'car', groupId });
  store.command('move', { id: ids.E, type: 'car' });
  store.command('capacity', { type: 'car', groupId: target, capacity: 1 });
  expect((await request.put(urlFor(id), { headers, data: schema6Data(store.getSnapshot()) })).ok()).toBe(true);
  try {
    await enter(page, id, `&task=group&group=${groupId}`);
    await page.getByRole('button', { name: '仮参加者Bの移動', exact: true }).click();
    const form = page.getByRole('form', { name: '仮参加者Bの移動', exact: true });
    const select = form.getByRole('combobox', { name: '移動先', exact: true });
    await select.selectOption(target); await select.focus();
    const remote = createRoomStore({ initial: await shared(request, id) });
    remote.command('move', { id: ids.C, type: 'car', groupId: target });
    expect((await request.put(urlFor(id), { headers, data: schema6Data(remote.getSnapshot()) })).ok()).toBe(true);
    await expect(form.getByRole('button', { name: '車へ移動', exact: true })).toBeDisabled();
    expect((await shared(request, id)).allocations.car.placements[ids.B].groupId).toBe(groupId);
    remote.command('deleteParticipant', { id: ids.B });
    expect((await request.put(urlFor(id), { headers, data: schema6Data(remote.getSnapshot()) })).ok()).toBe(true);
    await expect(form).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: '選択していた参加者が変更されました' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('group')).toBe(groupId);
  } finally { await page.close(); expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true); }
});
