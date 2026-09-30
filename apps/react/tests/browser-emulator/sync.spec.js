import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';

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
