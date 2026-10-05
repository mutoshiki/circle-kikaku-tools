import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRoomStore } from '../../src/store/room-store.js';
import { fixture, semanticRoom, createReference, plain } from '../reference.mjs';
import { vehicleCostTargets } from '../../src/ui/vehicle-cost-target.js';
import { navigateToProjectSection } from '../browser/project-navigation.js';

const base = 'http://127.0.0.1:9008', ns = 'demo-circle-react-default-rtdb';
const headers = { Authorization: 'Bearer owner' };
const urlFor = id => `${base}/rooms/${id}.json?ns=${ns}`;
const rulesUrl = `${base}/.settings/rules.json?ns=${ns}`;
const originalRules = JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json', import.meta.url)));
const domain = createRoomStore().domain;
const complete = page => page.getByRole('definition').filter({ hasText: /^同期完了$/ });
const ruleKey = id => `sanpo-ui:settlement-rules:v1:${encodeURIComponent(id)}`;
const local = (page, id, owner = 'room') => page.evaluate(({ id, owner }) => JSON.parse(localStorage.getItem(`sanpo-react:v1:${encodeURIComponent(id)}:${owner}`)), { id, owner });
const cached = (page, id) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null'), ruleKey(id));
const shared = async (request, id) => domain.migrate(await (await request.get(urlFor(id), { headers })).json());
const reward = page => page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true });
const save = page => page.getByRole('button', { name: '精算ルールを保存', exact: true });
const settings = ['rounding', 'organizerFree', 'organizerParticipantId', 'organizerNameFallback', 'driverCollectionOffset', 'driverCollectionFree', 'driverReward', 'driverRewardType', 'standalone'];
function data(room) { const copy = structuredClone(room); delete copy.activeAllocationType; delete copy.trayMinimized; return copy; }
function setup(standalone = false) {
  const store = createRoomStore({ initial: fixture });
  if (standalone) {
    const state = domain.settlementInput(store.getSnapshot()).state;
    state.standalone = { enabled: true, driverCount: '2', memberCount: '3', driverNames: ['名前だけA', '名前だけB'] };
    for (const name of state.standalone.driverNames) state.cars[name] = { dist: '100', eco: '10', price: '150', extras: [] };
    store.command('settlement', { state });
  }
  return store.getSnapshot();
}
async function seed(request, id, initial) { expect((await request.put(urlFor(id), { headers, data: data(initial) })).ok()).toBe(true); }
function expectProtected(result, expected) {
  const project = value => {
    const copy = data(value);
    for (const key of settings) delete copy.settlement[key];
    return semanticRoom(copy);
  };
  expect(project(result)).toEqual(project(expected));
  const input = domain.settlementInput(result);
  expect(plain(domain.settlement.calculateSettlement(input.data, input.state))).toEqual(plain(createReference().calculateSettlement(input.data, input.state)));
}
async function enter(page, id, rules = true) {
  await page.goto(`/?room=${id}&section=settlement${rules ? '&task=rules' : ''}`);
  await expect(complete(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: rules ? '精算ルール' : '精算', exact: true })).toBeVisible();
}
async function deny(request, id) {
  const rules = structuredClone(originalRules); rules.rules.rooms.$roomId['.write'] += ` && $roomId != '${id}'`;
  expect((await request.put(rulesUrl, { headers, data: rules })).ok()).toBe(true);
}
async function heldSocket(page, direction = 'out') {
  let held = false; const queue = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer(), source = direction === 'out' ? socket : server, destination = direction === 'out' ? server : socket;
    source.onMessage(message => { if (held) queue.push(() => destination.send(message)); else destination.send(message); });
  });
  return { hold() { held = true; }, count: () => queue.length, release() { held = false; queue.splice(0).forEach(send => send()); } };
}
async function quiescent(page, id) { await expect(complete(page)).toBeVisible(); await expect.poll(() => local(page, id, 'outbox')).toBeNull(); }
async function cleanup(request, id, contexts = [], sockets = []) {
  for (const socket of sockets) socket?.release();
  try { for (const context of contexts) await context.close(); }
  finally {
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect(await (await request.get(rulesUrl, { headers })).json()).toEqual(originalRules);
    expect((await request.delete(urlFor(id), { headers })).ok()).toBe(true);
    expect(await (await request.get(urlFor(id), { headers })).json()).toBeNull();
  }
}
const idFor = (name, info) => `GRULE${name}${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;

for (const standalone of [false, true]) test(`${standalone ? 'name-backed' : 'ID-backed'} rules save uses latest parallel driver cost and preserves financial state`, async ({ browser, request }, info) => {
  const id = idFor(standalone ? 'NAME' : 'ID', info), initial = setup(standalone);
  await seed(request, id, initial);
  const a = await browser.newContext(info.project.use), b = await browser.newContext(info.project.use);
  try {
    const pa = await a.newPage(), pb = await b.newPage();
    await enter(pa, id); const before = await shared(request, id), target = vehicleCostTargets(before, domain)[0];
    await pb.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(target.key)}&task=expense&expense=movement`);
    await expect(complete(pb)).toBeVisible();
    await pa.getByText('10円単位', { exact: true }).click();
    await pb.getByRole('textbox', { name: '走行距離（km）', exact: true }).fill('222');
    await pb.getByRole('button', { name: '車両費用を保存', exact: true }).click(); await quiescent(pb, id);
    await expect.poll(async () => domain.settlementInput(await local(pa, id)).state.cars[target.car.name].dist).toBe('222');
    const expected = await shared(request, id);
    expect(await reward(pa).inputValue()).toBe(domain.settlementInput(expected).state.driverReward);
    await save(pa).click(); await quiescent(pa, id);
    const result = await shared(request, id); expect(result.settlement.rounding).toBe('10');
    expectProtected(result, expected); expect(await cached(pa, id)).toBeNull();
    await pa.reload(); await expect(pa.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
    expect(domain.settlementInput(await local(pa, id)).state.cars[target.car.name].dist).toBe('222');
  } finally { await cleanup(request, id, [a, b]); }
});

