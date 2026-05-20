// Settlement renderer. Owns DOM rendering only.
// Split from features/settlement.js during S-3 cleanup.

function renderSettlementIssues(issues) {
    const box = byId('seisan-errors');
    if (!box) return;
    if (!issues.messages.length) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = window.SanpoApp?.templates?.settlement?.renderIssues
        ? window.SanpoApp.templates.settlement.renderIssues(issues, { escapeHtml })
        : issues.messages.map(m => `・${escapeHtml(m)}`).join('<br>');
}

function renderExtraRowHtml(carName, ex, index, issues) {
    return window.SanpoApp.templates.settlement.extraRow({
        carName,
        ex,
        index,
        issues,
        helpers: { escapeHtml, extraFieldErrorClass }
    });
}


function syncSettlementControls(state, participants) {
    const roundingEl = byId('seisanRounding');
    const organizerFreeEl = byId('seisanOrganizerFree');
    const organizerEl = byId('seisanOrganizerName');
    const rewardEl = byId('seisanDriverReward');
    if (roundingEl) roundingEl.value = state.rounding || '100';
    if (organizerFreeEl) organizerFreeEl.checked = state.organizerFree !== false;
    if (rewardEl) rewardEl.value = state.driverReward ?? '1000';
    if (organizerEl) {
        const current = state.organizerName || '';
        const placeholder = new Option('未選択', '');
        const options = participants.map(p => new Option(p.name, p.name));
        organizerEl.replaceChildren(placeholder, ...options);
        organizerEl.value = participants.some(p => p.name === current) ? current : '';
        state.organizerName = organizerEl.value;
    }
}

function renderSettlementSummaryHtml(result) {
    return window.SanpoApp.templates.settlement.summary(result, { yen });
}

function renderSettlementCarRowHtml(car, state, result, issues) {
    const cState = ensureDriverRewardExtra(state.cars?.[car.name] || {}, state);
    state.cars[car.name] = cState;
    const calc = result.cars.find(c => c.name === car.name) || { totalPay: 0, gas: 0, extras: [] };
    const extras = cState.extras.length ? cState.extras.map(normalizeExtraItem) : [{ name: '', amount: '', type: 'split' }];
    return window.SanpoApp.templates.settlement.carRow({
        car,
        cState,
        calc,
        extras,
        issues,
        helpers: { escapeHtml, yen, fieldErrorClass, extraFieldErrorClass }
    });
}

function renderSettlementCarsHtml(data, state, result, issues) {
    return window.SanpoApp.templates.settlement.cars({
        data,
        state,
        result,
        issues,
        helpers: {
            escapeHtml,
            yen,
            fieldErrorClass,
            extraFieldErrorClass,
            getCarState: (car, currentState) => ensureDriverRewardExtra(currentState.cars?.[car.name] || {}, currentState)
        }
    });
}

function renderSettlementCollectionHtml(participants, state, result) {
    return window.SanpoApp.templates.settlement.collection({ participants, state, result, helpers: { escapeHtml } });
}

function renderSettlementDriverPayHtml(result, state) {
    return window.SanpoApp.templates.settlement.driverPay({ result, state, helpers: { escapeHtml, yen } });
}

function renderSettlementBreakdownHtml(result) {
    return window.SanpoApp.templates.settlement.breakdown(result, { yen });
}

function renderSettlementSettingSummaryHtml(state, result) {
    return window.SanpoApp.templates.settlement.settingSummary({ state, result, helpers: { escapeHtml, yen } });
}

let activeSettlementCarEditName = '';

function getSettlementCarEditHtml(name) {
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    const result = calculateSettlement(data, state);
    const issues = getSettlementIssues(data, state, result);
    const car = (data.cars || []).find(c => c.name === name);
    if (!car) return '<div class="seisan-empty">この車が見つかりません。</div>';
    return renderSettlementCarRowHtml(car, state, result, issues);
}

function refreshSettlementCarEditor(name = activeSettlementCarEditName) {
    const body = byId('settlementCarEditBody');
    if (!body || !name) return;
    body.innerHTML = getSettlementCarEditHtml(name);
    applyRuntimeAccessibilityFixes(body);
}

window.openSettlementSettings = function() {
    syncSettlementStateFromDOM();
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    syncSettlementControls(state, getParticipantList(data));
    if (modals.settlementSettings) modals.settlementSettings.show();
};

