(function () {
  window.__mapsRequests = [];
  window.__mockPlacesById = {};
  window.__mockRouteDelay = 0;
  window.__mockRouteMode = 'success';
  class MockPlaceAutocompleteElement extends HTMLElement {
    constructor() { super(); this.value = ''; this.placeholder = ''; this.includedRegionCodes = []; }
    focus() {}
  }
  if (!customElements.get('gmp-place-autocomplete')) customElements.define('gmp-place-autocomplete', MockPlaceAutocompleteElement);
  class MockMap {
    constructor(host, options) { this.host = host; this.options = options; this.fitBoundsCalls = []; }
    fitBounds(bounds, padding) { this.fitBoundsCalls.push({ bounds, padding }); }
    setOptions(options) { this.options = { ...this.options, ...options }; }
  }
  class MockPolyline {
    constructor(options) { this.options = { ...options }; this.listeners = {}; this.map = options.map; }
    addListener(name, listener) { this.listeners[name] = listener; return { remove() {} }; }
    setOptions(options) { this.options = { ...this.options, ...options }; }
    setMap(map) { this.map = map; }
    trigger(name) { this.listeners[name]?.(); }
  }
  class MockMarker { constructor(options) { this.options = options; this.map = options.map; } setMap(map) { this.map = map; } }
  class MockLatLngBounds {
    constructor() { this.points = []; }
    extend(point) { this.points.push(point); return this; }
    toJSON() {
      if (!this.points.length) return { south: 0, west: 0, north: 0, east: 0 };
      const lats = this.points.map(point => Number(typeof point.lat === 'function' ? point.lat() : point.lat));
      const lngs = this.points.map(point => Number(typeof point.lng === 'function' ? point.lng() : point.lng));
      return { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) };
    }
  }
  const encodePath = path => JSON.stringify(path.map(point => ({ lat: Number(typeof point.lat === 'function' ? point.lat() : point.lat), lng: Number(typeof point.lng === 'function' ? point.lng() : point.lng) })));
  const decodePath = value => JSON.parse(value || '[]');
  const MOCK_COORDINATES = Object.freeze({
    'place-origin': { lat: 36.6392, lng: 138.1919 },
    'place-waypoint': { lat: 36.5044, lng: 138.1108 },
    'place-destination': { lat: 36.2306, lng: 137.9646 }
  });
  const placeIdFromRouteLocation = value => {
    if (typeof value !== 'string') return '';
    return value.startsWith('places/') ? value.slice('places/'.length) : '';
  };
  const resolveRoutePoint = waypoint => {
    if (!waypoint) return { lat: 36.2, lng: 138.2 };
    const raw = waypoint.location ?? waypoint;
    const placeId = placeIdFromRouteLocation(raw) || waypoint.placeId || '';
    if (placeId && window.__mockPlacesById[placeId]) {
      const stored = window.__mockPlacesById[placeId];
      return { lat: Number(stored.latitude), lng: Number(stored.longitude) };
    }
    if (placeId && MOCK_COORDINATES[placeId]) return MOCK_COORDINATES[placeId];
    if (raw && Number.isFinite(Number(raw.lat)) && Number.isFinite(Number(raw.lng))) {
      return { lat: Number(raw.lat), lng: Number(raw.lng) };
    }
    return { lat: 36.2, lng: 138.2 };
  };
  const resolvePoint = waypoint => resolveRoutePoint(waypoint);
  const makeRoute = (index, request) => {
    const origin = resolvePoint(request.origin);
    const destination = resolvePoint(request.destination);
    const bend = { lat: (origin.lat + destination.lat) / 2 + index * 0.02, lng: (origin.lng + destination.lng) / 2 - index * 0.02 };
    const distanceMeters = 84300 + index * 6900;
    const durationMillis = 6120000 + index * 780000;
    return {
      path: [origin, bend, destination],
      routeLabels: index === 0 ? ['DEFAULT_ROUTE'] : ['DEFAULT_ROUTE_ALTERNATE'],
      viewport: { toJSON: () => ({ south: Math.min(origin.lat, destination.lat), west: Math.min(origin.lng, destination.lng), north: Math.max(origin.lat, destination.lat), east: Math.max(origin.lng, destination.lng) }) },
      distanceMeters,
      durationMillis,
      description: index === 0 ? '上信越自動車道、長野自動車道' : index === 1 ? '国道18号、県道35号' : '国道19号、国道147号',
      warnings: [],
      travelAdvisory: index === 0 ? { tollInfo: { estimatedPrices: [{ currencyCode: 'JPY', units: 2350, nanos: 0 }] } } : {},
      legs: [{
        distanceMeters,
        durationMillis,
        travelAdvisory: index === 0 ? { tollInfo: { estimatedPrices: [{ currencyCode: 'JPY', units: 2350, nanos: 0 }] } } : {},
        steps: [
          { distanceMeters: Math.round(distanceMeters * 0.55), instructions: index === 0 ? '上信越自動車道を進む' : '国道18号を進む' },
          { distanceMeters: Math.round(distanceMeters * 0.45), instructions: index === 0 ? '長野自動車道に入る' : '県道35号を進む' }
        ]
      }]
    };
  };
  const Route = {
    async computeRoutes(request) {
      window.__mapsRequests.push(structuredClone(request));
      if (window.__mockRouteDelay) await new Promise(resolve => setTimeout(resolve, window.__mockRouteDelay));
      if (window.__mockRouteMode === 'error') throw new Error('RESOURCE_EXHAUSTED: mock quota');
      if (window.__mockRouteMode === 'empty') return { routes: [] };
      const count = request.computeAlternativeRoutes ? 4 : 1;
      return { routes: Array.from({ length: count }, (_, index) => makeRoute(index, request)) };
    }
  };
  const google = { maps: { Map: MockMap, Marker: MockMarker, Polyline: MockPolyline, LatLngBounds: MockLatLngBounds, UnitSystem: { METRIC: 'METRIC' }, geometry: { encoding: { encodePath, decodePath } } } };
  window.google = google;
  window.__SANPO_GOOGLE_MAPS_TEST_LIBRARIES__ = {
    maps: { Map: MockMap }, places: { PlaceAutocompleteElement: customElements.get('gmp-place-autocomplete') },
    routes: { Route, TravelMode: { DRIVING: 'DRIVING' }, RoutingPreference: { TRAFFIC_AWARE_OPTIMAL: 'TRAFFIC_AWARE_OPTIMAL', TRAFFIC_UNAWARE: 'TRAFFIC_UNAWARE' }, VehicleEmissionType: { GASOLINE: 'GASOLINE' }, TollPass: { JP_ETC: 'JP_ETC' }, ComputeRoutesExtraComputation: { TOLLS: 'TOLLS' }, PolylineQuality: { HIGH_QUALITY: 'HIGH_QUALITY' } },
    geometry: { encoding: { encodePath, decodePath } }, google
  };
  window.__selectMockPlace = (selector, data) => {
    const widget = document.querySelector(selector);
    if (!widget) throw new Error(`Autocomplete not found: ${selector}`);
    window.__mockPlacesById[data.placeId] = { latitude: data.latitude, longitude: data.longitude };
    const place = { id: data.placeId, displayName: data.name, formattedAddress: data.address, location: { lat: () => data.latitude, lng: () => data.longitude }, async fetchFields() {} };
    const event = new Event('gmp-select', { bubbles: true, composed: true });
    Object.defineProperty(event, 'placePrediction', { value: { toPlace: () => place } });
    widget.dispatchEvent(event);
  };
})();
