// Settlement route helper modal actions.
// Split from features/settlement.js during S-3 cleanup.

const ROUTE_PRIVATE_ORIGIN_KEY = 'circle_route_private_origin_v1';

function getRoutePrivateOrigin() {
    try {
        return String(localStorage.getItem(ROUTE_PRIVATE_ORIGIN_KEY) || '').trim();
    } catch (e) {
        return '';
    }
}

function setRoutePrivateOrigin(value) {
    try {
        const normalized = String(value || '').trim();
        if (normalized) {
            localStorage.setItem(ROUTE_PRIVATE_ORIGIN_KEY, normalized);
        } else {
            safeLocalRemove(ROUTE_PRIVATE_ORIGIN_KEY);
        }
    } catch (e) {}
}

function renderRoutePrivateOrigin(editing = false) {
    const box = byId('routePrivateOriginBox');
    if (!box) return;
    const saved = getRoutePrivateOrigin();
    if (saved && !editing) {
        box.innerHTML = window.SanpoApp.templates.settlement.routePrivateOriginView();
        return;
    }
    box.innerHTML = window.SanpoApp.templates.settlement.routePrivateOriginEdit(saved, { escapeHtml });
}

window.editRoutePrivateOrigin = function() {
    renderRoutePrivateOrigin(true);
    const input = byId('routePrivateOriginInput');
    if (input) input.focus();
};

window.saveRoutePrivateOrigin = function() {
    const input = byId('routePrivateOriginInput');
    setRoutePrivateOrigin(input ? input.value : '');
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus(getRoutePrivateOrigin() ? '自分用の出発地をこの端末に保存しました。' : '自分用の出発地を空にしました。');
};

window.clearRoutePrivateOrigin = function() {
    setRoutePrivateOrigin('');
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('自分用の出発地をこの端末から削除しました。');
};

window.cancelRoutePrivateOriginEdit = function() {
    renderRoutePrivateOrigin(false);
};

function getRouteCarNames() {
    return (getRoomDataOnly().cars || []).map(c => c.name).filter(Boolean);
}

function getSavedRouteStops() {
    const state = ensureSettlementState();
    return Array.isArray(state.routeStops) ? state.routeStops.map(v => String(v || '').trim()).filter(Boolean) : [];
}

function routeStopRowHtml(value = '', index = 0, total = 1) {
    return window.SanpoApp.templates.settlement.routeStopRow(value, index, { escapeHtml });
}

function refreshRouteStopNumbers() {
    const rows = Array.from(document.querySelectorAll('#routeStopList .route-stop-row'));
    rows.forEach((row, index) => {
        const num = row.querySelector('.route-stop-num');
        if (num) num.textContent = String(index + 1);
    });
}

function setRouteHelperStatus(message, isError = false) {
    const el = byId('routeHelperStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#ef4444' : 'var(--text-sub)';
}

function getRouteStops() {
    return Array.from(document.querySelectorAll('#routeStopList .route-stop-input'))
        .map(input => String(input.value || '').trim())
        .filter(Boolean);
}

function setRouteStops(stops) {
    const list = byId('routeStopList');
    if (!list) return;
    const normalized = Array.isArray(stops) && stops.length ? stops : [''];
    list.innerHTML = normalized.map((stop, index) => routeStopRowHtml(stop, index, normalized.length)).join('');
    refreshRouteStopNumbers();
    setupRouteStopSortable();
}

function saveRouteStopsFromModal() {
    const state = ensureSettlementState();
    state.routeStops = getRouteStops();
    save();
}

let routeStopSortable = null;
function setupRouteStopSortable() {
    const list = byId('routeStopList');
    if (!list || typeof Sortable === 'undefined') return;
    if (routeStopSortable) {
        try { routeStopSortable.destroy(); } catch (e) {}
        routeStopSortable = null;
    }
    routeStopSortable = new Sortable(list, {
        animation: 150,
        handle: '.route-stop-num',
        onEnd: () => {
            refreshRouteStopNumbers();
            saveRouteStopsFromModal();
        }
    });
}

let routeStopSaveTimer = null;
window.onRouteStopsChanged = function() {
    clearTimeout(routeStopSaveTimer);
    saveRouteStopsFromModal();
    refreshRouteStopNumbers();
};

window.onRouteStopsChangedDelayed = function() {
    clearTimeout(routeStopSaveTimer);
    routeStopSaveTimer = setTimeout(() => {
        saveRouteStopsFromModal();
        refreshRouteStopNumbers();
    }, 450);
};

window.openRouteDistanceHelper = function() {
    syncSettlementStateFromDOM();
    setRouteStops(getSavedRouteStops());
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('');
    if (modals.routeDistance) modals.routeDistance.show();
};

window.addRouteStop = function() {
    const list = byId('routeStopList');
    if (!list) return;
    const current = Array.from(list.querySelectorAll('.route-stop-input')).map(input => input.value);
    current.push('');
    setRouteStops(current);
    const input = list.querySelector('.route-stop-row:last-child .route-stop-input');
    if (input) input.focus();
    saveRouteStopsFromModal();
};

window.removeRouteStop = function(button) {
    const row = button.closest('.route-stop-row');
    if (row) row.remove();
    const list = byId('routeStopList');
    if (list && !list.querySelector('.route-stop-row')) setRouteStops(['']);
    refreshRouteStopNumbers();
    saveRouteStopsFromModal();
};


window.openGoogleRoute = function() {
    saveRouteStopsFromModal();
    const stops = getRouteStops();
    if (!stops.length) {
        setRouteHelperStatus('目的地・経由地を1つ以上入力してください。', true);
        return;
    }

    const privateOrigin = getRoutePrivateOrigin();
    const params = new URLSearchParams();
    params.set('api', '1');
    params.set('travelmode', 'driving');
    if (privateOrigin) {
        params.set('origin', privateOrigin);
        params.set('destination', privateOrigin);
        params.set('waypoints', stops.join('|'));
    } else if (stops.length === 1) {
        params.set('destination', stops[0]);
    } else {
        params.set('origin', stops[0]);
        params.set('destination', stops[stops.length - 1]);
        const waypoints = stops.slice(1, -1);
        if (waypoints.length) params.set('waypoints', waypoints.join('|'));
    }
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setRouteHelperStatus(privateOrigin ? '自分用の出発地を含めた往復ルートを開きました。' : 'Googleマップを開きました。必要なら出発地・帰着地を追加してください。');
};
