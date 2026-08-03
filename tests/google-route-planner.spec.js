import { test, expect } from '@playwright/test';

async function installGoogleMock(page) {
  await page.evaluate(() => {
    window.__polylines = [];
    window.__routeRequests = [];
    window.__mapResize = 0;
    class Bounds {
      constructor() { this.points = []; }
      extend(point) { this.points.push(point); return this; }
      isEmpty() { return !this.points.length; }
    }
    class Map {
      constructor(node, options) { this.node = node; this.options = options; }
      setOptions(options) { Object.assign(this.options, options); }
      fitBounds() {}
      getDiv() { return this.node; }
    }
    class Polyline {
      constructor(options) { this.options = options; this.map = options.map; this.listeners = {}; window.__polylines.push(this); }
      addListener(name, handler) { this.listeners[name] = handler; }
      setMap(map) { this.map = map; }
    }
    class Marker { constructor(options) { Object.assign(this, options); } setMap(map) { this.map = map; } }
    class AdvancedMarkerElement { constructor(options) { Object.assign(this, options); } }
    class AutocompleteSessionToken {}
    class Place { constructor(options = {}) { this.id = options.id || ''; } }

    const catalog = [
      { placeId: 'origin', name: '信州大学工学部', address: '長野県長野市若里', latitude: 36.627, longitude: 138.191 },
      { placeId: 'destination', name: '松本駅', address: '長野県松本市', latitude: 36.23, longitude: 137.965 },
      { placeId: 'waypoint', name: '榛名山', address: '群馬県高崎市', latitude: 36.477, longitude: 138.878 }
    ];
    const byId = id => catalog.find(item => item.placeId === id) || catalog[0];
    const prediction = value => ({
      placeId: value.placeId,
      mainText: { text: value.name },
      secondaryText: { text: value.address },
      text: { text: `${value.name} ${value.address}` },
      toPlace: () => ({
        id: value.placeId,
        displayName: value.name,
        formattedAddress: value.address,
        location: { lat: () => value.latitude, lng: () => value.longitude },
        fetchFields: async () => {}
      })
    });
    const AutocompleteSuggestion = {
      fetchAutocompleteSuggestions: async request => ({
        suggestions: catalog
          .filter(item => `${item.name} ${item.address}`.includes(request.input || ''))
          .map(item => ({ placePrediction: prediction(item) }))
      })
    };
    const pointFor = value => {
      const id = value?.id || value?.placeId || '';
      const place = byId(id);
      return { id: place.placeId, lat: place.latitude, lng: place.longitude };
    };
    const makeRoute = (request, index) => {
      const start = pointFor(request.origin);
      const end = pointFor(request.destination);
      const direct = Math.hypot(start.lat - end.lat, start.lng - end.lng);
      const distance = Math.round(direct * 100000 + 15000 + index * 4500);
      const duration = Math.round(distance / (index === 0 ? 18 : index === 1 ? 16 : 14) * 1000);
      const bend = (index - 1) * 0.045;
      return {
        routeToken: `${start.id}-${end.id}-${index}`,
        description: index === 1 ? '国道中心' : index === 2 ? '県道中心' : 'おすすめルート',
        distanceMeters: distance,
        durationMillis: duration,
        routeLabels: index === 0 ? ['DEFAULT_ROUTE'] : [],
        path: [
          { lat: start.lat, lng: start.lng },
          { lat: (start.lat + end.lat) / 2 + bend, lng: (start.lng + end.lng) / 2 - bend },
          { lat: end.lat, lng: end.lng }
        ],
        viewport: new Bounds(),
        legs: [{
          distanceMeters: distance,
          durationMillis: duration,
          startLocation: { lat: start.lat, lng: start.lng },
          endLocation: { lat: end.lat, lng: end.lng },
          steps: [{ navigationInstruction: { instructions: index === 0 ? '主要道路' : `別経路${index}` } }]
        }]
      };
    };
    const maps = {
      Map, Polyline, Marker, LatLngBounds: Bounds,
      event: {
        addListenerOnce: (_target, _name, handler) => setTimeout(handler, 0),
        trigger: (_target, event) => { if (event === 'resize') window.__mapResize += 1; }
      }
    };
    window.google = { maps };
    window.SanpoGoogleMaps = {
      isConfigured: () => true,
      getConfig: () => ({ mapId: '' }),
      importLibraries: async names => Object.fromEntries(names.map(name => [name,
        name === 'maps' ? maps :
        name === 'places' ? { AutocompleteSuggestion, AutocompleteSessionToken, Place } :
        name === 'routes' ? { Route: { computeRoutes: async request => {
          window.__routeRequests.push(request);
          return { routes: [0, 1, 2].map(index => makeRoute(request, index)) };
        } } } :
        name === 'geometry' ? { encoding: { encodePath: path => JSON.stringify(path), decodePath: value => JSON.parse(value) } } :
        name === 'marker' ? { AdvancedMarkerElement } : {}
      ]))
    };
  });
}

