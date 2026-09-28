import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';
import { getDatabase, ref, get, runTransaction, remove } from 'firebase/database';
import { fixture, createReference } from '../reference.mjs';

const roomId = process.env.REACT_PRODUCTION_SMOKE_ROOM;
const mode = process.env.REACT_PRODUCTION_SMOKE_MODE;
const smokeMarker = process.env.REACT_PRODUCTION_SMOKE_MARKER || '';
const expectedBuildSha = process.env.REACT_PRODUCTION_BUILD_SHA || '';
const expectedAssetDigest = process.env.REACT_PRODUCTION_ASSET_DIGEST || '';
const config = JSON.parse(process.env.REACT_FIREBASE_CONFIG || '{}');
const productionPath = mode === 'compatibility' ? '/circle-kikaku-tools/react/' : '/circle-kikaku-tools/';

function assertProductionSmokeTarget() {
  if (process.env.REACT_PRODUCTION_RELEASE !== 'true'
    || roomId !== 'P9A93LMQ'
    || !/^react-release-\d+-\d+$/.test(smokeMarker)
    || !/^[a-f0-9]{40}$/.test(expectedBuildSha)
    || !/^[a-f0-9]{64}$/.test(expectedAssetDigest)
    || config.projectId !== 'sanpokai-tool'
    || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com') {
    throw new Error('Production smoke target guard rejected this run.');
  }
}

async function openSmokeRoomClient() {
  assertProductionSmokeTarget();
  const app = initializeApp(config, `release-smoke-${globalThis.crypto.randomUUID()}`);
  const auth = getAuth(app);
  const database = getDatabase(app);
  try {
    await signInAnonymously(auth);
    return {
      room: ref(database, `rooms/${roomId}`),
      async dispose() {
        try { await signOut(auth); } finally { await deleteApp(app); }
      },
    };
  } catch (error) {
    await deleteApp(app);
    throw error;
  }
}

test('production app, Firebase compatibility, route APIs, and key tasks work without touching another room', async ({ page }) => {
  const smokeClient = await openSmokeRoomClient();
  let roomOwnedByThisRun = false;
  let consoleErrorCount = 0;
  const forbiddenResponses = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrorCount += 1; });
  page.on('pageerror', () => { consoleErrorCount += 1; });
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.status() === 403 && /(?:googleapis\.com|google\.com)$/.test(url.hostname)) {
      forbiddenResponses.push(`${url.hostname}${url.pathname}`);
    } else if (url.hostname === 'mutoshiki.github.io' && response.status() >= 400 && /\.(?:js|css)$/.test(url.pathname)) {
      forbiddenResponses.push(`${url.hostname}${url.pathname}:${response.status()}`);
    }
  });

  try {
    const initialRoom = await get(smokeClient.room);
    if (initialRoom.exists()) {
      const oldMarker = initialRoom.child('roomName').val();
      if (typeof oldMarker !== 'string' || !/^react-release-\d+-\d+$/.test(oldMarker)) {
        throw new Error('Reserved smoke room contains unmarked data; no data was changed.');
      }
      await remove(smokeClient.room);
      if ((await get(smokeClient.room)).exists()) throw new Error('Stale reserved smoke room cleanup could not be verified.');
    }

    const initial = createReference().migrateAppData(fixture);
    initial.roomName = smokeMarker;
    const seeded = await runTransaction(smokeClient.room, current => current === null ? initial : undefined, { applyLocally: false });
    if (!seeded.committed) throw new Error('Reserved smoke room is not empty; no data was changed.');
    roomOwnedByThisRun = true;

    await page.goto(`?room=${roomId}&view=participants`);
    await expect(page).toHaveTitle('サークル企画ツール');
    const buildManifest = await page.evaluate(async () => {
      const response = await fetch(new URL('release-build.json', window.location.href));
      if (!response.ok) throw new Error(`Build identity manifest request failed: ${response.status}`);
      return response.json();
    });
    expect(buildManifest).toEqual({ sourceSha: expectedBuildSha, assetDigest: expectedAssetDigest });
    await expect(page.locator('.application')).toBeVisible();
    await expect(page.locator('.sync-status')).toHaveText('同期完了');
    const projectName = page.getByRole('textbox', { name: '企画名' });
    await projectName.fill(smokeMarker);
    await projectName.press('Tab');
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    await page.getByRole('tab', { name: '車割', exact: true }).click();
    await expect(page.getByRole('heading', { name: '車割', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '班割', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: '班割', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '精算', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();

    const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A/ }) }).first();
    await car.getByRole('button', { name: '費用を入力' }).click();
    const editor = page.getByRole('dialog', { name: /仮参加者A/ });
    await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
    await editor.getByRole('button', { name: 'ガソリン代の操作' }).click();
    await page.getByRole('menuitem', { name: '計算条件を編集' }).click();
    await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
    await editor.getByRole('button', { name: 'ルートから距離を計算' }).click();
    const routeModal = page.getByRole('dialog', { name: /仮参加者A/ });
    const search = routeModal.getByRole('searchbox', { name: '場所を検索' });
    await search.fill('東京駅');
    await expect(routeModal.locator('.route-place-results')).toBeVisible();
    await routeModal.locator('.route-place-results .cds--contained-list-item').first().click();
    await routeModal.getByRole('button', { name: /目的地を追加/ }).click();
    await search.fill('新宿駅');
    await expect(routeModal.locator('.route-place-results')).toBeVisible();
    await routeModal.locator('.route-place-results .cds--contained-list-item').first().click();
    await expect(routeModal.locator('.route-results .route-result').first()).toBeVisible({ timeout: 60000 });
    await routeModal.getByRole('button', { name: '地図を表示' }).click();
    await expect(routeModal.getByRole('region', { name: 'ルート地図' })).toBeVisible();
    expect(forbiddenResponses).toEqual([]);
    await routeModal.getByRole('button', { name: '戻る' }).click();
    await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
    await editor.getByRole('button', { name: 'ガソリン代を適用' }).click();
    await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
    await editor.getByRole('button', { name: '費用を保存' }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    await page.reload();
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue(smokeMarker);
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    if (mode === 'compatibility') {
      const legacyUrl = new URL('/circle-kikaku-tools/', 'https://mutoshiki.github.io');
      legacyUrl.searchParams.set('room', roomId);
      await page.goto(legacyUrl.toString());
      await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue(smokeMarker);
      await page.goto(`${productionPath}?room=${roomId}&view=seisan`);
      await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();
    }
    expect(consoleErrorCount).toBe(0);
    expect(forbiddenResponses).toEqual([]);
  } finally {
    await page.close().catch(() => {});
    if (roomOwnedByThisRun) {
      await remove(smokeClient.room);
      const cleaned = await get(smokeClient.room);
      if (cleaned.exists()) throw new Error('Dedicated smoke room cleanup could not be verified.');
    }
    await smokeClient.dispose();
  }
});
