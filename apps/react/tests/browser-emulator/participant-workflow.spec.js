import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixture, createReference } from '../reference.mjs';

const headers = { Authorization: 'Bearer owner' };
const base = 'http://127.0.0.1:9008';
const ns = 'demo-circle-react-default-rtdb';
const roomUrl = id => `${base}/rooms/${id}.json?ns=${ns}`;
const complete = page => page.getByRole('definition').filter({ hasText: /^同期完了$/ });
const form = page => page.getByRole('form', { name: '参加者を登録' });

test('registration retries a rejected write without losing input or changing identity and converges with another client', async ({ browser, request }, info) => {
  const id = `DPARTICIPANTRETRY${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = roomUrl(id);
  const rulesUrl = `${base}/.settings/rules.json?ns=${ns}`;
  const originalRules = JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json', import.meta.url)));
  const denied = structuredClone(originalRules);
  denied.rules.rooms.$roomId['.write'] += ` && $roomId != '${id}'`;
  expect((await request.put(url, { headers, data: createReference().migrateAppData(fixture) })).ok()).toBe(true);
  const a = await browser.newContext(info.project.use), b = await browser.newContext(info.project.use);
  try {
    const page = await a.newPage(), other = await b.newPage();
    await Promise.all([page.goto(`/?room=${id}&section=participants&task=import`), other.goto(`/?room=${id}`)]);
    await expect(complete(page)).toBeVisible(); await expect(complete(other)).toBeVisible();
    const denyResponse = await request.put(rulesUrl, { headers, data: denied });
    expect(denyResponse.ok(), await denyResponse.text()).toBe(true);
    await form(page).getByLabel('参加者（改行区切り）', { exact: true }).fill('再試行する参加者');
    await form(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
    await expect(form(page).getByRole('status').filter({ hasText: '共有保存に失敗' })).toBeVisible();
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toHaveValue('再試行する参加者');
    expect(Object.keys((await (await request.get(url, { headers })).json()).participants)).toHaveLength(6);
    const localId = await page.evaluate(id => Object.values(JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)).participants).find(p => p.name === '再試行する参加者').id, id);
    await page.reload();
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toHaveValue('再試行する参加者');
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toBeDisabled();
    await expect(complete(page)).toBeVisible();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await form(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeVisible();
    await expect(other.getByRole('list', { name: '参加者一覧' })).toContainText('再試行する参加者');
    const shared = await (await request.get(url, { headers })).json();
    expect(shared.participants[localId].name).toBe('再試行する参加者');
    expect(shared.meta.applicationSync).toEqual(fixture.meta.applicationSync);
    expect(await page.evaluate(id => localStorage.getItem(`sanpo-ui:participant-task:v1:${id}:import`), id)).toBeNull();
  } finally {
    await Promise.all([a.close(), b.close()]);
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});

test('pending registration acknowledgement blocks double submit and cannot erase a newer draft after navigation', async ({ page, request }, info) => {
  const id = `DPARTICIPANTDELAY${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = roomUrl(id);
  let hold = false; const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    server.onMessage(message => { if (hold) pending.push(() => socket.send(message)); else socket.send(message); });
  });
  expect((await request.put(url, { headers, data: createReference().migrateAppData(fixture) })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${id}&section=participants&task=import`); await expect(complete(page)).toBeVisible();
    await form(page).getByLabel('参加者（改行区切り）', { exact: true }).fill('応答待ちの参加者');
    hold = true;
    await form(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
    await expect(form(page)).toHaveAttribute('aria-busy', 'true');
    await expect(form(page).getByRole('button', { name: '参加者を登録', exact: true })).toBeDisabled();
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    await page.getByRole('link', { name: '参加者に戻る' }).click();
    await page.getByRole('button', { name: '参加者を追加' }).click();
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toBeDisabled();
    await form(page).getByRole('button', { name: 'キャンセル', exact: true }).click();
    await page.getByRole('button', { name: '参加者を追加' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '参加者を登録', exact: true })).toBeFocused();
    await form(page).getByLabel('参加者（改行区切り）', { exact: true }).fill('次の下書き');
    hold = false; pending.splice(0).forEach(send => send());
    await expect(complete(page)).toBeVisible();
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toHaveValue('次の下書き');
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-ui:participant-task:v1:${id}:import`)).data.members, id)).toBe('次の下書き');
  } finally { await page.close(); expect((await request.delete(url, { headers })).ok()).toBe(true); }
});

