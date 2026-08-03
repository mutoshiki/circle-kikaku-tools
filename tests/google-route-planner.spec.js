import { test, expect } from '@playwright/test';

async function installGoogleMock(page) {
  await page.evaluate(() => {
    class FakeAutocomplete extends HTMLElement {
      constructor() { super(); this.value = ''; this.includedRegionCodes = []; this.placeholder = ''; }
      focus() {}
    }
    if (!customElements.get('gmp-place-autocomplete')) customElements.define('gmp-place-autocomplete', FakeAutocomplete);
    class FakePlace { constructor(options = {}) { this.id = options.id || ''; } }
    class Bounds {
      constructor() { this.points = []; }
      extend(point) { this.points.push(point); return this; }
      isEmpty() { return this.points.length === 0; }
      getNorthEast() { return { lat: () => 36.9, lng: () => 138.5 }; }
      getSouthWest() { return { lat: () => 35.9, lng: () => 137.5 }; }
    }
    class Map { constructor(node, options) { this.node = node; this.options = options; } setOptions(options) { Object.assign(this.options, options); } fitBounds(bounds) { this.bounds = bounds; } }
    window.__fakePolylines = [];
    class Polyline { constructor(options) { this.options = options; this.map = options.map; this.listeners = {}; window.__fakePolylines.push(this); } addListener(name, handler) { this.listeners[name] = handler; } setMap(map) { this.map = map; } }
    class Marker { constructor(options) { Object.assign(this, options); } setMap(map) { this.map = map; } }
    class AdvancedMarkerElement { constructor(options) { Object.assign(this, options); } }
    const makeRoute = (index, withToll, highway) => ({
      routeToken: `route-${index}`,
      description: highway ? '長野自動車道' : '国道19号',
      distanceMeters: index ? 76800 : 84300,
      durationMillis: index ? 9060000 : 6120000,
      routeLabels: index ? [] : ['DEFAULT_ROUTE'],
      path: [{ lat: 36.64, lng: 138.18 }, { lat: 36.2, lng: 138 }, { lat: 35.9, lng: 137.96 }],
      viewport: new Bounds(),
      travelAdvisory: withToll ? { tollInfo: { estimatedPrices: [{ currencyCode: 'JPY', units: 2350, nanos: 0 }] } } : undefined,
      legs: [{
        distanceMeters: index ? 76800 : 84300,
        durationMillis: index ? 9060000 : 6120000,
        startLocation: { lat: 36.64, lng: 138.18 },
        endLocation: { lat: 35.9, lng: 137.96 },
        steps: [{ navigationInstruction: { instructions: highway ? '長野自動車道を進む' : '国道19号を進む' } }]
      }]
    });
    const maps = { Map, Polyline, LatLngBounds: Bounds, Marker, event: { addListenerOnce: (_target, _name, handler) => setTimeout(handler, 0) } };
    window.google = { maps };
    window.SanpoGoogleMaps = {
      isConfigured: () => true,
      getConfig: () => ({ mapId: '' }),
      importLibraries: async names => Object.fromEntries(names.map(name => [name,
        name === 'maps' ? maps :
        name === 'places' ? { PlaceAutocompleteElement: FakeAutocomplete, Place: FakePlace } :
        name === 'routes' ? { Route: { computeRoutes: async request => ({ routes: request.intermediates ? [makeRoute(0, true, true)] : [makeRoute(0, true, true), makeRoute(1, false, false)] }) } } :
        name === 'geometry' ? { encoding: { encodePath: path => JSON.stringify(path), decodePath: value => JSON.parse(value) } } :
        name === 'marker' ? { AdvancedMarkerElement } : {}
      ]))
    };
    window.selectFakePlace = (selector, value) => {
      const widget = document.querySelector(selector);
      const event = new Event('gmp-select', { bubbles: true });
      event.placePrediction = { toPlace: () => ({
        id: value.placeId,
        displayName: value.name,
        formattedAddress: value.address,
        location: { lat: () => value.latitude, lng: () => value.longitude },
        fetchFields: async () => {}
      }) };
      widget.dispatchEvent(event);
    };
  });
}

