// Google map preview for all route candidates. List and map selection stay synchronized.
(function (global) {
  'use strict';

  let map = null;
  let libraries = null;
  let polylines = [];
  let markers = [];
  let selectedIndex = 0;
  let selectionHandler = null;

  const DARK_MAP_STYLES = [
    { elementType: 'geometry', stylers: [{ color: '#262626' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#262626' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#c6c6c6' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#393939' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#525252' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#161616' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#303030' }] }
  ];

  function isDarkTheme() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function routeMapGestureHandling() {
    return global.matchMedia?.('(max-width: 900px), (pointer: coarse)')?.matches ? 'cooperative' : 'greedy';
  }

  function clearMapObjects() {
    polylines.forEach(polyline => polyline?.setMap?.(null));
    markers.forEach(marker => marker?.setMap?.(null));
    polylines = [];
    markers = [];
  }

  async function ensureRouteMap(nextLibraries) {
    libraries = nextLibraries || libraries || await global.loadSanpoGoogleMapsLibraries();
    if (map) return map;
    const host = document.getElementById('routeMap');
    if (!host) throw new Error('地図の表示領域が見つかりません。');
    const MapConstructor = libraries.maps?.Map || libraries.google?.maps?.Map;
    if (!MapConstructor) throw new Error('Google Mapsの地図ライブラリを初期化できません。');
    try {
      map = new MapConstructor(host, {
        center: { lat: 36.2048, lng: 138.2529 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        cameraControl: false,
        clickableIcons: false,
        gestureHandling: routeMapGestureHandling(),
        styles: isDarkTheme() ? DARK_MAP_STYLES : null
      });
      host.dataset.mapReady = 'true';
      const placeholder = document.getElementById('routeMapPlaceholder');
      if (placeholder) placeholder.hidden = true;
      return map;
    } catch (error) {
      host.dataset.mapReady = 'false';
      map = null;
      throw new Error(`地図を初期化できませんでした。${error?.message ? ` ${error.message}` : ''}`);
    }
  }

  function plainPoint(point) {
    if (!point) return null;
    const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
    const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
    const result = { lat: Number(lat), lng: Number(lng) };
    return Number.isFinite(result.lat) && Number.isFinite(result.lng) ? result : null;
  }

  function routePath(route) {
    if (Array.isArray(route?._path) && route._path.length) return route._path.map(plainPoint).filter(Boolean);
    const decoder = libraries?.google?.maps?.geometry?.encoding;
    if (!route?.polyline || !decoder?.decodePath) return [];
    return decoder.decodePath(route.polyline).map(plainPoint).filter(Boolean);
  }

  function markerLabel(index, total) {
    if (index === 0) return 'A';
    if (index === total - 1) return 'B';
    return String(index);
  }

  function addStopMarkers(planner) {
    const MarkerConstructor = libraries.google?.maps?.Marker;
    if (!MarkerConstructor) return;
    const places = [planner.origin, ...(planner.waypoints || []), planner.destination].filter(Boolean);
    places.forEach((place, index) => {
      const marker = new MarkerConstructor({
        map,
        position: { lat: Number(place.latitude), lng: Number(place.longitude) },
        label: { text: markerLabel(index, places.length), color: '#ffffff', fontWeight: '600' },
        title: place.name || place.address,
        zIndex: 100 + index
      });
      markers.push(marker);
    });
  }

  function fitAllRoutes(routes) {
    const BoundsConstructor = libraries.google?.maps?.LatLngBounds;
    if (!BoundsConstructor || !map?.fitBounds) return;
    const bounds = new BoundsConstructor();
    let hasPoint = false;
    routes.forEach(route => routePath(route).forEach(point => {
      bounds.extend(point);
      hasPoint = true;
    }));
    if (hasPoint) map.fitBounds(bounds, 48);
  }

  function applyPolylineStyles() {
    polylines.forEach((polyline, index) => {
      if (!polyline) return;
      const active = index === selectedIndex;
      polyline.setOptions({
        strokeColor: active ? '#0f62fe' : (isDarkTheme() ? '#78a9ff' : '#8d8d8d'),
        strokeOpacity: active ? 1 : 0.55,
        strokeWeight: active ? 7 : 4,
        zIndex: active ? 20 : 10 - index
      });
    });
  }

  async function renderRouteMap(routes, planner, nextSelectedIndex = 0, onSelect = null, nextLibraries = null) {
    await ensureRouteMap(nextLibraries);
    clearMapObjects();
    selectedIndex = Math.min(Math.max(0, Number(nextSelectedIndex) || 0), Math.max(0, routes.length - 1));
    selectionHandler = typeof onSelect === 'function' ? onSelect : null;
    const PolylineConstructor = libraries.google?.maps?.Polyline;
    if (!PolylineConstructor) throw new Error('ルート線を描画できません。');

    routes.forEach((route, index) => {
      const path = routePath(route);
      if (!path.length) return;
      const polyline = new PolylineConstructor({ map, path, clickable: true, geodesic: true });
      polyline.addListener?.('click', () => selectionHandler?.(index, 'map'));
      polylines[index] = polyline;
    });
    addStopMarkers(planner);
    applyPolylineStyles();
    if (routes.length) fitAllRoutes(routes);
  }

  function selectRouteOnMap(index, route) {
    selectedIndex = Number(index) || 0;
    applyPolylineStyles();
    const path = routePath(route);
    const BoundsConstructor = libraries?.google?.maps?.LatLngBounds;
    if (!map || !path.length || !BoundsConstructor) return;
    const bounds = new BoundsConstructor();
    path.forEach(point => bounds.extend(point));
    map.fitBounds?.(bounds, 56);
  }

  function refreshRouteMapTheme() {
    if (!map) return;
    map.setOptions?.({
      styles: isDarkTheme() ? DARK_MAP_STYLES : null,
      gestureHandling: routeMapGestureHandling()
    });
    applyPolylineStyles();
  }

  function destroyRouteMap() {
    clearMapObjects();
    map = null;
    libraries = null;
  }

  function getRouteMapRuntimeForTests() {
    return { map, polylines: [...polylines], markers: [...markers], selectedIndex };
  }

  window.addEventListener('sanpo-theme-change', refreshRouteMapTheme);
  window.addEventListener('resize', refreshRouteMapTheme, { passive: true });
  document.addEventListener('sanpo:theme-changed', refreshRouteMapTheme);
  Object.assign(global, {
    ensureRouteMap,
    renderRouteMap,
    selectRouteOnMap,
    refreshRouteMapTheme,
    destroyRouteMap,
    getRouteMapRuntimeForTests
  });
})(window);