test('distinct settings edits preserve each other; a remote same dirty path blocks pre-submit without losing draft', async ({ browser, request }, info) => {
  const id = idFor('FIELDS', info); await seed(request, id, setup());
  const a = await browser.newContext(info.project.use), b = await browser.newContext(info.project.use);
  try {
    const pa = await a.newPage(), pb = await b.newPage(); await Promise.all([enter(pa, id), enter(pb, id)]);
    const before = await shared(request, id);
    await pa.getByText('10円単位', { exact: true }).click(); await reward(pb).fill('900');
    await save(pa).click(); await quiescent(pa, id);
    await expect.poll(async () => (await local(pb, id)).settlement.rounding).toBe('10');
    await save(pb).click(); await quiescent(pb, id);
    const result = await shared(request, id); expect(result.settlement.rounding).toBe('10'); expect(result.settlement.driverReward).toBe('900'); expectProtected(result, before);
    await enter(pa, id); await enter(pb, id); await pa.getByText('1円単位', { exact: true }).click();
    await reward(pb).fill('700'); await save(pb).click(); await quiescent(pb, id);
    await expect(reward(pa)).toHaveValue('700'); await reward(pa).fill('1600'); await expect(save(pa)).toBeEnabled();
    await save(pa).click(); await quiescent(pa, id);
    const firstEdited = await shared(request, id); expect(firstEdited.settlement.rounding).toBe('1'); expect(firstEdited.settlement.driverReward).toBe('1600'); expectProtected(firstEdited, before);
    await enter(pa, id); await reward(pa).fill('1500');
    await enter(pb, id); await reward(pb).fill('800'); await save(pb).click(); await quiescent(pb, id);
    await expect(pa.getByRole('region', { name: '保存前の確認' })).toContainText('別の端末で更新'); await expect(save(pa)).toBeDisabled();
    await pa.reload(); await expect(reward(pa)).toHaveValue('1500'); await expect(save(pa)).toBeDisabled();
    expect((await shared(request, id)).settlement.driverReward).toBe('800');
    await pa.getByRole('button', { name: '現在のルールから編集し直す', exact: true }).click(); await expect(reward(pa)).toHaveValue('800');
  } finally { await cleanup(request, id, [a, b]); }
});

