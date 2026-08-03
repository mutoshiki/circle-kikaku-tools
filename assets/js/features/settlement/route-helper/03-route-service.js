// Routes API adapter through the Maps JavaScript API Routes library.
(function (global) {
  'use strict';

  const HIGHWAY_PATTERN = /(高速|自動車道|expressway|motorway|highway|中央道|関越道|上信越道|長野道|東名|新東名|圏央道|名神|新名神|東北道|常磐道|北陸道|中国道|山陽道|九州道|阪神高速|首都高|都市高速)/i;

  function routePoint(place) {
    if (!place) return null;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function routeLocation(place) {
    if (!place) return null;
    const placeId = String(place.placeId || '').trim();
    if (placeId) return `places/${placeId}`;
    return routePoint(place);
  }

  function routeWaypoint(place, via = false) {
    const location = routeLocation(place);
    if (!location) return null;
    return via ? { location, via: true } : { location };
  }

  function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function pointToPlain(point) {
    if (!point) return null;
    const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
    const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
    const plain = { lat: Number(lat), lng: Number(lng) };
    return Number.isFinite(plain.lat) && Number.isFinite(plain.lng) ? plain : null;
  }

  function routeViewportToPlain(viewport) {
    if (!viewport) return null;
    try {
      const json = typeof viewport.toJSON === 'function' ? viewport.toJSON() : viewport;
      const south = Number(json.south), west = Number(json.west), north = Number(json.north), east = Number(json.east);
      return [south, west, north, east].every(Number.isFinite) ? { south, west, north, east } : null;
    } catch (_) { return null; }
  }

  function moneyToPlain(money) {
    if (!money) return null;
    const source = typeof money.toJSON === 'function' ? money.toJSON() : money;
    return {
      currencyCode: String(source.currencyCode || 'JPY'),
      units: numberFrom(source.units),
      nanos: numberFrom(source.nanos)
    };
  }

  function routeTollInfo(route) {
    if (route?.travelAdvisory?.tollInfo) return route.travelAdvisory.tollInfo;
    return Array.from(route?.legs || []).map(leg => leg?.travelAdvisory?.tollInfo).find(Boolean) || null;
  }

  function getRouteTollPrice(route) {
    const prices = routeTollInfo(route)?.estimatedPrices || [];
    return prices.length ? moneyToPlain(prices[0]) : null;
  }

  function cleanInstruction(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[（）()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function routeInstructionText(route) {
    return Array.from(route?.legs || []).flatMap(leg =>
      Array.from(leg?.steps || []).map(step => cleanInstruction(step?.instructions))
    ).filter(Boolean);
  }

  function extractMainRoads(route) {
    const description = cleanInstruction(route?.description);
    const instructions = routeInstructionText(route);
    const roadTokenPattern = /(?:国道|県道|都道|府道|道道|市道|高速|自動車道|街道|バイパス|ライン|道路|通り|ルート|Route|Expressway|Highway|Motorway)[^、,。;；／/→>|]{0,30}/gi;
    const rawParts = [description, ...instructions]
      .flatMap(value => [
        ...String(value).split(/[、,。;；／/→>|・]/),
        ...(String(value).match(roadTokenPattern) || [])
      ])
      .map(value => value
        .replace(/^(?:右折|左折|直進|進む|入る|出る|合流|分岐|向かう|経由|方面|標識|県道|国道へ)/, '')
        .replace(/(?:に入る|へ進む|を進む|を直進|方面へ|出口.*|入口.*)$/g, '')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(value => value.length >= 2 && value.length <= 60)
      .filter(value => /(?:\d+号|国道|県道|都道|府道|道道|市道|高速|自動車道|街道|バイパス|ライン|道路|通り|Route|Expressway|Highway|Motorway)/i.test(value));
    const seen = new Set();
    return rawParts.filter(value => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }

  function inferHighway(route, mainRoads) {
    const text = [route?.description || '', ...routeInstructionText(route), ...mainRoads].join(' ');
    if (HIGHWAY_PATTERN.test(text)) return { value: true, source: 'description-inferred' };
    return { value: false, source: text.trim() ? 'description-inferred' : 'unknown' };
  }

  function routeLabelStrings(route) {
    return Array.from(route?.routeLabels || []).map(label => String(label));
  }

  function formatRouteLabel(index, route, sourceKind) {
    const labels = routeLabelStrings(route);
    if (sourceKind === 'avoid-highways') return '一般道中心';
    if (sourceKind === 'avoid-tolls') return '有料道路を抑える';
    if (sourceKind === 'traffic-unaware') return '別条件のルート';
    if (labels.some(label => label.includes('FUEL_EFFICIENT'))) return '燃費を考慮';
    if (labels.some(label => label.includes('SHORTER_DISTANCE'))) return '距離が短いルート';
    if (labels.some(label => label.includes('DEFAULT_ROUTE_ALTERNATE'))) return `別ルート ${Math.max(1, index)}`;
    if (labels.some(label => label.includes('DEFAULT_ROUTE'))) return 'おすすめ';
    return index === 0 ? 'おすすめ' : `別ルート ${index}`;
  }

  function createRouteRequest(planner, libraries, overrides = {}) {
    const { routes, google } = libraries;
    const intermediates = (planner.waypoints || []).map(place => routeWaypoint(place, false)).filter(Boolean);
    const routeModifiers = {
      avoidTolls: planner.avoidTolls === true,
      avoidHighways: planner.avoidHighways === true,
      avoidFerries: planner.avoidFerries === true,
      vehicleInfo: {
        emissionType: routes.VehicleEmissionType?.GASOLINE || 'GASOLINE'
      }
    };
    Object.assign(routeModifiers, overrides.routeModifiers || {});
    return {
      origin: routeWaypoint(planner.origin),
      destination: routeWaypoint(planner.destination),
      intermediates,
      travelMode: routes.TravelMode?.DRIVING || 'DRIVING',
      routingPreference: overrides.routingPreference || routes.RoutingPreference?.TRAFFIC_AWARE_OPTIMAL || routes.RoutingPreference?.TRAFFIC_AWARE || 'TRAFFIC_AWARE',
      computeAlternativeRoutes: overrides.computeAlternativeRoutes === true,
      routeModifiers,
      extraComputations: [routes.ComputeRoutesExtraComputation?.TOLLS || 'TOLLS'],
      polylineQuality: routes.PolylineQuality?.HIGH_QUALITY || 'HIGH_QUALITY',
      language: 'ja-JP',
      region: 'jp',
      units: google.maps.UnitSystem?.METRIC,
      fields: [
        'path', 'routeLabels', 'viewport', 'distanceMeters', 'durationMillis',
        'legs.distanceMeters', 'legs.durationMillis', 'legs.travelAdvisory',
        'legs.steps.instructions', 'legs.steps.distanceMeters',
        'description', 'localizedValues', 'travelAdvisory', 'warnings'
      ]
    };
  }

  function stableRouteId(sourceKind, distanceMeters, durationSeconds, polyline) {
    let hash = 2166136261;
    const seed = `${sourceKind}|${Math.round(distanceMeters)}|${Math.round(durationSeconds)}|${polyline.slice(0, 96)}`;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `route-${(hash >>> 0).toString(36)}`;
  }

  function normalizeNativeRoute(route, index, sourceKind, libraries, planner) {
    const path = Array.from(route?.path || []).map(pointToPlain).filter(Boolean);
    const encoder = libraries.google?.maps?.geometry?.encoding;
    const polyline = path.length && encoder?.encodePath ? encoder.encodePath(path) : '';
    const mainRoads = extractMainRoads(route);
    const highway = inferHighway(route, mainRoads);
    const stops = [planner.origin, ...(planner.waypoints || []), planner.destination];
    const legs = Array.from(route?.legs || []).map((leg, legIndex) => ({
      index: legIndex,
      distanceMeters: Math.max(0, numberFrom(leg?.distanceMeters)),
      durationSeconds: Math.max(0, Math.round(numberFrom(leg?.durationMillis) / 1000)),
      startName: String(stops[legIndex]?.name || stops[legIndex]?.address || `地点${legIndex + 1}`),
      endName: String(stops[legIndex + 1]?.name || stops[legIndex + 1]?.address || `地点${legIndex + 2}`)
    }));
    const distanceMeters = Math.max(0, numberFrom(route?.distanceMeters));
    const durationSeconds = Math.max(0, Math.round(numberFrom(route?.durationMillis) / 1000));
    const tollInfo = routeTollInfo(route);
    const routeLabels = routeLabelStrings(route);
    const isDefault = routeLabels.some(label => label.includes('DEFAULT_ROUTE') && !label.includes('ALTERNATE'));
    return {
      id: stableRouteId(sourceKind, distanceMeters, durationSeconds, polyline),
      label: formatRouteLabel(index, route, sourceKind),
      description: String(route?.description || ''),
      distanceMeters,
      durationSeconds,
      legs,
      viewport: routeViewportToPlain(route?.viewport),
      polyline,
      hasTolls: !!tollInfo,
      hasHighways: highway.value,
      restrictionsPartiallyIgnored: route?.travelAdvisory?.routeRestrictionsPartiallyIgnored === true,
      highwayDetection: highway.source,
      tollPrice: getRouteTollPrice(route),
      mainRoads,
      sourceKind,
      isDefault,
      isRecommended: isDefault,
      routeLabels,
      warnings: Array.from(route?.warnings || []).map(String),
      _nativeRoute: route,
      _path: path
    };
  }

  function routeDedupKey(route) {
    return route.polyline || `${Math.round(route.distanceMeters / 50)}:${Math.round(route.durationSeconds / 60)}`;
  }

  async function requestRouteSet(planner, libraries, options) {
    const request = createRouteRequest(planner, libraries, options);
    document.dispatchEvent(new CustomEvent('sanpo:route-requested', {
      detail: { sourceKind: options.sourceKind || 'default', request }
    }));
    const result = await libraries.routes.Route.computeRoutes(request);
    return Array.from(result?.routes || []).map((route, index) => normalizeNativeRoute(route, index, options.sourceKind || 'default', libraries, planner));
  }

  async function computeSanpoRoutes(planner) {
    if (!planner?.origin?.placeId || !planner?.destination?.placeId) {
      throw new Error('出発地と目的地をGoogle候補から選択してください。');
    }
    const libraries = await global.loadSanpoGoogleMapsLibraries();
    const hasWaypoints = Array.isArray(planner.waypoints) && planner.waypoints.length > 0;
    const candidates = await requestRouteSet(planner, libraries, {
      sourceKind: 'default',
      computeAlternativeRoutes: !hasWaypoints
    });

    // Routes API does not return alternate routes when intermediate waypoints are present.
    // Request a small number of real, user-understandable modifier variants instead.
    if (hasWaypoints) {
      const variants = [];
      if (!planner.avoidHighways) variants.push({ sourceKind: 'avoid-highways', routeModifiers: { avoidHighways: true } });
      if (!planner.avoidTolls) variants.push({ sourceKind: 'avoid-tolls', routeModifiers: { avoidTolls: true } });
      if (!variants.length) {
        variants.push({
          sourceKind: 'traffic-unaware',
          routingPreference: libraries.routes.RoutingPreference?.TRAFFIC_UNAWARE || 'TRAFFIC_UNAWARE'
        });
      }
      const extraSets = await Promise.allSettled(
        variants.slice(0, 2).map(options => requestRouteSet(planner, libraries, { ...options, computeAlternativeRoutes: false }))
      );
      extraSets.forEach(result => { if (result.status === 'fulfilled') candidates.push(...result.value); });
    }

    const seen = new Set();
    const routes = candidates.filter(route => {
      const key = routeDedupKey(route);
      if (!route.distanceMeters || !route.durationSeconds || !route.polyline || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.durationSeconds - b.durationSeconds;
    }).slice(0, 4);
    if (!routes.length) throw new Error('利用できるルート候補が見つかりませんでした。');
    return { routes, libraries, hasWaypoints };
  }

  Object.assign(global, {
    computeSanpoRoutes,
    createRouteRequest,
    normalizeNativeRoute,
    routePoint,
    routeLocation,
    routeWaypoint
  });
})(window);
