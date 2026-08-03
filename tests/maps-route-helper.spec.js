import { test, expect } from '@playwright/test';
import { installGoogleMapsMock, selectMockPlace, MOCK_PLACES } from './maps-test-utils.js';

async function seed(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal'));
  await installGoogleMapsMock(page);
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.switchView('seisan'));
}

async function clickHost(page, selector, index = 0) {
  const node = page.locator(selector).nth(index);
  await expect(node).toBeAttached();
  await node.evaluate(element => element.click());
  await page.waitForTimeout(70);
}

async function openFromFirstCar(page) {
  await clickHost(page, '[data-action="open-settlement-car-edit"]');
  const targetCar = await page.evaluate(() => window.getActiveSettlementCarEditName?.());
  await clickHost(page, '#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
  await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
  await page.waitForFunction(() => document.querySelector('#routeOriginAutocompleteHost gmp-place-autocomplete'));
  return targetCar;
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`${viewport.width}px Google Maps route helper`, () => {
    test.use({ viewport });

    test('selects places, fetches alternatives and keeps list/map synchronized', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await seed(page);
      await openFromFirstCar(page);

      await selectMockPlace(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.origin);
      expect(await page.evaluate(() => window.__mapsRequests.length)).toBe(0);
      await selectMockPlace(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.destination);
      await expect(page.locator('#routeResultList cds-selectable-tile.route-result-tile')).toHaveCount(4);
      await expect(page.locator('#routeSummary')).toBeVisible();
      expect(await page.evaluate(() => window.__mapsRequests[0].computeAlternativeRoutes)).toBe(true);
      expect(await page.evaluate(() => window.__mapsRequests[0].origin.location)).toBe(`places/${MOCK_PLACES.origin.placeId}`);
      expect(await page.evaluate(() => window.__mapsRequests[0].destination.location)).toBe(`places/${MOCK_PLACES.destination.placeId}`);
      expect(await page.evaluate(() => window.getRouteMapRuntimeForTests().polylines.length)).toBe(4);
      expect(await page.evaluate(() => window.__mapsRequests[0].routeModifiers.tollPasses)).toBeUndefined();
      expect(await page.evaluate(() => window.__mapsRequests[0].fields)).toEqual(expect.arrayContaining(['legs.steps.instructions', 'legs.travelAdvisory']));
      const autocompleteOptions = await page.evaluate(() => {
        const widget = document.querySelector('#routeOriginAutocompleteHost gmp-place-autocomplete');
        return { lang: widget.lang, bias: widget.locationBias };
      });
      expect(autocompleteOptions.lang).toBe('ja');
      expect(autocompleteOptions.bias).toBeTruthy();
      await expect(page.locator('#routeResultList cds-selectable-tile.route-result-tile').first()).toHaveAttribute('selected', '');

      await clickHost(page, '#routeResultList cds-selectable-tile.route-result-tile', 1);
      expect(await page.evaluate(() => window.getRoutePlannerState().selectedRouteIndex)).toBe(1);
      expect(await page.locator('#routeResultList cds-selectable-tile.route-result-tile').nth(1).getAttribute('data-selected')).toBe('true');
      await page.evaluate(() => window.getRouteMapRuntimeForTests().polylines[2].trigger('click'));
      expect(await page.evaluate(() => window.getRoutePlannerState().selectedRouteIndex)).toBe(2);
      const selectedId = await page.evaluate(() => window.getRoutePlannerState().routes[2].id);
      await page.evaluate(() => window.refreshRoutes('manual'));
      await expect.poll(() => page.evaluate(() => window.getRoutePlannerState().routes.length)).toBe(4);
      expect(await page.evaluate(() => window.getRoutePlannerState().routes[window.getRoutePlannerState().selectedRouteIndex].id)).toBe(selectedId);
      expect(await page.evaluate(() => window.getRoutePlannerState().routes.some(route => route.isRecommended && route.routeLabels.includes('DEFAULT_ROUTE')))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });

    test('waypoints and route modifiers re-request only after selected places change', async ({ page }) => {
      await seed(page);
      await openFromFirstCar(page);
      await selectMockPlace(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.origin);
      await selectMockPlace(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.destination);
      const initial = await page.evaluate(() => window.__mapsRequests.length);

      await clickHost(page, '#routeAddWaypointBtn');
      await page.waitForFunction(() => document.querySelector('#routeWaypointAutocompleteHost0 gmp-place-autocomplete'));
      expect(await page.evaluate(() => window.__mapsRequests.length)).toBe(initial);
      await selectMockPlace(page, '#routeWaypointAutocompleteHost0 gmp-place-autocomplete', MOCK_PLACES.waypoint);
      await expect.poll(() => page.evaluate(() => window.__mapsRequests.length)).toBeGreaterThan(initial);
      expect(await page.evaluate(() => window.__mapsRequests.at(-1).computeAlternativeRoutes)).toBe(false);
      expect(await page.evaluate(() => window.__mapsRequests.at(-1).intermediates.length)).toBe(1);
      expect(await page.evaluate(() => window.__mapsRequests.at(-1).intermediates[0].location)).toBe(`places/${MOCK_PLACES.waypoint.placeId}`);

      await page.locator('cds-checkbox#routeAvoidTolls').evaluate(node => {
        node.checked = true;
        node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      });
      await expect.poll(() => page.evaluate(() => window.__mapsRequests.at(-1).routeModifiers.avoidTolls)).toBe(true);
      await page.locator('cds-checkbox#routeAvoidHighways').evaluate(node => {
        node.checked = true;
        node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      });
      await expect.poll(() => page.evaluate(() => window.__mapsRequests.at(-1).routeModifiers.avoidHighways)).toBe(true);
      await page.locator('cds-checkbox#routeAvoidFerries').evaluate(node => {
        node.checked = true;
        node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      });
      await expect.poll(() => page.evaluate(() => window.__mapsRequests.at(-1).routeModifiers.avoidFerries)).toBe(true);

      await clickHost(page, '[data-route-waypoint-delete="0"]');
      await expect(page.locator('#routeWaypointList .route-waypoint-row')).toHaveCount(0);
    });
  });
}

