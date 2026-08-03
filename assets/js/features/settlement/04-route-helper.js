// Google Maps route planner integrated with settlement state and Carbon modals.
(function (global) {
  'use strict';

  const MAX_WAYPOINTS = 8;
  const JAPAN_BIAS = Object.freeze({ north: 45.75, south: 24.0, east: 153.99, west: 122.9 });
  const ROUTE_FIELDS = Object.freeze([
    'path',
    'legs',
    'distanceMeters',
    'durationMillis',
    'viewport',
    'description',
    'travelAdvisory',
    'routeLabels'
  ]);

  let googleLibrariesPromise = null;
  let googleLibraries = null;
  let map = null;
  let mapPolylines = [];
  let mapMarkers = [];
  let sequenceSortable = null;
  let placeAutocomplete = null;
  let activePlaceTarget = null;
  let routeRequestSequence = 0;
  let routeRequestTimer = null;
  let routeReturnSuppressed = false;
  let routeFeatureBound = false;

  const byIdSafe = id => document.getElementById(id);
  const templates = () => global.SanpoApp?.templates?.settlement || {};

  function normalizePlanner(raw) {
    return typeof global.normalizeRoutePlannerState === 'function'
      ? global.normalizeRoutePlannerState(raw || {})
      : raw || {};
  }

  function getPlannerState() {
    const settlement = global.ensureSettlementState?.();
    if (!settlement) return null;
    settlement.routePlanner = normalizePlanner(settlement.routePlanner || {});
    return settlement.routePlanner;
  }

  function commitPlanner({ shared = false } = {}) {
    if (shared) global.save?.();
    else global.saveLocalDraftOnly?.();
  }

  function allPlaces(planner = getPlannerState()) {
    if (!planner) return [];
    return [planner.origin, ...(planner.waypoints || []), planner.destination].filter(Boolean);
  }

  function placeName(place, fallback = '') {
    return String(place?.name || fallback || '').trim();
  }

  function toLatLngLiteral(place) {
    return { lat: Number(place.latitude), lng: Number(place.longitude) };
  }

  function parseStoredPath(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function latLngLiteral(value) {
    const source = value?.location || value;
    const lat = typeof source?.lat === 'function' ? source.lat() : Number(source?.lat ?? source?.latitude);
    const lng = typeof source?.lng === 'function' ? source.lng() : Number(source?.lng ?? source?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function viewportLiteral(value) {
    if (!value) return null;
    if (typeof value.toJSON === 'function') return value.toJSON();
    const north = typeof value.getNorthEast === 'function' ? value.getNorthEast().lat() : Number(value.north);
    const east = typeof value.getNorthEast === 'function' ? value.getNorthEast().lng() : Number(value.east);
    const south = typeof value.getSouthWest === 'function' ? value.getSouthWest().lat() : Number(value.south);
    const west = typeof value.getSouthWest === 'function' ? value.getSouthWest().lng() : Number(value.west);
    return [north, south, east, west].every(Number.isFinite) ? { north, south, east, west } : null;
  }

  function formatTollPrice(route) {
    const prices = route?.travelAdvisory?.tollInfo?.estimatedPrice;
    if (!Array.isArray(prices) || !prices.length) return '';
    const money = prices[0] || {};
    const units = Number(money.units || 0);
    const nanos = Number(money.nanos || 0) / 1e9;
    const value = units + nanos;
    if (!Number.isFinite(value)) return '';
    const currency = String(money.currencyCode || 'JPY');
    try {
      return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value);
    } catch (error) {
      return `${Math.round(value).toLocaleString('ja-JP')} ${currency}`;
    }
  }

  function extractMainRoads(route) {
    const candidates = [];
    const description = String(route?.description || '').trim();
    if (description) {
      description.split(/\s*(?:、|,|\/|・|→|via)\s*/i).forEach(value => {
        const text = value.trim();
        if (text && !candidates.includes(text)) candidates.push(text);
      });
    }
    for (const leg of route?.legs || []) {
      for (const step of leg?.steps || []) {
        const instruction = String(step?.instructions || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const match = instruction.match(/(?:国道\s*\d+号|県道\s*\d+号|[^、。]{1,28}(?:高速道路|自動車道|街道|バイパス|線|通り|Road|Route|Expressway))/i);
        if (match?.[0] && !candidates.includes(match[0])) candidates.push(match[0]);
        if (candidates.length >= 5) break;
      }
      if (candidates.length >= 5) break;
    }
    return candidates.slice(0, 5);
  }

  function normalizeRouteResult(route, index, planner) {
    const sequence = allPlaces(planner);
    const path = Array.from(route?.path || []).map(latLngLiteral).filter(Boolean);
    const legs = Array.from(route?.legs || []).map((leg, legIndex) => ({
      distanceMeters: Math.max(0, Number(leg?.distanceMeters) || 0),
      durationSeconds: Math.max(0, Number(leg?.durationMillis) || 0) / 1000,
      start: latLngLiteral(leg?.startLocation),
      end: latLngLiteral(leg?.endLocation),
      fromName: placeName(sequence[legIndex], `地点${legIndex + 1}`),
      toName: placeName(sequence[legIndex + 1], `地点${legIndex + 2}`)
    }));
    const distanceMeters = Math.max(0, Number(route?.distanceMeters) || legs.reduce((sum, leg) => sum + leg.distanceMeters, 0));
    const durationSeconds = Math.max(0, Number(route?.durationMillis) || legs.reduce((sum, leg) => sum + leg.durationSeconds * 1000, 0)) / 1000;
    const tollPrice = formatTollPrice(route);
    const mainRoads = extractMainRoads(route);
    const highwayText = [route?.description, ...mainRoads].filter(Boolean).join(' ');
    const hasTolls = Boolean(route?.travelAdvisory?.tollInfo || tollPrice);
    const hasHighways = /(高速道路|自動車道|Expressway|Motorway|高速|E\d{1,3})/i.test(highwayText);
    const labels = Array.from(route?.routeLabels || []).map(String);
    return {
      id: String(route?.routeToken || `route-${index}-${Math.round(distanceMeters)}-${Math.round(durationSeconds)}`),
      label: labels.some(label => /DEFAULT_ROUTE|DEFAULT/i.test(label)) || index === 0 ? 'おすすめ' : `別ルート ${index}`,
      distanceMeters,
      durationSeconds,
      legs,
      viewport: viewportLiteral(route?.viewport),
      polyline: JSON.stringify(path),
      hasTolls,
      hasHighways,
      tollPrice,
      mainRoads
    };
  }

  function setNotice({ title = '', message = '', kind = 'info', retry = false } = {}) {
    const notice = byIdSafe('routePlannerNotice');
    const retryWrap = byIdSafe('routePlannerRetry');
    if (notice) {
      notice.hidden = !(title || message);
      notice.kind = kind;
      notice.setAttribute('kind', kind);
      notice.title = title;
      notice.subtitle = message;
      notice.setAttribute('title', title);
      notice.setAttribute('subtitle', message);
    }
    if (retryWrap) retryWrap.hidden = !retry;
  }

  function setLoading(active) {
    const loading = byIdSafe('routePlannerLoading');
    if (loading) loading.hidden = !active;
  }

  function classifyRouteError(error) {
    const base = global.SanpoGoogleMaps?.classifyError?.(error);
    if (base) return base;
    const text = String(error?.message || error || '');
    if (/ZERO_RESULTS|NOT_FOUND|route/i.test(text)) return { title: 'ルートが見つかりません', message: '地点や回避設定を変更してください。', kind: 'warning' };
    return { title: 'ルート候補を取得できませんでした', message: text || '時間をおいて再試行してください。', kind: 'error' };
  }

  async function ensureGoogleLibraries({ force = false } = {}) {
    if (force) {
      googleLibrariesPromise = null;
      googleLibraries = null;
    }
    if (googleLibraries) return googleLibraries;
    if (!googleLibrariesPromise) {
      googleLibrariesPromise = global.SanpoGoogleMaps.importLibraries(['maps', 'places', 'routes', 'marker'])
        .then(result => {
          googleLibraries = result;
          return result;
        })
        .catch(error => {
          googleLibrariesPromise = null;
          throw error;
        });
    }
    return googleLibrariesPromise;
  }

  function renderSequence() {
    const list = byIdSafe('routeSequenceList');
    const planner = getPlannerState();
    if (!list || !planner) return;
    const rows = [];
    let index = 0;
    rows.push(templates().routePlaceRow?.({ place: planner.origin, index, role: 'origin', removable: Boolean(planner.origin), draggable: Boolean(planner.origin) }, { escapeHtml: global.escapeHtml }) || '');
    index += 1;
    (planner.waypoints || []).forEach(place => {
      rows.push(templates().routePlaceRow?.({ place, index, role: 'waypoint', removable: true, draggable: true }, { escapeHtml: global.escapeHtml }) || '');
      index += 1;
    });
    rows.push(templates().routePlaceRow?.({ place: planner.destination, index, role: 'destination', removable: Boolean(planner.destination), draggable: Boolean(planner.destination) }, { escapeHtml: global.escapeHtml }) || '');
    index += 1;
    if ((planner.waypoints || []).length < MAX_WAYPOINTS) {
      rows.push(templates().routeAddWaypointRow?.(index) || '');
    }
    list.innerHTML = rows.join('');
    global.SanpoCarbon?.renderCarbonIcons?.(list);
    setupSequenceSortable();
  }

  function renderHistory() {
    const list = byIdSafe('routePlaceHistoryList');
    const planner = getPlannerState();
    if (!list || !planner) return;
    const history = Array.isArray(planner.history) ? planner.history : [];
    list.innerHTML = history.length
      ? history.map(place => templates().routeHistoryItem?.(place, { escapeHtml: global.escapeHtml }) || '').join('')
      : '<div class="route-place-candidates-empty">共有された候補はまだありません。</div>';
    global.SanpoCarbon?.renderCarbonIcons?.(list);
  }

  function selectedRoute(planner = getPlannerState()) {
    if (!planner?.routes?.length) return null;
    return planner.routes[Math.min(Math.max(0, Number(planner.selectedRouteIndex) || 0), planner.routes.length - 1)] || null;
  }

  function renderRouteResults() {
    const planner = getPlannerState();
    const list = byIdSafe('routeCandidateList');
    const summary = byIdSafe('routeLegSummary');
    const calculated = byIdSafe('routePlannerCalculatedAt');
    if (!planner || !list || !summary) return;
    list.innerHTML = (planner.routes || []).map((route, index) => templates().routeCandidateCard?.(route, index, index === planner.selectedRouteIndex, { escapeHtml: global.escapeHtml }) || '').join('');
    const route = selectedRoute(planner);
    summary.innerHTML = route ? (templates().routeLegSummary?.({
      legs: route.legs,
      totalDistanceMeters: route.distanceMeters,
      totalDurationSeconds: route.durationSeconds,
      roundTrip: planner.roundTrip
    }, { escapeHtml: global.escapeHtml }) || '') : '';
    if (calculated) calculated.textContent = planner.calculatedAt ? new Date(planner.calculatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    global.SanpoCarbon?.renderCarbonIcons?.(list);
    updateApplyButton();
  }

  function syncOptionControls() {
    const planner = getPlannerState();
    if (!planner) return;
    const pairs = [
      ['routeAvoidTolls', planner.avoidTolls],
      ['routeAvoidHighways', planner.avoidHighways],
      ['routeAvoidFerries', planner.avoidFerries],
      ['routeRoundTrip', planner.roundTrip]
    ];
    pairs.forEach(([id, checked]) => {
      const control = byIdSafe(id);
      if (!control) return;
      control.checked = Boolean(checked);
      control.toggleAttribute('checked', Boolean(checked));
    });
  }

  function updateApplyButton() {
    const planner = getPlannerState();
    const button = byIdSafe('applyRouteDistanceBtn');
    if (!button || !planner) return;
    const enabled = Boolean(selectedRoute(planner) && planner.targetCarName);
    button.disabled = !enabled;
    button.toggleAttribute('disabled', !enabled);
  }

  function clearMapObjects() {
    mapPolylines.forEach(polyline => polyline?.setMap?.(null));
    mapMarkers.forEach(marker => {
      if ('map' in marker) marker.map = null;
      marker?.setMap?.(null);
    });
    mapPolylines = [];
    mapMarkers = [];
  }

  function mapThemeOptions() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const mapId = String(global.SanpoGoogleMaps?.getConfig?.().mapId || '').trim();
    const options = {
      center: { lat: 36.2, lng: 138.2 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy'
    };
    if (mapId) options.mapId = mapId;
    if (global.google?.maps?.ColorScheme) options.colorScheme = dark ? global.google.maps.ColorScheme.DARK : global.google.maps.ColorScheme.LIGHT;
    return options;
  }

  async function ensureMap() {
    const container = byIdSafe('routeMap');
    if (!container) return null;
    const libs = await ensureGoogleLibraries();
    if (!map) map = new libs.maps.Map(container, mapThemeOptions());
    return map;
  }

  function createMapMarker(position, label) {
    if (!map || !position) return null;
    const AdvancedMarker = googleLibraries?.marker?.AdvancedMarkerElement;
    const mapId = String(global.SanpoGoogleMaps?.getConfig?.().mapId || '').trim();
    if (AdvancedMarker && mapId) {
      return new AdvancedMarker({ map, position, title: label });
    }
    const Marker = global.google?.maps?.Marker;
    return Marker ? new Marker({ map, position, label }) : null;
  }

  async function renderMap() {
    const empty = byIdSafe('routeMapEmpty');
    const skeleton = byIdSafe('routeMapSkeleton');
    try {
      await ensureMap();
      clearMapObjects();
      const planner = getPlannerState();
      const places = allPlaces(planner);
      const bounds = new googleLibraries.maps.LatLngBounds();
      places.forEach((place, index) => {
        const position = toLatLngLiteral(place);
        bounds.extend(position);
        const marker = createMapMarker(position, String.fromCharCode(65 + index));
        if (marker) mapMarkers.push(marker);
      });
      (planner?.routes || []).forEach((route, index) => {
        const path = parseStoredPath(route.polyline);
        if (!path.length) return;
        path.forEach(point => bounds.extend(point));
        const selected = index === planner.selectedRouteIndex;
        const polyline = new googleLibraries.maps.Polyline({
          map,
          path,
          clickable: true,
          strokeColor: selected ? '#0f62fe' : '#8d8d8d',
          strokeOpacity: selected ? 0.95 : 0.38,
          strokeWeight: selected ? 7 : 4,
          zIndex: selected ? 20 : 10
        });
        polyline.addListener?.('click', () => selectRoute(index));
        mapPolylines.push(polyline);
      });
      if (places.length) map.fitBounds(bounds, 48);
      if (empty) empty.hidden = places.length > 0;
      if (skeleton) skeleton.hidden = true;
    } catch (error) {
      if (skeleton) skeleton.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = '地図を読み込めませんでした。';
      }
      const info = classifyRouteError(error);
      setNotice({ title: info.title, message: info.message, kind: 'error', retry: true });
    }
  }

  function renderPlanner() {
    renderSequence();
    renderHistory();
    syncOptionControls();
    renderRouteResults();
    void renderMap();
  }

  function setupSequenceSortable() {
    const list = byIdSafe('routeSequenceList');
    if (!list || typeof global.Sortable === 'undefined') return;
    sequenceSortable?.destroy?.();
    sequenceSortable = new global.Sortable(list, {
      animation: 150,
      handle: '.route-sequence-drag',
      draggable: '.route-sequence-row[data-route-place-id]:not([data-route-place-id=""])',
      filter: '.route-sequence-row--add',
      ghostClass: 'route-sequence-ghost',
      chosenClass: 'route-sequence-chosen',
      dragClass: 'route-sequence-dragging',
      forceFallback: true,
      fallbackOnBody: true,
      onEnd: () => {
        const planner = getPlannerState();
        const ids = Array.from(list.querySelectorAll('.route-sequence-row[data-route-place-id]:not([data-route-place-id=""])')).map(row => row.dataset.routePlaceId);
        const lookup = new Map(allPlaces(planner).map(place => [place.placeId, place]));
        const ordered = ids.map(id => lookup.get(id)).filter(Boolean);
        if (ordered.length >= 2) {
          planner.origin = ordered[0];
          planner.destination = ordered[ordered.length - 1];
          planner.waypoints = ordered.slice(1, -1);
          invalidateRoutes(planner);
          commitPlanner({ shared: true });
          renderPlanner();
          scheduleRouteRequest();
        } else renderSequence();
      }
    });
  }

  function invalidateRoutes(planner = getPlannerState()) {
    if (!planner) return;
    planner.routes = [];
    planner.selectedRouteIndex = 0;
    planner.calculatedAt = 0;
    routeRequestSequence += 1;
    renderRouteResults();
  }

  function recordHistory(place) {
    const planner = getPlannerState();
    if (!planner || !place?.placeId) return;
    planner.history = [place, ...(planner.history || []).filter(item => item.placeId !== place.placeId)].slice(0, 24);
  }

  function applyPlaceSelection(place) {
    const planner = getPlannerState();
    const target = activePlaceTarget;
    if (!planner || !target || !place) return;
    if (target.role === 'origin') planner.origin = place;
    else if (target.role === 'destination') planner.destination = place;
    else if (target.role === 'waypoint') planner.waypoints[target.index] = place;
    else if (target.role === 'new-waypoint' && planner.waypoints.length < MAX_WAYPOINTS) planner.waypoints.splice(target.index, 0, place);
    recordHistory(place);
    invalidateRoutes(planner);
    commitPlanner({ shared: true });
    closePlacePicker();
    renderPlanner();
    scheduleRouteRequest(40);
  }

  function normalizeGooglePlace(place) {
    const location = latLngLiteral(place?.location);
    const placeId = String(place?.id || place?.placeId || '').trim();
    const displayName = typeof place?.displayName === 'string' ? place.displayName : String(place?.displayName?.text || '');
    const name = displayName.trim() || String(place?.formattedAddress || '').trim();
    if (!placeId || !name || !location) return null;
    return {
      placeId,
      name,
      address: String(place?.formattedAddress || '').trim(),
      latitude: location.lat,
      longitude: location.lng
    };
  }

  function syncPlacePickerViewport() {
    const modal = byIdSafe('routePlacePickerModal');
    if (!modal) return;
    const viewport = global.visualViewport;
    modal.style.setProperty('--route-visual-top', `${viewport?.offsetTop || 0}px`);
    modal.style.setProperty('--route-visual-height', `${viewport?.height || global.innerHeight}px`);
  }

  function readPlaceSearchQuery() {
    if (!placeAutocomplete) return '';
    const inner = placeAutocomplete.shadowRoot?.querySelector('input');
    return String(inner?.value ?? placeAutocomplete.value ?? '').trim();
  }

  function syncHistoryVisibility() {
    const panel = byIdSafe('routePlaceCandidates');
    if (panel) panel.hidden = Boolean(readPlaceSearchQuery());
  }

  function bindPlaceInputBridge() {
    const bind = () => {
      const input = placeAutocomplete?.shadowRoot?.querySelector('input');
      if (!input || input.dataset.sanpoRouteBound === 'true') return;
      input.dataset.sanpoRouteBound = 'true';
      input.addEventListener('input', syncHistoryVisibility);
      input.addEventListener('focus', () => {
        syncPlacePickerViewport();
        byIdSafe('routePlacePickerModal')?.scrollIntoView?.({ block: 'start' });
      });
    };
    Promise.resolve(placeAutocomplete?.updateComplete).then(() => requestAnimationFrame(() => requestAnimationFrame(bind)));
  }

  async function createPlaceAutocomplete() {
    const host = byIdSafe('routePlaceSearchHost');
    if (!host || !activePlaceTarget) return;
    host.innerHTML = '';
    const libs = await ensureGoogleLibraries();
    const Widget = libs.places.PlaceAutocompleteElement;
    placeAutocomplete = new Widget();
    const roleLabel = activePlaceTarget.role === 'origin' ? '出発地' : activePlaceTarget.role === 'destination' ? '目的地' : '経由地';
    placeAutocomplete.placeholder = `${roleLabel}を検索`;
    placeAutocomplete.locationBias = JAPAN_BIAS;
    placeAutocomplete.requestedLanguage = 'ja';
    placeAutocomplete.requestedRegion = 'jp';
    placeAutocomplete.setAttribute('aria-label', `${roleLabel}を検索`);
    const selectPlace = async event => {
      const prediction = event.placePrediction || event.detail?.placePrediction;
      const place = prediction?.toPlace ? prediction.toPlace() : event.place || event.detail?.place;
      if (!place) return;
      try {
        await place.fetchFields?.({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
        const normalized = normalizeGooglePlace(place);
        if (!normalized) throw new Error('選択した地点の位置情報を取得できませんでした。');
        applyPlaceSelection(normalized);
      } catch (error) {
        const info = classifyRouteError(error);
        setPlacePickerMessage(info.message || info.title, true);
      }
    };
    placeAutocomplete.addEventListener('gmp-select', selectPlace);
    placeAutocomplete.addEventListener('gmp-placeselect', selectPlace);
    placeAutocomplete.addEventListener('input', syncHistoryVisibility);
    host.appendChild(placeAutocomplete);
    bindPlaceInputBridge();
    requestAnimationFrame(() => {
      placeAutocomplete?.focus?.({ preventScroll: true });
      placeAutocomplete?.shadowRoot?.querySelector('input')?.focus?.({ preventScroll: true });
    });
  }

  function setPlacePickerMessage(message = '', isError = false) {
    const messageEl = byIdSafe('routePlacePickerMessage');
    if (!messageEl) return;
    messageEl.hidden = !message;
    messageEl.kind = isError ? 'error' : 'info';
    messageEl.setAttribute('kind', messageEl.kind);
    messageEl.title = isError ? '場所を選択できませんでした' : '候補';
    messageEl.subtitle = message;
    messageEl.setAttribute('title', messageEl.title);
    messageEl.setAttribute('subtitle', message);
  }

  function openPlacePicker(target) {
    activePlaceTarget = target;
    renderHistory();
    setPlacePickerMessage('');
    const title = byIdSafe('routePlacePickerTitle');
    const roleLabel = target.role === 'origin' ? '出発地' : target.role === 'destination' ? '目的地' : '経由地';
    if (title) title.textContent = `${roleLabel}を選択`;
    syncPlacePickerViewport();
    modals.routePlacePicker?.show();
    void createPlaceAutocomplete().catch(error => {
      const info = classifyRouteError(error);
      setPlacePickerMessage(info.message || info.title, true);
    });
  }

  function closePlacePicker() {
    modals.routePlacePicker?.hide();
    placeAutocomplete = null;
    activePlaceTarget = null;
  }

  function clearPlace(row) {
    const planner = getPlannerState();
    if (!planner || !row) return;
    const role = row.dataset.routeRole;
    const index = Number(row.dataset.routeIndex);
    if (role === 'origin') planner.origin = null;
    else if (role === 'destination') planner.destination = null;
    else if (role === 'waypoint' && Number.isInteger(index)) {
      const waypointIndex = index - 1;
      if (waypointIndex >= 0) planner.waypoints.splice(waypointIndex, 1);
    }
    invalidateRoutes(planner);
    commitPlanner({ shared: true });
    renderPlanner();
  }

  function selectRoute(index) {
    const planner = getPlannerState();
    if (!planner?.routes?.[index]) return;
    planner.selectedRouteIndex = index;
    commitPlanner();
    renderRouteResults();
    void renderMap();
  }

  function createRouteRequest(planner) {
    const routesLibrary = googleLibraries?.routes || {};
    const request = {
      origin: toLatLngLiteral(planner.origin),
      destination: toLatLngLiteral(planner.destination),
      intermediates: (planner.waypoints || []).map(place => ({ location: toLatLngLiteral(place) })),
      travelMode: routesLibrary.RouteTravelMode?.DRIVING || 'DRIVING',
      routingPreference: routesLibrary.RoutingPreference?.TRAFFIC_AWARE_OPTIMAL || 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: !(planner.waypoints || []).length,
      routeModifiers: {
        avoidTolls: Boolean(planner.avoidTolls),
        avoidHighways: Boolean(planner.avoidHighways),
        avoidFerries: Boolean(planner.avoidFerries)
      },
      polylineQuality: routesLibrary.PolylineQuality?.HIGH_QUALITY || 'HIGH_QUALITY',
      fields: ROUTE_FIELDS
    };
    const tolls = routesLibrary.ComputeRoutesExtraComputation?.TOLLS || 'TOLLS';
    request.extraComputations = [tolls];
    // Intentionally omit ComputeRoutesRequest.units. Google infers display units
    // from the origin, while distanceMeters remains meters in every locale.
    return request;
  }

  async function requestRoutes({ force = false } = {}) {
    const planner = getPlannerState();
    if (!planner) return;
    if (!planner.origin || !planner.destination) {
      invalidateRoutes(planner);
      setNotice({});
      setLoading(false);
      void renderMap();
      return;
    }
    const requestId = ++routeRequestSequence;
    setLoading(true);
    setNotice({});
    try {
      const libs = await ensureGoogleLibraries({ force });
      const request = createRouteRequest(planner);
      const result = await libs.routes.Route.computeRoutes(request);
      if (requestId !== routeRequestSequence) return;
      const rawRoutes = Array.isArray(result) ? result : Array.from(result?.routes || []);
      if (!rawRoutes.length) throw new Error('ZERO_RESULTS');
      planner.routes = rawRoutes.map((route, index) => normalizeRouteResult(route, index, planner)).filter(route => route.distanceMeters > 0);
      if (!planner.routes.length) throw new Error('ZERO_RESULTS');
      planner.selectedRouteIndex = 0;
      planner.calculatedAt = Date.now();
      commitPlanner();
      renderRouteResults();
      await renderMap();
    } catch (error) {
      if (requestId !== routeRequestSequence) return;
      planner.routes = [];
      planner.selectedRouteIndex = 0;
      planner.calculatedAt = 0;
      renderRouteResults();
      const info = classifyRouteError(error);
      setNotice({ title: info.title, message: info.message, kind: info.kind === 'warning' ? 'warning' : 'error', retry: true });
    } finally {
      if (requestId === routeRequestSequence) setLoading(false);
    }
  }

  function scheduleRouteRequest(delay = 180) {
    clearTimeout(routeRequestTimer);
    routeRequestTimer = setTimeout(() => void requestRoutes(), delay);
  }

  function readCheckbox(id) {
    return Boolean(byIdSafe(id)?.checked);
  }

  function onRouteOptionChanged(event) {
    const target = event.currentTarget || event.target;
    if (!target?.id) return;
    const planner = getPlannerState();
    if (!planner) return;
    if (target.id === 'routeAvoidTolls') planner.avoidTolls = readCheckbox(target.id);
    else if (target.id === 'routeAvoidHighways') planner.avoidHighways = readCheckbox(target.id);
    else if (target.id === 'routeAvoidFerries') planner.avoidFerries = readCheckbox(target.id);
    else if (target.id === 'routeRoundTrip') {
      planner.roundTrip = readCheckbox(target.id);
      commitPlanner();
      renderRouteResults();
      return;
    }
    invalidateRoutes(planner);
    commitPlanner({ shared: true });
    scheduleRouteRequest();
  }

  function applySelectedDistance() {
    const planner = getPlannerState();
    const route = selectedRoute(planner);
    const targetName = String(planner?.targetCarName || '').trim();
    if (!planner || !route || !targetName) return;
    const meters = route.distanceMeters * (planner.roundTrip ? 2 : 1);
    const km = Number((meters / 1000).toFixed(1)).toString();
    const settlement = global.ensureSettlementState?.();
    if (!settlement) return;
    settlement.cars[targetName] = { ...(settlement.cars[targetName] || {}), dist: km };
    global.save?.();
    global.renderSettlementView?.({ force: true });
    modals.routeDistance?.hide();
  }

  function reopenTargetCarAfterRouteClose() {
    if (routeReturnSuppressed) return;
    const planner = getPlannerState();
    const name = String(planner?.targetCarName || '').trim();
    const shouldReturn = planner?.returnTo === 'carSettlement' && name;
    if (!shouldReturn) return;
    planner.returnTo = '';
    commitPlanner();
    requestAnimationFrame(() => global.openSettlementCarEditor?.(encodeURIComponent(name)));
  }

  function showRoutePlanner({ targetCarName = '' } = {}) {
    const planner = getPlannerState();
    if (!planner) return;
    if (targetCarName) {
      planner.targetCarId = targetCarName;
      planner.targetCarName = targetCarName;
      planner.returnTo = 'carSettlement';
    } else {
      planner.targetCarId = '';
      planner.targetCarName = '';
      planner.returnTo = '';
    }
    commitPlanner();
    renderPlanner();
    setNotice({});
    modals.routeDistance?.show();
    void ensureGoogleLibraries().then(() => {
      void renderMap();
      if (planner.origin && planner.destination && !planner.routes.length) scheduleRouteRequest(40);
    }).catch(error => {
      const info = classifyRouteError(error);
      setNotice({ title: info.title, message: info.message, kind: 'error', retry: true });
    });
  }

  function openRouteDistanceHelperFromShortcut(targetCarName = '') {
    const rowName = String(targetCarName || '').trim();
    global.saveSettlementCarEditDraft?.();
    const carModal = byIdSafe('settlementCarEditModal');
    const launch = () => showRoutePlanner({ targetCarName: rowName });
    if (carModal?.open) {
      let launched = false;
      const once = () => {
        if (launched) return;
        launched = true;
        launch();
      };
      carModal.addEventListener('sanpo:modal-hidden', once, { once: true });
      modals.settlementCarEdit?.hide();
      setTimeout(() => { if (!carModal.open) once(); }, 320);
    } else launch();
  }

  function handleSequenceClick(event) {
    const path = event.composedPath?.() || [];
    const find = selector => path.find(node => node instanceof Element && node.matches?.(selector));
    const history = find('[data-route-history-place-id]');
    if (history) {
      const planner = getPlannerState();
      const place = planner?.history?.find(item => item.placeId === history.dataset.routeHistoryPlaceId);
      if (place) applyPlaceSelection(place);
      return;
    }
    const routeCard = find('.route-candidate-card[data-route-index]');
    if (routeCard) {
      selectRoute(Number(routeCard.dataset.routeIndex));
      return;
    }
    const clear = find('[data-route-clear-place]');
    if (clear) {
      clearPlace(clear.closest('[data-route-sequence-row]'));
      return;
    }
    const add = find('[data-route-add-waypoint]') || find('[data-route-add-row]');
    if (add) {
      const planner = getPlannerState();
      openPlacePicker({ role: 'new-waypoint', index: planner?.waypoints?.length || 0 });
      return;
    }
    const edit = find('[data-route-edit-place]');
    if (edit) {
      const row = edit.closest('[data-route-sequence-row]');
      const role = row?.dataset.routeRole || '';
      const sequenceIndex = Number(row?.dataset.routeIndex);
      const waypointIndex = role === 'waypoint' ? sequenceIndex - 1 : -1;
      openPlacePicker({ role, index: waypointIndex });
    }
  }

  function bindRouteFeature() {
    if (routeFeatureBound) return;
    routeFeatureBound = true;
    const sequenceList = byIdSafe('routeSequenceList');
    sequenceList?.addEventListener('click', handleSequenceClick);
    if (sequenceList) sequenceList.dataset.routeFeatureBound = 'true';
    byIdSafe('routeCandidateList')?.addEventListener('click', handleSequenceClick);
    byIdSafe('routePlaceHistoryList')?.addEventListener('click', handleSequenceClick);
    byIdSafe('routePlannerRetryBtn')?.addEventListener('click', () => void requestRoutes({ force: true }));
    byIdSafe('routePlannerCancelBtn')?.addEventListener('click', () => modals.routeDistance?.hide());
    byIdSafe('applyRouteDistanceBtn')?.addEventListener('click', applySelectedDistance);
    ['routeAvoidTolls', 'routeAvoidHighways', 'routeAvoidFerries', 'routeRoundTrip'].forEach(id => {
      const control = byIdSafe(id);
      control?.addEventListener('change', onRouteOptionChanged);
      control?.addEventListener('cds-checkbox-changed', onRouteOptionChanged);
    });
    byIdSafe('routeDistanceModal')?.addEventListener('sanpo:modal-hidden', reopenTargetCarAfterRouteClose);
    byIdSafe('routePlacePickerModal')?.addEventListener('sanpo:modal-hidden', () => {
      placeAutocomplete = null;
      activePlaceTarget = null;
    });
    global.visualViewport?.addEventListener('resize', syncPlacePickerViewport);
    global.visualViewport?.addEventListener('scroll', syncPlacePickerViewport);
    global.addEventListener('resize', syncPlacePickerViewport);
  }

  global.openRouteDistanceHelper = () => showRoutePlanner({});
  global.openRouteDistanceHelperFromShortcut = openRouteDistanceHelperFromShortcut;
  global.selectGoogleRoute = selectRoute;
  global.removeRouteWaypoint = index => {
    const planner = getPlannerState();
    if (!planner || !Number.isInteger(Number(index))) return;
    planner.waypoints.splice(Number(index), 1);
    invalidateRoutes(planner);
    commitPlanner({ shared: true });
    renderPlanner();
    scheduleRouteRequest();
  };

  // This script is loaded after the route modal markup. Bind immediately so
  // iOS Safari cannot miss the delegated tap handlers while module scripts are
  // still delaying DOMContentLoaded.
  bindRouteFeature();
})(window);
