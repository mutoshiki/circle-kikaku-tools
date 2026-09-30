import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';
import { readFileSync } from 'node:fs';

const syncComplete = page => page.getByRole('definition').filter({ hasText: /^同期完了$/ });

test('two real browsers save through Emulator; an active Japanese draft survives remote rename', async ({ browser, request }, testInfo) => {
  const roomId = `RCBROWSER${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const adminUrl = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const seed = await request.put(adminUrl, { headers: { Authorization: 'Bearer owner' }, data: createReference().migrateAppData(fixture) });
  expect(seed.ok()).toBe(true);
  const a = await browser.newContext(testInfo.project.use);
  const b = await browser.newContext(testInfo.project.use);
  try {
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    const errors = [];
    for (const page of [pageA, pageB]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([pageA.goto(`http://127.0.0.1:4175/?room=${roomId}&section=overview`), pageB.goto(`http://127.0.0.1:4175/?room=${roomId}&section=overview`)]);
    await expect(syncComplete(pageA)).toBeVisible();
    await expect(syncComplete(pageB)).toBeVisible();
    await pageA.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await pageB.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    const fieldA = pageA.getByRole('textbox', { name: '企画名' });
    const fieldB = pageB.getByRole('textbox', { name: '企画名' });
    await fieldB.focus();
    await fieldB.dispatchEvent('compositionstart');
    await fieldB.fill('にほんご編集中');
    await fieldA.fill('別端末で変更');
    await pageA.getByRole('button', { name: '保存', exact: true }).click();
    await expect(syncComplete(pageA)).toBeVisible();
    await expect.poll(async () => (await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json()).roomName).toBe('別端末で変更');
    await expect(fieldB).toHaveValue('にほんご編集中');
    await fieldB.dispatchEvent('compositionend', { data: '日本語で確定' });
    await fieldB.fill('日本語で確定');
    await pageB.getByRole('button', { name: '保存', exact: true }).click();
    await expect(syncComplete(pageB)).toBeVisible();
    await expect(pageA.getByRole('main').getByText('日本語で確定', { exact: true }).first()).toBeVisible();
    await pageA.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await expect(pageA.getByRole('textbox', { name: '企画名' })).toHaveValue('日本語で確定');
    const saved = await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json();
    expect(Object.keys(saved.participants)).toHaveLength(6);
    expect(saved.meta.applicationSync).toEqual(fixture.meta.applicationSync);
    expect(errors).toEqual([]);
  } finally { await Promise.all([a.close(), b.close()]); }
});

test('overview retains its draft and retries after a permanent Emulator rules rejection', async ({ page, request }, testInfo) => {
  const roomId = `COVERVIEWFAIL${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const database = 'http://127.0.0.1:9008';
  const ns = 'demo-circle-react-default-rtdb';
  const url = `${database}/rooms/${roomId}.json?ns=${ns}`;
  const rulesUrl = `${database}/.settings/rules.json?ns=${ns}`;
  const headers = { Authorization: 'Bearer owner' };
  const originalRules = JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json', import.meta.url)));
  const rules = structuredClone(originalRules);
  rules.rules.rooms.$roomId['.write'] += ` && ($roomId != '${roomId}' || newData.child('roomName').val() != '再試行する企画')`;
  expect((await request.put(url, { headers, data: createReference().migrateAppData(fixture) })).ok()).toBe(true);
  expect((await request.put(rulesUrl, { headers, data: rules })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${roomId}&section=overview`);
    await expect(syncComplete(page)).toBeVisible();
    await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await page.getByRole('textbox', { name: '企画名', exact: true }).fill('再試行する企画');
    await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('拒否されても保持するメモ');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const form = page.getByRole('form', { name: '企画情報を編集', exact: true });
    await expect(form.getByRole('status')).toContainText('保存できませんでした');
    await expect(form.getByRole('textbox', { name: '企画名', exact: true })).toHaveValue('再試行する企画');
    await expect(form.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('拒否されても保持するメモ');
    await expect(form.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    const shared = await (await request.get(url, { headers })).json();
    expect(shared.roomName).toBe(fixture.roomName);
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`sanpoOverviewDraft:v1:${id}`)).memo, roomId)).toBe('拒否されても保持するメモ');
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    await form.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('button', { name: '企画情報を編集', exact: true })).toBeVisible();
    await expect.poll(async () => (await (await request.get(url, { headers })).json()).roomName).toBe('再試行する企画');
    expect(await page.evaluate(id => localStorage.getItem(`sanpoOverviewDraft:v1:${id}`), roomId)).toBeNull();
  } finally {
    await page.close();
    expect((await request.put(rulesUrl, { headers, data: originalRules })).ok()).toBe(true);
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});