test.describe('Per-car application, return and resilient states', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('applies selected route only to the source car and returns to it', async ({ page }) => {
    await seed(page);
    const targetCar = await openFromFirstCar(page);
    const before = await page.evaluate(target => {
      const state = window.ensureSettlementState();
      return Object.fromEntries(Object.entries(state.cars).map(([name, car]) => [name, car.dist]));
    }, targetCar);
    await selectMockPlace(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.origin);
    await selectMockPlace(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.destination);
    await expect(page.locator('#routeResultList cds-selectable-tile.route-result-tile')).toHaveCount(4);
    await clickHost(page, '#routeResultList cds-selectable-tile.route-result-tile', 1);
    await page.locator('cds-checkbox#routeRoundTrip').evaluate(node => {
      node.checked = true;
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await clickHost(page, '#routeApplyBtn');
    await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.getActiveSettlementCarEditName?.())).toBe(targetCar);
    const after = await page.evaluate(() => Object.fromEntries(Object.entries(window.ensureSettlementState().cars).map(([name, car]) => [name, car.dist])));
    expect(Number(after[targetCar])).toBeCloseTo((84300 + 6900) * 2 / 1000, 1);
    for (const [name, distance] of Object.entries(after)) {
      if (name !== targetCar) expect(distance).toBe(before[name]);
    }
  });

  test('cancel and browser back return to the exact source car', async ({ page }) => {
    await seed(page);
    const targetCar = await openFromFirstCar(page);
    await clickHost(page, '#routeCancelBtn');
    await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.getActiveSettlementCarEditName?.())).toBe(targetCar);
    await clickHost(page, '#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
    await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
    await page.goBack();
    await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.getActiveSettlementCarEditName?.())).toBe(targetCar);
  });

  test('maps errors use Carbon notification and stale requests cannot overwrite current state', async ({ page }) => {
    await seed(page);
    await openFromFirstCar(page);
    await page.evaluate(() => { window.__mockRouteMode = 'error'; });
    await selectMockPlace(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.origin);
    await selectMockPlace(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', MOCK_PLACES.destination);
    await expect(page.locator('#routeHelperStatus')).toBeVisible();
    await expect(page.locator('#routeHelperStatusMessage')).toContainText('API利用上限');

    await page.evaluate(() => { window.__mockRouteMode = 'success'; window.__mockRouteDelay = 120; });
    const first = page.evaluate(() => window.refreshRoutes('race-old'));
    await page.waitForTimeout(10);
    await page.evaluate(() => { window.__mockRouteDelay = 0; });
    const second = page.evaluate(() => window.refreshRoutes('race-new'));
    await Promise.all([first, second]);
    expect(await page.evaluate(() => window.getRoutePlannerState().routes.length)).toBeGreaterThan(0);
  });
});
