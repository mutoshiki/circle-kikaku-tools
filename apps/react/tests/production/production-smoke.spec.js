import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';
import { openRoutePlannerFromMovementSettings, returnToMovementSettingsFromRoutePlanner } from '../browser/settlement-smoke-actions.mjs';
import { cleanupProductionSmokeRoom, seedProductionSmokeRoom } from './firebase-smoke-room.mjs';
import { createSmokeDiagnostics } from './production-smoke-diagnostics.mjs';

const roomId = process.env.REACT_PRODUCTION_SMOKE_ROOM;
const mode = process.env.REACT_PRODUCTION_SMOKE_MODE;
const baseURL = process.env.REACT_PRODUCTION_SMOKE_BASE_URL || '';
const smokeMarker = process.env.REACT_PRODUCTION_SMOKE_MARKER || '';
const expectedBuildSha = process.env.REACT_PRODUCTION_BUILD_SHA || '';
const expectedAssetDigest = process.env.REACT_PRODUCTION_ASSET_DIGEST || '';
const diagnosticPath = process.env.REACT_PRODUCTION_DIAGNOSTICS_PATH || '';
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

function assertProductionSmokeTarget() {
  if (process.env.REACT_PRODUCTION_RELEASE !== 'true'
    || roomId !== 'P9A93LMQ'
    || !/^react-(?:release|diagnostic)-\d+-\d+$/.test(smokeMarker)
    || !/^[a-f0-9]{40}$/.test(expectedBuildSha)
    || !/^[a-f0-9]{64}$/.test(expectedAssetDigest)
    || config.projectId !== 'sanpokai-tool'
    || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com') {
    throw new Error('Production smoke target guard rejected this run.');
  }
}

async function waitForProductionBuildManifest(page) {
  const expectedManifest = { sourceSha: expectedBuildSha, assetDigest: expectedAssetDigest };
  await expect.poll(async () => page.evaluate(async () => {
    const manifestUrl = new URL('release-build.json', window.location.href);
    manifestUrl.searchParams.set('releaseCheck', `${Date.now()}-${Math.random()}`);
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) return { error: `Build identity manifest request failed: ${response.status}` };
    return response.json();
  }), {
    message: 'Wait for GitHub Pages to serve the release that was just deployed.',
    timeout: 120_000,
    intervals: [1_000, 2_000, 5_000],
  }).toEqual(expectedManifest);
}

