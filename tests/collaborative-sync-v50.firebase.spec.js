import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });

test.describe('v50 live Firebase collaboration', () => {
  test.skip(process.env.SANPO_LIVE_FIREBASE !== '1', 'Set SANPO_LIVE_FIREBASE=1 for the authorized localhost/Firebase suite.');
  test.setTimeout(90_000);

  test('three independent browsers preserve drafts, merge intent and converge exactly', async ({ browser }) => {
    const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
    let pages = await Promise.all(contexts.map(context => context.newPage()));
    const port = process.env.PLAYWRIGHT_TEST_PORT || '4173';
    const room = `V50LIVE${Date.now().toString(36).toUpperCase()}`;
    const url = `http://127.0.0.1:${port}/?room=${room}`;

    const ready = async page => {
      await page.goto(url);
      await page.waitForFunction(() => typeof window.executeDebugMode === 'function');
      await page.waitForTimeout(1_000);
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
    await Promise.all([ready(pages[1]), ready(pages[2])]);
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

    await Promise.all(contexts.map(context => context.close()));
  });
});

async function pageWaitForParticipants(page, count) {
  await page.waitForFunction(expected => Object.keys(window.SanpoCanonicalState?.get?.().participants || {}).length === expected, count);
}
