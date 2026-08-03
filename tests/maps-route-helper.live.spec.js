import { test, expect } from '@playwright/test';

const liveEnabled = process.env.MAPS_LIVE_TEST === '1' && Boolean(process.env.MAPS_LIVE_BASE_URL);

test('live Places (New), Maps JavaScript API and Routes API smoke', async ({ page }) => {
  test.skip(!liveEnabled, 'Set MAPS_LIVE_TEST=1 and MAPS_LIVE_BASE_URL to an allowed HTTPS referrer.');
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const librariesReady = await page.evaluate(async () => {
    const libraries = await window.loadSanpoGoogleMapsLibraries();
    return {
      placeWidget: Boolean(libraries.places.PlaceAutocompleteElement),
      routeClass: Boolean(libraries.routes.Route),
      mapClass: Boolean(libraries.maps.Map)
    };
  });
  expect(librariesReady).toEqual({ placeWidget: true, routeClass: true, mapClass: true });

  const result = await page.evaluate(async () => {
    const libraries = await window.loadSanpoGoogleMapsLibraries();
    const response = await libraries.routes.Route.computeRoutes({
      origin: { lat: 36.6392, lng: 138.1919 },
      destination: { lat: 36.2306, lng: 137.9646 },
      travelMode: libraries.routes.TravelMode.DRIVING,
      routingPreference: libraries.routes.RoutingPreference.TRAFFIC_AWARE_OPTIMAL,
      computeAlternativeRoutes: true,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
        vehicleInfo: { emissionType: libraries.routes.VehicleEmissionType.GASOLINE }
      },
      extraComputations: [libraries.routes.ComputeRoutesExtraComputation.TOLLS],
      fields: ['distanceMeters', 'durationMillis', 'path', 'routeLabels', 'viewport', 'travelAdvisory']
    });
    return {
      routeCount: response.routes?.length || 0,
      distanceMeters: response.routes?.[0]?.distanceMeters || 0,
      durationMillis: response.routes?.[0]?.durationMillis || 0,
      pathPoints: response.routes?.[0]?.path?.length || 0
    };
  });
  expect(result.routeCount).toBeGreaterThan(0);
  expect(result.distanceMeters).toBeGreaterThan(0);
  expect(result.durationMillis).toBeGreaterThan(0);
  expect(result.pathPoints).toBeGreaterThan(1);

  await page.evaluate(() => window.switchView?.('seisan'));
  const firstEditor = page.locator('[data-action="open-settlement-car-edit"]').first();
  if (await firstEditor.count()) {
    await firstEditor.evaluate(element => element.click());
    await page.locator('#settlementCarEditModal [data-action="open-route-helper-shortcut"]').evaluate(element => element.click());
    await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
    const autocomplete = page.locator('#routeOriginAutocompleteHost gmp-place-autocomplete');
    await expect(autocomplete).toBeAttached();
    const input = autocomplete.locator('input');
    if (await input.count()) {
      await input.fill('長野駅');
      const predictions = autocomplete.locator('[part~="prediction-item"]');
      await expect(predictions.first()).toBeVisible({ timeout: 12_000 });
    }
  }
  expect(errors).toEqual([]);
});