window.saveSettlementSettingsDraft = function() {
    syncSettlementStateFromDOM();
    renderSettlementView({ force: true });
    save();
};

window.saveSettlementSettings = function() {
    window.saveSettlementSettingsDraft?.();
    if (modals.settlementSettings) modals.settlementSettings.hide();
};

window.openSettlementCarEditor = function(encodedName) {
    syncSettlementStateFromDOM();
    const name = decodeURIComponent(encodedName || '');
    activeSettlementCarEditName = name;
    const title = byId('settlementCarEditModalTitle');
    if (title) title.innerHTML = `<i class="fas fa-car-side me-2" aria-hidden="true"></i>${escapeHtml(name)}車の費用`;
    refreshSettlementCarEditor(name);
    if (modals.settlementCarEdit) modals.settlementCarEdit.show();
};

window.saveSettlementCarEditDraft = function() {
    syncSettlementStateFromDOM();
    renderSettlementView({ force: true });
    save();
};

window.saveSettlementCarEdit = function() {
    window.saveSettlementCarEditDraft?.();
    if (modals.settlementCarEdit) modals.settlementCarEdit.hide();
};

window.clearSettlementCarEditor = function() {
    const body = byId('settlementCarEditBody');
    if (body) body.innerHTML = '';
    activeSettlementCarEditName = '';
};

function toggleSettlementEmptyState(area, isEmpty) {
    if (!area) return;
    const wrap = area.querySelector('.seisan-wrap');
    let empty = byId('seisan-empty-state');
    if (!empty) {
        empty = document.createElement('div');
        empty.id = 'seisan-empty-state';
        empty.className = 'seisan-empty-state';
        empty.hidden = true;
        empty.innerHTML = window.SanpoApp.templates.settlement.emptyState();
        if (wrap) area.insertBefore(empty, wrap);
        else area.appendChild(empty);
    }
    empty.hidden = !isEmpty;
    if (wrap) wrap.hidden = isEmpty;
}

function renderSettlementView() {
    const options = arguments[0] || {};
    if (!options.force && isSettlementInputProtected()) {
        settlementRenderDeferred = true;
        return;
    }
    const area = byId('seisan-view-area');
    if (!area) return;
    const state = ensureSettlementState();
    const data = getRoomDataOnly();
    const participants = getParticipantList(data);
    const hasParticipants = participants.length > 0;

    toggleSettlementEmptyState(area, !hasParticipants);
    if (!hasParticipants) {
        renderSettlementIssues({ messages: [], fields: new Set(), rows: new Set() });
        return;
    }

    syncSettlementControls(state, participants);

    const result = calculateSettlement(data, state);
    const issues = getSettlementIssues(data, state, result);
    renderSettlementIssues(issues);

    const settingsSummary = byId('seisan-settings-summary');
    if (settingsSummary) settingsSummary.innerHTML = renderSettlementSettingSummaryHtml(state, result);

    const summary = byId('seisan-summary');
    if (summary) summary.innerHTML = renderSettlementSummaryHtml(result);

    const carList = byId('seisan-car-list');
    if (carList) carList.innerHTML = renderSettlementCarsHtml(data, state, result, issues);

    const note = byId('seisan-collection-note');
    if (note) {
        note.innerHTML = `<span class="seisan-collection-note-left"><span>集金済み ${result.paidCount}/${result.payerCount}名</span><span>未回収 ${yen(result.unpaidAmount)}</span></span><span class="seisan-collection-per-person"><span class="seisan-collection-per-person-label">1人あたり /</span><strong class="seisan-collection-per-person-amount">${yen(result.perPerson)}</strong></span>`;
    }

    const collectionList = byId('seisan-collection-list');
    if (collectionList) collectionList.innerHTML = renderSettlementCollectionHtml(participants, state, result);

    const driverPayList = byId('seisan-driver-pay-list');
    if (driverPayList) driverPayList.innerHTML = renderSettlementDriverPayHtml(result, state);

    const shareNote = byId('seisan-share-note');
    if (shareNote) {
        const planText = data.settlementPlanName ? `精算対象：${data.settlementPlanName}。` : '';
        shareNote.textContent = `${planText}諸経費の内訳と部費・割勘の扱いまでまとめてコピーできます。未回収 ${yen(result.unpaidAmount)}`;
    }

    const breakdown = byId('seisan-breakdown');
    if (breakdown) breakdown.innerHTML = renderSettlementBreakdownHtml(result);
}
