import { test, expect } from '@playwright/test';

async function installGoogleMock(page) {
  await page.evaluate(() => {
    window.__polylines = [];
    window.__mapResize = 0;
    class Bounds { constructor() { this.points = []; } extend(point) { this.points.push(point); return this; } isEmpty() { return !this.points.length; } }
    class Map { constructor(node, options) { this.node = node; this.options = options; } setOptions(options) { Object.assign(this.options, options); } fitBounds() {} getDiv() { return this.node; } }
    class Polyline { constructor(options) { this.options = options; this.map = options.map; this.listeners = {}; window.__polylines.push(this); } addListener(name, handler) { this.listeners[name] = handler; } setMap(map) { this.map = map; } }
    class Marker { constructor(options) { Object.assign(this, options); } setMap(map) { this.map = map; } }
    class AdvancedMarkerElement { constructor(options) { Object.assign(this, options); } }
    class AutocompleteSessionToken {}
    class Place { constructor(options = {}) { this.id = options.id || ''; } }
    const prediction = value => ({
      placeId: value.placeId,
      mainText: { text: value.name }, secondaryText: { text: value.address }, text: { text: `${value.name} ${value.address}` },
      toPlace: () => ({ id: value.placeId, displayName: value.name, formattedAddress: value.address, location: { lat: () => value.latitude, lng: () => value.longitude }, fetchFields: async () => {} })
    });
    const catalog = [
      { placeId: 'origin', name: '信州大学工学部', address: '長野県長野市若里', latitude: 36.627, longitude: 138.191 },
      { placeId: 'destination', name: '松本駅', address: '長野県松本市', latitude: 36.23, longitude: 137.965 },
      { placeId: 'waypoint', name: '榛名山', address: '群馬県高崎市', latitude: 36.477, longitude: 138.878 }
    ];
    const AutocompleteSuggestion = { fetchAutocompleteSuggestions: async request => ({ suggestions: catalog.filter(item => `${item.name} ${item.address}`.includes(request.input || '')).map(item => ({ placePrediction: prediction(item) })) }) };
    const makeRoute = index => ({
      routeToken: `route-${index}`, description: index ? '国道19号' : '長野自動車道', distanceMeters: index ? 76000 : 84000, durationMillis: index ? 8800000 : 6100000,
      routeLabels: index ? [] : ['DEFAULT_ROUTE'], path: [{ lat: 36.627, lng: 138.191 }, { lat: 36.4, lng: 138.1 - index * 0.03 }, { lat: 36.23, lng: 137.965 }], viewport: new Bounds(),
      legs: [{ distanceMeters: index ? 76000 : 84000, durationMillis: index ? 8800000 : 6100000, startLocation: { lat: 36.627, lng: 138.191 }, endLocation: { lat: 36.23, lng: 137.965 }, steps: [{ navigationInstruction: { instructions: index ? '国道19号' : '長野自動車道' } }] }]
    });
    const maps = { Map, Polyline, Marker, LatLngBounds: Bounds, event: { addListenerOnce: (_target, _name, handler) => setTimeout(handler, 0), trigger: (_target, event) => { if (event === 'resize') window.__mapResize += 1; } } };
    window.google = { maps };
    window.SanpoGoogleMaps = {
      isConfigured: () => true, getConfig: () => ({ mapId: '' }),
      importLibraries: async names => Object.fromEntries(names.map(name => [name,
        name === 'maps' ? maps : name === 'places' ? { AutocompleteSuggestion, AutocompleteSessionToken, Place } :
        name === 'routes' ? { Route: { computeRoutes: async request => ({ routes: request.intermediates ? [makeRoute(0)] : [makeRoute(0), makeRoute(1)] }) } } :
        name === 'geometry' ? { encoding: { encodePath: path => JSON.stringify(path), decodePath: value => JSON.parse(value) } } :
        name === 'marker' ? { AdvancedMarkerElement } : {}
      ]))
    };
  });
}

async function clickHost(page, selector, index = 0) {
  await page.locator(selector).nth(index).evaluate(node => node.click());
}

async function setHostValue(page, selector, value) {
  await page.locator(selector).evaluate((node, next) => {
    node.value = next; node.setAttribute('value', next);
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }, value);
}