async function openPlanner(page) {
  await page.evaluate(() => { executeDebugMode(); switchView('seisan'); });
  await page.locator('[data-action="open-settlement-car-edit"]').first().evaluate(node => node.click());
  await page.locator('#settlementCarEditModal [data-action="open-route-helper-shortcut"]').evaluate(node => node.click());
  await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button'));
  await installGoogleMock(page);
});

test('selected Places produce alternative routes and map/list synchronization', async ({ page }) => {
  await openPlanner(page);
  await page.evaluate(() => selectFakePlace('#routeOriginAutocomplete gmp-place-autocomplete', { placeId: 'origin', name: '信州大学', address: '長野市', latitude: 36.64, longitude: 138.18 }));
  await page.evaluate(() => selectFakePlace('#routeDestinationAutocomplete gmp-place-autocomplete', { placeId: 'destination', name: '松本駅', address: '松本市', latitude: 35.9, longitude: 137.96 }));
  await expect(page.locator('.route-candidate-card')).toHaveCount(2);
  await expect(page.locator('#routeMap')).toBeVisible();
  await page.evaluate(() => window.__fakePolylines.filter(line => line.map)[1].listeners.click());
  expect(await page.evaluate(() => ensureSettlementState().routePlanner.selectedRouteIndex)).toBe(1);
  await page.locator('.route-candidate-card').first().evaluate(node => node.click());
  expect(await page.evaluate(() => ensureSettlementState().routePlanner.selectedRouteIndex)).toBe(0);
  await expect(page.locator('.route-candidate-card').nth(1)).toHaveAttribute('aria-checked', 'true');
});

test('waypoints, modifiers, persistence, exact-car application, and return flow work', async ({ page }) => {
  await openPlanner(page);
  const targetName = await page.evaluate(() => ensureSettlementState().routePlanner.targetCarName);
  await page.evaluate(() => selectFakePlace('#routeOriginAutocomplete gmp-place-autocomplete', { placeId: 'origin', name: '信州大学', address: '長野市', latitude: 36.64, longitude: 138.18 }));
  await page.evaluate(() => selectFakePlace('#routeDestinationAutocomplete gmp-place-autocomplete', { placeId: 'destination', name: '松本駅', address: '松本市', latitude: 35.9, longitude: 137.96 }));
  await page.locator('#addRouteWaypointBtn').evaluate(node => node.click());
  await page.evaluate(() => selectFakePlace('#routeWaypointList gmp-place-autocomplete', { placeId: 'waypoint', name: '姨捨SA', address: '千曲市', latitude: 36.5, longitude: 138.1 }));
  await expect(page.locator('.route-candidate-card')).toHaveCount(1);
  await page.locator('cds-checkbox#routeAvoidTolls').evaluate(node => { node.checked = true; node.dispatchEvent(new Event('change', { bubbles: true, composed: true })); });
  await page.locator('cds-checkbox#routeRoundTrip').evaluate(node => { node.checked = true; node.dispatchEvent(new Event('change', { bubbles: true, composed: true })); });
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(ensureSettlementState().cars).map(([name, car]) => [name, car.dist])));
  await page.locator('#applyRouteDistanceBtn').evaluate(node => node.click());
  await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
  const after = await page.evaluate(() => Object.fromEntries(Object.entries(ensureSettlementState().cars).map(([name, car]) => [name, car.dist])));
  expect(after[targetName]).not.toBe(before[targetName]);
  for (const [name, distance] of Object.entries(before)) if (name !== targetName) expect(after[name]).toBe(distance);
  expect(await page.evaluate(() => ensureSettlementState().routePlanner.waypoints.length)).toBe(1);
  expect(await page.evaluate(() => ensureSettlementState().routePlanner.avoidTolls)).toBe(true);
});