test('production app, Firebase compatibility, route APIs, and key tasks work without touching another room', async ({ page }) => {
  assertProductionSmokeTarget();
  let roomSeeded = false;
  const consoleErrors = [];
  const diagnostics = createSmokeDiagnostics(page.context(), { browserName: test.info().project.name });
  diagnostics.trackPage(page);
  const identityToolkitDiagnostics = [];
  const identityToolkitResponseTasks = [];
  const forbiddenResponses = [];
  let smokePhase = 'initial app load';
  const setSmokePhase = value => { smokePhase = value; diagnostics.setPhase(value); };
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location();
    let source = '';
    try {
      if (location.url) {
        const url = new URL(location.url);
        source = ` [${url.origin}${url.pathname}:${location.lineNumber}:${location.columnNumber}]`;
      }
    } catch {}
    const messageText = message.text().replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]');
    consoleErrors.push(`${messageText}${source}`);
  });
  page.on('pageerror', error => { consoleErrors.push(error.message); });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.hostname !== 'identitytoolkit.googleapis.com') return;
    identityToolkitDiagnostics.push(`${smokePhase}: ${request.method()} ${url.origin}${url.pathname} failed (${request.failure()?.errorText || 'unknown'})`);
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname !== 'identitytoolkit.googleapis.com' || response.status() < 400) return;
    const responsePhase = smokePhase;
    identityToolkitResponseTasks.push((async () => {
      let detail = '';
      try { detail = ((await response.json())?.error?.message || '').replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]'); } catch {}
      identityToolkitDiagnostics.push(`${responsePhase}: HTTP ${response.status()} ${url.origin}${url.pathname}${detail ? ` (${detail})` : ''}`);
    })());
  });
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
    setSmokePhase('initial app load');
    await page.goto(baseURL);
    await expect(page.locator('.application')).toBeVisible();
    await expect(page.locator('.sync-status')).toHaveText('同期完了');
    setSmokePhase('smoke room seed helper');
    await seedProductionSmokeRoom(page, { config, roomId, marker: smokeMarker, data: initial });
    roomSeeded = true;
    setSmokePhase('React room entry');
    await page.goto(`${baseURL}?room=${roomId}&view=participants`);
    await expect(page).toHaveTitle('サークル企画ツール');
    await waitForProductionBuildManifest(page);
    setSmokePhase('React room reload');
    await page.reload();
    await waitForProductionBuildManifest(page);
    await expect(page.locator('.application')).toBeVisible();
    await expect(page.locator('.sync-status')).toHaveText('同期完了');
    const projectName = page.getByRole('textbox', { name: '企画名' });
    const updatedSmokeMarker = `${smokeMarker}-updated`;
    await projectName.fill(updatedSmokeMarker);
    await projectName.press('Tab');
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    await page.getByRole('tab', { name: '車割', exact: true }).click();
    await expect(page.getByRole('region', { name: '車割', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '班割', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: '班割', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '精算', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();

    const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A/ }) }).first();
    await car.getByRole('button', { name: '費用を入力' }).click();
    const editor = page.getByRole('dialog', { name: /仮参加者A/ });
    await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
    await editor.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
    await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
    await openRoutePlannerFromMovementSettings(editor);
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
    await expect(routeModal.locator('.route-leg-summary')).toBeVisible({ timeout: 60000 });
    await expect(routeModal.getByRole('radio')).toHaveCount(0);
    await expect(routeModal.getByRole('button', { name: /地図/ })).toHaveCount(0);
    expect(forbiddenResponses).toEqual([]);
    await returnToMovementSettingsFromRoutePlanner(routeModal);
    await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
    await editor.getByRole('button', { name: 'ガソリン代を適用' }).click();
    await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
    await editor.getByRole('button', { name: '費用を保存' }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    setSmokePhase('React persistence reload');
    await page.reload();
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue(updatedSmokeMarker);
    await expect(page.locator('.sync-status')).toHaveText('同期完了');

    if (mode === 'root') {
      setSmokePhase('React alias validation');
      const routePage = await page.context().newPage();
      try {
        const reactAlias = new URL('/circle-kikaku-tools/react/', 'https://mutoshiki.github.io');
        reactAlias.searchParams.set('room', roomId);
        await routePage.goto(reactAlias.toString());
        await waitForProductionBuildManifest(routePage);
        await routePage.reload();
        await expect(routePage.locator('.application')).toBeVisible();
        await expect(routePage.locator('.sync-status')).toHaveText('同期完了');
        await waitForProductionBuildManifest(routePage);

        const legacyAlias = new URL('/circle-kikaku-tools/legacy/', 'https://mutoshiki.github.io');
        legacyAlias.searchParams.set('room', roomId);
        await routePage.goto(legacyAlias.toString());
        await expect(routePage.locator('#roomNameInput')).toHaveJSProperty('value', updatedSmokeMarker);
      } finally {
        await routePage.close();
      }
    }

    if (mode === 'compatibility') {
      setSmokePhase('legacy alias validation');
      const legacyUrl = new URL('/circle-kikaku-tools/legacy/', 'https://mutoshiki.github.io');
      legacyUrl.searchParams.set('room', roomId);
      await page.goto(legacyUrl.toString());
      await expect(page.locator('#roomNameInput')).toHaveJSProperty('value', updatedSmokeMarker);
      await page.goto(`${productionPath}?room=${roomId}&view=seisan`);
      await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();
    }
    await Promise.all(identityToolkitResponseTasks);
    expect(consoleErrors, [
      'Unexpected browser console/page errors:',
      consoleErrors.join('\n'),
      'Identity Toolkit request diagnostics (query strings omitted):',
      identityToolkitDiagnostics.join('\n') || '(none)',
    ].join('\n')).toEqual([]);
    expect(forbiddenResponses).toEqual([]);
  } finally {
    try {
      if (roomSeeded) {
        setSmokePhase('smoke room cleanup');
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
    } finally {
      diagnostics.dispose();
      await diagnostics.flush(diagnosticPath);
    }
  }
});