async function choosePlace(page, role, query) {
  await clickHost(page, `#routeStopList .route-stop-row[data-route-role="${role}"] .route-stop-input`);
  await expect(page.locator('#routeDistanceModal')).toHaveClass(/route-place-search-active/);
  await expect(page.locator('#routePlaceSearchSurface')).toBeVisible();
  await expect(page.locator('#routePlaceCandidatesTitle')).toHaveText('候補');
  await setHostValue(page, '#routePlaceSearchInput', query);
  await expect(page.locator('#routePlaceCandidatesTitle')).toHaveText('検索結果');
  await expect(page.locator('#routePlaceHistoryList .route-place-history-item')).toHaveCount(1);
  await clickHost(page, '#routePlaceHistoryList .route-place-history-item');
  await expect(page.locator('#routeDistanceModal')).not.toHaveClass(/route-place-search-active/);
}

async function openFromCar(page) {
  await page.evaluate(() => { executeDebugMode(); switchView('seisan'); });
  await clickHost(page, '[data-action="open-settlement-car-edit"]');
  await clickHost(page, '#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
  await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-text-input') && customElements.get('cds-button'));
  await installGoogleMock(page);
});

test('Carbon place search avoids Google-owned full-screen UI and returns route alternatives', async ({ page }) => {
  await openFromCar(page);
  await expect(page.locator('#routeStopList .route-stop-row')).toHaveCount(2);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'destination', '松本');
  await expect(page.locator('gmp-place-autocomplete')).toHaveCount(0);
  await expect(page.locator('.route-candidate-card')).toHaveCount(2);
  expect(await page.evaluate(() => window.__polylines.filter(polyline => polyline.map).length)).toBe(2);
  await page.evaluate(() => window.__polylines.filter(polyline => polyline.map)[1].listeners.click());
  await expect(page.locator('.route-candidate-card').nth(1)).toHaveAttribute('aria-checked', 'true');
});

test('waypoint candidate history, selection, reorder controls and map update work', async ({ page }) => {
  await openFromCar(page);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'destination', '松本');
  await clickHost(page, '#addRouteWaypointBtn');
  await expect(page.locator('#routePlaceSearchSurface')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#routePlaceHistoryList .route-place-history-item')).toHaveCount(2);
  await setHostValue(page, '#routePlaceSearchInput', '榛名');
  await expect(page.locator('#routePlaceHistoryList .route-place-history-item')).toHaveCount(1);
  await clickHost(page, '#routePlaceHistoryList .route-place-history-item');
  await expect(page.locator('.route-candidate-card')).toHaveCount(1);
  const geometry = await page.locator('#routeStopList .route-stop-row[data-route-role="waypoint"]').evaluate(row => {
    const field = row.querySelector('.route-stop-input').getBoundingClientRect();
    const drag = row.querySelector('.route-stop-drag').getBoundingClientRect();
    const trash = row.querySelector('.route-stop-delete').getBoundingClientRect();
    return { centers: [field, drag, trash].map(rect => Math.round(rect.y + rect.height / 2)), sizes: [drag.width, drag.height, trash.width, trash.height] };
  });
  expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThanOrEqual(1);
  expect(geometry.sizes.every(size => size >= 44)).toBeTruthy();
});

test('mobile input does not trigger iOS zoom and no horizontal scroll is introduced', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFromCar(page);
  await clickHost(page, '#routeStopList .route-stop-row[data-route-role="origin"] .route-stop-input');
  const surfaceBox = await page.locator('#routePlaceSearchSurface').boundingBox();
  expect(surfaceBox.width).toBeGreaterThanOrEqual(389);
  expect(surfaceBox.height).toBeGreaterThanOrEqual(843);
  const fontSize = await page.locator('#routePlaceSearchInput').evaluate(node => parseFloat(getComputedStyle(node.shadowRoot.querySelector('input')).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
  expect(await page.locator('#routeDistanceModal .route-helper-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy();
});

test('reopening resizes and redraws the existing map', async ({ page }) => {
  await openFromCar(page);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'destination', '松本');
  const before = await page.evaluate(() => window.__mapResize);
  await clickHost(page, '#routePlannerCancelBtn');
  await expect(page.locator('#settlementCarEditModal')).toHaveAttribute('open', '');
  await clickHost(page, '#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
  await expect(page.locator('#routeMapSkeleton')).toHaveAttribute('hidden', '');
  expect(await page.evaluate(() => window.__mapResize)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__polylines.filter(polyline => polyline.map).length)).toBeGreaterThan(0);
});
