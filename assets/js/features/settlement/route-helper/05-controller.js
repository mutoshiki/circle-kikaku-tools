// Carbon route-planner UI controller: Places (New), Routes API, map, persistence and exact car return flow.
(function (global) {
  'use strict';

  const templates = () => global.SanpoApp?.templates?.settlement || global.SanpoApp?.settlementTemplateParts || {};
  let initialized = false;
  let libraries = null;
  let originWidget = null;
  let destinationWidget = null;
  let waypointWidgets = [];
  let waypointDrafts = [];
  let routeSortable = null;
  let runtimeRoutes = [];
  let requestSequence = 0;
  let refreshTimer = 0;
  let pendingRequestKey = '';
  let pendingRequestPromise = null;
  let lastCompletedRequestKey = '';
  let routeHistoryActive = false;
  let closingFromHistory = false;
  let suppressCarReturn = false;

  function byRouteId(id) { return document.getElementById(id); }

  function plainRoute(route) {
    const { _nativeRoute, _path, ...stored } = route || {};
    return stored;
  }

  function invalidatePendingRouteRequests() {
    requestSequence += 1;
    if (refreshTimer) global.clearTimeout(refreshTimer);
    refreshTimer = 0;
    pendingRequestKey = '';
    pendingRequestPromise = null;
    setLoading(false);
  }

  function routeRequestKey(state) {
    return JSON.stringify({
      origin: state.origin?.placeId || '',
      waypoints: (state.waypoints || []).map(place => place?.placeId || ''),
      destination: state.destination?.placeId || '',
      avoidTolls: state.avoidTolls === true,
      avoidHighways: state.avoidHighways === true,
      avoidFerries: state.avoidFerries === true
    });
  }

  function scheduleRouteRefresh(reason, delay = 180) {
    if (refreshTimer) global.clearTimeout(refreshTimer);
    refreshTimer = global.setTimeout(() => {
      refreshTimer = 0;
      void refreshRoutes(reason);
    }, delay);
  }

  function setRouteHelperStatus(message, kind = 'info', title = '') {
    const host = byRouteId('routeHelperStatus');
    const titleNode = byRouteId('routeHelperStatusTitle');
    const subtitleNode = byRouteId('routeHelperStatusMessage');
    if (!host || !titleNode || !subtitleNode) return;
    const text = String(message || '').trim();
    host.hidden = !text;
    host.kind = kind;
    host.setAttribute('kind', kind);
    titleNode.textContent = title || ({
      error: 'ルートを取得できません',
      warning: '確認してください',
      success: '距離を反映しました'
    }[kind] || 'Google Maps 距離計算');
    subtitleNode.textContent = text;
  }

  function setLoading(active, text = 'ルート候補を取得しています') {
    const host = byRouteId('routeLoading');
    const refresh = byRouteId('routeRefreshBtn');
    const skeleton = byRouteId('routeResultSkeleton');
    const resultList = byRouteId('routeResultList');
    if (host) {
      host.hidden = !active;
      const inline = host.querySelector('cds-inline-loading');
      if (inline) {
        inline.status = active ? 'active' : 'finished';
        inline.setAttribute('status', active ? 'active' : 'finished');
        inline.textContent = text;
      }
    }
    const showSkeleton = active && getRoutePlannerState().routes.length === 0;
    if (skeleton) skeleton.hidden = !showSkeleton;
    if (resultList) resultList.hidden = showSkeleton;
    if (refresh) refresh.disabled = active || !canCalculateRoute();
    byRouteId('routeDistanceModal')?.setAttribute('aria-busy', active ? 'true' : 'false');
    byRouteId('routeResultList')?.setAttribute('aria-busy', active ? 'true' : 'false');
  }

  function canCalculateRoute() {
    const state = getRoutePlannerState();
    return !!(state.origin?.placeId && state.destination?.placeId && waypointDrafts.every(Boolean));
  }

  function updateActionState() {
    const state = getRoutePlannerState();
    const apply = byRouteId('routeApplyBtn');
    const refresh = byRouteId('routeRefreshBtn');
    const selected = state.routes[state.selectedRouteIndex];
    if (apply) {
      const disabled = !(selected && state.targetCarId);
      apply.disabled = disabled;
      apply.toggleAttribute('disabled', disabled);
      apply.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (refresh) {
      const disabled = !canCalculateRoute();
      refresh.disabled = disabled;
      refresh.toggleAttribute('disabled', disabled);
      refresh.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  }

  function displayPlaceDetail(element, place) {
    if (!element) return;
    if (!place) {
      element.hidden = true;
      element.textContent = '';
      return;
    }
    element.hidden = false;
    element.textContent = place.address && place.address !== place.name ? place.address : place.name;
  }

  function roleLabel(role, index) {
    if (role === 'origin') return '出発地';
    if (role === 'destination') return '目的地';
    return `経由地${index + 1}`;
  }

  function getPredictionPlace(event) {
    return event?.placePrediction?.toPlace?.() || event?.place || null;
  }

  function createAutocomplete(host, role, index = -1, selectedPlace = null) {
    const { PlaceAutocompleteElement } = libraries.places;
    if (!PlaceAutocompleteElement) throw new Error('Places API (New) の検索コンポーネントを利用できません。');
    const widget = new PlaceAutocompleteElement();
    // Bias results toward Japan without excluding overseas destinations. The widget
    // localizes itself from the document/browser language, per the Places (New) contract.
    widget.locationBias = { north: 45.8, south: 24.0, east: 146.0, west: 122.0 };
    widget.requestedLanguage = 'ja';
    widget.requestedRegion = 'jp';
    widget.unitSystem = libraries.google?.maps?.UnitSystem?.METRIC || 'METRIC';
    widget.lang = 'ja';
    widget.className = 'route-place-autocomplete';
    widget.placeholder = role === 'origin' ? '出発地を検索' : role === 'destination' ? '目的地を検索' : '経由地を検索';
    widget.description = `${roleLabel(role, index)}をGoogle Mapsから検索`;
    widget.setAttribute('aria-label', `${roleLabel(role, index)}を検索`);
    widget.setAttribute('aria-labelledby', role === 'origin' ? 'routeOriginLabel' : role === 'destination' ? 'routeDestinationLabel' : `routeWaypointLabel${index}`);
    widget.noInputIcon = true;
    widget.value = selectedPlace?.name || selectedPlace?.address || '';
    widget.dataset.routeRole = role;
    if (index >= 0) widget.dataset.waypointIndex = String(index);

    widget.addEventListener('gmp-select', async event => {
      try {
        const place = getPredictionPlace(event);
        if (!place) throw new Error('選択した場所を取得できませんでした。');
        await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
        const location = place.location;
        const normalized = normalizeRoutePlace({
          placeId: place.id,
          name: place.displayName || place.formattedAddress,
          address: place.formattedAddress || place.displayName,
          latitude: typeof location?.lat === 'function' ? location.lat() : location?.lat,
          longitude: typeof location?.lng === 'function' ? location.lng() : location?.lng
        });
        if (!normalized) throw new Error('地点の緯度・経度を取得できませんでした。');
        setSelectedPlace(role, index, normalized, { recalculate: false });
        widget.value = normalized.name || normalized.address;
        setRouteHelperStatus('');
        if (canCalculateRoute()) await refreshRoutes('place-selected');
        else clearRouteResults('出発地と目的地をGoogle候補から選択してください。', { invalidate: false });
      } catch (error) {
        setRouteHelperStatus(formatMapsError(error, '地点情報の取得に失敗しました。'), 'error', '場所を選択できません');
      }
    });

    widget.addEventListener('gmp-error', () => {
      setRouteHelperStatus('検索候補を取得できません。API制限または通信状態を確認してください。', 'error', '場所検索に失敗しました');
    });

    widget.addEventListener('input', () => {
      const state = getRoutePlannerState();
      const selected = role === 'origin' ? state.origin : role === 'destination' ? state.destination : waypointDrafts[index];
      const selectedText = selected?.name || selected?.address || '';
      if (selected && String(widget.value || '').trim() !== selectedText.trim()) {
        setSelectedPlace(role, index, null, { recalculate: false });
        clearRouteResults('入力中です。Google候補から地点を選択してください。');
      }
    });

    host.replaceChildren(widget);
    return widget;
  }

  function setSelectedPlace(role, index, place, options = {}) {
    const state = getRoutePlannerState();
    if (role === 'origin') {
      state.origin = place;
      displayPlaceDetail(byRouteId('routeOriginDetail'), place);
    } else if (role === 'destination') {
      state.destination = place;
      displayPlaceDetail(byRouteId('routeDestinationDetail'), place);
    } else {
      waypointDrafts[index] = place;
      state.waypoints = waypointDrafts.filter(Boolean);
      displayPlaceDetail(document.querySelector(`[data-waypoint-detail="${index}"]`), place);
    }
    state.routes = [];
    state.selectedRouteIndex = 0;
    state.calculatedAt = 0;
    setRoutePlannerState(state, { persist: true });
    updateActionState();
    if (options.recalculate !== false && canCalculateRoute()) void refreshRoutes('place-change');
  }

  function renderWaypointRows() {
    const list = byRouteId('routeWaypointList');
    if (!list) return;
    const tpl = templates();
    list.innerHTML = waypointDrafts.map((place, index) => tpl.routeWaypointRow(place, index, { escapeHtml: global.escapeHtml })).join('');
    global.SanpoCarbon?.renderCarbonIcons?.(list);
    waypointWidgets = waypointDrafts.map((place, index) => createAutocomplete(byRouteId(`routeWaypointAutocompleteHost${index}`), 'waypoint', index, place));
    setupWaypointSortable();
  }

  function setupWaypointSortable() {
    const list = byRouteId('routeWaypointList');
    if (!list || typeof Sortable === 'undefined') return;
    try { routeSortable?.destroy?.(); } catch (_) {}
    routeSortable = new Sortable(list, {
      animation: 150,
      handle: '.route-waypoint-drag',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackClass: 'route-waypoint-fallback',
      ghostClass: 'route-waypoint-ghost',
      chosenClass: 'route-waypoint-chosen',
      onEnd: event => {
        if (!Number.isInteger(event.oldIndex) || !Number.isInteger(event.newIndex) || event.oldIndex === event.newIndex) return;
        const [moved] = waypointDrafts.splice(event.oldIndex, 1);
        waypointDrafts.splice(event.newIndex, 0, moved);
        const state = getRoutePlannerState();
        state.waypoints = waypointDrafts.filter(Boolean);
        state.routes = [];
        state.selectedRouteIndex = 0;
        setRoutePlannerState(state, { persist: true });
        renderWaypointRows();
        clearRouteResults('経由地の順番を変更しました。ルートを再取得します。');
        if (canCalculateRoute()) scheduleRouteRefresh('waypoint-reorder', 120);
      }
    });
  }

  function addWaypoint() {
    if (waypointDrafts.length >= 8) {
      setRouteHelperStatus('経由地は8件まで追加できます。', 'warning');
      return;
    }
    waypointDrafts.push(null);
    renderWaypointRows();
    clearRouteResults('追加した経由地をGoogle候補から選択してください。');
    requestAnimationFrame(() => waypointWidgets.at(-1)?.focus?.());
  }

  function removeWaypoint(index) {
    if (!Number.isInteger(index) || index < 0 || index >= waypointDrafts.length) return;
    waypointDrafts.splice(index, 1);
    const state = getRoutePlannerState();
    state.waypoints = waypointDrafts.filter(Boolean);
    state.routes = [];
    state.selectedRouteIndex = 0;
    setRoutePlannerState(state, { persist: true });
    renderWaypointRows();
    if (canCalculateRoute()) scheduleRouteRefresh('waypoint-remove', 120);
    else clearRouteResults('出発地と目的地をGoogle候補から選択してください。');
  }

  function formatMapsError(error, fallback) {
    const message = [error?.message, error?.status, error?.code, error?.name, error]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' ');
    if (/quota|resource_exhausted|rate|limit|429/i.test(message)) return 'API利用上限に達したか、短時間にリクエストが集中しました。少し待ってから再試行してください。';
    if (/permission|denied|key|referer|referrer|api.*enabled|403/i.test(message)) return 'Google Maps APIの利用が拒否されました。APIキーのリファラー制限とAPI制限を確認してください。';
    if (/zero_results|not found|no route|ルート.*見つか/i.test(message)) return '指定した地点と条件ではルートが見つかりませんでした。地点または回避条件を変更してください。';
    if (/network|fetch|load|internet|timeout/i.test(message)) return '通信に失敗しました。ネットワーク接続を確認して再試行してください。';
    return message || fallback;
  }

  function clearRouteResults(note = '', options = {}) {
    if (options.invalidate !== false) invalidatePendingRouteRequests();
    const state = getRoutePlannerState();
    state.routes = [];
    state.selectedRouteIndex = 0;
    setRoutePlannerState(state, { persist: true });
    runtimeRoutes = [];
    const list = byRouteId('routeResultList');
    if (list) {
      list.innerHTML = '';
      list.hidden = false;
    }
    const skeleton = byRouteId('routeResultSkeleton');
    if (skeleton) skeleton.hidden = true;
    const summary = byRouteId('routeSummary');
    if (summary) summary.hidden = true;
    const noteNode = byRouteId('routeResultsNote');
    if (noteNode) noteNode.textContent = note || '出発地と目的地をGoogle候補から選択してください。';
    if (libraries) void renderRouteMap([], state, 0, selectRoute, libraries);
    updateActionState();
  }

  async function refreshRoutes(reason = 'manual') {
    const state = getRoutePlannerState();
    state.waypoints = waypointDrafts.filter(Boolean);
    if (!state.origin?.placeId || !state.destination?.placeId) {
      clearRouteResults('出発地と目的地をGoogle候補から選択してください。');
      return;
    }
    if (!waypointDrafts.every(Boolean)) {
      clearRouteResults('すべての経由地をGoogle候補から選択してください。');
      return;
    }

    const requestKey = routeRequestKey(state);
    const dedupeEligible = new Set([
      'place-selected', 'place-change', 'modifier-change',
      'waypoint-reorder', 'waypoint-remove', 'restore'
    ]).has(reason);
    if (dedupeEligible && requestKey === lastCompletedRequestKey && state.routes.length) {
      runtimeRoutes = state.routes;
      renderRouteResults();
      if (libraries) await renderRouteMap(runtimeRoutes, state, state.selectedRouteIndex, selectRoute, libraries);
      return;
    }
    if (dedupeEligible && pendingRequestPromise && pendingRequestKey === requestKey) return pendingRequestPromise;

    const previousSelectedId = state.routes[state.selectedRouteIndex]?.id || '';
    const sequence = ++requestSequence;
    setLoading(true);
    setRouteHelperStatus('');
    const note = byRouteId('routeResultsNote');
    if (note) note.textContent = 'ルート候補を取得しています…';

    const requestPromise = (async () => {
      try {
        const result = await computeSanpoRoutes(state);
        if (sequence !== requestSequence) return;
        libraries = result.libraries;
        runtimeRoutes = result.routes;
        state.routes = result.routes.map(plainRoute);
        const retainedIndex = previousSelectedId
          ? state.routes.findIndex(route => route.id === previousSelectedId)
          : -1;
        state.selectedRouteIndex = retainedIndex >= 0 ? retainedIndex : 0;
        state.calculatedAt = Date.now();
        lastCompletedRequestKey = requestKey;
        setRoutePlannerState(state, { persist: true, remote: reason !== 'restore' });
        renderRouteResults();
        await renderRouteMap(runtimeRoutes, state, state.selectedRouteIndex, selectRoute, libraries);
        if (sequence !== requestSequence) return;
        if (result.hasWaypoints && runtimeRoutes.length === 1) {
          setRouteHelperStatus('経由地を含むリクエストでは代替ルートが返らない場合があります。現在の条件で取得できたルートを表示しています。', 'info', 'ルート候補について');
        }
        document.dispatchEvent(new CustomEvent('sanpo:routes-updated', { detail: { reason, count: runtimeRoutes.length } }));
      } catch (error) {
        if (sequence !== requestSequence) return;
        clearRouteResults('ルート候補を取得できませんでした。', { invalidate: false });
        setRouteHelperStatus(formatMapsError(error, 'ルート候補の取得に失敗しました。'), 'error');
      } finally {
        if (sequence === requestSequence) setLoading(false);
      }
    })();
    pendingRequestKey = requestKey;
    pendingRequestPromise = requestPromise;
    try {
      return await requestPromise;
    } finally {
      if (pendingRequestPromise === requestPromise) {
        pendingRequestPromise = null;
        pendingRequestKey = '';
      }
    }
  }

  function renderRouteResults() {
    const state = getRoutePlannerState();
    const routes = runtimeRoutes.length ? runtimeRoutes : state.routes;
    const list = byRouteId('routeResultList');
    const note = byRouteId('routeResultsNote');
    if (!list) return;
    const tpl = templates();
    const skeleton = byRouteId('routeResultSkeleton');
    if (skeleton) skeleton.hidden = true;
    list.hidden = false;
    list.innerHTML = routes.map((route, index) => tpl.routeResultTile(route, index, index === state.selectedRouteIndex, { escapeHtml: global.escapeHtml, routeCount: routes.length })).join('');
    global.SanpoCarbon?.renderCarbonIcons?.(list);
    if (note) note.textContent = `${routes.length}件の候補を表示しています。地図上の線からも選択できます。`;
    renderSelectedRouteSummary();
    updateActionState();
  }

  function selectRoute(index) {
    const state = getRoutePlannerState();
    const routes = runtimeRoutes.length ? runtimeRoutes : state.routes;
    if (!Number.isInteger(index) || !routes[index]) return;
    state.selectedRouteIndex = index;
    setRoutePlannerState(state, { persist: true });
    document.querySelectorAll('#routeResultList [data-route-index]').forEach((tile, tileIndex) => {
      const active = tileIndex === index;
      tile.toggleAttribute('selected', active);
      tile.selected = active;
      tile.setAttribute('data-selected', active ? 'true' : 'false');
      tile.setAttribute('aria-checked', active ? 'true' : 'false');
      tile.setAttribute('tabindex', active ? '0' : '-1');
    });
    selectRouteOnMap(index, routes[index]);
    renderSelectedRouteSummary();
    updateActionState();
    document.dispatchEvent(new CustomEvent('sanpo:route-selected', { detail: { index, routeId: routes[index].id } }));
  }

  function renderSelectedRouteSummary() {
    const state = getRoutePlannerState();
    const routes = runtimeRoutes.length ? runtimeRoutes : state.routes;
    const route = routes[state.selectedRouteIndex];
    const summary = byRouteId('routeSummary');
    if (!summary || !route) {
      if (summary) summary.hidden = true;
      return;
    }
    summary.hidden = false;
    const tpl = templates();
    byRouteId('routeSummaryName').textContent = route.label;
    byRouteId('routeSummaryDistance').textContent = tpl.formatRouteDistance(route.distanceMeters);
    byRouteId('routeSummaryDuration').textContent = tpl.formatRouteDuration(route.durationSeconds);
    byRouteId('routeSummaryRoundTrip').textContent = tpl.formatRouteDistance(route.distanceMeters * 2);
    const legs = byRouteId('routeLegList');
    if (legs) legs.innerHTML = (route.legs || []).map(tpl.routeLegRow).join('');
  }

  function syncOptionControls() {
    const state = getRoutePlannerState();
    const mapping = {
      routeAvoidTolls: 'avoidTolls',
      routeAvoidHighways: 'avoidHighways',
      routeAvoidFerries: 'avoidFerries',
      routeRoundTrip: 'roundTrip'
    };
    Object.entries(mapping).forEach(([id, key]) => {
      const control = byRouteId(id);
      if (control) control.checked = state[key] === true;
    });
  }

  function readCheckedControl(control) {
    if (!control) return false;
    return control.checked === true || control.hasAttribute('checked');
  }

  async function initializeRouteHelperUi() {
    if (initialized) return;
    initialized = true;
    const modal = byRouteId('routeDistanceModal');
    if (!modal) return;

    byRouteId('routeAddWaypointBtn')?.addEventListener('click', addWaypoint);
    byRouteId('routeRefreshBtn')?.addEventListener('click', () => refreshRoutes('manual'));
    byRouteId('routeApplyBtn')?.addEventListener('click', applySelectedRouteDistance);
    byRouteId('routeCancelBtn')?.addEventListener('click', () => modals.routeDistance?.hide());

    byRouteId('routeWaypointList')?.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-route-waypoint-delete]');
      if (button instanceof HTMLElement) removeWaypoint(Number(button.dataset.routeWaypointDelete));
    });
    const resultList = byRouteId('routeResultList');
    resultList?.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const tile = target?.closest('[data-route-index]');
      if (tile instanceof HTMLElement) selectRoute(Number(tile.dataset.routeIndex));
    });
    resultList?.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      const pathTile = event.composedPath?.().find(node => node instanceof HTMLElement && node.dataset.routeIndex !== undefined);
      const tile = target?.closest('[data-route-index]') || pathTile;
      if (tile instanceof HTMLElement) selectRoute(Number(tile.dataset.routeIndex));
    });
    resultList?.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      const tiles = Array.from(resultList.querySelectorAll('[data-route-index]'));
      if (!tiles.length) return;
      const pathTile = event.composedPath?.().find(node => node instanceof HTMLElement && node.dataset.routeIndex !== undefined);
      const current = pathTile instanceof HTMLElement ? pathTile : document.activeElement?.closest?.('[data-route-index]');
      const currentIndex = Math.max(0, tiles.indexOf(current));
      let nextIndex = currentIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tiles.length - 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tiles.length;
      else nextIndex = (currentIndex - 1 + tiles.length) % tiles.length;
      event.preventDefault();
      selectRoute(nextIndex);
      const nextTile = tiles[nextIndex];
      if (nextTile instanceof HTMLElement) nextTile.focus();
    });

    const optionMap = {
      routeAvoidTolls: 'avoidTolls',
      routeAvoidHighways: 'avoidHighways',
      routeAvoidFerries: 'avoidFerries',
      routeRoundTrip: 'roundTrip'
    };
    Object.entries(optionMap).forEach(([id, key]) => {
      const control = byRouteId(id);
      control?.addEventListener('change', () => {
        const state = getRoutePlannerState();
        state[key] = readCheckedControl(control);
        if (key === 'roundTrip') {
          setRoutePlannerState(state, { persist: true });
          renderSelectedRouteSummary();
          return;
        }
        state.routes = [];
        state.selectedRouteIndex = 0;
        setRoutePlannerState(state, { persist: true });
        if (canCalculateRoute()) scheduleRouteRefresh('modifier-change');
        else clearRouteResults('出発地と目的地をGoogle候補から選択してください。');
      });
    });

    modal.addEventListener('sanpo:modal-hiding', () => {
      invalidatePendingRouteRequests();
      if (routeHistoryActive && !closingFromHistory && history.state?.sanpoRouteHelper) {
        routeHistoryActive = false;
        history.back();
      }
    });
    modal.addEventListener('sanpo:modal-hidden', () => {
      originWidget = null;
      destinationWidget = null;
      waypointWidgets = [];
      try { routeSortable?.destroy?.(); } catch (_) {}
      routeSortable = null;
      if (!suppressCarReturn) returnToSourceCar();
    });
    global.addEventListener('popstate', () => {
      if (!routeHistoryActive || !modal.open) return;
      closingFromHistory = true;
      routeHistoryActive = false;
      modals.routeDistance?.hide();
      queueMicrotask(() => { closingFromHistory = false; });
    });
  }

  async function prepareRouteHelperWidgets() {
    libraries = await loadSanpoGoogleMapsLibraries();
    const state = getRoutePlannerState();
    waypointDrafts = [...(state.waypoints || [])];
    originWidget = createAutocomplete(byRouteId('routeOriginAutocompleteHost'), 'origin', -1, state.origin);
    destinationWidget = createAutocomplete(byRouteId('routeDestinationAutocompleteHost'), 'destination', -1, state.destination);
    displayPlaceDetail(byRouteId('routeOriginDetail'), state.origin);
    displayPlaceDetail(byRouteId('routeDestinationDetail'), state.destination);
    renderWaypointRows();
    syncOptionControls();
    await ensureRouteMap(libraries);
    if (state.routes.length) {
      runtimeRoutes = state.routes;
      renderRouteResults();
      await renderRouteMap(runtimeRoutes, state, state.selectedRouteIndex, selectRoute, libraries);
    } else {
      runtimeRoutes = [];
      clearRouteResults('出発地と目的地をGoogle候補から選択してください。', { invalidate: false });
    }
  }

  function pushRouteHistory() {
    if (history.state?.sanpoRouteHelper) {
      routeHistoryActive = true;
      return;
    }
    history.pushState({ ...(history.state || {}), sanpoRouteHelper: true }, '', location.href);
    routeHistoryActive = true;
  }

  async function showRouteHelper(context = {}) {
    await initializeRouteHelperUi();
    const state = getRoutePlannerState();
    const hasExplicitTarget = Object.prototype.hasOwnProperty.call(context, 'targetCarId');
    // This feature is car-scoped. Never reuse a previously stored car when no opener context is supplied.
    state.targetCarId = String(hasExplicitTarget ? context.targetCarId : '').trim();
    state.returnTo = state.targetCarId ? 'carSettlement' : 'settlementSummary';
    setRoutePlannerState(state, { persist: true });

    const target = byRouteId('routeTargetCar');
    if (target) {
      target.hidden = !state.targetCarId;
      target.textContent = state.targetCarId ? `${state.targetCarId}車へ距離を適用します` : '';
    }
    setRouteHelperStatus(
      state.targetCarId ? '' : '車の費用画面から開いてください。距離は車を特定できる場合だけ適用できます。',
      state.targetCarId ? 'info' : 'warning',
      state.targetCarId ? '' : '適用先の車がありません'
    );
    setLoading(true, 'Google Mapsを読み込んでいます');
    const placeholder = byRouteId('routeMapPlaceholder');
    if (placeholder) {
      placeholder.hidden = false;
      const label = placeholder.querySelector(':scope > span');
      if (label) label.textContent = '地図を読み込んでいます';
    }
    modals.routeDistance?.show();
    pushRouteHistory();
    try {
      await prepareRouteHelperWidgets();
    } catch (error) {
      setRouteHelperStatus(formatMapsError(error, 'Google Mapsを読み込めませんでした。'), 'error', '地図を読み込めません');
      if (placeholder) {
        placeholder.hidden = false;
        const label = placeholder.querySelector(':scope > span');
        if (label) label.textContent = '地図を読み込めませんでした';
      }
    } finally {
      setLoading(false);
      updateActionState();
    }
  }

  function openRouteDistanceHelper(context = {}) {
    return showRouteHelper(context);
  }

  function openRouteDistanceHelperFromShortcut() {
    saveSettlementCarEditDraft?.();
    const targetCarId = String(global.getActiveSettlementCarEditName?.() || '').trim();
    if (!targetCarId) {
      global.showStatus?.('距離を反映する車を特定できませんでした。車の費用画面から開き直してください。', 'error');
      return;
    }
    suppressCarReturn = true;
    modals.settlementCarEdit?.hide();
    setTimeout(() => {
      suppressCarReturn = false;
      void showRouteHelper({ targetCarId, returnTo: 'carSettlement' });
    }, 120);
  }

  function applySelectedRouteDistance() {
    const state = getRoutePlannerState();
    const route = state.routes[state.selectedRouteIndex];
    const targetCarId = String(state.targetCarId || '');
    const settlement = ensureSettlementState();
    if (!route) {
      setRouteHelperStatus('適用するルートを選択してください。', 'warning');
      return;
    }
    if (!targetCarId || !settlement.cars?.[targetCarId]) {
      setRouteHelperStatus('距離を反映する車が見つかりません。別の車へは反映していません。', 'error');
      return;
    }

    const multiplier = state.roundTrip ? 2 : 1;
    const kilometers = route.distanceMeters * multiplier / 1000;
    const nextDistance = (Math.round(kilometers * 10) / 10).toString();
    settlement.cars[targetCarId] = normalizeCarSettlementState({
      ...settlement.cars[targetCarId],
      dist: nextDistance
    });
    state.calculatedAt = Date.now();
    setRoutePlannerState(state, { persist: false });
    renderSettlementView({ force: true });
    save();
    document.dispatchEvent(new CustomEvent('sanpo:route-distance-applied', {
      detail: { targetCarId, distanceKm: Number(nextDistance), routeId: route.id, roundTrip: state.roundTrip }
    }));
    setRouteHelperStatus(`${targetCarId}車の移動距離へ${nextDistance}kmを反映しました。`, 'success');
    modals.routeDistance?.hide();
  }

  function returnToSourceCar() {
    const state = getRoutePlannerState();
    if (state.returnTo !== 'carSettlement' || !state.targetCarId) return;
    const targetCarId = state.targetCarId;
    const settlement = ensureSettlementState();
    if (!settlement.cars?.[targetCarId]) return;
    setTimeout(() => openSettlementCarEditor(encodeURIComponent(targetCarId)), 100);
  }

  function getRouteHelperRuntimeForTests() {
    return {
      libraries,
      waypointDrafts: [...waypointDrafts],
      runtimeRoutes: runtimeRoutes.map(plainRoute),
      requestSequence,
      pendingRequestKey,
      lastCompletedRequestKey
    };
  }

  Object.assign(global, {
    initializeRouteHelperUi,
    openRouteDistanceHelper,
    openRouteDistanceHelperFromShortcut,
    refreshRoutes,
    selectRoute,
    applySelectedRouteDistance,
    setRouteHelperStatus,
    getRouteHelperRuntimeForTests
  });
})(window);
