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
        autocompleteWidgets: new Map(),
        waypointRows: [],
        waypointSortable: null,
        requestSequence: 0,
        selectionSequence: new Map(),
        initializing: null,
        historyActive: false,
        historyClosing: false,
        suppressPopstate: false,
        returnAfterClose: false,
        applyInProgress: false,
        themeObserver: null,
        routeRequestTimer: null
    };

    function plannerState() {
        const state = ensureSettlementState();
        state.routePlanner = normalizeRoutePlannerState(state.routePlanner || {});
        return state.routePlanner;
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
        return state.routes[state.selectedRouteIndex] || null;
    }

    function getOrderedPlaces(state = plannerState()) {
        return [state.origin, ...state.waypoints, state.destination].filter(Boolean);
    }

    function persistPlannerState() {
        const state = ensureSettlementState();
        const current = plannerState();
        current.waypoints = runtime.waypointRows.map(row => row.place).filter(Boolean);
        state.routePlanner = normalizeRoutePlannerState(current);
        if (typeof saveLocalDraftOnly === 'function') saveLocalDraftOnly();
        return state.routePlanner;
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

    function serializeRoute(route, index, places) {
        const path = Array.from(route.path || []).map(normalizeLatLng).filter(Boolean);
        const pathForEncoding = path.map(point => ({ lat: point.latitude, lng: point.longitude }));
        let polyline = '';
        try { polyline = runtime.geometry?.encoding?.encodePath?.(pathForEncoding) || ''; } catch (error) {}
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
        const id = String(route.routeToken || `route-${Date.now()}-${index}`);
        runtime.routePaths.set(id, pathForEncoding);
        return {
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
        };
    }

    function renderPlaceSummary(role, place, waypointId = '') {
        const selector = role === 'origin'
            ? '#routeOriginSummary'
            : role === 'destination'
                ? '#routeDestinationSummary'
                : `[data-route-waypoint-summary="${CSS.escape(waypointId)}"]`;
        const summary = document.querySelector(selector);
        if (!summary) return;
        summary.toggleAttribute('hidden', !place);
        summary.innerHTML = place ? templates().routePlaceSummary(place, { escapeHtml }) : '';
    }

    function updateContextLabel() {
        const state = plannerState();
        const context = byId('routePlannerContext');
        if (!context) return;
        context.textContent = state.returnTo === 'carSettlement' && state.targetCarName
            ? `${state.targetCarName}車の移動距離へ反映します。`
            : '各車の費用画面から開くと、その車の距離へ反映できます。';
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

    function setRolePlace(role, place, waypointId = '') {
        const state = plannerState();
        if (role === 'origin') state.origin = place;
        else if (role === 'destination') state.destination = place;
        else {
            const row = runtime.waypointRows.find(item => item.id === waypointId);
            if (row) row.place = place;
        }
        state.routes = [];
        state.selectedRouteIndex = 0;
        state.calculatedAt = 0;
        const widget = runtime.autocompleteWidgets.get(routeWidgetKey(role, waypointId));
        if (widget) {
            const displayValue = place ? `${place.name}${place.address ? `（${place.address}）` : ''}` : '';
            if (place && widget.value !== displayValue) widget.value = displayValue;
            widget.dataset.selectedPlaceId = place?.placeId || '';
            widget.dataset.selectedValue = displayValue;
        }
        renderPlaceSummary(role, place, waypointId);
        persistPlannerState();
        renderRoutes();
        renderMapRoutes();
    }

    async function resolvePrediction(event, role, waypointId = '') {
        const prediction = event?.placePrediction || event?.detail?.placePrediction;
        if (!prediction?.toPlace) return;
        const key = routeWidgetKey(role, waypointId);
        const sequence = (runtime.selectionSequence.get(key) || 0) + 1;
        runtime.selectionSequence.set(key, sequence);
        try {
            setNotice('info', '場所の情報を取得しています', 'Google候補の選択内容を確認しています。');
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'] });
            if (runtime.selectionSequence.get(key) !== sequence) return;
            const point = normalizeLatLng(place.location);
            if (!point || !place.id) throw new Error('選択した場所の座標を取得できませんでした。');
            const selected = {
                placeId: String(place.id),
                name: String(place.displayName || prediction.mainText?.text || prediction.text?.text || '選択した場所'),
                address: String(place.formattedAddress || ''),
                latitude: point.latitude,
                longitude: point.longitude
            };
            setRolePlace(role, selected, waypointId);
            setNotice('', '', '');
            await requestRoutesIfReady('place-selected');
        } catch (error) {
            const info = classifyGoogleError(error);
            setNotice(info.kind, info.title, info.subtitle);
        }
    }

    function handleAutocompleteInput(role, waypointId, widget) {
        const key = routeWidgetKey(role, waypointId);
        const currentPlace = getRolePlace(role, waypointId);
        if (!currentPlace) return;
        const sequence = (runtime.selectionSequence.get(key) || 0) + 1;
        runtime.selectionSequence.set(key, sequence);
        setTimeout(() => {
            if (runtime.selectionSequence.get(key) !== sequence) return;
            const value = String(widget.value || '').trim();
            const selectedValue = String(widget.dataset.selectedValue || '').trim();
            if (value !== selectedValue) {
                setRolePlace(role, null, waypointId);
                setNotice('warning', 'Google候補から場所を選択してください', '文字を入力しただけではルート計算を行いません。');
                setMapEmpty('出発地と目的地をGoogle候補から選択してください。');
            }
        }, 120);
    }

    function createAutocomplete(container, role, waypointId = '') {
        if (!container || !runtime.places?.PlaceAutocompleteElement) return null;
        const key = routeWidgetKey(role, waypointId);
        container.innerHTML = '';
        const widget = new runtime.places.PlaceAutocompleteElement();
        widget.locationBias = JAPAN_SEARCH_BIAS;
        widget.requestedLanguage = 'ja';
        widget.requestedRegion = 'jp';
        widget.placeholder = role === 'origin' ? '出発地を検索' : role === 'destination' ? '目的地を検索' : '経由地を検索';
        widget.description = `${widget.placeholder}。Googleの候補から選択してください。`;
        widget.setAttribute('aria-label', widget.placeholder);
        const selected = getRolePlace(role, waypointId);
        if (selected) widget.value = `${selected.name}${selected.address ? `（${selected.address}）` : ''}`;
        widget.dataset.selectedPlaceId = selected?.placeId || '';
        widget.dataset.selectedValue = String(widget.value || '');
        widget.addEventListener('gmp-select', event => void resolvePrediction(event, role, waypointId));
        widget.addEventListener('gmp-error', event => {
            const info = classifyGoogleError(event?.error || event);
            setNotice(info.kind, '場所候補を取得できませんでした', info.subtitle, { retryable: true });
        });
        ['input', 'change', 'paste'].forEach(type => widget.addEventListener(type, () => handleAutocompleteInput(role, waypointId, widget)));
        container.appendChild(widget);
        runtime.autocompleteWidgets.set(key, widget);
        return widget;
    }

    function renderWaypoints() {
        const list = byId('routeWaypointList');
        if (!list) return;
        for (const key of Array.from(runtime.autocompleteWidgets.keys())) {
            if (key.startsWith('waypoint:')) runtime.autocompleteWidgets.delete(key);
        }
        list.innerHTML = runtime.waypointRows.map((item, index) => templates().routeWaypointRow(item, index, { escapeHtml })).join('');
        runtime.waypointRows.forEach(item => {
            const container = list.querySelector(`[data-route-waypoint-autocomplete="${CSS.escape(item.id)}"]`);
            createAutocomplete(container, 'waypoint', item.id);
            renderPlaceSummary('waypoint', item.place, item.id);
        });
        applyRuntimeAccessibilityFixes(list);
        const addButton = byId('addRouteWaypointBtn');
        if (addButton) {
            addButton.disabled = runtime.waypointRows.length >= MAX_WAYPOINTS;
            addButton.toggleAttribute('disabled', addButton.disabled);
        }
        setupWaypointSortable();
    }

    function setupWaypointSortable() {
        const list = byId('routeWaypointList');
        if (!list || typeof Sortable === 'undefined') return;
        if (runtime.waypointSortable) {
            try { runtime.waypointSortable.destroy(); } catch (error) {}
        }
        runtime.waypointSortable = new Sortable(list, {
            animation: 150,
            handle: '.route-waypoint-handle',
            forceFallback: true,
            fallbackOnBody: true,
            ghostClass: 'route-waypoint-drag-ghost',
            chosenClass: 'route-waypoint-drag-chosen',
            fallbackClass: 'route-waypoint-drag-fallback',
            onStart: () => document.body.classList.add('route-waypoint-dragging'),
            onEnd: () => {
                document.body.classList.remove('route-waypoint-dragging');
                const order = Array.from(list.querySelectorAll('[data-route-waypoint-id]')).map(row => row.dataset.routeWaypointId);
                runtime.waypointRows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
                renderWaypoints();
                persistPlannerState();
                scheduleRouteRequest('waypoint-reordered', 120);
            }
        });
    }

    function renderRoutes() {
        const state = plannerState();
        const list = byId('routeCandidateList');
        const summary = byId('routeLegSummary');
        const apply = byId('applyRouteDistanceBtn');
        const calculatedAt = byId('routePlannerCalculatedAt');
        const selected = getSelectedRoute(state);
        if (list) {
            list.innerHTML = state.routes.length
                ? state.routes.map((route, index) => templates().routeCandidateCard(route, index, index === state.selectedRouteIndex, state.roundTrip, { escapeHtml })).join('')
                : '<div class="route-candidate-empty">出発地と目的地を選ぶと、Google Routes APIの候補を表示します。</div>';
        }
        if (summary) summary.innerHTML = selected ? templates().routeLegSummary(selected, getOrderedPlaces(state), state.roundTrip, { escapeHtml }) : '';
        if (apply) apply.disabled = !selected || !state.targetCarName;
        if (calculatedAt) {
            calculatedAt.textContent = state.calculatedAt
                ? `${new Date(state.calculatedAt).toLocaleString('ja-JP')} に取得・選択中: ${selected?.label || 'なし'}`
                : '地点を選択すると自動で取得します。';
        }
        if (list) applyRuntimeAccessibilityFixes(list);
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

    function createMarker(place, index, total) {
        if (!runtime.map || !place) return;
        const position = { lat: place.latitude, lng: place.longitude };
        const label = index === 0 ? 'A' : index === total - 1 ? 'B' : String(index);
        let marker;
        if (runtime.marker?.AdvancedMarkerElement && global.SanpoGoogleMaps?.getConfig().mapId) {
            marker = new runtime.marker.AdvancedMarkerElement({ map: runtime.map, position, title: place.name });
        } else if (global.google?.maps?.Marker) {
            marker = new global.google.maps.Marker({ map: runtime.map, position, label, title: place.name });
        }
        if (marker) runtime.markers.push(marker);
    }

    function renderMapRoutes() {
        const state = plannerState();
        if (!runtime.map) return;
        clearMapOverlays();
        const bounds = new global.google.maps.LatLngBounds();
        const selectedIndex = state.selectedRouteIndex;
        state.routes.forEach((route, index) => {
            const path = routePath(route);
            if (!path?.length) return;
            path.forEach(point => bounds.extend(point));
            const selected = index === selectedIndex;
            const polyline = new global.google.maps.Polyline({
                map: runtime.map,
                path,
                clickable: true,
                strokeColor: selected ? '#0f62fe' : '#8d8d8d',
                strokeOpacity: selected ? 1 : 0.55,
                strokeWeight: selected ? 7 : 5,
                zIndex: selected ? 20 : 10
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
        setMapEmpty(state.routes.length ? '' : '出発地と目的地をGoogle候補から選択してください。');
    }

    function applyMapTheme() {
        if (!runtime.map) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        runtime.map.setOptions({ styles: dark ? DARK_MAP_STYLES : null });
        renderMapRoutes();
    }

    async function initializeMap() {
        if (runtime.map) return runtime.map;
        const mapNode = byId('routeMap');
        if (!mapNode) throw new Error('地図の表示領域が見つかりません。');
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
            gestureHandling: matchMedia('(pointer: coarse)').matches ? 'cooperative' : 'greedy'
        });
        applyMapTheme();
        global.google.maps.event.addListenerOnce(runtime.map, 'idle', () => setMapSkeleton(false));
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
            createAutocomplete(byId('routeOriginAutocomplete'), 'origin');
            createAutocomplete(byId('routeDestinationAutocomplete'), 'destination');
            renderWaypoints();
            return libraries;
        })().catch(error => {
            runtime.initializing = null;
            throw error;
        });
        return runtime.initializing;
    }

    function routeRequest(state) {
        const location = place => {
            if (runtime.places?.Place && place?.placeId) {
                try { return new runtime.places.Place({ id: place.placeId }); } catch (error) {}
            }
            return { lat: place.latitude, lng: place.longitude };
        };
        const waypoint = place => ({ location: location(place), vehicleStopover: true });
        const request = {
            origin: location(state.origin),
            destination: location(state.destination),
            intermediates: state.waypoints.map(waypoint),
            travelMode: 'DRIVING',
            routingPreference: 'TRAFFIC_AWARE',
            computeAlternativeRoutes: state.waypoints.length === 0,
            routeModifiers: {
                avoidTolls: state.avoidTolls,
                avoidHighways: state.avoidHighways,
                avoidFerries: state.avoidFerries
            },
            language: 'ja-JP',
            region: 'JP',
            units: 'METRIC',
            polylineQuality: 'HIGH_QUALITY',
            extraComputations: ['TOLLS'],
            fields: ROUTE_FIELDS
        };
        if (!request.intermediates.length) delete request.intermediates;
        return request;
    }

    async function requestRoutesIfReady(reason = '') {
        const state = persistPlannerState();
        if (!state.origin || !state.destination) {
            runtime.requestSequence += 1;
            state.routes = [];
            state.selectedRouteIndex = 0;
            state.calculatedAt = 0;
            persistPlannerState();
            renderRoutes();
            renderMapRoutes();
            setLoading(false);
            return;
        }
        await initializeGoogleFeatures();
        const requestId = ++runtime.requestSequence;
        setLoading(true);
        setNotice('info', 'ルート候補を取得しています', '地点と回避設定をGoogle Routes APIへ送信しています。');
        try {
            const initialRequest = routeRequest(state);
            let response;
            try {
                response = await runtime.routes.Route.computeRoutes(initialRequest);
            } catch (initialError) {
                if (!canRetryWithoutTolls(initialError)) throw initialError;
                const basicRequest = { ...initialRequest };
                delete basicRequest.extraComputations;
                basicRequest.fields = ROUTE_FIELDS.filter(field => field !== 'travelAdvisory');
                response = await runtime.routes.Route.computeRoutes(basicRequest);
            }
            if (requestId !== runtime.requestSequence) return;
            const rawRoutes = Array.from(response.routes || []);
            if (!rawRoutes.length) throw new Error('No routes returned.');
            runtime.routePaths.clear();
            const places = getOrderedPlaces(state);
            state.routes = rawRoutes.map((route, index) => serializeRoute(route, index, places));
            state.selectedRouteIndex = defaultRouteIndex(rawRoutes);
            state.calculatedAt = Date.now();
            persistPlannerState();
            renderRoutes();
            renderMapRoutes();
            if (state.waypoints.length) {
                setNotice('info', '経由地を含むルートは1件表示される場合があります', 'Google Routes APIは中間経由地を含むリクエストでは代替ルートを返しません。');
            } else if (response.fallbackInfo) {
                setNotice('warning', '別の計算方式で取得しました', 'Google側でルート計算がフォールバックされました。');
            } else {
                setNotice('', '', '');
            }
        } catch (error) {
            if (requestId !== runtime.requestSequence) return;
            state.routes = [];
            state.selectedRouteIndex = 0;
            state.calculatedAt = 0;
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

    function moveWaypoint(id, direction) {
        const index = runtime.waypointRows.findIndex(row => row.id === id);
        if (index < 0) return;
        const targetIndex = direction === 'first'
            ? 0
            : direction === 'last'
                ? runtime.waypointRows.length - 1
                : Math.min(runtime.waypointRows.length - 1, Math.max(0, index + Number(direction || 0)));
        if (targetIndex === index) return;
        const [row] = runtime.waypointRows.splice(index, 1);
        runtime.waypointRows.splice(targetIndex, 0, row);
        renderWaypoints();
        persistPlannerState();
        requestAnimationFrame(() => {
            /** @type {HTMLElement | null} */
            const movedHandle = document.querySelector(`[data-route-waypoint-id="${CSS.escape(id)}"] .route-waypoint-handle`);
            movedHandle?.focus({ preventScroll: true });
        });
        scheduleRouteRequest('waypoint-keyboard-reordered', 120);
    }

    function addWaypoint() {
        if (runtime.waypointRows.length >= MAX_WAYPOINTS) {
            setNotice('warning', '経由地は25件までです', 'Google Routes APIの上限に合わせています。');
            return;
        }
        runtime.waypointRows.push({ id: createWaypointId(), place: null });
        renderWaypoints();
        const last = runtime.waypointRows[runtime.waypointRows.length - 1];
        const widget = runtime.autocompleteWidgets.get(routeWidgetKey('waypoint', last.id));
        widget?.focus?.({ preventScroll: false });
    }

    function removeWaypoint(id) {
        runtime.waypointRows = runtime.waypointRows.filter(row => row.id !== id);
        renderWaypoints();
        persistPlannerState();
        scheduleRouteRequest('waypoint-removed', 120);
    }

    function updateOptionsFromControls() {
        const state = plannerState();
        state.avoidTolls = Boolean(byId('routeAvoidTolls')?.checked);
        state.avoidHighways = Boolean(byId('routeAvoidHighways')?.checked);
        state.avoidFerries = Boolean(byId('routeAvoidFerries')?.checked);
        state.roundTrip = Boolean(byId('routeRoundTrip')?.checked);
        persistPlannerState();
        renderRoutes();
    }

    function syncControlsFromState() {
        const state = plannerState();
        const controls = {
            routeAvoidTolls: state.avoidTolls,
            routeAvoidHighways: state.avoidHighways,
            routeAvoidFerries: state.avoidFerries,
            routeRoundTrip: state.roundTrip
        };
        Object.entries(controls).forEach(([id, checked]) => {
            const control = byId(id);
            if (!control) return;
            control.checked = checked;
            control.toggleAttribute('checked', checked);
        });
    }

    function initializeWaypointRows() {
        runtime.waypointRows = plannerState().waypoints.map(place => ({ id: createWaypointId(), place }));
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
        setTimeout(() => global.openSettlementCarEditor?.(encodeURIComponent(name)), 100);
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
        settlement.routePlanner = normalizeRoutePlannerState(state);
        renderSettlementView({ force: true });
        save();
        runtime.applyInProgress = true;
        runtime.returnAfterClose = true;
        closePlanner({ apply: true });
    }

    async function openPlanner(options = {}) {
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
        updateContextLabel();
        renderRoutes();
        setNotice('', '', '');
        setMapEmpty('Google Mapsを読み込んでいます。');
        setMapSkeleton(true);
        modals.routeDistance?.show();
        pushRouteHistoryState();
        try {
            await initializeGoogleFeatures();
            createAutocomplete(byId('routeOriginAutocomplete'), 'origin');
            createAutocomplete(byId('routeDestinationAutocomplete'), 'destination');
            renderWaypoints();
            renderPlaceSummary('origin', state.origin);
            renderPlaceSummary('destination', state.destination);
            renderRoutes();
            renderMapRoutes();
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

    async function retryRoutePlanner() {
        setRetryVisible(false);
        setNotice('info', '再試行しています', 'Google Mapsとルート候補をもう一度取得しています。');
        try {
            if (!runtime.map || !runtime.maps || !runtime.places || !runtime.routes) {
                runtime.initializing = null;
                await initializeGoogleFeatures();
                createAutocomplete(byId('routeOriginAutocomplete'), 'origin');
                createAutocomplete(byId('routeDestinationAutocomplete'), 'destination');
                renderWaypoints();
                renderPlaceSummary('origin', plannerState().origin);
                renderPlaceSummary('destination', plannerState().destination);
            }
            if (plannerState().origin && plannerState().destination) await requestRoutesIfReady('manual-retry');
            else {
                setMapSkeleton(false);
                setMapEmpty('出発地と目的地をGoogle候補から選択してください。');
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
        global.saveSettlementCarEditDraft?.();
        modals.settlementCarEdit?.hide();
        setTimeout(() => void openPlanner({ targetCarName: targetName }), 120);
    };

    global.addRouteWaypoint = addWaypoint;
    global.removeRouteWaypoint = removeWaypoint;
    global.selectGoogleRoute = selectRoute;
    global.applySelectedRouteDistance = applySelectedDistance;
    global.closeRoutePlanner = () => closePlanner();
    global.refreshGoogleRoutes = () => requestRoutesIfReady('manual');
    global.retryGoogleRoutePlanner = retryRoutePlanner;

    function bindPlannerEvents() {
        byId('addRouteWaypointBtn')?.addEventListener('click', addWaypoint);
        byId('routeWaypointList')?.addEventListener('keydown', event => {
            const handle = event.target.closest?.('.route-waypoint-handle');
            const row = handle?.closest?.('[data-route-waypoint-id]');
            if (!handle || !row) return;
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            moveWaypoint(row.dataset.routeWaypointId, event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : event.key === 'Home' ? 'first' : 'last');
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
        ['routeAvoidTolls', 'routeAvoidHighways', 'routeAvoidFerries'].forEach(id => {
            byId(id)?.addEventListener('change', () => {
                updateOptionsFromControls();
                scheduleRouteRequest('modifier-changed', 250);
            });
        });
        byId('routeRoundTrip')?.addEventListener('change', () => {
            updateOptionsFromControls();
            renderRoutes();
        });
        const modal = byId('routeDistanceModal');
        if (modal && modal.dataset.googleRoutesBound !== 'true') {
            modal.dataset.googleRoutesBound = 'true';
            modal.addEventListener('sanpo:modal-hiding', () => {
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
