import { test, expect } from '@playwright/test';

const live = process.env.GOOGLE_MAPS_LIVE === '1';

test('live Google Maps JavaScript, Places (New), and Routes APIs respond', async ({ page }) => {
  test.skip(!live, 'Set GOOGLE_MAPS_LIVE=1 and GOOGLE_MAPS_LIVE_BASE_URL to an allowed HTTPS referrer.');
  await page.goto('/');
  const result = await page.evaluate(async () => {
    await SanpoGoogleMaps.load();
    const [{ AutocompleteSuggestion, AutocompleteSessionToken }, { Route }] = await Promise.all([
      SanpoGoogleMaps.importLibrary('places'),
      SanpoGoogleMaps.importLibrary('routes')
    ]);
    const response = await Route.computeRoutes({
      origin: { lat: 36.643, lng: 138.188 },
      destination: { lat: 35.681, lng: 139.767 },
      travelMode: 'DRIVING',
      computeAlternativeRoutes: true,
      routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
      language: 'ja-JP',
      region: 'JP',
      fields: ['distanceMeters', 'durationMillis', 'path']
    });
    return {
      placesNew: typeof AutocompleteSuggestion?.fetchAutocompleteSuggestions === 'function' && typeof AutocompleteSessionToken === 'function',
      count: response.routes?.length || 0,
      distance: response.routes?.[0]?.distanceMeters || 0
    };
  });
  expect(result.placesNew).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.distance).toBeGreaterThan(0);
});

test('live Places Autocomplete Data selection triggers the integrated route workflow', async ({ page }) => {
  test.skip(!live, 'Set GOOGLE_MAPS_LIVE=1 and GOOGLE_MAPS_LIVE_BASE_URL to an allowed HTTPS referrer.');
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button'));
  await page.evaluate(() => { executeDebugMode(); switchView('seisan'); });
  await page.locator('[data-action="open-settlement-car-edit"]').first().evaluate(node => node.click());
  await page.locator('#settlementCarEditModal [data-action="open-route-helper-shortcut"]').evaluate(node => node.click());
  await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
  await page.waitForSelector('#routeStopList .route-stop-input');

  async function choose(query) {
    const host = page.locator('#routePlaceSearchInput');
    await host.evaluate((node, value) => {
      node.value = value;
      node.setAttribute('value', value);
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }, query);
    await expect(page.locator('#routePlaceHistoryList .route-place-history-item').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('#routePlaceHistoryList .route-place-history-item').first().evaluate(node => node.click());
  }

  await page.locator('#routeStopList .route-stop-input').first().evaluate(node => node.click());
  await choose('信州大学 長野');
  await expect.poll(() => page.evaluate(() => ensureSettlementState().routePlanner.origin?.placeId || '')).not.toBe('');
  await page.locator('#routeStopList .route-stop-input').last().evaluate(node => node.click());
  await choose('松本駅');
  await expect.poll(() => page.evaluate(() => ensureSettlementState().routePlanner.destination?.placeId || '')).not.toBe('');
  await expect.poll(() => page.locator('.route-candidate-card').count(), { timeout: 20000 }).toBeGreaterThan(0);
});