test('denied double submit freezes one settings payload; reload retries exactly without rewriting cost or paid maps', async ({ page, request }, info) => {
  const id = idFor('RETRY', info); await seed(request, id, setup()); const socket = await heldSocket(page);
  try {
    await enter(page, id); const before = await shared(request, id); await reward(page).fill('1500');
    await deny(request, id); socket.hold();
    await page.getByRole('form', { name: '精算ルール' }).dispatchEvent('submit'); await page.getByRole('form', { name: '精算ルール' }).dispatchEvent('submit');
    await expect.poll(socket.count).toBeGreaterThan(0); await expect(reward(page)).toHaveAttribute('readonly', '');
    const original = (await cached(page, id)).data;
    expect(original.receipt.patch).toEqual({ 'settlement/driverReward': '1500' });
    expect(original.receipt.operationId).toBeTruthy(); socket.release();
    await expect.poll(async () => (await cached(page, id))?.data.receipt?.canRetry).toBe(true);
    await page.reload(); await expect(page.getByRole('button', { name: '同じ内容を再試行', exact: true })).toBeEnabled();
    await expect(reward(page)).toHaveValue('1500'); await expect(reward(page)).toHaveAttribute('readonly', '');
    expect((await cached(page, id)).data.receipt.patch).toEqual(original.receipt.patch);
    expect((await shared(request, id)).settlement.driverReward).toBe(before.settlement.driverReward);
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await page.getByRole('button', { name: '同じ内容を再試行', exact: true }).click(); await quiescent(page, id);
    const result = await shared(request, id); expect(result.settlement.driverReward).toBe('1500'); expectProtected(result, before);
    expect(await cached(page, id)).toBeNull();
  } finally { socket.release(); await page.close(); await cleanup(request, id); }
});

test('unknown recovery is not accepted by another operation draining the outbox', async ({ page, request }, info) => {
  const id = idFor('UNKNOWN', info); await seed(request, id, setup());
  try {
    await enter(page, id); await reward(page).fill('1500'); await deny(request, id); await save(page).click();
    await expect.poll(async () => (await cached(page, id))?.data.receipt?.canRetry).toBe(true);
    const record = await cached(page, id);
    // A narrow corrupt/lost-outbox recovery fixture, not an invented server ack.
    record.data.receipt.canRetry = false; record.data.receipt.disposition = 'unresolved';
    await page.evaluate(({ id, key, record }) => { localStorage.removeItem(`sanpo-react:v1:${id}:outbox`); sessionStorage.setItem(key, JSON.stringify(record)); }, { id, key: ruleKey(id), record });
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await navigateToProjectSection(page, '概要'); await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await page.getByRole('textbox', { name: '企画名', exact: true }).fill('別操作の受理');
    await page.getByRole('form', { name: '企画情報を編集' }).getByRole('button', { name: '保存', exact: true }).click(); await quiescent(page, id);
    await enter(page, id); await expect(page.getByRole('status').filter({ hasText: '保存結果を確認できません' }).first()).toBeVisible();
    await expect(reward(page)).toHaveAttribute('readonly', ''); await expect(page.getByRole('button', { name: 'キャンセル', exact: true })).toHaveCount(0);
    expect((await cached(page, id)).data.receipt.operationId).toBe(record.data.receipt.operationId);
    expect((await shared(request, id)).settlement.driverReward).toBe('500');
  } finally { await page.close(); await cleanup(request, id); }
});

test('late ack cannot steal child focus; accepted then changed receipt reviews current result without replay', async ({ page, request }, info) => {
  const id = idFor('LATE', info); await seed(request, id, setup()); const socket = await heldSocket(page, 'in');
  try {
    await enter(page, id); const before = await shared(request, id); await reward(page).fill('1500'); socket.hold(); await save(page).click();
    await expect.poll(socket.count).toBeGreaterThan(0); const record = await cached(page, id);
    await expect.poll(async () => (await shared(request, id)).syncOperations?.[record.data.receipt.operationId]).toBeTruthy();
    await navigateToProjectSection(page, '参加者'); await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
    const names = page.getByRole('textbox', { name: '参加者（改行区切り）', exact: true }); await names.fill('次の入力を継続');
    socket.release(); await quiescent(page, id); await expect(names).toBeFocused(); await expect(names).toHaveValue('次の入力を継続');
    const later = await shared(request, id); later.settlement.driverReward = '900'; await seed(request, id, later);
    await page.evaluate(({ key, record }) => sessionStorage.setItem(key, JSON.stringify(record)), { key: ruleKey(id), record });
    await enter(page, id); await expect(reward(page)).toHaveValue('1500'); await expect(reward(page)).toHaveAttribute('readonly', '');
    await expect(page.getByRole('status').filter({ hasText: '同時編集により結果が変わりました' }).first()).toBeVisible();
    const receipt = (await cached(page, id)).data.receipt; expect(receipt.acknowledged).toBe(true); expect(receipt.canRetry).toBe(false);
    await page.getByRole('button', { name: '現在の精算を確認', exact: true }).click(); await expect(page.getByRole('link', { name: '精算ルール', exact: true })).toBeFocused();
    const result = await shared(request, id); expect(result.settlement.driverReward).toBe('900'); expectProtected(result, before); expect(await cached(page, id)).toBeNull();
  } finally { socket.release(); await page.close(); await cleanup(request, id); }
});