test('overview memo save preserves another client\'s independently changed project name', async ({ browser, request }, testInfo) => {
  const roomId = `COVERVIEWMERGE${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  expect((await request.put(url, { headers: { Authorization: 'Bearer owner' }, data: createReference().migrateAppData(fixture) })).ok()).toBe(true);
  const a = await browser.newContext(testInfo.project.use);
  const b = await browser.newContext(testInfo.project.use);
  try {
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await Promise.all([pageA.goto(`/?room=${roomId}&section=overview`), pageB.goto(`/?room=${roomId}&section=overview`)]);
    await expect(syncComplete(pageA)).toBeVisible();
    await expect(syncComplete(pageB)).toBeVisible();
    await pageB.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await pageB.getByRole('textbox', { name: 'メモ', exact: true }).fill('担当者Bのメモ');
    await pageA.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await pageA.getByRole('textbox', { name: '企画名', exact: true }).fill('担当者Aの企画名');
    await pageA.getByRole('button', { name: '保存', exact: true }).click();
    await expect(pageA.getByRole('button', { name: '企画情報を編集', exact: true })).toBeVisible();
    await expect(pageB.getByRole('main').getByText('担当者Aの企画名', { exact: true }).first()).toBeVisible();
    await pageB.getByRole('button', { name: '保存', exact: true }).click();
    await expect(pageB.getByRole('button', { name: '企画情報を編集', exact: true })).toBeVisible();
    await expect.poll(async () => (await (await request.get(url, { headers: { Authorization: 'Bearer owner' } })).json()).roomName).toBe('担当者Aの企画名');
    await expect(pageA.getByText('担当者Bのメモ', { exact: true })).toBeVisible();
    const saved = await (await request.get(url, { headers: { Authorization: 'Bearer owner' } })).json();
    expect(Object.keys(saved.participants)).toHaveLength(6);
    expect(saved.meta.applicationSync).toEqual(fixture.meta.applicationSync);
  } finally {
    await Promise.all([a.close(), b.close()]);
    expect((await request.delete(url, { headers: { Authorization: 'Bearer owner' } })).ok()).toBe(true);
  }
});

test('participant deletion failure stays in its confirmation after a remote removal', async ({ page, request }, testInfo) => {
  const roomId = `CCONFIRMFAIL${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const headers = { Authorization: 'Bearer owner' };
  const seed = createReference().migrateAppData(fixture);
  const id = Object.keys(seed.participants)[0];
  const name = seed.participants[id].name;
  expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${roomId}&section=participants`);
    await expect(syncComplete(page)).toBeVisible();
    await page.getByRole('button', { name: '参加者を選び直す', exact: true }).click();
    await page.getByRole('button', { name: `${name}の操作`, exact: true }).click();
    await page.getByRole('menuitem', { name: '削除', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '参加者を削除しますか？', exact: true });
    delete seed.participants[id];
    expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
    await expect(page.getByRole('button', { name: `${name}の操作`, exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: '削除', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('参加者が削除されています。');
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: '参加者', exact: true })).toBeFocused();
  } finally {
    await page.close();
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});

test('overview stays busy with its draft until the shared acknowledgement arrives', async ({ page, request }, testInfo) => {
  const roomId = `COVERVIEWDELAY${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const headers = { Authorization: 'Bearer owner' };
  let hold = false;
  const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    server.onMessage(message => {
      if (hold) pending.push(() => socket.send(message));
      else socket.send(message);
    });
  });
  expect((await request.put(url, { headers, data: createReference().migrateAppData(fixture) })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${roomId}&section=overview`);
    await expect(syncComplete(page)).toBeVisible();
    await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await page.getByRole('textbox', { name: '企画名', exact: true }).fill('応答を待つ企画');
    hold = true;
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(async () => (await (await request.get(url, { headers })).json()).roomName).toBe('応答を待つ企画');
    const form = page.getByRole('form', { name: '企画情報を編集', exact: true });
    await expect(form).toHaveAttribute('aria-busy', 'true');
    await expect(form.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    await expect(form.getByRole('button', { name: 'キャンセル', exact: true })).toBeDisabled();
    await expect(form.getByText('保存中', { exact: true })).toBeVisible();
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`sanpoOverviewDraft:v1:${id}`)).roomName, roomId)).toBe('応答を待つ企画');
    hold = false;
    pending.splice(0).forEach(send => send());
    await expect(page.getByRole('button', { name: '企画情報を編集', exact: true })).toBeFocused();
  } finally {
    await page.close();
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});

test('a remote reset during overview save retains the discarded draft with an explanation', async ({ page, request }, testInfo) => {
  const roomId = `COVERVIEWRESET${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const url = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const headers = { Authorization: 'Bearer owner' };
  const seed = createReference().migrateAppData(fixture);
  let hold = false;
  const pending = [];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => {
      if (hold) pending.push(() => server.send(message));
      else server.send(message);
    });
  });
  expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
  try {
    await page.goto(`/?room=${roomId}&section=overview`);
    await expect(syncComplete(page)).toBeVisible();
    await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
    await page.getByRole('textbox', { name: '企画名', exact: true }).fill('リセット前の下書き');
    hold = true;
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    seed.resetGeneration = Number(seed.resetGeneration || 0) + 1;
    seed.roomName = '別端末でリセットした企画';
    expect((await request.put(url, { headers, data: seed })).ok()).toBe(true);
    await expect(page.getByRole('main').getByText(seed.roomName, { exact: true }).first()).toBeVisible();
    hold = false;
    pending.splice(0).forEach(send => send());
    const form = page.getByRole('form', { name: '企画情報を編集', exact: true });
    await expect(form.getByRole('status')).toContainText('企画がリセットされました');
    await expect(form.getByRole('textbox', { name: '企画名', exact: true })).toHaveValue('リセット前の下書き');
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`sanpoOverviewDraft:v1:${id}`)).roomName, roomId)).toBe('リセット前の下書き');
    await form.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(page.getByRole('button', { name: '企画情報を編集', exact: true })).toBeVisible();
    expect((await (await request.get(url, { headers })).json()).roomName).toBe(seed.roomName);
  } finally {
    await page.close();
    expect((await request.delete(url, { headers })).ok()).toBe(true);
  }
});