test('selection retries rejection and does not report a remote reset as a successful confirmation', async ({ page, request }, info) => {
  const id = `DPARTICIPANTSELECTION${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = roomUrl(id), rulesUrl = `${base}/.settings/rules.json?ns=${ns}`;
  const seed = createReference().migrateAppData(fixture);
  const originalRules = JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json', import.meta.url)));
  const denied = structuredClone(originalRules);
  denied.rules.rooms.$roomId['.write'] += ` && $roomId != '${id}'`;
  let hold = false; const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => { if (hold) pending.push(() => server.send(message)); else server.send(message); });
  });
  expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${id}`); await expect(complete(page)).toBeVisible();
    await page.getByRole('button', { name: '参加者を選び直す' }).click();
    await page.getByRole('checkbox', { name: '仮参加者G', exact: true }).check({ force: true });
    expect((await request.put(rulesUrl, { headers, data: denied })).ok()).toBe(true);
    await page.getByRole('button', { name: '参加者を確定', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '共有保存に失敗' })).toBeVisible();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await page.getByRole('button', { name: '参加者を確定', exact: true }).click();
    await expect(page.getByRole('button', { name: '参加者を選び直す' })).toBeVisible();
    expect(Object.values((await (await request.get(url, { headers })).json()).participants).some(p => p.name === '仮参加者G')).toBe(true);
    await page.getByRole('button', { name: '参加者を選び直す' }).click();
    await page.getByRole('checkbox', { name: '仮参加者G', exact: true }).uncheck({ force: true });
    hold = true;
    await page.getByRole('button', { name: '参加者を確定', exact: true }).click();
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    seed.resetGeneration = Number(seed.resetGeneration || 0) + 1;
    expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
    await expect.poll(async () => page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)).resetGeneration, id)).toBe(seed.resetGeneration);
    hold = false; pending.splice(0).forEach(send => send());
    await expect(page.getByRole('status').filter({ hasText: '企画がリセットされました' })).toBeVisible();
    await expect(page.getByRole('button', { name: '参加者を確定', exact: true })).toBeVisible();
  } finally {
    await page.close();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});

test('remote reset during registration retains draft and never reports discarded registration as success', async ({ page, request }, info) => {
  const id = `DPARTICIPANTRESET${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = roomUrl(id); const seed = createReference().migrateAppData(fixture);
  let hold = false; const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => { if (hold) pending.push(() => server.send(message)); else server.send(message); });
  });
  expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${id}&section=participants&task=import`); await expect(complete(page)).toBeVisible();
    await form(page).getByLabel('参加者（改行区切り）', { exact: true }).fill('リセット前の参加者');
    hold = true;
    await form(page).getByRole('button', { name: '参加者を登録', exact: true }).click();
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    seed.resetGeneration = Number(seed.resetGeneration || 0) + 1;
    seed.roomName = 'リセット後の企画';
    expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
    await expect(page.getByRole('main').getByText(seed.roomName, { exact: true }).first()).toBeVisible();
    hold = false; pending.splice(0).forEach(send => send());
    await expect(form(page).getByRole('status').filter({ hasText: '企画がリセットされました' })).toBeVisible();
    await expect(form(page).getByLabel('参加者（改行区切り）', { exact: true })).toHaveValue('リセット前の参加者');
    expect(Object.values((await (await request.get(url, { headers })).json()).participants).some(p => p.name === 'リセット前の参加者')).toBe(false);
  } finally { await page.close(); expect((await request.delete(url, { headers })).ok()).toBe(true); }
});

test('first confirmation remains a busy selection task and late acknowledgement does not steal child focus', async ({ page, request }, info) => {
  const id = `DPARTICIPANTFIRST${info.project.name.startsWith('webkit') ? 'WK' : 'CH'}`, url = roomUrl(id);
  const seed = createReference().migrateAppData(fixture); seed.participants = {};
  seed.allocations = createReference().migrateAppData({}).allocations;
  let hold = false; const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    server.onMessage(message => { if (hold) pending.push(() => socket.send(message)); else socket.send(message); });
  });
  expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${id}`); await expect(complete(page)).toBeVisible();
    await page.getByRole('checkbox', { name: '仮参加者G', exact: true }).check({ force: true });
    hold = true;
    await page.getByRole('button', { name: '参加者を確定', exact: true }).click();
    await expect(page.getByRole('button', { name: '参加者を確定', exact: true })).toBeDisabled();
    await expect(page.getByText('確定済み', { exact: true })).toHaveCount(0);
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: '参加者を追加' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '参加者を登録', exact: true })).toBeFocused();
    const names = form(page).getByLabel('参加者（改行区切り）', { exact: true });
    await names.fill('別の入力を継続');
    hold = false; pending.splice(0).forEach(send => send());
    await expect(complete(page)).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(names).toBeFocused(); await expect(names).toHaveValue('別の入力を継続');
  } finally { await page.close(); expect((await request.delete(url, { headers })).ok()).toBe(true); }
});