test('reset fences in-flight rules and retains the exact copy until explicit current-result confirmation', async ({ page, request }, info) => {
  const id = idFor('RESET', info), initial = setup(); await seed(request, id, initial); const socket = await heldSocket(page);
  try {
    await enter(page, id); const before = await shared(request, id); await reward(page).fill('1500'); socket.hold(); await save(page).click(); await expect.poll(socket.count).toBeGreaterThan(0);
    const reset = structuredClone(before); reset.resetGeneration++; await seed(request, id, reset); socket.release();
    await expect(page.getByRole('status').filter({ hasText: '企画がリセットされました' }).first()).toBeVisible();
    await expect(reward(page)).toHaveAttribute('readonly', ''); expect((await shared(request, id)).settlement.driverReward).toBe('500');
    expect((await cached(page, id)).data.receipt.patch).toEqual({ 'settlement/driverReward': '1500' });
    await page.getByRole('button', { name: '現在の精算を確認', exact: true }).click(); await quiescent(page, id);
    expectProtected(await shared(request, id), reset); expect(await cached(page, id)).toBeNull();
  } finally { socket.release(); await page.close(); await cleanup(request, id); }
});

test('selected organizer removal prevents unintended exemption writes after refresh', async ({ page, request }, info) => {
  const id = idFor('IDENTITY', info), initial = setup(); await seed(request, id, initial);
  try {
    await enter(page, id); const before = await shared(request, id), personId = Object.keys(before.participants)[0];
    await page.getByRole('combobox', { name: '企画者', exact: true }).selectOption(personId); await reward(page).fill('1500');
    const removed = structuredClone(before); delete removed.participants[personId]; await seed(request, id, removed);
    await expect(page.getByRole('region', { name: '保存前の確認' })).toContainText('選択した企画者が変更'); await expect(save(page)).toBeDisabled();
    await page.reload(); await expect(reward(page)).toHaveValue('1500'); await expect(save(page)).toBeDisabled();
    expectProtected(await shared(request, id), domain.migrate(removed)); expect((await shared(request, id)).settlement.driverReward).toBe('500');
  } finally { await page.close(); await cleanup(request, id); }
});

test('canonical duplicate identity cannot silently select another organizer', async ({ page, request }, info) => {
  const id = idFor('DUPLICATE', info), initial = setup();
  const personId = Object.keys(initial.participants)[0];
  try {
    const duplicateInput = structuredClone(initial);
    // A new manual participant, not a second alias of the imported response.
    duplicateInput.participants.duplicate = { id: 'duplicate', name: ` ${initial.participants[personId].name} `, grade: 1, memo: '', flag: 'none', locked: false };
    const duplicate = domain.migrate(duplicateInput);
    await seed(request, id, duplicate);
    await enter(page, id); const before = await shared(request, id);
    const organizer = page.getByRole('combobox', { name: '企画者', exact: true });
    await organizer.selectOption(personId); await reward(page).fill('1500'); await expect(organizer).toHaveValue(personId);
    await expect(page.getByRole('region', { name: '保存前の確認' })).toContainText('同じ名前として扱われる'); await expect(save(page)).toBeDisabled();
    await page.reload(); await expect(organizer).toHaveValue(personId); await expect(save(page)).toBeDisabled();
    expectProtected(await shared(request, id), before); expect((await shared(request, id)).settlement.driverReward).toBe('500');
  } finally { await page.close(); await cleanup(request, id); }
});