async function clickHost(page, selector, index = 0) {
  await page.locator(selector).nth(index).evaluate(node => node.click());
  await page.waitForTimeout(100);
}

async function setHostValue(page, selector, value) {
  await page.locator(selector).evaluate((node, next) => {
    node.value = next;
    node.setAttribute('value', next);
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }, value);
}

async function choosePlace(page, role, query, waypointId = '') {
  const suffix = waypointId ? `[data-route-waypoint-id="${waypointId}"]` : '';
  await clickHost(page, `#routeStopList .route-stop-row[data-route-role="${role}"]${suffix} .route-stop-input`);
  await expect(page.locator('#routeDistanceModal')).toHaveClass(/route-place-search-active/);
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

test('compact Carbon stop editor uses one permanent append slot and accordion settings', async ({ page }) => {
  await openFromCar(page);
  await expect(page.locator('#addRouteWaypointBtn')).toHaveCount(0);
  await expect(page.locator('#routeStopList .route-stop-row')).toHaveCount(2);
  await expect(page.locator('#routeStopList .route-stop-row--append .route-stop-delete')).toHaveCount(0);
  await expect(page.locator('#routeStopList .route-stop-row--append .route-stop-input')).toHaveJSProperty('placeholder', '経由地を追加');
  await expect(page.locator('#routePlannerMapTitle')).toHaveCount(0);
  await expect(page.locator('#routePlannerCalculatedAt')).toHaveCount(0);
  await expect(page.locator('cds-accordion.route-settings-accordion')).toHaveCount(1);
  await expect(page.locator('#routeAvoidTolls')).toHaveJSProperty('checked', true);
  await expect(page.locator('#routeAvoidHighways')).toHaveJSProperty('checked', true);
});

test('segmented alternatives create at most three complete route candidates', async ({ page }) => {
  await openFromCar(page);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'append', '松本');
  await expect(page.locator('.route-candidate-card')).toHaveCount(3);
  await choosePlace(page, 'append', '榛名');
  await expect(page.locator('#routeStopList .route-stop-row[data-route-role="waypoint"]')).toHaveCount(1);
  await expect(page.locator('#routeStopList .route-stop-row--append')).toHaveCount(1);
  await expect(page.locator('.route-candidate-card')).toHaveCount(3);
  await expect(page.locator('#routeLegSummary .route-leg-row')).toHaveCount(2);
  const requests = await page.evaluate(() => window.__routeRequests.map(request => ({
    alternatives: request.computeAlternativeRoutes,
    hasIntermediates: Boolean(request.intermediates?.length)
  })));
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(requests.every(request => request.alternatives === true && request.hasIntermediates === false)).toBeTruthy();
  expect(await page.evaluate(() => window.__polylines.filter(polyline => polyline.map).length)).toBe(3);
  await page.evaluate(() => window.__polylines.filter(polyline => polyline.map)[2].listeners.click());
  await expect(page.locator('.route-candidate-card').nth(2)).toHaveAttribute('aria-checked', 'true');
});

test('drag fallback keeps compact geometry and all actions stay aligned', async ({ page }) => {
  await openFromCar(page);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'append', '松本');
  await choosePlace(page, 'append', '榛名');
  const row = page.locator('#routeStopList .route-stop-row[data-route-role="waypoint"]').first();
  const geometry = await row.evaluate(node => {
    const field = node.querySelector('.route-stop-input').getBoundingClientRect();
    const drag = node.querySelector('.route-stop-drag').getBoundingClientRect();
    const trash = node.querySelector('.route-stop-delete').getBoundingClientRect();
    return { centers: [field, drag, trash].map(rect => Math.round(rect.y + rect.height / 2)), sizes: [drag.width, drag.height, trash.width, trash.height] };
  });
  expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThanOrEqual(1);
  expect(geometry.sizes.every(size => size >= 40)).toBeTruthy();

  const handle = row.locator('.route-stop-drag');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 90, { steps: 12 });
  const fallback = page.locator('.route-stop-drag-fallback');
  if (await fallback.count()) {
    const helper = await fallback.evaluate(node => ({
      width: node.getBoundingClientRect().width,
      icon: node.querySelector('.route-search-svg')?.getBoundingClientRect().width || 0
    }));
    expect(helper.width).toBeLessThanOrEqual((await page.locator('#routeStopList').boundingBox()).width + 2);
    expect(helper.icon).toBeLessThanOrEqual(20.5);
  }
  await page.mouse.up();
});

test('mobile route tool has no horizontal scroll and reopening redraws map', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFromCar(page);
  await choosePlace(page, 'origin', '信州');
  await choosePlace(page, 'append', '松本');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
  expect(await page.locator('#routeDistanceModal .route-helper-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy();
  const before = await page.evaluate(() => window.__mapResize);
  await clickHost(page, '#routePlannerCancelBtn');
  await clickHost(page, '#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
  await expect(page.locator('#routeMapSkeleton')).toHaveAttribute('hidden', '');
  expect(await page.evaluate(() => window.__mapResize)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__polylines.filter(polyline => polyline.map).length)).toBeGreaterThan(0);
});
