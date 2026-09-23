import { createRouteDomain } from './legacy-domain.js';

const ROUTE_FIELDS = ['description', 'distanceMeters', 'durationMillis', 'legs', 'localizedValues', 'path', 'routeLabels', 'routeToken', 'travelAdvisory', 'viewport', 'warnings'];
export function rememberPlace(current = [], place) {
  if (!place?.placeId) return current;
  return [place, ...current.filter(item => item.placeId !== place.placeId)].slice(0, 48);
}
export function distanceKilometers(state, route = createRouteDomain()) {
  const selected = route.getSelectedRoute(state);
  if (!selected) return 0;
  return Math.round((Number(selected.distanceMeters) || 0) * (state.roundTrip ? 2 : 1) / 100) / 10;
}
export function createRouteService({ loadLibraries, htmlText } = {}) {
  const domain = createRouteDomain({ htmlText });
  let libraries;
  const mapInstances = new WeakMap();
  const load = async () => libraries ||= await loadLibraries();
  const location = (place, places) => places?.Place && place?.placeId ? new places.Place({ id: place.placeId }) : { lat: place.latitude, lng: place.longitude };
  return {
    async calculate(state) {
      if (!state?.origin) throw new Error('出発地を選択してください。');
      if (!state?.destination) throw new Error('出発地と目的地を選択してください。');
      const sdk = await load();
      const ordered = [state.origin, ...(state.waypoints || []), state.destination];
      const request = { origin: location(ordered[0], sdk.places), destination: location(ordered.at(-1), sdk.places), intermediates: ordered.slice(1, -1).map(place => ({ location: location(place, sdk.places) })), travelMode: 'DRIVING', routingPreference: 'TRAFFIC_AWARE', computeAlternativeRoutes: true, routeModifiers: { avoidTolls: !!state.avoidTolls, avoidHighways: !!state.avoidHighways, avoidFerries: !!state.avoidFerries }, language: 'ja-JP', region: 'JP', polylineQuality: 'HIGH_QUALITY', extraComputations: ['TOLLS'], fields: ROUTE_FIELDS };
      let response;
      try { response = await sdk.routes.Route.computeRoutes(request); }
      catch (error) {
        if (!/INVALID_ARGUMENT|UNIMPLEMENTED|unsupported|not supported|extraComputations|TOLLS/i.test(String(error?.message || error))) throw error;
        const fallback = { ...request, fields: ROUTE_FIELDS.filter(field => field !== 'travelAdvisory') }; delete fallback.extraComputations;
        response = await sdk.routes.Route.computeRoutes(fallback);
      }
      const routes = domain.sortRoutesForState(Array.from(response.routes || []).slice(0, 3).map((raw, index) => domain.serializeRouteData(raw, index, ordered).route), state);
      return { ...state, waypoints: [...(state.waypoints || [])], routes, selectedRouteIndex: 0, calculatedAt: Date.now() };
    },
    async search(query) {
      const sdk = await load();
      const response = await sdk.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: String(query || '').trim(), language: 'ja', region: 'jp' });
      const seen = new Set();
      return Array.from(response?.suggestions || []).map(item => item.placePrediction).filter(item => { const id = String(item?.placeId || item?.text?.text || ''); if (!id || seen.has(id)) return false; seen.add(id); return true; }).slice(0, 8);
    },
    async resolve(prediction) {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'] });
      const latitude = Number(typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat);
      const longitude = Number(typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng);
      return { placeId: String(place.id), name: String(place.displayName || prediction.text?.text || ''), address: String(place.formattedAddress || ''), latitude, longitude };
    },
    async renderMap(element, state) {
      const sdk = await load();
      if (!sdk.maps?.Map || !element) return;
      let entry = mapInstances.get(element);
      if (!entry) {
        entry = { map: new sdk.maps.Map(element, { center: { lat: 36.2, lng: 138.2 }, zoom: 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: false }), overlays: [] };
        mapInstances.set(element, entry);
      }
      entry.overlays.forEach(overlay => overlay.setMap(null)); entry.overlays = [];
      const selected = domain.getSelectedRoute(state);
      const Bounds = sdk.maps.LatLngBounds || sdk.core?.LatLngBounds;
      if (!sdk.maps.Polyline || !Bounds) return;
      const bounds = new Bounds();
      (state.routes || []).forEach((route, index) => {
        const path = Array.isArray(route.path) ? route.path : [];
        if (!path.length) return;
        const line = new sdk.maps.Polyline({ path, map: entry.map, strokeColor: index === state.selectedRouteIndex ? '#0f62fe' : '#8d8d8d', strokeOpacity: index === state.selectedRouteIndex ? 1 : 0.45, strokeWeight: index === state.selectedRouteIndex ? 6 : 4, zIndex: index === state.selectedRouteIndex ? 2 : 1 });
        entry.overlays.push(line);
        if (route === selected) path.forEach(point => bounds.extend(point));
      });
      if (!bounds.isEmpty()) entry.map.fitBounds(bounds, 48);
    },
  };
}
