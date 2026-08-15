import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });

const stagingConfigText = process.env.SANPO_STAGING_FIREBASE_CONFIG || '';
const stagingConfig = stagingConfigText ? JSON.parse(stagingConfigText) : null;

test.describe('v68 staging Firebase collaboration', () => {
  test.skip(process.env.SANPO_LIVE_FIREBASE !== '1', 'Set SANPO_LIVE_FIREBASE=1 for the authorized staging suite.');
  test.skip(!stagingConfig, 'Set SANPO_STAGING_FIREBASE_CONFIG. Production firebase-config.js is never used by this test.');
  test.skip(stagingConfig?.projectId === 'sanpokai-tool', 'Refusing production Firebase project in staging test.');
  test.setTimeout(120_000);

  test('five independent browsers preserve drafts, merge intent and converge exactly', async ({ browser }) => {
    const contexts = await Promise.all([0, 1, 2, 3, 4].map(() => browser.newContext()));
    let pages = await Promise.all(contexts.map(context => context.newPage()));
    const port = process.env.PLAYWRIGHT_TEST_PORT || '4173';
    const room = `V50LIVE${Date.now().toString(36).toUpperCase()}`;
    const url = `http://127.0.0.1:${port}/?room=${room}`;

    const ready = async page => {
      await page.route('**/firebase-config.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: `window.SANPO_FIREBASE_CONFIG = ${JSON.stringify(stagingConfig)};`
      }));
      await page.goto(url);
      await page.waitForFunction(() => typeof window.executeDebugMode === 'function');
      // Do not seed or edit while Firebase Auth is still negotiating. A real browser may
      // render the local shell first; edits before the authenticated room listener exists
      // would only exercise local storage, not the collaboration protocol under test.
      await page.waitForFunction(() => {
        const badge = document.querySelector('#syncStatusBadge');
        return badge?.dataset.status === 'connected';
      }, null, { timeout: 30_000 });
    };
    const openCar = async (page, index) => {
      await page.locator('#tab-seisan').click();
      await page.locator('[data-action="open-settlement-car-edit"]').nth(index).click();
      await page.locator('#settlementCarEditModal[open]').waitFor();
    };
    const fill = (page, field, value) => page.locator(`[data-field="${field}"] input`).fill(String(value));
    const saveCar = async page => {
      await page.locator('#saveSettlementCarEditBtn').click();
      await page.waitForFunction(() => !document.querySelector('#settlementCarEditModal')?.open);
    };
    const snapshot = page => page.evaluate(() => window.SanpoCanonicalState.get());

    await ready(pages[0]);
    await pages[0].evaluate(() => window.executeDebugMode());
    await pageWaitForParticipants(pages[0], 13);
    await Promise.all(pages.slice(1).map(ready));
    await Promise.all(pages.map(page => pageWaitForParticipants(page, 13)));

    // Same car, different fields: the remote save must not rebuild the other open editor.
    await Promise.all([openCar(pages[0], 0), openCar(pages[1], 0)]);
    await fill(pages[0], 'dist', 711);
    await fill(pages[1], 'price', 772);
    await saveCar(pages[1]);
    await expect(pages[0].locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
    await expect(pages[0].locator('[data-field="dist"] input')).toHaveValue('711');
    await expect(pages[0].locator('#saveSettlementCarEditBtn')).toBeEnabled();
    await saveCar(pages[0]);

    // Carbon's shadow-native select can update ahead of its host on touch devices. Both
    // signed expense types must be finalized by Save and persisted to Firebase.
    await openCar(pages[0], 0);
    await pages[0].locator('[data-extra-field="type"] select').first().selectOption('split-minus');
    await saveCar(pages[0]);
    await openCar(pages[1], 0);
    await expect(pages[1].locator('[data-extra-field="type"] select').first()).toHaveValue('split-minus');
    await pages[1].locator('[data-extra-field="type"] select').first().selectOption('club-minus');
    await saveCar(pages[1]);
    await expect.poll(async () => {
      // The saving tab is the deterministic acknowledgement surface. Other listeners
      // are checked for full convergence below, after their remote event is delivered.
      const roomData = await snapshot(pages[1]);
      return Object.values(roomData.settlement?.carsByParticipantId || {})
        .some(car => car.extras?.some(extra => extra.type === 'club-minus'));
    }).toBe(true);

    // An explicit offline save survives page loss and replays its original narrow intent.
    await openCar(pages[2], 2);
    await fill(pages[2], 'eco', 23);
    await contexts[2].setOffline(true);
    await pages[2].locator('#saveSettlementCarEditBtn').click();
    await expect.poll(() => pages[2].evaluate(() => Object.keys(localStorage).filter(key => key.includes('_sync_outbox_')).length)).toBe(1);
    await pages[2].close();
    await contexts[2].setOffline(false);
    pages[2] = await contexts[2].newPage();
    await ready(pages[2]);
    await expect.poll(() => pages[2].evaluate(() => Object.keys(localStorage).filter(key => key.includes('_sync_outbox_')).length)).toBe(0);

    // Three clients save distinct entities in reverse order.
    await Promise.all([openCar(pages[0], 0), openCar(pages[1], 1), openCar(pages[2], 2)]);
    await Promise.all([fill(pages[0], 'dist', 1001), fill(pages[1], 'dist', 1002), fill(pages[2], 'dist', 1003)]);
    await saveCar(pages[2]);
    await saveCar(pages[1]);
    await saveCar(pages[0]);

    await Promise.all(pages.map(page => page.waitForFunction(() => {
      const cars = Object.values(window.SanpoCanonicalState.get().settlement?.carsByParticipantId || {});
      return ['1001', '1002', '1003'].every(value => cars.some(car => car.dist === value));
    })));
    const sharedDomain = roomData => JSON.stringify({
      participants: roomData.participants,
      allocations: roomData.allocations,
      settlement: roomData.settlement
    });
    await expect.poll(async () => {
      const finalRooms = await Promise.all(pages.map(snapshot));
      return new Set(finalRooms.map(sharedDomain)).size;
    }, { timeout: 15_000 }).toBe(1);

    // A repeated transport request must carry the same operation ID and be a no-op.
    // The revision proves it was journalled once, rather than applying twice.
    const duplicateResult = await pages[3].evaluate(async () => {
      const base = window.SanpoCanonicalState.get();
      const next = structuredClone(base);
      const marker = `duplicate-${Date.now()}`;
      next.overview = { ...(next.overview || {}), memo: marker };
      const patch = { 'overview/memo': marker };
      const operationId = `staging-duplicate-${Date.now()}`;
      const first = await window.SanpoSync.saveImmediate({ snapshot: next, baseSnapshot: base, patchOverride: patch, operationId });
      const second = await window.SanpoSync.saveImmediate({ snapshot: next, baseSnapshot: base, patchOverride: patch, operationId });
      return { before: Number(base.revision || 0), first: Number(first?.revision || 0), second: Number(second?.revision || 0), marker };
    });
    expect(duplicateResult.first).toBe(duplicateResult.before + 1);
    expect(duplicateResult.second).toBe(duplicateResult.first);

    // A tab that saved while offline must not resurrect the pre-reset room when it
    // reconnects. The durable outbox is discarded when its reset generation is stale.
    await openCar(pages[4], 0);
    await fill(pages[4], 'dist', 9191);
    await contexts[4].setOffline(true);
    await pages[4].locator('#saveSettlementCarEditBtn').click();
    await expect.poll(() => pages[4].evaluate(() => Object.keys(localStorage).filter(key => key.includes('_sync_outbox_')).length)).toBe(1);
    await pages[4].close();

    const reloaded = pages[0].waitForEvent('framenavigated');
    // resetData waits for its confirmation modal. Start it without returning that
    // promise to Playwright, then complete the real modal interaction below.
    await pages[0].evaluate(() => { void window.resetData(); });
    await pages[0].locator('#passphrase-panel .passphrase-input input').fill('リセット');
    await pages[0].locator('#passphrase-panel cds-modal-footer-button[kind="primary"]').click();
    await reloaded;
    await pages[0].waitForFunction(() => document.querySelector('#syncStatusBadge')?.dataset.status === 'connected');
    await Promise.all(pages.slice(0, 4).map(page => page.waitForFunction(() => {
      const room = window.SanpoCanonicalState.get();
      return Number(room.resetGeneration || 0) >= 1 && Object.keys(room.participants || {}).length === 0;
    })));

    await contexts[4].setOffline(false);
    pages[4] = await contexts[4].newPage();
    await ready(pages[4]);
    await expect.poll(() => pages[4].evaluate(() => Object.keys(localStorage).filter(key => key.includes('_sync_outbox_')).length)).toBe(0);
    await expect.poll(() => pages[4].evaluate(() => {
      const room = window.SanpoCanonicalState.get();
      return Number(room.resetGeneration || 0) >= 1 && Object.keys(room.participants || {}).length === 0;
    }), { timeout: 15_000 }).toBe(true);

    await Promise.all(contexts.map(context => context.close()));
  });
});

async function pageWaitForParticipants(page, count) {
  await page.waitForFunction(expected => Object.keys(window.SanpoCanonicalState?.get?.().participants || {}).length === expected, count);
}
