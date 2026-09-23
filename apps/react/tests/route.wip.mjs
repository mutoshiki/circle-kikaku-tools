import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { createRouteDomain } from '../src/route/legacy-domain.js';
import { createRouteService, rememberPlace, distanceKilometers } from '../src/route/service.js';
import { createConfiguredRouteService } from '../src/route/google-maps-adapter.js';
import { createDomain } from '../src/domain/index.js';

const places = [{ placeId: 'A', name: '駅', latitude: 35, longitude: 139 }, { placeId: 'B', name: '山', latitude: 36, longitude: 140 }];
const rawRoute = { routeToken: 'fixture', description: '国道20号', distanceMeters: 12345, durationMillis: 3600000, path: [{ lat: 35, lng: 139 }, { lat: 36, lng: 140 }], legs: [{ distanceMeters: 12345, durationMillis: 3600000 }], routeLabels: ['DEFAULT_ROUTE'] };

test('configured preview Maps adapter loads current routes and places libraries', async () => {
  const imports = [];
  const maps = {
    async importLibrary(name) {
      imports.push(name);
      if (name === 'routes') return { Route: { async computeRoutes() { return { routes: [rawRoute] }; } } };
      return { AutocompleteSuggestion: { async fetchAutocompleteSuggestions() { return { suggestions: [] }; } } };
    },
  };
  const browser = { google: null };
  const document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, addEventListener() {} }),
    head: { appendChild(script) { browser.google = { maps }; new URL(script.src).searchParams.get('callback').split('.').reduce((value, key) => value[key], browser)(); } },
  };
  assert.equal(createConfiguredRouteService({}, { browser, document }), null);
  const service = createConfiguredRouteService({ VITE_REACT_MAPS_API_KEY: 'preview-key' }, { browser, document });
  assert.ok(service);
  const result = await service.calculate({ origin: places[0], destination: places[1] });
  assert.deepEqual(imports.sort(), ['core', 'maps', 'places', 'routes']);
  assert.equal(result.routes[0].distanceMeters, 12345);
});

test('route serialization, ranking, aggregation and selected distance retain legacy semantics', () => {
  const source = readFileSync(new URL('../../../assets/js/features/settlement/04-route-helper.js', import.meta.url), 'utf8');
  const declarations = parse(source, { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
  const generated = readFileSync(new URL('../src/route/legacy-domain.js', import.meta.url), 'utf8');
  const names = [...generated.matchAll(/^\s*function (\w+)\(/gm)].map(match => match[1]);
  const code = declarations.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).map(node => source.slice(node.start, node.end)).join('\n');
  const context = vm.createContext({ runtime: { routePaths: new Map(), geometry: null }, stripHtml: value => String(value || '').trim(), HIGHWAY_PATTERN: /(高速|自動車道|expressway|motorway|highway|\bE\d{1,3}\b|\bC\d{1,3}\b|JCT|IC)/i, MAX_SEGMENT_ROUTES: 3, MAX_PARTIAL_COMBINATIONS: 9, MAX_FINAL_ROUTES: 3 });
  vm.runInContext(code, context);
  const route = createRouteDomain({ htmlText: value => String(value || '').trim() });
  const actual = route.serializeRouteData(rawRoute, 0, places);
  const { path: mapPath, ...comparableRoute } = actual.route;
  assert.deepEqual({ ...actual, route: comparableRoute }, JSON.parse(JSON.stringify(context.serializeRouteData(rawRoute, 0, places))));
  assert.deepEqual(mapPath, actual.path);
  const routes = [actual.route, { ...actual.route, id: 'highway', hasHighways: true, durationSeconds: 10 }];
  const state = { avoidHighways: false, avoidTolls: false, routes, selectedRouteIndex: 1 };
  assert.deepEqual(route.sortRoutesForState(routes, state), JSON.parse(JSON.stringify(context.sortRoutesForState(routes, state))));
  assert.equal(route.getSelectedRoute(state).id, 'highway');
  assert.equal(context.getSelectedRoute(state).id, 'route-fixture-0');
  assert.equal(distanceKilometers({ ...state, roundTrip: true }, route), 24.7);
  assert.deepEqual(route.combineSegmentRoutes([[actual], [actual]]), JSON.parse(JSON.stringify(context.combineSegmentRoutes([[actual], [actual]]))));
});

test('route service uses current SDK request, retries unsupported toll fields, and preserves stop order', async () => {
  const requests = [];
  const service = createRouteService({ loadLibraries: async () => ({ routes: { Route: { async computeRoutes(request) { requests.push(request); if (requests.length === 1) throw new Error('UNIMPLEMENTED extraComputations TOLLS'); return { routes: [rawRoute] }; } } }, places: {} }), htmlText: String });
  const state = createDomain().settlement.normalizeRoutePlannerState({ origin: places[0], destination: places[1], waypoints: [{ ...places[0], placeId: 'C', latitude: 35.5 }], avoidHighways: false });
  const result = await service.calculate(state);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].intermediates, [{ location: { lat: 35.5, lng: 139 } }]);
  assert.equal(requests[1].extraComputations, undefined);
  assert.equal(requests[1].fields.includes('travelAdvisory'), false);
  assert.equal(result.routes[0].distanceMeters, 12345);
  assert.equal(result.waypoints[0].placeId, 'C');
  assert.equal(result.selectedRouteIndex, 0);
  assert.equal(rememberPlace([places[0], places[1]], { ...places[0], name: '改名' })[0].name, '改名');
  await assert.rejects(service.calculate({ origin: places[0] }), /出発地/);
});

test('SDK failure is retryable and search resolves Places New suggestions', async () => {
  let loads = 0;
  const prediction = { placeId: 'A', text: { text: '駅' }, toPlace: () => ({ id: 'A', displayName: '駅', formattedAddress: '東京都', location: { lat: () => 35, lng: () => 139 }, async fetchFields() {} }) };
  const service = createRouteService({ htmlText: String, loadLibraries: async () => { if (++loads === 1) throw new Error('network'); return { places: { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: prediction }, { placePrediction: prediction }] }) } } }; } });
  await assert.rejects(service.search('駅'), /network/);
  assert.equal((await service.search('駅')).length, 1);
  assert.deepEqual(await service.resolve(prediction), { ...places[0], address: '東京都' });
});
