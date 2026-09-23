export function createRouteDomain({ htmlText = value => String(value || '').replace(/<[^>]*>/g, '').trim() } = {}) {
  const runtime = { routePaths: new Map(), geometry: null };
  const HIGHWAY_PATTERN = /(高速|自動車道|expressway|motorway|highway|\bE\d{1,3}\b|\bC\d{1,3}\b|JCT|IC)/i;
  const MAX_SEGMENT_ROUTES = 3;
  const MAX_PARTIAL_COMBINATIONS = 9;
  const MAX_FINAL_ROUTES = 3;
  const stripHtml = htmlText;

  function getSelectedRoute(state = {}) {
    return state.routes?.[state.selectedRouteIndex] || state.routes?.[0] || null;
  }
  function normalizeLatLng(value) {
    if (!value) return null;
    const latitude = Number(typeof value.lat === 'function' ? value.lat() : (value.lat ?? value.latitude));
    const longitude = Number(typeof value.lng === 'function' ? value.lng() : (value.lng ?? value.longitude));
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  }
  function normalizeViewport(value) {
    if (!value) return null;
    const northEast = value.getNorthEast?.();
    const southWest = value.getSouthWest?.();
    const north = Number(value.north ?? northEast?.lat?.());
    const east = Number(value.east ?? northEast?.lng?.());
    const south = Number(value.south ?? southWest?.lat?.());
    const west = Number(value.west ?? southWest?.lng?.());
    return [north, south, east, west].every(Number.isFinite) ? { north, south, east, west } : null;
  }
  function extractRoadNames(route) {
    const names = [];
    const push = value => {
      const text = stripHtml(value).replace(/^(?:そのまま|右折して|左折して|斜め[右左]方向に|ロータリーを).*?/, '').trim();
      if (!text) return;
      const lowered = text.toLowerCase();
      if (names.some(item => { const existing = item.toLowerCase(); return existing === lowered || existing.includes(lowered) || lowered.includes(existing); })) return;
      names.push(text);
    };
    const extract = value => {
      const text = stripHtml(value);
      if (!text) return;
      text.split(/[・、,／/]/).map(item => item.trim()).filter(Boolean).forEach(chunk => {
        const matches = chunk.match(/(?:国道|県道|都道|府道|道道)\s*\d+号(?:線)?|[^。()（）]{1,28}(?:自動車道|高速道路|バイパス|街道)|\b[EC]\d{1,3}[A-Z]?\b/gi);
        if (matches?.length) matches.forEach(push); else if (chunk.length <= 36) push(chunk);
      });
    };
    extract(route.description);
    (route.legs || []).forEach(leg => (leg.steps || []).forEach(step => extract(step.navigationInstruction?.instructions || step.instructions)));
    return names.slice(0, 4);
  }
  function formatMoney(money = {}) {
    const currency = String(money.currencyCode || money.currency || 'JPY');
    const amount = Number(money.units || 0) + Number(money.nanos || 0) / 1e9;
    if (!Number.isFinite(amount) || amount <= 0) return '';
    try { return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount); }
    catch { return `${Math.round(amount).toLocaleString()} ${currency}`; }
  }
  function inferHighway(route, roads) {
    if (HIGHWAY_PATTERN.test(String(route.description || '')) || roads.some(name => HIGHWAY_PATTERN.test(name))) return true;
    return (route.legs || []).some(leg => (leg.steps || []).some(step => HIGHWAY_PATTERN.test(stripHtml(step.navigationInstruction?.instructions || step.instructions || ''))));
  }
  function routeLabel(route, index, hasHighways) {
    const labels = Array.from(route.routeLabels || []).map(String);
    if (labels.includes('DEFAULT_ROUTE') || (!labels.length && index === 0)) return 'おすすめ';
    if (labels.includes('FUEL_EFFICIENT')) return '燃費重視';
    if (!hasHighways) return '一般道中心';
    return `別ルート ${index}`;
  }
  function serializeRouteData(route, index, places, idPrefix = 'route') {
    const normalizedPath = Array.from(route.path || []).map(normalizeLatLng).filter(Boolean);
    const path = normalizedPath.map(point => ({ lat: point.latitude, lng: point.longitude }));
    let polyline = '';
    try { polyline = runtime.geometry?.encoding?.encodePath?.(path) || ''; } catch {}
    const roads = extractRoadNames(route);
    const routeTollInfo = route.travelAdvisory?.tollInfo || null;
    const legTollInfos = (route.legs || []).map(leg => leg.travelAdvisory?.tollInfo).filter(Boolean);
    const tollPrices = routeTollInfo?.estimatedPrices?.length ? Array.from(routeTollInfo.estimatedPrices) : legTollInfos.flatMap(info => Array.from(info.estimatedPrices || []));
    const hasTolls = Boolean(routeTollInfo) || legTollInfos.length > 0;
    const hasHighways = inferHighway(route, roads);
    const legs = Array.from(route.legs || []).map((leg, legIndex) => ({ distanceMeters: Math.max(0, Number(leg.distanceMeters) || 0), durationSeconds: Math.max(0, Number(leg.durationMillis) || 0) / 1000, start: normalizeLatLng(leg.startLocation), end: normalizeLatLng(leg.endLocation), fromName: places[legIndex]?.name || '', toName: places[legIndex + 1]?.name || '' }));
    const sourceId = String(route.routeToken || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9_-]+/g, '-');
    return { path, route: { id: `${idPrefix}-${sourceId}-${index}`, label: routeLabel(route, index, hasHighways), distanceMeters: Math.max(0, Number(route.distanceMeters) || 0), durationSeconds: Math.max(0, Number(route.durationMillis) || 0) / 1000, legs, path, viewport: normalizeViewport(route.viewport), polyline, hasTolls, hasHighways, tollPrice: Array.from(new Set(tollPrices.map(formatMoney).filter(Boolean))).join(' / '), mainRoads: roads } };
  }
  function appendRoutePath(current = [], next = []) {
    if (!current.length) return next.slice(); if (!next.length) return current.slice();
    const last = current[current.length - 1], first = next[0];
    return Math.abs(Number(last.lat) - Number(first.lat)) < 1e-7 && Math.abs(Number(last.lng) - Number(first.lng)) < 1e-7 ? current.concat(next.slice(1)) : current.concat(next);
  }
  function viewportFromPath(path = []) {
    if (!path.length) return null;
    const latitudes = path.map(point => Number(point.lat)).filter(Number.isFinite), longitudes = path.map(point => Number(point.lng)).filter(Number.isFinite);
    return latitudes.length && longitudes.length ? { north: Math.max(...latitudes), south: Math.min(...latitudes), east: Math.max(...longitudes), west: Math.min(...longitudes) } : null;
  }
  function splitTollPrices(value = '') { return String(value || '').split(' / ').map(item => item.trim()).filter(Boolean); }
  function combineSegmentRoutes(segmentGroups = []) {
    let combinations = [{ idParts: [], distanceMeters: 0, durationSeconds: 0, legs: [], path: [], hasTolls: false, hasHighways: false, tollPrices: [], mainRoads: [] }];
    segmentGroups.forEach(group => {
      const choices = group.slice().sort((left, right) => left.route.durationSeconds - right.route.durationSeconds || left.route.distanceMeters - right.route.distanceMeters).slice(0, MAX_SEGMENT_ROUTES);
      const expanded = [];
      combinations.forEach(partial => choices.forEach(choice => expanded.push({ idParts: partial.idParts.concat(choice.route.id), distanceMeters: partial.distanceMeters + choice.route.distanceMeters, durationSeconds: partial.durationSeconds + choice.route.durationSeconds, legs: partial.legs.concat(choice.route.legs), path: appendRoutePath(partial.path, choice.path), hasTolls: partial.hasTolls || choice.route.hasTolls, hasHighways: partial.hasHighways || choice.route.hasHighways, tollPrices: Array.from(new Set(partial.tollPrices.concat(splitTollPrices(choice.route.tollPrice)))), mainRoads: Array.from(new Set(partial.mainRoads.concat(choice.route.mainRoads || []))).slice(0, 5) })));
      const seen = new Set();
      combinations = expanded.sort((left, right) => left.durationSeconds - right.durationSeconds || left.distanceMeters - right.distanceMeters).filter(item => { const signature = item.idParts.join('|'); if (seen.has(signature)) return false; seen.add(signature); return true; }).slice(0, MAX_PARTIAL_COMBINATIONS);
    });
    return combinations.slice(0, MAX_FINAL_ROUTES).map((combination, index) => {
      const id = `combined-${combination.idParts.join('-').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 180)}-${index}`;
      runtime.routePaths.set(id, combination.path);
      let polyline = ''; try { polyline = runtime.geometry?.encoding?.encodePath?.(combination.path) || ''; } catch {}
      return { id, label: index === 0 ? 'おすすめ' : (!combination.hasHighways && index === 1 ? '一般道中心' : `別ルート ${index}`), distanceMeters: combination.distanceMeters, durationSeconds: combination.durationSeconds, legs: combination.legs, viewport: viewportFromPath(combination.path), polyline, hasTolls: combination.hasTolls, hasHighways: combination.hasHighways, tollPrice: combination.tollPrices.join(' / '), mainRoads: combination.mainRoads };
    });
  }
  function routePreferenceScore(route, state) { let score = 0; if (!state.avoidTolls && route.hasTolls) score += 2; if (!state.avoidHighways && route.hasHighways) score += 2; if (route.label === 'おすすめ') score += 1; return score; }
  function sortRoutesForState(routes = [], state = {}) {
    return Array.from(routes).sort((left, right) => routePreferenceScore(right, state) - routePreferenceScore(left, state) || (Number(left.durationSeconds) || 0) - (Number(right.durationSeconds) || 0) || (Number(left.distanceMeters) || 0) - (Number(right.distanceMeters) || 0));
  }
  return { serializeRouteData, combineSegmentRoutes, sortRoutesForState, getSelectedRoute };
}