test('waypoints support keyboard reordering and 48px drag controls', async ({ page }) => {
  await openPlanner(page);
  await page.locator('#addRouteWaypointBtn').evaluate(node => node.click());
  await page.locator('#addRouteWaypointBtn').evaluate(node => node.click());
  const before = await page.locator('#routeWaypointList .route-waypoint-row').evaluateAll(rows => rows.map(row => row.dataset.routeWaypointId));
  const firstHandle = page.locator('#routeWaypointList .route-waypoint-handle').first();
  await firstHandle.focus();
  await firstHandle.press('ArrowDown');
  const after = await page.locator('#routeWaypointList .route-waypoint-row').evaluateAll(rows => rows.map(row => row.dataset.routeWaypointId));
  expect(after[1]).toBe(before[0]);
  const boxes = await page.locator('#routeWaypointList .route-waypoint-handle').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  expect(boxes.every(box => box.width >= 44 && box.height >= 44)).toBeTruthy();
});

test('browser back closes the planner and restores the originating car editor', async ({ page }) => {
  await openPlanner(page);
  const targetName = await page.evaluate(() => ensureSettlementState().routePlanner.targetCarName);
  await page.goBack();
  await expect(page.locator('#routeDistanceModal')).not.toHaveAttribute('open', '');
  await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
  await expect(page.locator('#settlementCarEditBody .seisan-car-row')).toHaveAttribute('data-driver-name', targetName);
});

test('stale requests cannot overwrite the latest route result', async ({ page }) => {
  await page.evaluate(() => {
    let call = 0;
    const Route = window.SanpoGoogleMaps.importLibraries;
    window.__originalImportLibraries = Route;
    window.SanpoGoogleMaps.importLibraries = async names => {
      const libraries = await Route(names);
      if (libraries.routes) {
        libraries.routes.Route.computeRoutes = async () => {
          call += 1;
          const current = call;
          await new Promise(resolve => setTimeout(resolve, current === 1 ? 250 : 10));
          return { routes: [{ routeToken: `result-${current}`, distanceMeters: current * 1000, durationMillis: 60000, path: [{ lat: 36, lng: 138 }, { lat: 35, lng: 137 }], legs: [{ distanceMeters: current * 1000, durationMillis: 60000 }] }] };
        };
      }
      return libraries;
    };
  });
  await openPlanner(page);
  await page.evaluate(() => selectFakePlace('#routeOriginAutocomplete gmp-place-autocomplete', { placeId: 'origin', name: 'A', address: 'A', latitude: 36, longitude: 138 }));
  await page.evaluate(() => selectFakePlace('#routeDestinationAutocomplete gmp-place-autocomplete', { placeId: 'destination', name: 'B', address: 'B', latitude: 35, longitude: 137 }));
  await page.locator('cds-checkbox#routeAvoidHighways').evaluate(node => { node.checked = true; node.dispatchEvent(new Event('change', { bubbles: true, composed: true })); });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => ensureSettlementState().routePlanner.routes[0]?.id)).toBe('result-2');
});

test('API failure exposes Carbon retry and the retry refreshes routes', async ({ page }) => {
  await page.evaluate(() => { window.__routeMode = 'permission'; });
  await openPlanner(page);
  await page.evaluate(() => selectFakePlace('#routeOriginAutocomplete gmp-place-autocomplete', { placeId: 'origin', name: 'A', address: 'A', latitude: 36, longitude: 138 }));
  await page.evaluate(() => selectFakePlace('#routeDestinationAutocomplete gmp-place-autocomplete', { placeId: 'destination', name: 'B', address: 'B', latitude: 35, longitude: 137 }));
  await expect(page.locator('#routePlannerRetryBtn')).toBeVisible();
  const before = await page.evaluate(() => window.__routeCall);
  await page.evaluate(() => { window.__routeMode = 'normal'; });
  await page.locator('#routePlannerRetryBtn').evaluate(node => node.click());
  await expect(page.locator('.route-candidate-card')).toHaveCount(2);
  expect(await page.evaluate(() => window.__routeCall)).toBe(before + 1);
  await expect(page.locator('#routePlannerRetry')).toHaveAttribute('hidden', '');
});
