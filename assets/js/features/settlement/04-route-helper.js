// Settlement route helper modal actions.
// Split from features/settlement.js during S-3 cleanup.

const ROUTE_PRIVATE_ORIGIN_KEY = 'circle_route_private_origin_v1';
const ROUTE_PERSONAL_STOPS_KEY_PREFIX = 'circle_route_personal_stops_v1:';

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

function normalizeRouteStopList(stops = []) {
    const seen = new Set();
    const list = [];
    (Array.isArray(stops) ? stops : []).forEach(stop => {
        const text = String(stop || '').replace(/\s+/g, ' ').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) return;
        seen.add(key);
        list.push(text);
    });
    return list;
}

function getRoutePersonalStopsKey() {
    const queryRoom = new URLSearchParams(location.search || '').get('room') || '';
    const room = String(byId('roomNameInput')?.value || '').trim();
    const key = queryRoom || room || 'default';
    return ROUTE_PERSONAL_STOPS_KEY_PREFIX + key.slice(0, 120);
}

function getRoutePersonalStops(fallbackStops = []) {
    try {
        const raw = localStorage.getItem(getRoutePersonalStopsKey());
        if (raw) return normalizeRouteStopList(JSON.parse(raw));
    } catch (e) {}
    return normalizeRouteStopList(fallbackStops);
}

function setRoutePersonalStops(stops = []) {
    try {
        const normalized = normalizeRouteStopList(stops);
        if (normalized.length) {
            localStorage.setItem(getRoutePersonalStopsKey(), JSON.stringify(normalized));
        } else {
            safeLocalRemove(getRoutePersonalStopsKey());
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
    setRouteHelperStatus(getRoutePrivateOrigin() ? '自宅を保存しました。' : '自宅を空にしました。');
};

window.clearRoutePrivateOrigin = function() {
    setRoutePrivateOrigin('');
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('自宅を削除しました。');
};

window.cancelRoutePrivateOriginEdit = function() {
    renderRoutePrivateOrigin(false);
};

function getRouteCarNames() {
    return (getRoomDataOnly().cars || []).map(c => c.name).filter(Boolean);
}

function getSavedRouteStops() {
    const state = ensureSettlementState();
    return normalizeRouteStopList(state.routeStops || []);
}

function routeStopRowHtml(value = '', index = 0, total = 1) {
    return window.SanpoApp.templates.settlement.routeStopRow(value, index, { escapeHtml });
}

function routeCandidateHtml(value = '') {
    return window.SanpoApp.templates.settlement.routeCandidateButton(value, { escapeHtml });
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
    return normalizeRouteStopList(Array.from(document.querySelectorAll('#routeStopList .route-stop-input'))
        .map(input => String(input.value || '').trim()));
}

function setRouteStops(stops) {
    const list = byId('routeStopList');
    if (!list) return;
    const normalized = Array.isArray(stops) && stops.length ? stops : [''];
    list.innerHTML = normalized.map((stop, index) => routeStopRowHtml(stop, index, normalized.length)).join('');
    refreshRouteStopNumbers();
    setupRouteStopSortable();
}

function setRouteCandidates(candidates = getSavedRouteStops()) {
    const list = byId('routeCandidateList');
    if (!list) return;
    const normalized = normalizeRouteStopList(candidates);
    list.innerHTML = normalized.length
        ? normalized.map(routeCandidateHtml).join('')
        : '<div class="route-candidate-empty">候補はまだありません。</div>';
}

function mergeRouteCandidates(stops = []) {
    const normalized = normalizeRouteStopList(stops);
    if (!normalized.length) return getSavedRouteStops();
    const state = ensureSettlementState();
    const merged = normalizeRouteStopList([...(state.routeStops || []), ...normalized]);
    state.routeStops = merged;
    setRouteCandidates(merged);
    return merged;
}

function saveRouteStopsFromModal(options = {}) {
    const share = options.share === true;
    const stops = getRouteStops();
    setRoutePersonalStops(stops);
    if (share) {
        mergeRouteCandidates(stops);
        save();
    } else {
        saveLocalDraftOnly?.();
    }
    return stops;
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
    saveRouteStopsFromModal({ share: true });
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
    const candidates = getSavedRouteStops();
    setRouteStops(getRoutePersonalStops(candidates));
    setRouteCandidates(candidates);
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('');
    if (modals.routeDistance) modals.routeDistance.show();
};

window.openRouteDistanceHelperFromShortcut = function() {
    const editor = byId('settlementCarEditModal');
    if (editor?.classList.contains('show') && modals.settlementCarEdit) {
        modals.settlementCarEdit.hide();
        setTimeout(() => window.openRouteDistanceHelper?.(), 180);
        return;
    }
    window.openRouteDistanceHelper?.();
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
    saveRouteStopsFromModal({ share: true });
};

window.addRouteCandidateToPersonal = function(encodedValue) {
    const value = decodeURIComponent(encodedValue || '').trim();
    if (!value) return;
    const current = getRouteStops();
    setRouteStops(normalizeRouteStopList([...current, value]));
    setRoutePersonalStops(getRouteStops());
    setRouteHelperStatus('候補を回る場所に追加しました。');
};

window.openGoogleRoute = function() {
    const stops = saveRouteStopsFromModal({ share: true });
    if (!stops.length) {
        setRouteHelperStatus('回る場所を1つ以上入力してください。', true);
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
    setRouteHelperStatus(privateOrigin ? '自宅に戻るルートを開きました。' : 'Googleマップを開きました。');
};
