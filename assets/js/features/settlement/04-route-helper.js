// Google Maps / Places (New) / Routes integration for per-car settlement distance.
(function (global) {
    'use strict';

    const templates = () => global.SanpoApp?.templates?.settlement || {};
    const ROUTE_FIELDS = [
        'description',
        'distanceMeters',
        'durationMillis',
        'legs',
        'localizedValues',
        'path',
        'routeLabels',
        'routeToken',
        'travelAdvisory',
        'viewport',
        'warnings'
    ];
    const MAX_WAYPOINTS = 25;
    const MAX_SEGMENT_ROUTES = 3;
    const MAX_PARTIAL_COMBINATIONS = 9;
    const MAX_FINAL_ROUTES = 3;
    const SEGMENT_CACHE_TTL = 5 * 60 * 1000;
    const LOCAL_PLANNER_KEY_PREFIX = 'sanpo.routePlannerState.v2';
    const JAPAN_SEARCH_BIAS = Object.freeze({ north: 45.8, south: 20.0, east: 154.0, west: 122.0 });
    const HIGHWAY_PATTERN = /(高速|自動車道|expressway|motorway|highway|\bE\d{1,3}\b|\bC\d{1,3}\b|JCT|IC)/i;
    const DARK_MAP_STYLES = [
        { elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1f1f1f' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#c6c6c6' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#525252' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#262626' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#393939' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#161616' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#c6c6c6' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#525252' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#262626' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f3b57' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#78a9ff' }] }
    ];

    /** @type {any} */
    const runtime = {
        maps: null,
        places: null,
        routes: null,
        geometry: null,
        marker: null,
        map: null,
        polylines: [],
        markers: [],
        routePaths: new Map(),
        placeSearchWidget: null,
        activePlaceSearch: null,
        placeHistoryEntries: [],
        placeSearchSessionToken: null,
        placeSearchTimer: null,
        placeSearchSequence: 0,
        waypointRows: [],
        stopSortable: null,
        requestSequence: 0,
        selectionSequence: new Map(),
        initializing: null,
        historyActive: false,
        historyClosing: false,
        suppressPopstate: false,
        returnAfterClose: false,
        applyInProgress: false,
        themeObserver: null,
        routeRequestTimer: null,
        segmentRouteCache: new Map(),
        localPlannerState: null,
        openingPromise: null,
        routeSettingsOpen: false
    };

    function localPlannerStorageKey() {
        const id = typeof roomId !== 'undefined' && roomId ? String(roomId) : 'local';
        return `${LOCAL_PLANNER_KEY_PREFIX}:${id}`;
    }

    function readLocalPlannerState() {
        try {
            return normalizeRoutePlannerState(JSON.parse(localStorage.getItem(localPlannerStorageKey()) || '{}'));
        } catch (error) {
            return normalizeRoutePlannerState({});
        }
    }

    function plannerState() {
        if (!runtime.localPlannerState) runtime.localPlannerState = readLocalPlannerState();
        runtime.localPlannerState = normalizeRoutePlannerState(runtime.localPlannerState);
        return runtime.localPlannerState;
    }

    function createWaypointId() {
        if (global.crypto?.randomUUID) return global.crypto.randomUUID();
        return `waypoint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function getTargetCarId(name = '') {
        const planId = typeof activeCarPlanId !== 'undefined' ? activeCarPlanId : 'plan-1';
        return `${String(planId || 'plan-1')}:${encodeURIComponent(String(name || ''))}`;
    }

    function getSelectedRoute(state = plannerState()) {
        return state.routes[0] || state.routes[state.selectedRouteIndex] || null;
    }

    function getOrderedPlaces(state = plannerState()) {
        return [state.origin, ...state.waypoints, state.destination].filter(Boolean);
    }

    function persistPlannerState() {
        const current = plannerState();
        current.waypoints = runtime.waypointRows.map(row => row.place).filter(Boolean);
        runtime.localPlannerState = normalizeRoutePlannerState(current);
        try { localStorage.setItem(localPlannerStorageKey(), JSON.stringify(runtime.localPlannerState)); } catch (error) {}
        return runtime.localPlannerState;
    }

    function setRetryVisible(visible) {
        const retry = byId('routePlannerRetry');
        if (retry) retry.hidden = !visible;
    }

    function setNotice(kind = 'info', title = '', subtitle = '', options = {}) {
        const notice = byId('routePlannerNotice');
        if (!notice) return;
        setRetryVisible(options.retryable === true);
        if (!title && !subtitle) {
            notice.hidden = true;
            return;
        }
        notice.hidden = false;
        notice.kind = kind;
        notice.setAttribute('kind', kind);
        notice.title = title;
        notice.setAttribute('title', title);
        notice.subtitle = subtitle;
        notice.setAttribute('subtitle', subtitle);
    }

    function setLoading(loading, description = 'ルート候補を取得しています') {
        const container = byId('routePlannerLoading');
        const control = container?.querySelector('cds-inline-loading');
        if (container) container.hidden = !loading;
        if (control) {
            control.status = loading ? 'active' : 'finished';
            control.setAttribute('status', loading ? 'active' : 'finished');
            control.description = description;
            control.setAttribute('description', description);
        }
        const apply = byId('applyRouteDistanceBtn');
        if (apply) apply.disabled = loading || !getSelectedRoute();
    }

    function setMapSkeleton(visible) {
        const skeleton = byId('routeMapSkeleton');
        if (skeleton) skeleton.hidden = !visible;
    }

    function setMapEmpty(message = '') {
        const empty = byId('routeMapEmpty');
        if (!empty) return;
        empty.hidden = !message;
        empty.textContent = message;
    }


    function readSemanticToken(tokenName, fallback = '') {
        const token = String(tokenName || '').trim();
        if (!token) return fallback;
        try {
            const value = global.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function googleErrorText(error) {
        return [error?.code, error?.status, error?.name, error?.message, error].filter(Boolean).map(String).join(' ');
    }

    function classifyGoogleError(error) {
        const message = googleErrorText(error);
        if (/UNAUTHENTICATED|PERMISSION_DENIED|referer|referrer|api key|denied|permission|forbidden|403/i.test(message)) {
            return { kind: 'error', title: 'Google APIの利用が拒否されました', subtitle: 'HTTPリファラー制限、API制限、請求先設定を確認してください。' };
        }
        if (/RESOURCE_EXHAUSTED|quota|429|limit/i.test(message)) {
            return { kind: 'error', title: 'Google APIの利用上限に達しました', subtitle: 'しばらく待ってから再度お試しください。' };
        }
        if (/UNAVAILABLE|DEADLINE_EXCEEDED|network|fetch|load|timeout|offline/i.test(message)) {
            return { kind: 'error', title: '通信に失敗しました', subtitle: 'ネットワーク接続を確認して、もう一度お試しください。' };
        }
        if (/ZERO_RESULTS|zero|no route|not found/i.test(message)) {
            return { kind: 'warning', title: 'ルートが見つかりません', subtitle: '地点または回避設定を変更してください。' };
        }
        return { kind: 'error', title: 'ルート候補を取得できませんでした', subtitle: String(error?.message || '') || '時間をおいてもう一度お試しください。' };
    }

    function canRetryWithoutTolls(error) {
        return /INVALID_ARGUMENT|UNIMPLEMENTED|unsupported|not supported|extraComputations|TOLLS/i.test(googleErrorText(error));
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

    function stripHtml(value = '') {
        const node = document.createElement('div');
        node.innerHTML = String(value || '');
        return String(node.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function extractRoadNames(route) {
        const names = [];
        const push = value => {
            const text = stripHtml(value).replace(/^(?:そのまま|右折して|左折して|斜め[右左]方向に|ロータリーを).*?/, '').trim();
            if (!text) return;
            const lowered = text.toLowerCase();
            if (names.some(item => {
                const existing = item.toLowerCase();
                return existing === lowered || existing.includes(lowered) || lowered.includes(existing);
            })) return;
            names.push(text);
        };
        const extract = value => {
            const text = stripHtml(value);
            if (!text) return;
            const chunks = text.split(/[・、,／/]/).map(item => item.trim()).filter(Boolean);
            chunks.forEach(chunk => {
                const matches = chunk.match(/(?:国道|県道|都道|府道|道道)\s*\d+号(?:線)?|[^。()（）]{1,28}(?:自動車道|高速道路|バイパス|街道)|\b[EC]\d{1,3}[A-Z]?\b/gi);
                if (matches?.length) matches.forEach(push);
                else if (chunk.length <= 36) push(chunk);
            });
        };
        extract(route.description);
        (route.legs || []).forEach(leg => {
            (leg.steps || []).forEach(step => extract(step.navigationInstruction?.instructions || step.instructions));
        });
        return names.slice(0, 4);
    }

    function formatMoney(money = {}) {
        const currency = String(money.currencyCode || money.currency || 'JPY');
        const units = Number(money.units || 0);
        const nanos = Number(money.nanos || 0);
        const amount = units + nanos / 1e9;
        if (!Number.isFinite(amount) || amount <= 0) return '';
        try {
            return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount);
        } catch (error) {
            return `${Math.round(amount).toLocaleString()} ${currency}`;
        }
    }

    function inferHighway(route, roads) {
        if (HIGHWAY_PATTERN.test(String(route.description || ''))) return true;
        if (roads.some(name => HIGHWAY_PATTERN.test(name))) return true;
        return (route.legs || []).some(leg => (leg.steps || []).some(step => HIGHWAY_PATTERN.test(stripHtml(step.navigationInstruction?.instructions || step.instructions || ''))));
    }

    function routeLabel(route, index, hasHighways) {
        const labels = Array.from(route.routeLabels || []).map(String);
        if (labels.includes('DEFAULT_ROUTE') || (!labels.length && index === 0)) return 'おすすめ';
        if (labels.includes('FUEL_EFFICIENT')) return '燃費重視';
        if (!hasHighways) return '一般道中心';
        return `別ルート ${index}`;
    }

    function defaultRouteIndex(routes = []) {
        const index = routes.findIndex(route => Array.from(route.routeLabels || []).map(String).includes('DEFAULT_ROUTE'));
        return index >= 0 ? index : 0;
    }

    function serializeRouteData(route, index, places, idPrefix = 'route') {
        const normalizedPath = Array.from(route.path || []).map(normalizeLatLng).filter(Boolean);
        const path = normalizedPath.map(point => ({ lat: point.latitude, lng: point.longitude }));
        let polyline = '';
        try { polyline = runtime.geometry?.encoding?.encodePath?.(path) || ''; } catch (error) {}
        const roads = extractRoadNames(route);
        const routeTollInfo = route.travelAdvisory?.tollInfo || null;
        const legTollInfos = (route.legs || []).map(leg => leg.travelAdvisory?.tollInfo).filter(Boolean);
        const tollPrices = routeTollInfo?.estimatedPrices?.length
            ? Array.from(routeTollInfo.estimatedPrices)
            : legTollInfos.flatMap(info => Array.from(info.estimatedPrices || []));
        const hasTolls = Boolean(routeTollInfo) || legTollInfos.length > 0;
        const hasHighways = inferHighway(route, roads);
        const legs = Array.from(route.legs || []).map((leg, legIndex) => ({
            distanceMeters: Math.max(0, Number(leg.distanceMeters) || 0),
            durationSeconds: Math.max(0, Number(leg.durationMillis) || 0) / 1000,
            start: normalizeLatLng(leg.startLocation),
            end: normalizeLatLng(leg.endLocation),
            fromName: places[legIndex]?.name || '',
            toName: places[legIndex + 1]?.name || ''
        }));
        const sourceId = String(route.routeToken || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9_-]+/g, '-');
        const id = `${idPrefix}-${sourceId}-${index}`;
        return {
            path,
            route: {
                id,
                label: routeLabel(route, index, hasHighways),
                distanceMeters: Math.max(0, Number(route.distanceMeters) || 0),
                durationSeconds: Math.max(0, Number(route.durationMillis) || 0) / 1000,
                legs,
                viewport: normalizeViewport(route.viewport),
                polyline,
                hasTolls,
                hasHighways,
                tollPrice: Array.from(new Set(tollPrices.map(formatMoney).filter(Boolean))).join(' / '),
                mainRoads: roads
            }
        };
    }

    function serializeRoute(route, index, places) {
        const serialized = serializeRouteData(route, index, places, 'route');
        runtime.routePaths.set(serialized.route.id, serialized.path);
        return serialized.route;
    }

    function appendRoutePath(current = [], next = []) {
        if (!current.length) return next.slice();
        if (!next.length) return current.slice();
        const last = current[current.length - 1];
        const first = next[0];
        const samePoint = Math.abs(Number(last.lat) - Number(first.lat)) < 1e-7
            && Math.abs(Number(last.lng) - Number(first.lng)) < 1e-7;
        return samePoint ? current.concat(next.slice(1)) : current.concat(next);
    }

    function viewportFromPath(path = []) {
        if (!path.length) return null;
        const latitudes = path.map(point => Number(point.lat)).filter(Number.isFinite);
        const longitudes = path.map(point => Number(point.lng)).filter(Number.isFinite);
        if (!latitudes.length || !longitudes.length) return null;
        return {
            north: Math.max(...latitudes),
            south: Math.min(...latitudes),
            east: Math.max(...longitudes),
            west: Math.min(...longitudes)
        };
    }

    function splitTollPrices(value = '') {
        return String(value || '').split(' / ').map(item => item.trim()).filter(Boolean);
    }


    function segmentSelectionLabel(index = 0) {
        return index === 0 ? 'おすすめ' : `ルート${index + 1}`;
    }

    function decorateSegmentRoute(route = {}, segmentIndex = 0, routeIndex = 0) {
        return {
            ...route,
            segmentIndex,
            segmentRouteIndex: routeIndex,
            label: segmentSelectionLabel(routeIndex)
        };
    }

    function clearComputedRoutes(state = plannerState()) {
        state.routes = [];
        state.segmentRouteGroups = [];
        state.segmentSelectionIndices = [];
        state.selectedRouteIndex = 0;
        state.calculatedAt = 0;
        return state;
    }

    function clampSegmentSelections(state = plannerState()) {
        const groups = Array.isArray(state.segmentRouteGroups) ? state.segmentRouteGroups : [];
        state.segmentSelectionIndices = groups.map((group, index) => {
            const value = Array.isArray(state.segmentSelectionIndices) ? Number(state.segmentSelectionIndices[index]) : 0;
            return Number.isInteger(value) && value >= 0 ? Math.min(value, Math.max(0, group.length - 1)) : 0;
        });
        return state.segmentSelectionIndices;
    }

    function buildAggregateFromSelections(state = plannerState()) {
        const groups = Array.isArray(state.segmentRouteGroups) ? state.segmentRouteGroups : [];
        if (!groups.length) return null;
        clampSegmentSelections(state);
        const selectedRoutes = groups.map((group, index) => group[state.segmentSelectionIndices[index]] || group[0]).filter(Boolean);
        if (!selectedRoutes.length) return null;
        let distanceMeters = 0;
        let durationSeconds = 0;
        let path = [];
        let legs = [];
        let hasTolls = false;
        let hasHighways = false;
        let tollPrices = [];
        let mainRoads = [];
        const idParts = [];
        selectedRoutes.forEach(route => {
            distanceMeters += Number(route.distanceMeters) || 0;
            durationSeconds += Number(route.durationSeconds) || 0;
            legs = legs.concat(route.legs || []);
            path = appendRoutePath(path, routePath(route));
            hasTolls = hasTolls || route.hasTolls === true;
            hasHighways = hasHighways || route.hasHighways === true;
            tollPrices = Array.from(new Set(tollPrices.concat(splitTollPrices(route.tollPrice))));
            mainRoads = Array.from(new Set(mainRoads.concat(route.mainRoads || []))).slice(0, 5);
            idParts.push(route.id);
        });
        const id = `selected-${idParts.join('-').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 180)}`;
        runtime.routePaths.set(id, path);
        let polyline = '';
        try { polyline = runtime.geometry?.encoding?.encodePath?.(path) || ''; } catch (error) {}
        return {
            id,
            label: '選択中のルート',
            distanceMeters,
            durationSeconds,
            legs,
            viewport: viewportFromPath(path),
            polyline,
            hasTolls,
            hasHighways,
            tollPrice: tollPrices.join(' / '),
            mainRoads
        };
    }

    function refreshAggregateRouteState(state = plannerState()) {
        const aggregate = buildAggregateFromSelections(state);
        state.routes = aggregate ? [aggregate] : [];
        state.selectedRouteIndex = 0;
        return aggregate;
    }

    function combineSegmentRoutes(segmentGroups = []) {
        let combinations = [{
            idParts: [],
            distanceMeters: 0,
            durationSeconds: 0,
            legs: [],
            path: [],
            hasTolls: false,
            hasHighways: false,
            tollPrices: [],
            mainRoads: []
        }];
        segmentGroups.forEach(group => {
            const choices = group.slice()
                .sort((left, right) => left.route.durationSeconds - right.route.durationSeconds || left.route.distanceMeters - right.route.distanceMeters)
                .slice(0, MAX_SEGMENT_ROUTES);
            const expanded = [];
            combinations.forEach(partial => {
                choices.forEach(choice => {
                    expanded.push({
                        idParts: partial.idParts.concat(choice.route.id),
                        distanceMeters: partial.distanceMeters + choice.route.distanceMeters,
                        durationSeconds: partial.durationSeconds + choice.route.durationSeconds,
                        legs: partial.legs.concat(choice.route.legs),
                        path: appendRoutePath(partial.path, choice.path),
                        hasTolls: partial.hasTolls || choice.route.hasTolls,
                        hasHighways: partial.hasHighways || choice.route.hasHighways,
                        tollPrices: Array.from(new Set(partial.tollPrices.concat(splitTollPrices(choice.route.tollPrice)))),
                        mainRoads: Array.from(new Set(partial.mainRoads.concat(choice.route.mainRoads || []))).slice(0, 5)
                    });
                });
            });
            const seen = new Set();
            combinations = expanded
                .sort((left, right) => left.durationSeconds - right.durationSeconds || left.distanceMeters - right.distanceMeters)
                .filter(item => {
                    const signature = item.idParts.join('|');
                    if (seen.has(signature)) return false;
                    seen.add(signature);
                    return true;
                })
                .slice(0, MAX_PARTIAL_COMBINATIONS);
        });
        return combinations.slice(0, MAX_FINAL_ROUTES).map((combination, index) => {
            const id = `combined-${combination.idParts.join('-').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 180)}-${index}`;
            runtime.routePaths.set(id, combination.path);
            let polyline = '';
            try { polyline = runtime.geometry?.encoding?.encodePath?.(combination.path) || ''; } catch (error) {}
            const label = index === 0 ? 'おすすめ' : (!combination.hasHighways && index === 1 ? '一般道中心' : `別ルート ${index}`);
            return {
                id,
                label,
                distanceMeters: combination.distanceMeters,
                durationSeconds: combination.durationSeconds,
                legs: combination.legs,
                viewport: viewportFromPath(combination.path),
                polyline,
                hasTolls: combination.hasTolls,
                hasHighways: combination.hasHighways,
                tollPrice: combination.tollPrices.join(' / '),
                mainRoads: combination.mainRoads
            };
        });
    }

    function cloneSegmentRoutes(routes = []) {
        return routes.map(item => ({
            path: item.path.map(point => ({ ...point })),
            route: {
                ...item.route,
                legs: item.route.legs.map(leg => ({ ...leg, start: leg.start ? { ...leg.start } : null, end: leg.end ? { ...leg.end } : null })),
                viewport: item.route.viewport ? { ...item.route.viewport } : null,
                mainRoads: Array.from(item.route.mainRoads || [])
            }
        }));
    }

    function renderPlaceSummary() {
        // The compact editor shows selected place names directly in Carbon fields.
    }

    function updateContextLabel() {
        // The target car remains in state; promotional copy is intentionally omitted.
    }

    function routeWidgetKey(role, waypointId = '') {
        return role === 'waypoint' ? `waypoint:${waypointId}` : role;
    }

    function getRolePlace(role, waypointId = '') {
        const state = plannerState();
        if (role === 'origin') return state.origin;
        if (role === 'destination') return state.destination;
        return runtime.waypointRows.find(row => row.id === waypointId)?.place || null;
    }

    function normalizeStoredPlace(raw = null) {
        if (!raw || typeof raw !== 'object') return null;
        const placeId = String(raw.placeId || '').trim();
        const name = String(raw.name || '').trim();
        const address = String(raw.address || '').trim();
        const latitude = Number(raw.latitude);
        const longitude = Number(raw.longitude);
        if (!placeId || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return { placeId, name, address, latitude, longitude };
    }

    function sharedPlaceCatalog() {
        const state = ensureSettlementState();
        return Array.isArray(state.routePlaceCatalog)
            ? state.routePlaceCatalog.map(normalizeStoredPlace).filter(Boolean)
            : [];
    }

    function rememberPlace(place) {
        const normalized = normalizeStoredPlace(place);
        if (!normalized) return;
        const state = ensureSettlementState();
        const current = sharedPlaceCatalog();
        const next = [normalized, ...current.filter(item => item.placeId !== normalized.placeId)].slice(0, 48);
        const changed = next.length !== current.length || next.some((item, index) => item.placeId !== current[index]?.placeId || item.name !== current[index]?.name || item.address !== current[index]?.address);
        state.routePlaceCatalog = next;
        if (changed && typeof save === 'function') save();
    }

    function recentPlaces() {
        return sharedPlaceCatalog().slice(0, 12);
    }

    function getStopItems() {
        const state = plannerState();
        const items = [
            { id: 'origin', role: 'origin', place: state.origin },
            ...runtime.waypointRows.filter(row => row.place).map(row => ({ id: row.id, role: 'waypoint', place: row.place }))
        ];
        if (state.destination) items.push({ id: 'destination', role: 'destination', place: state.destination });
        items.push({ id: 'append', role: 'append', place: null });
        return items;
    }

    function preventTouchCallout(handle) {
        if (!(handle instanceof HTMLElement) || handle.dataset.routeTouchBound === 'true') return;
        handle.dataset.routeTouchBound = 'true';
        handle.addEventListener('touchstart', event => {
            if (event.cancelable) event.preventDefault();
        }, { passive: false });
        handle.addEventListener('contextmenu', event => event.preventDefault());
    }

    function renderStopEditor() {
        const list = byId('routeStopList');
        if (!list) return;
        const items = getStopItems();
        list.innerHTML = items.map((item, index) => templates().routeStopRow(item, index, items.length, { escapeHtml })).join('');
        applyRuntimeAccessibilityFixes(list);
        list.querySelectorAll('.route-stop-drag:not([disabled])').forEach(preventTouchCallout);
        setupStopSortable();
    }

    function setRolePlace(role, place, waypointId = '') {
        const state = plannerState();
        if (role === 'origin') state.origin = place;
        else if (role === 'destination') state.destination = place;
        else if (role === 'append') {
            if (!place) return;
            if (state.destination) runtime.waypointRows.push({ id: createWaypointId(), place: state.destination });
            state.destination = place;
        } else {
            const row = runtime.waypointRows.find(item => item.id === waypointId);
            if (row) row.place = place;
        }
        if (place) rememberPlace(place);
        clearComputedRoutes(state);
        persistPlannerState();
        renderStopEditor();
        renderRoutes();
        renderMapRoutes();
    }

    function activeSearchTarget() {
        return runtime.activePlaceSearch || { role: '', waypointId: '' };
    }

    function searchPlaceholder(role) {
        return role === 'origin' ? '出発地を追加' : '経由地を追加';
    }

    function placeSearchInput() {
        return byId('routePlaceSearchInput');
    }

    function placeSearchNativeInput() {
        return placeSearchInput()?.shadowRoot?.querySelector('input') || null;
    }

    function resetPlaceSearchSession() {
        runtime.placeSearchSessionToken = runtime.places?.AutocompleteSessionToken
            ? new runtime.places.AutocompleteSessionToken()
            : null;
    }

    function createPlaceSearchWidget() {
        const widget = placeSearchInput();
        if (!widget) return null;
        if (runtime.placeSearchWidget === widget) return widget;
        runtime.placeSearchWidget = widget;
        widget.addEventListener('input', () => handlePlaceSearchInput(widget));
        widget.addEventListener('keydown', event => {
            if (event.key === 'Escape') closePlaceSearch();
            if (event.key === 'Enter' && runtime.placeHistoryEntries.length) {
                event.preventDefault();
                selectPlaceSearchEntry(0);
            }
        });
        byId('routePlaceSearchClearBtn')?.addEventListener('click', () => {
            widget.value = '';
            widget.setAttribute('value', '');
            widget.dataset.selectedValue = '';
            updatePlaceSearchClearButton();
            renderPlaceHistory();
            placeSearchNativeInput()?.focus({ preventScroll: true });
        });
        return widget;
    }

    function updatePlaceSearchClearButton() {
        const clear = byId('routePlaceSearchClearBtn');
        if (clear) clear.hidden = !String(placeSearchInput()?.value || '').trim();
    }

    function predictionEntries(predictions = []) {
        return predictions.map(prediction => ({
            kind: 'prediction',
            prediction,
            title: String(prediction.mainText?.text || prediction.text?.text || '候補'),
            subtitle: String(prediction.secondaryText?.text || prediction.text?.text || '')
        }));
    }

    function setPlaceSearchHeading(mode = 'history') {
        const title = byId('routePlaceCandidatesTitle');
        if (title) title.textContent = mode === 'search' ? '検索結果' : '候補';
    }

    function renderPlaceEntries(entries = [], mode = 'history') {
        const list = byId('routePlaceHistoryList');
        if (!list) return;
        setPlaceSearchHeading(mode);
        runtime.placeHistoryEntries = entries;
        list.innerHTML = entries.length
            ? entries.map((entry, index) => templates().routeHistoryItem(entry, index, { escapeHtml })).join('')
            : `<div class="route-place-history-empty">${mode === 'search' ? '一致する場所がありません。' : '候補はまだありません。'}</div>`;
        applyRuntimeAccessibilityFixes(list);
    }

    function renderPlaceHistory() {
        renderPlaceEntries(recentPlaces().map(place => ({ kind: 'recent', place, title: place.name, subtitle: place.address })), 'history');
    }

    async function fetchPlaceSuggestions(query) {
        await initializeGoogleFeatures();
        if (!runtime.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
            throw new Error('Places候補APIを利用できません。');
        }
        if (!runtime.placeSearchSessionToken) resetPlaceSearchSession();
        const request = {
            input: query,
            locationBias: JAPAN_SEARCH_BIAS,
            language: 'ja',
            region: 'jp'
        };
        if (runtime.placeSearchSessionToken) request.sessionToken = runtime.placeSearchSessionToken;
        const response = await runtime.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        const seen = new Set();
        return Array.from(response?.suggestions || [])
            .map(item => item.placePrediction)
            .filter(Boolean)
            .filter(prediction => {
                const identity = String(prediction.placeId || prediction.text?.text || prediction.mainText?.text || '');
                if (!identity || seen.has(identity)) return false;
                seen.add(identity);
                return true;
            })
            .slice(0, 8);
    }

    function closePlaceSearch() {
        const surface = byId('routePlaceSearchSurface');
        const modal = byId('routeDistanceModal');
        const previousTarget = runtime.activePlaceSearch;
        if (surface) surface.hidden = true;
        modal?.classList.remove('route-place-search-active');
        if (runtime.placeSearchTimer) clearTimeout(runtime.placeSearchTimer);
        runtime.placeSearchTimer = null;
        runtime.placeSearchSequence += 1;
        runtime.activePlaceSearch = null;
        runtime.placeSearchSessionToken = null;
        document.body.classList.remove('route-place-search-open');
        requestAnimationFrame(() => {
            if (!previousTarget?.role) return;
            const selector = `[data-action="open-route-place-search"][data-route-role="${CSS.escape(previousTarget.role)}"]${previousTarget.waypointId ? `[data-route-waypoint-id="${CSS.escape(previousTarget.waypointId)}"]` : ''}`;
            const target = document.querySelector(selector);
            if (!(target instanceof HTMLElement)) return;
            if (global.SanpoFocusModality?.isKeyboard?.()) target.focus({ preventScroll: true });
            else global.SanpoFocusModality?.clearPointerFocus?.(target);
        });
    }

    function openPlaceSearch(role, waypointId = '') {
        if (role === 'append' && runtime.waypointRows.length >= MAX_WAYPOINTS) {
            setNotice('warning', '経由地は25件までです', 'Google Routes APIの上限に合わせています。');
            return;
        }
        const surface = byId('routePlaceSearchSurface');
        const modal = byId('routeDistanceModal');
        const widget = createPlaceSearchWidget();
        if (!surface || !widget || !role) return;
        runtime.activePlaceSearch = { role, waypointId };
        resetPlaceSearchSession();
        const placeholder = searchPlaceholder(role);
        widget.placeholder = placeholder;
        widget.setAttribute('placeholder', placeholder);
        widget.setAttribute('aria-label', placeholder);
        widget.value = '';
        widget.setAttribute('value', '');
        widget.dataset.selectedPlaceId = '';
        widget.dataset.selectedValue = '';
        updatePlaceSearchClearButton();
        renderPlaceHistory();
        surface.scrollTop = 0;
        surface.hidden = false;
        global.SanpoCarbon?.renderCarbonIcons?.(surface);
        modal?.classList.add('route-place-search-active');
        document.body.classList.add('route-place-search-open');
        const focusSearch = () => {
            const input = placeSearchNativeInput();
            (input || widget).focus?.({ preventScroll: true });
            input?.setSelectionRange?.(0, 0);
        };
        // Keep the focus call in the original tap event so iOS opens the keyboard immediately.
        focusSearch();
        requestAnimationFrame(() => requestAnimationFrame(focusSearch));
    }

    async function resolvePrediction(prediction, role, waypointId = '') {
        const placePrediction = prediction?.placePrediction || prediction;
        if (!placePrediction?.toPlace || !role) return;
        const key = routeWidgetKey(role, waypointId);
        const sequence = (runtime.selectionSequence.get(key) || 0) + 1;
        runtime.selectionSequence.set(key, sequence);
        try {
            setNotice('info', '場所の情報を取得しています', '選択した候補を確認しています。');
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'] });
            if (runtime.selectionSequence.get(key) !== sequence) return;
            const point = normalizeLatLng(place.location);
            if (!point || !place.id) throw new Error('選択した場所の座標を取得できませんでした。');
            const selected = {
                placeId: String(place.id),
                name: String(place.displayName || placePrediction.mainText?.text || placePrediction.text?.text || '選択した場所'),
                address: String(place.formattedAddress || ''),
                latitude: point.latitude,
                longitude: point.longitude
            };
            setRolePlace(role, selected, waypointId);
            closePlaceSearch();
            setNotice('', '', '');
            await requestRoutesIfReady('place-selected');
        } catch (error) {
            const info = classifyGoogleError(error);
            setNotice(info.kind, info.title, info.subtitle);
        }
    }

    function selectPlaceSearchEntry(index) {
        const entry = runtime.placeHistoryEntries[Number(index)];
        const target = activeSearchTarget();
        if (!entry || !target.role) return;
        if (entry.kind === 'prediction') {
            void resolvePrediction(entry.prediction, target.role, target.waypointId);
            return;
        }
        const place = entry.place || entry;
        setRolePlace(target.role, place, target.waypointId);
        closePlaceSearch();
        void requestRoutesIfReady('history-place-selected');
    }

    function handlePlaceSearchInput(widget) {
        const target = activeSearchTarget();
        if (!target.role) return;
        const value = String(widget.value || '').trim();
        updatePlaceSearchClearButton();
        const currentPlace = getRolePlace(target.role, target.waypointId);
        if (currentPlace && value !== String(widget.dataset.selectedValue || '').trim()) {
            setRolePlace(target.role, null, target.waypointId);
            setNotice('warning', '候補から場所を選択してください', '文字を入力しただけではルート計算を行いません。');
            setMapEmpty('出発地と目的地を候補から選択してください。');
        }
        if (!value) {
            renderPlaceHistory();
            return;
        }
        if (runtime.placeSearchTimer) clearTimeout(runtime.placeSearchTimer);
        const requestId = ++runtime.placeSearchSequence;
        runtime.placeSearchTimer = setTimeout(async () => {
            try {
                const predictions = await fetchPlaceSuggestions(value);
                if (requestId !== runtime.placeSearchSequence) return;
                renderPlaceEntries(predictionEntries(predictions), 'search');
            } catch (error) {
                if (requestId !== runtime.placeSearchSequence) return;
                const info = classifyGoogleError(error);
                setNotice(info.kind, '場所候補を取得できませんでした', info.subtitle, { retryable: true });
            }
        }, 180);
    }

    function itemForRenderedStop(row) {
        const role = row?.dataset?.routeRole || '';
        const waypointId = row?.dataset?.routeWaypointId || '';
        if (role === 'append') return null;
        if (role === 'origin') return { id: 'origin', role, place: plannerState().origin };
        if (role === 'destination') return { id: 'destination', role, place: plannerState().destination };
        const waypoint = runtime.waypointRows.find(item => item.id === waypointId);
        return waypoint ? { id: waypoint.id, role: 'waypoint', place: waypoint.place } : null;
    }

    function applyRenderedStopOrder(rows, reason = 'stops-reordered') {
        const items = rows.map(itemForRenderedStop).filter(Boolean);
        if (items.length < 2) return;
        const state = plannerState();
        state.origin = items[0]?.place || null;
        state.destination = items[items.length - 1]?.place || null;
        runtime.waypointRows = items.slice(1, -1).map(item => ({
            id: item.role === 'waypoint' ? item.id : createWaypointId(),
            place: item.place || null
        }));
        clearComputedRoutes(state);
        renderStopEditor();
        persistPlannerState();
        renderRoutes();
        renderMapRoutes();
        scheduleRouteRequest(reason, 120);
    }

    function setupStopSortable() {
        const list = byId('routeStopList');
        if (!list || typeof Sortable === 'undefined') return;
        if (runtime.stopSortable) {
            try { runtime.stopSortable.destroy(); } catch (error) {}
        }
        runtime.stopSortable = new Sortable(list, {
            animation: 150,
            handle: '.route-stop-drag:not([disabled])',
            draggable: '.route-stop-row:not(.route-stop-row--append)',
            filter: '.route-stop-row--append',
            preventOnFilter: false,
            forceFallback: true,
            fallbackOnBody: false,
            fallbackTolerance: 4,
            delay: 120,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            ghostClass: 'route-stop-drag-ghost',
            chosenClass: 'route-stop-drag-chosen',
            fallbackClass: 'route-stop-drag-fallback',
            onStart: () => {
                closePlaceSearch();
                document.body.classList.add('route-stop-dragging');
            },
            onEnd: () => {
                document.body.classList.remove('route-stop-dragging');
                applyRenderedStopOrder(Array.from(list.querySelectorAll('.route-stop-row:not(.route-stop-row--append)')), 'stops-drag-reordered');
            }
        });
    }

    function renderRoutes() {
        const state = plannerState();
        const list = byId('routeCandidateList');
        const summary = byId('routeLegSummary');
        const apply = byId('applyRouteDistanceBtn');
        const selected = getSelectedRoute(state);
        const places = getOrderedPlaces(state);
        if (list) {
            list.innerHTML = state.routes.length
                ? state.routes.map((route, index) => templates().routeCandidateCard(route, index, index === state.selectedRouteIndex, state.roundTrip, { escapeHtml })).join('')
                : '<div class="route-candidate-empty">出発地と目的地を選ぶと、ルート候補を表示します。</div>';
        }
        if (summary) summary.innerHTML = selected ? templates().routeLegSummary(selected, places, state.roundTrip, { escapeHtml }) : '';
        if (apply) apply.disabled = !selected;
        applyRuntimeAccessibilityFixes(list);
    }

    function clearMapOverlays() {
        runtime.polylines.forEach(polyline => polyline.setMap?.(null));
        runtime.polylines = [];
        runtime.markers.forEach(marker => {
            if ('map' in marker) marker.map = null;
            marker.setMap?.(null);
        });
        runtime.markers = [];
    }

    function routePath(route) {
        const runtimePath = runtime.routePaths.get(route.id);
        if (runtimePath?.length) return runtimePath;
        if (route.polyline && runtime.geometry?.encoding?.decodePath) {
            try { return runtime.geometry.encoding.decodePath(route.polyline); } catch (error) {}
        }
        return [];
    }

    function svgDataUrl(markup = '') {
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
    }

    function formatMapStopLetter(index = 0) {
        let number = Math.max(0, Number(index) || 0) + 1;
        let label = '';
        while (number > 0) {
            number -= 1;
            label = String.fromCharCode(65 + (number % 26)) + label;
            number = Math.floor(number / 26);
        }
        return label || 'A';
    }

    function buildCircleMarkerSvg(label = 'A') {
        return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#ffffff" stroke="#161616" stroke-width="3"/><text x="20" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#161616">${String(label || '').replace(/[<&>]/g, '')}</text></svg>`);
    }

    function buildPinMarkerSvg() {
        return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56"><path d="M22 3C11.5 3 3 11.4 3 21.9c0 13.4 15.2 26.7 18 30.7.7 1 2.2 1 2.9 0 2.8-4 18-17.3 18-30.7C41 11.4 32.5 3 22 3z" fill="#fa4d56" stroke="#ffffff" stroke-width="2"/></svg>`);
    }

    function createMarker(place, index, total) {
        if (!runtime.map || !place || !global.google?.maps?.Marker) return;
        const position = { lat: place.latitude, lng: place.longitude };
        const isOrigin = index === 0;
        const isDestination = index === total - 1;
        const markerText = isOrigin ? 'O' : formatMapStopLetter(index - 1);
        const marker = new global.google.maps.Marker({
            map: runtime.map,
            position,
            title: place.name,
            icon: {
                url: isDestination ? buildPinMarkerSvg() : buildCircleMarkerSvg(markerText),
                scaledSize: new global.google.maps.Size(isDestination ? 44 : 40, isDestination ? 56 : 40),
                anchor: new global.google.maps.Point(isDestination ? 22 : 20, isDestination ? 53 : 20)
            },
            optimized: true,
            zIndex: isDestination ? 40 : 35
        });
        runtime.markers.push(marker);
    }

    function renderMapRoutes() {
        const state = plannerState();
        if (!runtime.map) return;
        clearMapOverlays();
        const bounds = new global.google.maps.LatLngBounds();
        const selectedIndex = state.selectedRouteIndex;
        const routeOrder = state.routes.map((route, index) => ({ route, index }))
            .sort((left, right) => Number(left.index === selectedIndex) - Number(right.index === selectedIndex));
        routeOrder.forEach(({ route, index }) => {
            const path = routePath(route);
            if (!path?.length) return;
            path.forEach(point => bounds.extend(point));
            const selected = index === selectedIndex;
            const polyline = new global.google.maps.Polyline({
                map: runtime.map,
                path,
                clickable: true,
                strokeColor: selected ? readSemanticToken('--accent-color', '#0f62fe') : readSemanticToken('--accent-line', '#78a9ff'),
                strokeOpacity: selected ? 0.98 : 0.82,
                strokeWeight: selected ? 7 : 5,
                zIndex: selected ? 30 : 10
            });
            polyline.addListener('click', () => selectRoute(index));
            runtime.polylines.push(polyline);
        });
        const places = getOrderedPlaces(state);
        places.forEach((place, index) => {
            createMarker(place, index, places.length);
            bounds.extend({ lat: place.latitude, lng: place.longitude });
        });
        if (!bounds.isEmpty()) runtime.map.fitBounds(bounds, 48);
        setMapEmpty(state.routes.length ? '' : '出発地と目的地を候補から選択してください。');
    }

    function applyMapTheme() {
        if (!runtime.map) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        runtime.map.setOptions({ styles: dark ? DARK_MAP_STYLES : null });
        renderMapRoutes();
    }

    function refreshMapAfterOpen() {
        if (!runtime.map || !byId('routeDistanceModal')?.open) return;
        const refresh = () => {
            if (!runtime.map || !byId('routeDistanceModal')?.open) return;
            try { global.google?.maps?.event?.trigger?.(runtime.map, 'resize'); } catch (error) {}
            setMapSkeleton(false);
            renderMapRoutes();
        };
        requestAnimationFrame(() => requestAnimationFrame(refresh));
        setTimeout(refresh, 120);
        setTimeout(refresh, 320);
    }

    async function initializeMap() {
        const mapNode = byId('routeMap');
        if (!mapNode) throw new Error('地図の表示領域が見つかりません。');
        if (runtime.map) {
            const currentNode = runtime.map.getDiv?.();
            if (!currentNode || currentNode === mapNode) {
                setMapSkeleton(false);
                refreshMapAfterOpen();
                return runtime.map;
            }
            clearMapOverlays();
            runtime.map = null;
        }
        setMapSkeleton(true);
        const config = global.SanpoGoogleMaps.getConfig();
        runtime.map = new runtime.maps.Map(mapNode, {
            center: { lat: 36.2048, lng: 138.2529 },
            zoom: 5,
            mapId: config.mapId || undefined,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: true,
            gestureHandling: 'none',
            draggable: false
        });
        if (mapNode.dataset.twoFingerMapBound !== 'true') {
            mapNode.dataset.twoFingerMapBound = 'true';
            const setTwoFingerMode = enabled => runtime.map?.setOptions({
                gestureHandling: enabled ? 'greedy' : 'none',
                draggable: enabled
            });
            mapNode.addEventListener('touchstart', event => setTwoFingerMode(event.touches.length >= 2), { passive: true, capture: true });
            mapNode.addEventListener('touchmove', event => setTwoFingerMode(event.touches.length >= 2), { passive: true, capture: true });
            mapNode.addEventListener('touchend', event => setTwoFingerMode(event.touches.length >= 2), { passive: true, capture: true });
            mapNode.addEventListener('touchcancel', () => setTwoFingerMode(false), { passive: true, capture: true });
        }
        applyMapTheme();
        global.google.maps.event.addListenerOnce(runtime.map, 'idle', () => {
            setMapSkeleton(false);
            refreshMapAfterOpen();
        });
        if (!runtime.themeObserver) {
            runtime.themeObserver = new MutationObserver(applyMapTheme);
            runtime.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
        renderMapRoutes();
        return runtime.map;
    }

    async function initializeGoogleFeatures() {
        if (runtime.initializing) return runtime.initializing;
        runtime.initializing = (async () => {
            if (!global.SanpoGoogleMaps?.isConfigured()) throw new Error('Google Maps APIキーが設定されていません。');
            const libraries = await global.SanpoGoogleMaps.importLibraries(['maps', 'places', 'routes', 'geometry', 'marker']);
            runtime.maps = libraries.maps;
            runtime.places = libraries.places;
            runtime.routes = libraries.routes;
            runtime.geometry = libraries.geometry;
            runtime.marker = libraries.marker;
            await initializeMap();
            createPlaceSearchWidget();
            renderStopEditor();
            return libraries;
        })().catch(error => {
            runtime.initializing = null;
            throw error;
        });
        return runtime.initializing;
    }

    function routeLocation(place) {
        if (runtime.places?.Place && place?.placeId) {
            try { return new runtime.places.Place({ id: place.placeId }); } catch (error) {}
        }
        return { lat: place.latitude, lng: place.longitude };
    }

    function wholeRouteRequest(state, places) {
        return {
            origin: routeLocation(places[0]),
            destination: routeLocation(places[places.length - 1]),
            intermediates: places.slice(1, -1).map(place => ({ location: routeLocation(place) })),
            travelMode: 'DRIVING',
            routingPreference: 'TRAFFIC_AWARE',
            computeAlternativeRoutes: true,
            routeModifiers: {
                avoidTolls: state.avoidTolls,
                avoidHighways: state.avoidHighways,
                avoidFerries: state.avoidFerries
            },
            language: 'ja-JP',
            region: 'JP',
            polylineQuality: 'HIGH_QUALITY',
            extraComputations: ['TOLLS'],
            fields: ROUTE_FIELDS
        };
    }

    function segmentCacheKey(state, origin, destination) {
        return JSON.stringify({
            origin: origin.placeId,
            destination: destination.placeId,
            avoidTolls: state.avoidTolls,
            avoidHighways: state.avoidHighways,
            avoidFerries: state.avoidFerries
        });
    }

    async function computeRoutesWithFallback(request) {
        try {
            return await runtime.routes.Route.computeRoutes(request);
        } catch (initialError) {
            if (!canRetryWithoutTolls(initialError)) throw initialError;
            const basicRequest = { ...request };
            delete basicRequest.extraComputations;
            basicRequest.fields = ROUTE_FIELDS.filter(field => field !== 'travelAdvisory');
            return runtime.routes.Route.computeRoutes(basicRequest);
        }
    }

    async function loadSegmentRoutes(state, origin, destination, segmentIndex) {
        const key = segmentCacheKey(state, origin, destination);
        const cached = runtime.segmentRouteCache.get(key);
        if (cached && cached.expiresAt > Date.now()) return { routes: cloneSegmentRoutes(cached.routes), fallbackInfo: null };
        const response = await computeRoutesWithFallback(wholeRouteRequest(state, [origin, destination]));
        const rawRoutes = Array.from(response.routes || []);
        if (!rawRoutes.length) throw new Error(`No routes returned for segment ${segmentIndex + 1}.`);
        const routes = rawRoutes
            .map((route, index) => serializeRouteData(route, index, [origin, destination], `segment-${segmentIndex}`))
            .sort((left, right) => left.route.durationSeconds - right.route.durationSeconds || left.route.distanceMeters - right.route.distanceMeters)
            .slice(0, MAX_SEGMENT_ROUTES);
        runtime.segmentRouteCache.set(key, { expiresAt: Date.now() + SEGMENT_CACHE_TTL, routes: cloneSegmentRoutes(routes) });
        return { routes, fallbackInfo: response.fallbackInfo || null };
    }

    async function requestRoutesIfReady(reason = '') {
        const state = persistPlannerState();
        if (!state.origin || !state.destination) {
            runtime.requestSequence += 1;
            clearComputedRoutes(state);
            persistPlannerState();
            renderRoutes();
            renderMapRoutes();
            setLoading(false);
            setNotice('', '', '');
            return;
        }
        await initializeGoogleFeatures();
        const requestId = ++runtime.requestSequence;
        const places = getOrderedPlaces(state);
        setLoading(true, 'ルート候補を取得しています');
        setNotice('', '', '');
        try {
            const response = await computeRoutesWithFallback(wholeRouteRequest(state, places));
            if (requestId !== runtime.requestSequence) return;
            const rawRoutes = Array.from(response.routes || []);
            if (!rawRoutes.length) throw new Error('No routes returned.');
            runtime.routePaths.clear();
            state.routes = sortRoutesForState(rawRoutes.slice(0, 3).map((route, index) => serializeRoute(route, index, places)), state);
            state.segmentRouteGroups = [];
            state.segmentSelectionIndices = [];
            state.selectedRouteIndex = 0;
            state.calculatedAt = Date.now();
            persistPlannerState();
            renderRoutes();
            renderMapRoutes();
            setNotice('', '', '');
        } catch (error) {
            if (requestId !== runtime.requestSequence) return;
            clearComputedRoutes(state);
            persistPlannerState();
            renderRoutes();
            renderMapRoutes();
            const info = classifyGoogleError(error);
            setNotice(info.kind, info.title, info.subtitle, { retryable: true });
            console.error('Google Routes request failed:', error);
        } finally {
            if (requestId === runtime.requestSequence) setLoading(false);
        }
    }

    function scheduleRouteRequest(reason = '', delay = 220) {
        if (runtime.routeRequestTimer) clearTimeout(runtime.routeRequestTimer);
        runtime.routeRequestTimer = setTimeout(() => {
            runtime.routeRequestTimer = null;
            void requestRoutesIfReady(reason);
        }, Math.max(0, Number(delay) || 0));
    }

    function selectRoute(index) {
        const state = plannerState();
        const next = Number(index);
        if (!Number.isInteger(next) || next < 0 || next >= state.routes.length) return;
        state.selectedRouteIndex = next;
        persistPlannerState();
        renderRoutes();
        renderMapRoutes();
    }

    function moveStop(id, direction) {
        const list = byId('routeStopList');
        if (!list) return;
        const rows = Array.from(list.querySelectorAll('.route-stop-row:not(.route-stop-row--append)'));
        const index = rows.findIndex(row => row.dataset.routeStopId === id);
        if (index < 0) return;
        const targetIndex = direction === 'first'
            ? 0
            : direction === 'last'
                ? rows.length - 1
                : Math.min(rows.length - 1, Math.max(0, index + Number(direction || 0)));
        if (targetIndex === index) return;
        const [row] = rows.splice(index, 1);
        rows.splice(targetIndex, 0, row);
        applyRenderedStopOrder(rows, 'stops-keyboard-reordered');
        requestAnimationFrame(() => {
            const moved = document.querySelector(`[data-route-stop-id="${CSS.escape(id)}"] .route-stop-drag`);
            if (moved instanceof HTMLElement) moved.focus({ preventScroll: true });
        });
    }

    function addWaypoint() {
        if (runtime.waypointRows.length >= MAX_WAYPOINTS) {
            setNotice('warning', '経由地は25件までです', 'Google Routes APIの上限に合わせています。');
            return;
        }
        openPlaceSearch('append');
    }

    function removeWaypoint(id) {
        if (runtime.activePlaceSearch?.role === 'waypoint' && runtime.activePlaceSearch?.waypointId === id) closePlaceSearch();
        runtime.waypointRows = runtime.waypointRows.filter(row => row.id !== id);
        renderStopEditor();
        persistPlannerState();
        scheduleRouteRequest('waypoint-removed', 120);
    }

    function removeStop(role, waypointId = '') {
        const state = plannerState();
        if (role === 'waypoint') {
            removeWaypoint(waypointId);
            return;
        }
        if (role === 'origin') {
            if (runtime.activePlaceSearch?.role === role) closePlaceSearch();
            setRolePlace('origin', null);
            scheduleRouteRequest('origin-cleared', 120);
            return;
        }
        if (role === 'destination') {
            if (runtime.activePlaceSearch?.role === role) closePlaceSearch();
            const previous = runtime.waypointRows.pop() || null;
            state.destination = previous?.place || null;
            clearComputedRoutes(state);
            persistPlannerState();
            renderStopEditor();
            renderRoutes();
            renderMapRoutes();
            scheduleRouteRequest('destination-removed', 120);
        }
    }

    function setRouteSettingsOpen(open) {
        const panel = byId('routeSettingsPanel');
        const button = byId('routeSettingsToggleBtn');
        const next = open === true;
        runtime.routeSettingsOpen = next;
        if (panel) panel.hidden = !next;
        if (button) {
            button.setAttribute('aria-expanded', next ? 'true' : 'false');
            button.setAttribute('aria-label', next ? 'ルート設定を閉じる' : 'ルート設定を開く');
            if (!next) global.SanpoFocusModality?.clearPointerFocus?.(button);
        }
    }

    function routePreferenceScore(route, state) {
        let score = 0;
        if (!state.avoidTolls && route.hasTolls) score += 2;
        if (!state.avoidHighways && route.hasHighways) score += 2;
        if (route.label === 'おすすめ') score += 1;
        return score;
    }

    function sortRoutesForState(routes = [], state = plannerState()) {
        return Array.from(routes).sort((left, right) => {
            const scoreDiff = routePreferenceScore(right, state) - routePreferenceScore(left, state);
            if (scoreDiff) return scoreDiff;
            const durationDiff = (Number(left.durationSeconds) || 0) - (Number(right.durationSeconds) || 0);
            if (durationDiff) return durationDiff;
            return (Number(left.distanceMeters) || 0) - (Number(right.distanceMeters) || 0);
        });
    }

    function updateOptionsFromControls() {
        const state = plannerState();
        state.avoidTolls = !Boolean(byId('routeUseTolls')?.checked);
        state.avoidHighways = !Boolean(byId('routeUseHighways')?.checked);
        state.avoidFerries = false;
        state.roundTrip = false;
        persistPlannerState();
        renderRoutes();
    }

    function syncControlsFromState() {
        const state = plannerState();
        const controls = {
            routeUseTolls: !state.avoidTolls,
            routeUseHighways: !state.avoidHighways
        };
        Object.entries(controls).forEach(([id, checked]) => {
            const control = byId(id);
            if (!control) return;
            control.checked = checked;
            control.toggleAttribute('checked', checked);
        });
    }

    function initializeWaypointRows() {
        const state = plannerState();
        const places = Array.from(state.waypoints || []);
        if (!state.destination && places.length) state.destination = places.pop();
        runtime.waypointRows = places.map(place => ({ id: createWaypointId(), place }));
        persistPlannerState();
    }

    function pushRouteHistoryState() {
        if (runtime.historyActive) return;
        try {
            history.pushState({ ...(history.state || {}), sanpoRoutePlanner: true }, '', location.href);
            runtime.historyActive = true;
        } catch (error) {}
    }

    function removeRouteHistoryState() {
        if (!runtime.historyActive || runtime.historyClosing) return;
        runtime.suppressPopstate = true;
        runtime.historyActive = false;
        try { history.back(); } catch (error) { runtime.suppressPopstate = false; }
    }

    function closePlanner({ apply = false, fromPopstate = false } = {}) {
        if (runtime.routeRequestTimer) { clearTimeout(runtime.routeRequestTimer); runtime.routeRequestTimer = null; }
        runtime.applyInProgress = apply;
        runtime.returnAfterClose = plannerState().returnTo === 'carSettlement' && Boolean(plannerState().targetCarName);
        runtime.historyClosing = fromPopstate;
        if (!fromPopstate) removeRouteHistoryState();
        modals.routeDistance?.hide();
    }

    function restoreTargetCarEditor() {
        const state = plannerState();
        if (!runtime.returnAfterClose || !state.targetCarName) return;
        const name = state.targetCarName;
        runtime.returnAfterClose = false;
        setTimeout(() => (global.resumeSettlementCarEditor || global.openSettlementCarEditor)?.(encodeURIComponent(name)), 100);
    }

    function applySelectedDistance() {
        const state = plannerState();
        const route = getSelectedRoute(state);
        const targetName = state.targetCarName;
        if (!route || !targetName || state.targetCarId !== getTargetCarId(targetName)) {
            setNotice('error', '距離を反映できません', '元の車を特定できませんでした。車ごとの費用画面から開き直してください。');
            return;
        }
        const settlement = ensureSettlementState();
        if (!settlement.cars[targetName]) {
            setNotice('error', '対象の車が見つかりません', '車割または車名が変更されています。車ごとの費用画面から開き直してください。');
            return;
        }
        const totalMeters = route.distanceMeters * (state.roundTrip ? 2 : 1);
        const kilometers = Math.round((totalMeters / 1000) * 10) / 10;
        settlement.cars[targetName].dist = String(kilometers);
        renderSettlementView({ force: true });
        save();
        runtime.applyInProgress = true;
        runtime.returnAfterClose = true;
        closePlanner({ apply: true });
    }

    async function waitForPlannerLayout() {
        const modal = byId('routeDistanceModal');
        await Promise.resolve(modal?.updateComplete);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    async function waitForPlannerCloseCompletion() {
        const modal = byId('routeDistanceModal');
        if (!modal || modal.open || modal.hidden) return;
        await new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                modal.removeEventListener('sanpo:modal-hidden', finish);
                resolve();
            };
            const timeoutId = setTimeout(finish, 400);
            modal.addEventListener('sanpo:modal-hidden', finish, { once: true });
        });
    }

    async function performOpenPlanner(options = {}) {
        await waitForPlannerCloseCompletion();
        const state = plannerState();
        if (options.targetCarName) {
            state.targetCarName = String(options.targetCarName);
            state.targetCarId = getTargetCarId(state.targetCarName);
            state.returnTo = 'carSettlement';
        } else if (!options.preserveTarget) {
            state.targetCarName = '';
            state.targetCarId = '';
            state.returnTo = '';
        }
        initializeWaypointRows();
        syncControlsFromState();
        closePlaceSearch();
        renderStopEditor();
        renderRoutes();
        setNotice('', '', '');
        setMapEmpty(runtime.map ? '' : 'Google Mapsを読み込んでいます。');
        setMapSkeleton(!runtime.map);
        runtime.historyClosing = false;
        modals.routeDistance?.show();
        pushRouteHistoryState();
        await waitForPlannerLayout();
        try {
            await initializeGoogleFeatures();
            createPlaceSearchWidget();
            renderStopEditor();
            renderRoutes();
            renderMapRoutes();
            refreshMapAfterOpen();
            if (state.origin && state.destination && !state.routes.length) void requestRoutesIfReady('open');
            else setNotice('', '', '');
        } catch (error) {
            setMapSkeleton(false);
            setMapEmpty('地図を読み込めませんでした。');
            const info = classifyGoogleError(error);
            setNotice(info.kind, '地図を読み込めませんでした', info.subtitle, { retryable: true });
            console.error('Google Maps initialization failed:', error);
        }
    }

    function openPlanner(options = {}) {
        setRouteSettingsOpen(false);
        if (runtime.openingPromise) return runtime.openingPromise;
        runtime.openingPromise = performOpenPlanner(options).finally(() => {
            runtime.openingPromise = null;
        });
        return runtime.openingPromise;
    }

    async function retryRoutePlanner() {
        setRetryVisible(false);
        setNotice('info', '再試行しています', 'Google Mapsとルート候補をもう一度取得しています。');
        try {
            if (!runtime.map || !runtime.maps || !runtime.places || !runtime.routes) {
                runtime.initializing = null;
                await initializeGoogleFeatures();
            }
            createPlaceSearchWidget();
            renderStopEditor();
            refreshMapAfterOpen();
            if (plannerState().origin && plannerState().destination) await requestRoutesIfReady('manual-retry');
            else {
                setMapSkeleton(false);
                setMapEmpty('出発地と目的地を候補から選択してください。');
                setNotice('', '', '');
            }
        } catch (error) {
            setMapSkeleton(false);
            setMapEmpty('地図を読み込めませんでした。');
            const info = classifyGoogleError(error);
            setNotice(info.kind, info.title, info.subtitle, { retryable: true });
            console.error('Google Maps retry failed:', error);
        }
    }

    global.openRouteDistanceHelper = function() {
        syncSettlementStateFromDOM();
        void openPlanner({ preserveTarget: false });
    };

    global.openRouteDistanceHelperFromShortcut = function() {
        const targetName = typeof global.getActiveSettlementCarEditName === 'function'
            ? global.getActiveSettlementCarEditName()
            : (typeof activeSettlementCarEditName !== 'undefined' ? activeSettlementCarEditName : '');
        if (!targetName) {
            setNotice('warning', '車を特定できません', '車ごとの費用画面から距離計算ツールを開いてください。');
            return;
        }
        if (typeof global.prepareSettlementCarEditTransition === 'function'
            && !global.prepareSettlementCarEditTransition({ allowInvalid: true, preserveSession: true })) return;
        const carModal = byId('settlementCarEditModal');
        let launched = false;
        const launchPlanner = () => {
            if (launched) return;
            launched = true;
            void openPlanner({ targetCarName: targetName });
        };
        if (carModal?.open) {
            carModal.addEventListener('sanpo:modal-hidden', launchPlanner, { once: true });
            modals.settlementCarEdit?.hide();
            // Defensive fallback for browsers that suppress a transition event.
            setTimeout(() => {
                if (!carModal.open) launchPlanner();
            }, 320);
        } else {
            launchPlanner();
        }
    };

    global.addRouteWaypoint = addWaypoint;
    global.removeRouteWaypoint = removeWaypoint;
    global.removeRouteStop = removeStop;
    global.selectGoogleRoute = selectRoute;
    global.applySelectedRouteDistance = applySelectedDistance;
    global.closeRoutePlanner = () => closePlanner();
    global.refreshGoogleRoutes = () => requestRoutesIfReady('manual');
    global.retryGoogleRoutePlanner = retryRoutePlanner;
    global.getLocalRoutePlannerState = () => normalizeRoutePlannerState(plannerState());

    function bindPlannerEvents() {
        const carEditModal = byId('settlementCarEditModal');
        if (carEditModal && carEditModal.dataset.routeShortcutBound !== 'true') {
            carEditModal.dataset.routeShortcutBound = 'true';
            carEditModal.addEventListener('click', event => {
                const shortcut = event.composedPath?.().find(node =>
                    node instanceof Element && node.matches?.('[data-action="open-route-helper-shortcut"]')
                );
                if (!shortcut) return;
                event.preventDefault();
                event.stopPropagation();
                global.openRouteDistanceHelperFromShortcut?.();
            });
        }
        byId('routePlaceSearchBackBtn')?.addEventListener('click', closePlaceSearch);
        byId('routePlaceStack')?.addEventListener('click', event => {
            const path = event.composedPath?.() || [];
            const remove = path.find(node => node instanceof Element && node.matches?.('[data-action="remove-route-stop"]'));
            if (remove) {
                event.preventDefault();
                event.stopPropagation();
                removeStop(remove.dataset.routeRole || '', remove.dataset.routeWaypointId || '');
                return;
            }
            const field = path.find(node =>
                node instanceof Element && node.matches?.('[data-action="open-route-place-search"]')
            );
            if (!field) return;
            event.preventDefault();
            openPlaceSearch(field.dataset.routeRole || '', field.dataset.routeWaypointId || '');
        });
        byId('routePlaceStack')?.addEventListener('keydown', event => {
            if (!['Enter', ' '].includes(event.key)) return;
            const field = event.composedPath?.().find(node =>
                node instanceof Element && node.matches?.('[data-action="open-route-place-search"]')
            );
            if (!field) return;
            event.preventDefault();
            openPlaceSearch(field.dataset.routeRole || '', field.dataset.routeWaypointId || '');
        });
        byId('routePlaceHistoryList')?.addEventListener('click', event => {
            const item = event.composedPath?.().find(node =>
                node instanceof Element && node.matches?.('[data-route-history-index]')
            );
            if (!item) return;
            selectPlaceSearchEntry(Number(item.dataset.routeHistoryIndex));
        });
        byId('routeStopList')?.addEventListener('keydown', event => {
            const handle = event.composedPath?.().find(node => node instanceof Element && node.matches?.('.route-stop-drag'));
            const row = handle?.closest?.('[data-route-stop-id]');
            if (!handle || !row) return;
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            moveStop(row.dataset.routeStopId, event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : event.key === 'Home' ? 'first' : 'last');
        });
        byId('routeCandidateList')?.addEventListener('keydown', event => {
            const card = event.target.closest?.('.route-candidate-card');
            if (!card || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const state = plannerState();
            if (!state.routes.length) return;
            event.preventDefault();
            const current = Number(card.dataset.routeIndex || state.selectedRouteIndex || 0);
            const next = event.key === 'Home'
                ? 0
                : event.key === 'End'
                    ? state.routes.length - 1
                    : Math.min(state.routes.length - 1, Math.max(0, current + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1)));
            selectRoute(next);
            requestAnimationFrame(() => {
                const nextCard = document.querySelector(`.route-candidate-card[data-route-index="${next}"]`);
                if (nextCard instanceof HTMLElement) nextCard.focus({ preventScroll: true });
            });
        });
        byId('applyRouteDistanceBtn')?.addEventListener('click', applySelectedDistance);
        byId('routePlannerRetryBtn')?.addEventListener('click', () => void retryRoutePlanner());
        byId('routePlannerCancelBtn')?.addEventListener('click', () => closePlanner());
        ['routeUseTolls', 'routeUseHighways'].forEach(id => {
            byId(id)?.addEventListener('change', () => {
                updateOptionsFromControls();
                scheduleRouteRequest('modifier-changed', 250);
            });
        });
        byId('routeSettingsToggleBtn')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setRouteSettingsOpen(!runtime.routeSettingsOpen);
        });
        byId('routeSettingsPanel')?.addEventListener('click', event => {
            event.stopPropagation();
        });
        document.addEventListener('click', event => {
            if (!runtime.routeSettingsOpen) return;
            const toolbar = document.querySelector('.route-map-toolbar');
            if (toolbar instanceof Element && event.target instanceof Node && toolbar.contains(event.target)) return;
            setRouteSettingsOpen(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && runtime.routeSettingsOpen) setRouteSettingsOpen(false);
        });
        const modal = byId('routeDistanceModal');
        if (modal && modal.dataset.googleRoutesBound !== 'true') {
            modal.dataset.googleRoutesBound = 'true';
            modal.addEventListener('sanpo:modal-shown', refreshMapAfterOpen);
            modal.addEventListener('sanpo:modal-hiding', () => {
                closePlaceSearch();
                setRouteSettingsOpen(false);
                runtime.requestSequence += 1;
                const state = plannerState();
                if (state.returnTo === 'carSettlement' && state.targetCarName) runtime.returnAfterClose = true;
                if (!runtime.historyClosing) removeRouteHistoryState();
            });
            modal.addEventListener('sanpo:modal-hidden', () => {
                runtime.historyClosing = false;
                restoreTargetCarEditor();
            });
        }
        global.addEventListener('popstate', () => {
            if (runtime.suppressPopstate) {
                runtime.suppressPopstate = false;
                return;
            }
            if (byId('routeDistanceModal')?.open && runtime.historyActive) {
                runtime.historyActive = false;
                closePlanner({ fromPopstate: true });
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPlannerEvents, { once: true });
    else bindPlannerEvents();
})(window);
