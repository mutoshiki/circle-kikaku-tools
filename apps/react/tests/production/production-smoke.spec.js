import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';
import { navigateToProjectSection } from '../browser/project-navigation.js';
import { cleanupProductionSmokeRoom, seedProductionSmokeRoom } from './firebase-smoke-room.mjs';

const roomId = process.env.REACT_PRODUCTION_SMOKE_ROOM;
const mode = process.env.REACT_PRODUCTION_SMOKE_MODE;
const baseURL = process.env.REACT_PRODUCTION_SMOKE_BASE_URL || '';
const smokeMarker = process.env.REACT_PRODUCTION_SMOKE_MARKER || '';
const expectedBuildSha = process.env.REACT_PRODUCTION_BUILD_SHA || '';
const expectedAssetDigest = process.env.REACT_PRODUCTION_ASSET_DIGEST || '';
const config = {
  apiKey: process.env.REACT_FIREBASE_API_KEY || '',
  authDomain: 'sanpokai-tool.firebaseapp.com',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
  projectId: 'sanpokai-tool',
  storageBucket: 'sanpokai-tool.firebasestorage.app',
  messagingSenderId: '79505558920',
  appId: '1:79505558920:web:3f9a9a333fc77de7a7fe3d',
};
const productionPath = mode === 'compatibility' ? '/circle-kikaku-tools/react/' : '/circle-kikaku-tools/';
const syncComplete = page => page.getByRole('definition').filter({ hasText: /^同期完了$/ });

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

test('production app, Firebase compatibility, route APIs, and key tasks work without touching another room', async ({ page }) => {
  assertProductionSmokeTarget();
  let roomSeeded = false;
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
    const initial = createReference().migrateAppData(fixture);
    initial.roomName = smokeMarker;
    await page.goto(baseURL);
    await expect(page.locator('.application')).toBeVisible();
    await expect(syncComplete(page)).toBeVisible();
    await seedProductionSmokeRoom(page, { config, roomId, marker: smokeMarker, data: initial });
    roomSeeded = true;
    await page.goto(`${baseURL}?room=${roomId}&view=participants`);
    await expect(page).toHaveTitle('山歩会企画ツール');
    const buildManifest = await page.evaluate(async () => {
      const response = await fetch(new URL('release-build.json', window.location.href));
      if (!response.ok) throw new Error(`Build identity manifest request failed: ${response.status}`);
      return response.json();
    });
    expect(buildManifest).toEqual({ sourceSha: expectedBuildSha, assetDigest: expectedAssetDigest });
    await expect(page.locator('.application')).toBeVisible();
    await expect(syncComplete(page)).toBeVisible();
    await navigateToProjectSection(page, '概要');
    const projectName = page.getByRole('textbox', { name: '企画名' });
    const updatedSmokeMarker = `${smokeMarker}-updated`;
    await projectName.fill(updatedSmokeMarker);
    await projectName.press('Tab');
    await expect(syncComplete(page)).toBeVisible();

    await navigateToProjectSection(page, '車割');
    await expect(page.getByRole('heading', { level: 1, name: '車割', exact: true })).toBeVisible();
    await navigateToProjectSection(page, '班割');
    await expect(page.getByRole('heading', { level: 1, name: '班割', exact: true })).toBeVisible();
    await navigateToProjectSection(page, '精算');
    await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();

    const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A/ }) }).first();
    await car.getByRole('button', { name: '費用を入力' }).click();
    const editor = page.getByRole('dialog', { name: /仮参加者A/ });
    await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
    await editor.getByRole('button', { name: 'ガソリン代の操作' }).click();
    await page.getByRole('menuitem', { name: '計算条件を編集' }).click();
    await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
    await editor.getByRole('button', { name: 'ルートから距離を計算' }).click();
    const routeModal = page.getByRole('dialog', { name: /仮参加者A/ });
    await routeModal.getByRole('button', { name: /出発地を追加/ }).click();
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
    await expect(syncComplete(page)).toBeVisible();

    await page.reload();
    await navigateToProjectSection(page, '概要');
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue(updatedSmokeMarker);
    await expect(syncComplete(page)).toBeVisible();

    if (mode === 'compatibility') {
      const legacyUrl = new URL('/circle-kikaku-tools/', 'https://mutoshiki.github.io');
      legacyUrl.searchParams.set('room', roomId);
      await page.goto(legacyUrl.toString());
      await expect(page.locator('#roomNameInput')).toHaveJSProperty('value', updatedSmokeMarker);
      await page.goto(`${productionPath}?room=${roomId}&view=seisan`);
      await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
    }
    expect(consoleErrorCount).toBe(0);
    expect(forbiddenResponses).toEqual([]);
  } finally {
    if (roomSeeded) {
      const context = page.context();
      if (!page.isClosed()) await page.close();
      const cleanupPage = await context.newPage();
      try {
        await cleanupPage.goto('https://mutoshiki.github.io/circle-kikaku-tools/', { waitUntil: 'domcontentloaded' });
        await cleanupProductionSmokeRoom(cleanupPage, { config, roomId, marker: smokeMarker });
      } finally {
        await cleanupPage.close();
      }
    }
  }
});
