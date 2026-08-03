// Google Maps route-planner state model and serialization helpers.
(function (global) {
  'use strict';

  /** @returns {SanpoRoutePlannerState} */
  function createDefaultRoutePlannerState() {
    return {
      origin: null,
      waypoints: [],
      destination: null,
      routes: [],
      selectedRouteIndex: 0,
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
      targetCarId: '',
      returnTo: 'carSettlement',
      roundTrip: false,
      calculatedAt: 0
    };
  }

  /** @param {unknown} value @returns {SanpoRoutePlace|null} */
  function normalizeRoutePlace(value) {
    if (!value || typeof value !== 'object') return null;
    const source = /** @type {Record<string, unknown>} */ (value);
    const placeId = String(source.placeId || '').trim();
    const name = String(source.name || '').trim();
    const address = String(source.address || '').trim();
    const latitude = Number(source.latitude);
    const longitude = Number(source.longitude);
    if (!placeId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { placeId, name: name || address, address, latitude, longitude };
  }

  /** @param {unknown} value @returns {SanpoRouteLeg[]} */
  function normalizeRouteLegs(value) {
    if (!Array.isArray(value)) return [];
    return value.map((leg, index) => {
      const source = leg && typeof leg === 'object' ? /** @type {Record<string, unknown>} */ (leg) : {};
      return {
        index,
        distanceMeters: Math.max(0, Number(source.distanceMeters) || 0),
        durationSeconds: Math.max(0, Number(source.durationSeconds) || 0),
        startName: String(source.startName || ''),
        endName: String(source.endName || '')
      };
    });
  }

  /** @param {unknown} value @returns {SanpoStoredRoute|null} */
  function normalizeStoredRoute(value) {
    if (!value || typeof value !== 'object') return null;
    const source = /** @type {Record<string, unknown>} */ (value);
    const distanceMeters = Math.max(0, Number(source.distanceMeters) || 0);
    const durationSeconds = Math.max(0, Number(source.durationSeconds) || 0);
    const polyline = String(source.polyline || '');
    if (!distanceMeters || !durationSeconds || !polyline) return null;
    const viewportSource = source.viewport && typeof source.viewport === 'object'
      ? /** @type {Record<string, unknown>} */ (source.viewport)
      : {};
    const viewport = ['south', 'west', 'north', 'east'].every(key => Number.isFinite(Number(viewportSource[key])))
      ? {
          south: Number(viewportSource.south), west: Number(viewportSource.west),
          north: Number(viewportSource.north), east: Number(viewportSource.east)
        }
      : null;
    return {
      id: String(source.id || `route-${distanceMeters}-${durationSeconds}`),
      label: String(source.label || 'ルート'),
      description: String(source.description || ''),
      distanceMeters,
      durationSeconds,
      legs: normalizeRouteLegs(source.legs),
      viewport,
      polyline,
      hasTolls: source.hasTolls === true,
      hasHighways: source.hasHighways === true,
      restrictionsPartiallyIgnored: source.restrictionsPartiallyIgnored === true,
      highwayDetection: String(source.highwayDetection || 'unknown'),
      tollPrice: source.tollPrice && typeof source.tollPrice === 'object' ? source.tollPrice : null,
      mainRoads: Array.isArray(source.mainRoads) ? source.mainRoads.map(String).filter(Boolean).slice(0, 5) : [],
      sourceKind: String(source.sourceKind || 'default'),
      isDefault: source.isDefault === true,
      isRecommended: source.isRecommended === true || source.isDefault === true,
      routeLabels: Array.isArray(source.routeLabels) ? source.routeLabels.map(String).filter(Boolean) : [],
      warnings: Array.isArray(source.warnings) ? source.warnings.map(String).filter(Boolean) : []
    };
  }

  /** @param {unknown} value @returns {SanpoRoutePlannerState} */
  function normalizeRoutePlannerState(value) {
    const base = createDefaultRoutePlannerState();
    const source = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
    const routes = Array.isArray(source.routes)
      ? source.routes.map(normalizeStoredRoute).filter(Boolean)
      : [];
    const selectedRouteIndex = Math.min(
      Math.max(0, Number(source.selectedRouteIndex) || 0),
      Math.max(0, routes.length - 1)
    );
    return {
      ...base,
      origin: normalizeRoutePlace(source.origin),
      waypoints: Array.isArray(source.waypoints) ? source.waypoints.map(normalizeRoutePlace).filter(Boolean) : [],
      destination: normalizeRoutePlace(source.destination),
      routes,
      selectedRouteIndex,
      avoidTolls: source.avoidTolls === true,
      avoidHighways: source.avoidHighways === true,
      avoidFerries: source.avoidFerries === true,
      targetCarId: String(source.targetCarId || ''),
      returnTo: source.returnTo === 'carSettlement' ? 'carSettlement' : 'settlementSummary',
      roundTrip: source.roundTrip === true,
      calculatedAt: Math.max(0, Number(source.calculatedAt) || 0)
    };
  }

  function getRoutePlannerState() {
    const state = typeof ensureSettlementState === 'function' ? ensureSettlementState() : null;
    if (!state) return createDefaultRoutePlannerState();
    state.routePlanner = normalizeRoutePlannerState(state.routePlanner);
    return state.routePlanner;
  }

  function setRoutePlannerState(nextState, options = {}) {
    const state = typeof ensureSettlementState === 'function' ? ensureSettlementState() : null;
    if (!state) return normalizeRoutePlannerState(nextState);
    state.routePlanner = normalizeRoutePlannerState(nextState);
    if (options.persist !== false) {
      if (options.remote === true && typeof save === 'function') save();
      else if (typeof saveLocalDraftOnly === 'function') saveLocalDraftOnly();
    }
    return state.routePlanner;
  }

  function patchRoutePlannerState(patch, options = {}) {
    return setRoutePlannerState({ ...getRoutePlannerState(), ...(patch || {}) }, options);
  }

  Object.assign(global, {
    createDefaultRoutePlannerState,
    normalizeRoutePlace,
    normalizeStoredRoute,
    normalizeRoutePlannerState,
    getRoutePlannerState,
    setRoutePlannerState,
    patchRoutePlannerState
  });
})(window);
