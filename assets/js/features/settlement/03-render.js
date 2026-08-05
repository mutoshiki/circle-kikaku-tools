// Settlement renderer. Owns DOM rendering only.
// Split from features/settlement.js during S-3 cleanup.

function readSettlementCarLayoutMode() {
    return 'list';
}

function updateSettlementCarLayoutControl() {
    const button = byId('seisanCarLayoutToggle');
    if (button) button.hidden = true;
}

function applySettlementCarLayout(carList) {
    if (!carList) return;
    carList.classList.remove('is-two-column');
    carList.dataset.layoutMode = 'list';
    updateSettlementCarLayoutControl();
}

function toggleSettlementCarLayout() {
    applySettlementCarLayout(byId('seisan-car-list'));
}

function createEmptySettlementIssues() {
    return { messages: [], fields: new Set(), rows: new Set() };
}

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
    const roundingOptions = Array.from(document.querySelectorAll('[data-rounding-value]'));
    const organizerFreeEl = byId('seisanOrganizerFree');
    const organizerEl = byId('seisanOrganizerName');
    const organizerField = byId('seisanOrganizerField');
    const driverCollectionOffsetEl = byId('seisanDriverCollectionOffset');
    const driverCollectionFreeEl = byId('seisanDriverCollectionFree');
    const rewardEl = byId('seisanDriverReward');
    const rewardTypeEl = byId('seisanDriverRewardType');
    const standaloneEnabledEl = byId('seisanStandaloneEnabled');
    const standaloneDriverCountEl = byId('seisanStandaloneDriverCount');
    const standaloneMemberCountEl = byId('seisanStandaloneMemberCount');
    const standaloneFieldsEl = byId('seisanStandaloneFields');
    if (roundingEl) roundingEl.value = state.rounding || '100';
    if (organizerFreeEl) organizerFreeEl.checked = state.organizerFree !== false;
    if (driverCollectionOffsetEl) driverCollectionOffsetEl.checked = state.driverCollectionOffset !== false;
    if (driverCollectionFreeEl) driverCollectionFreeEl.checked = state.driverCollectionFree === true;
    if (rewardEl) rewardEl.value = state.driverReward ?? '0';
    if (rewardTypeEl) {
        const rewardType = getDriverRewardType(state);
        rewardTypeEl.value = rewardType;
        rewardTypeEl.querySelectorAll('cds-content-switcher-item').forEach(item => {
            item.selected = item.value === rewardType;
        });
    }
    const standalone = normalizeStandaloneSettlementState(state.standalone || {});
    const roundingValue = String(state.rounding || '100');
    document.querySelectorAll('.seisan-rounding-row').forEach(switcher => {
        if (switcher.querySelector(`[data-rounding-value="${CSS.escape(roundingValue)}"]`)) switcher.value = roundingValue;
    });
    if (standaloneEnabledEl) standaloneEnabledEl.checked = standalone.enabled;
    if (standaloneDriverCountEl) standaloneDriverCountEl.value = standalone.driverCount || '';
    if (standaloneMemberCountEl) standaloneMemberCountEl.value = standalone.memberCount || '';
    if (standaloneFieldsEl) standaloneFieldsEl.hidden = !standalone.enabled;
    roundingOptions.forEach(option => {
        const active = option.dataset.roundingValue === roundingValue;
        option.classList.toggle('active', active);
        option.selected = active;
        option.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (organizerField) organizerField.hidden = state.organizerFree === false;
    if (organizerEl) {
        const current = state.organizerName || '';
        const createItem = (label, value) => {
            const item = document.createElement('cds-select-item');
            item.value = value;
            item.textContent = label;
            return item;
        };
        const placeholder = createItem('未選択', '');
        const options = participants.map(p => createItem(p.name, p.name));
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
    const editableExtras = cState.extras.map(normalizeExtraItem).filter(ex => !isDriverRewardExtra(ex));
    const extras = editableExtras.length ? editableExtras : [{ name: '', amount: '', type: 'split' }];
    const extraCandidateMap = new Map();
    Object.values(state.cars || {})
        .flatMap(carState => normalizeCarSettlementState(carState || {}).extras || [])
        .forEach(extra => {
            const name = String(extra?.name || '').trim();
            const normalizedName = name.replace(/\s+/g, '');
            if (!name
                || isDriverRewardExtra({ name })
                || normalizedName === 'タイムズ時間料金'
                || normalizedName === 'タイムズ移動料金'
                || extraCandidateMap.has(name)) return;
            extraCandidateMap.set(name, {
                name,
                amount: String(extra?.amount || ''),
                type: normalizeSettlementExtraType(extra?.type)
            });
        });
    const extraCandidates = [...extraCandidateMap.values()];
    return window.SanpoApp.templates.settlement.carRow({
        car,
        cState,
        calc,
        extras,
        extraCandidates,
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

function renderSettlementCollectionHtml(data, participants, state, result) {
    return window.SanpoApp.templates.settlement.collection({ data, participants, state, result, helpers: { escapeHtml } });
}

function renderSettlementDriverPayHtml(result, state) {
    return window.SanpoApp.templates.settlement.driverPay({ result, state, helpers: { escapeHtml, yen } });
}

function renderSettlementBreakdownHtml(result) {
    return window.SanpoApp.templates.settlement.breakdown(result, { yen });
}

function renderSettlementClubExpenseBreakdownHtml(result) {
    return window.SanpoApp.templates.settlement.clubExpenseBreakdown(result, { escapeHtml, yen });
}

function renderSettlementSettingSummaryHtml(state, result) {
    return window.SanpoApp.templates.settlement.settingSummary({ state, result, helpers: { escapeHtml, yen } });
}

let activeSettlementCarEditName = '';
let settlementCarEditValidationActive = false;
let settlementCarEditClosePrepared = false;
let settlementCarEditOpeningSnapshot = null;
let settlementCarEditDiscardPromptActive = false;
let settlementCarEditPreserveOnHidden = false;

function getSettlementCarEditIssues(name) {
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    const result = calculateSettlement(data, state);
    const issues = getSettlementIssues(data, state, result);
    const fieldPrefix = `${name}:`;
    return {
        messages: issues.messages.filter(message => String(message || '').startsWith(`${name}車の`)),
        fields: new Set([...issues.fields].filter(key => String(key).startsWith(fieldPrefix))),
        rows: new Set(issues.rows.has(name) ? [name] : [])
    };
}

function getSettlementCarEditHtml(name) {
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    const result = calculateSettlement(data, state);
    const issues = settlementCarEditValidationActive
        ? getSettlementCarEditIssues(name)
        : createEmptySettlementIssues();
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

function refreshSettlementCarEditorCandidates(name = activeSettlementCarEditName) {
    const body = byId('settlementCarEditBody');
    const currentRow = body?.querySelector('.seisan-car-row');
    if (!body || !currentRow || !name) return;

    const template = document.createElement('template');
    template.innerHTML = getSettlementCarEditHtml(name);
    const nextCandidates = template.content.querySelector('.seisan-extra-candidates');
    const currentCandidates = currentRow.querySelector('.seisan-extra-candidates');

    if (currentCandidates && nextCandidates) currentCandidates.replaceWith(nextCandidates);
    else if (nextCandidates) currentRow.appendChild(nextCandidates);
    else currentCandidates?.remove();

    if (nextCandidates) applyRuntimeAccessibilityFixes(nextCandidates);
}


function focusFirstSettlementCarValidationError() {
    const body = byId('settlementCarEditBody');
    const host = body?.querySelector('[invalid], .seisan-input-error');
    if (!host) return;
    const apply = () => {
        host.scrollIntoView?.({ block: 'center', inline: 'nearest' });
        const control = host.shadowRoot?.querySelector('input, select, textarea, button');
        (control || host).focus?.({ preventScroll: true });
    };
    Promise.resolve(host.updateComplete).then(() => requestAnimationFrame(() => requestAnimationFrame(apply)));
}

function validateActiveSettlementCarEditor(showErrors = true) {
    if (!activeSettlementCarEditName) return true;
    syncSettlementStateFromDOM();
    const issues = getSettlementCarEditIssues(activeSettlementCarEditName);
    const valid = issues.fields.size === 0;
    if (!showErrors) return valid;
    settlementCarEditValidationActive = !valid;
    refreshSettlementCarEditor(activeSettlementCarEditName);
    if (!valid) focusFirstSettlementCarValidationError();
    return valid;
}

function restoreSettlementCarEditOpeningSnapshot() {
    if (!settlementCarEditOpeningSnapshot) return;
    settlementState = normalizeSettlementState(cloneData(settlementCarEditOpeningSnapshot));
}

function waitForSettlementCarModalHidden() {
    const modal = byId('settlementCarEditModal');
    if (!modal || !modal.open) return Promise.resolve();
    return new Promise(resolve => modal.addEventListener('sanpo:modal-hidden', resolve, { once: true }));
}

async function promptDiscardInvalidSettlementCarEdit() {
    if (settlementCarEditDiscardPromptActive || !activeSettlementCarEditName) return;
    settlementCarEditDiscardPromptActive = true;
    settlementCarEditPreserveOnHidden = true;
    settlementCarEditClosePrepared = true;
    const name = activeSettlementCarEditName;
    const hidden = waitForSettlementCarModalHidden();
    modals.settlementCarEdit?.hide({ reason: 'discard-prompt' });
    await hidden;

    const discard = await appConfirm(
        '未入力または正しくない項目があります。変更を破棄して車ごとの費用を閉じますか？',
        {
            title: '入力内容を破棄',
            okText: '破棄して閉じる',
            cancelText: '編集を続ける',
            danger: true
        }
    );

    settlementCarEditDiscardPromptActive = false;
    settlementCarEditPreserveOnHidden = false;
    if (discard) {
        restoreSettlementCarEditOpeningSnapshot();
        clearSettlementCarEditor();
        renderSettlementView({ force: true });
        save();
        return;
    }

    activeSettlementCarEditName = name;
    settlementCarEditValidationActive = true;
    refreshSettlementCarEditor(name);
    modals.settlementCarEdit?.show();
    focusFirstSettlementCarValidationError();
}

function validateAndSaveSettlementCarEditBeforeClose() {
    if (settlementCarEditClosePrepared) {
        settlementCarEditClosePrepared = false;
        return true;
    }
    if (!validateActiveSettlementCarEditor(true)) {
        queueMicrotask(promptDiscardInvalidSettlementCarEdit);
        return false;
    }
    saveSettlementCarEditDraft();
    return true;
}

function prepareSettlementCarEditTransition(options = {}) {
    const allowInvalid = options?.allowInvalid === true;
    const preserveSession = options?.preserveSession === true;
    if (!allowInvalid && !validateActiveSettlementCarEditor(true)) return false;
    saveSettlementCarEditDraft();
    settlementCarEditClosePrepared = true;
    if (preserveSession) settlementCarEditPreserveOnHidden = true;
    return true;
}

function openSettlementSettings() {
    syncSettlementStateFromDOM();
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    syncSettlementControls(state, getParticipantList(data));
    validateStandaloneSettlementSettings(false);
    if (modals.settlementSettings) modals.settlementSettings.show();
}

function openStandaloneSettlementSettings() {
    syncSettlementStateFromDOM();
    const state = ensureSettlementState();
    state.standalone = normalizeStandaloneSettlementState({
        ...(state.standalone || {}),
        enabled: true
    });
    state.driverCollectionOffset = false;
    state.driverCollectionFree = false;
    state.organizerFree = false;
    const data = getRoomDataOnly();
    syncSettlementControls(state, getParticipantList(data));
    const standaloneEnabled = byId('seisanStandaloneEnabled');
    const standaloneFields = byId('seisanStandaloneFields');
    const driverCollectionOffset = byId('seisanDriverCollectionOffset');
    const driverCollectionFree = byId('seisanDriverCollectionFree');
    const organizerFree = byId('seisanOrganizerFree');
    if (standaloneEnabled) standaloneEnabled.checked = true;
    if (standaloneFields) standaloneFields.hidden = false;
    if (driverCollectionOffset) driverCollectionOffset.checked = false;
    if (driverCollectionFree) driverCollectionFree.checked = false;
    if (organizerFree) organizerFree.checked = false;
    validateStandaloneSettlementSettings(false);
    if (modals.settlementSettings) modals.settlementSettings.show();
}

function validateStandaloneSettlementSettings(showErrors = true) {
    const enabled = byId('seisanStandaloneEnabled');
    const fields = [byId('seisanStandaloneDriverCount'), byId('seisanStandaloneMemberCount')].filter(Boolean);
    const message = byId('seisanStandaloneError');
    const shouldValidate = !!enabled?.checked;
    const invalidFields = shouldValidate ? fields.filter(field => String(field.value || '').trim() === '') : [];
    fields.forEach(field => {
        const invalid = showErrors && invalidFields.includes(field);
        field.classList.toggle('is-invalid', invalid);
        field.invalid = invalid;
        field.invalidText = invalid ? '人数を入力してください' : '';
        field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    });
    if (message) {
        message.hidden = !(showErrors && invalidFields.length);
    }
    return invalidFields.length === 0;
}

function saveSettlementSettingsDraft() {
    syncSettlementStateFromDOM();
    renderSettlementView({ force: true });
    save();
}

function saveSettlementSettings() {
    if (!validateStandaloneSettlementSettings(true)) return;
    saveSettlementSettingsDraft();
    if (modals.settlementSettings) modals.settlementSettings.hide({ reason: 'submit' });
}

function openSettlementCarEditor(encodedName) {
    syncSettlementStateFromDOM();
    settlementCarEditValidationActive = false;
    settlementCarEditClosePrepared = false;
    settlementCarEditDiscardPromptActive = false;
    settlementCarEditPreserveOnHidden = false;
    settlementCarEditOpeningSnapshot = cloneData(ensureSettlementState());
    const name = decodeURIComponent(encodedName || '');
    activeSettlementCarEditName = name;
    const title = byId('settlementCarEditModalTitle');
    if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(name)}車の費用`;
    refreshSettlementCarEditor(name);
    if (modals.settlementCarEdit) modals.settlementCarEdit.show();
}

function resumeSettlementCarEditor(encodedName) {
    const name = decodeURIComponent(encodedName || '');
    if (!name) return;
    activeSettlementCarEditName = name;
    settlementCarEditClosePrepared = false;
    settlementCarEditDiscardPromptActive = false;
    settlementCarEditPreserveOnHidden = false;
    const title = byId('settlementCarEditModalTitle');
    if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(name)}車の費用`;
    refreshSettlementCarEditor(name);
    if (modals.settlementCarEdit) modals.settlementCarEdit.show();
}

function saveSettlementCarEditDraft() {
    const body = byId('settlementCarEditBody');
    const standaloneRow = body?.querySelector?.('.seisan-car-row[data-standalone-driver-index]');
    let renamedStandaloneDriver = '';
    if (standaloneRow) {
        const index = Number(standaloneRow.dataset.standaloneDriverIndex);
        const input = standaloneRow.querySelector('[data-field="standaloneDriverName"]');
        renamedStandaloneDriver = normalizeStandaloneDriverName(input?.value || standaloneRow.dataset.driverName, Number.isInteger(index) ? index : 0);
    }
    syncSettlementStateFromDOM();
    if (renamedStandaloneDriver) activeSettlementCarEditName = renamedStandaloneDriver;
    renderSettlementView({ force: true });
    if (renamedStandaloneDriver) {
        const title = byId('settlementCarEditModalTitle');
        if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(renamedStandaloneDriver)}車の費用`;
        refreshSettlementCarEditor(renamedStandaloneDriver);
    }
    save();
}

function saveSettlementCarEdit() {
    if (!validateActiveSettlementCarEditor(true)) return;
    saveSettlementCarEditDraft();
    settlementCarEditClosePrepared = true;
    if (modals.settlementCarEdit) modals.settlementCarEdit.hide({ reason: 'submit' });
}

function shouldPreserveSettlementCarEditorOnHidden() {
    return settlementCarEditPreserveOnHidden;
}

function clearSettlementCarEditor() {
    if (settlementCarEditPreserveOnHidden) return;
    settlementCarEditValidationActive = false;
    settlementCarEditClosePrepared = false;
    settlementCarEditOpeningSnapshot = null;
    settlementCarEditDiscardPromptActive = false;
    const body = byId('settlementCarEditBody');
    if (body) body.innerHTML = '';
    activeSettlementCarEditName = '';
}

window.SanpoApp?.exposeCompat?.('openSettlementSettings', openSettlementSettings);
window.SanpoApp?.exposeCompat?.('openStandaloneSettlementSettings', openStandaloneSettlementSettings);
window.SanpoApp?.exposeCompat?.('saveSettlementSettingsDraft', saveSettlementSettingsDraft);
window.SanpoApp?.exposeCompat?.('saveSettlementSettings', saveSettlementSettings);
window.SanpoApp?.exposeCompat?.('openSettlementCarEditor', openSettlementCarEditor);
window.SanpoApp?.exposeCompat?.('resumeSettlementCarEditor', resumeSettlementCarEditor);
window.SanpoApp?.exposeCompat?.('refreshSettlementCarEditor', refreshSettlementCarEditor);
window.SanpoApp?.exposeCompat?.('refreshSettlementCarEditorCandidates', refreshSettlementCarEditorCandidates);
window.SanpoApp?.exposeCompat?.('saveSettlementCarEditDraft', saveSettlementCarEditDraft);
window.SanpoApp?.exposeCompat?.('saveSettlementCarEdit', saveSettlementCarEdit);
window.SanpoApp?.exposeCompat?.('validateAndSaveSettlementCarEditBeforeClose', validateAndSaveSettlementCarEditBeforeClose);
window.SanpoApp?.exposeCompat?.('prepareSettlementCarEditTransition', prepareSettlementCarEditTransition);
window.SanpoApp?.exposeCompat?.('shouldPreserveSettlementCarEditorOnHidden', shouldPreserveSettlementCarEditorOnHidden);
window.SanpoApp?.exposeCompat?.('clearSettlementCarEditor', clearSettlementCarEditor);

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
    const summaryIssues = createEmptySettlementIssues();
    renderSettlementIssues(summaryIssues);

    const settingsSummary = byId('seisan-settings-summary');
    if (settingsSummary) settingsSummary.innerHTML = renderSettlementSettingSummaryHtml(state, result);

    const summary = byId('seisan-summary');
    if (summary) summary.innerHTML = renderSettlementSummaryHtml(result);

    const carList = byId('seisan-car-list');
    if (carList) {
        carList.innerHTML = renderSettlementCarsHtml(data, state, result, summaryIssues);
        applySettlementCarLayout(carList, (data.cars || []).length);
    }

    const clubExpenseList = byId('seisan-club-expense-list');
    if (clubExpenseList) clubExpenseList.innerHTML = renderSettlementClubExpenseBreakdownHtml(result);

    const note = byId('seisan-collection-note');
    if (note) {
        note.innerHTML = `<span class="seisan-collection-note-left"><span>集金済み ${result.paidCount}/${result.payerCount}名</span><span>未回収 ${yen(result.unpaidAmount)}</span></span><span class="seisan-collection-per-person"><span class="seisan-collection-per-person-label">1人あたり /</span><strong class="seisan-collection-per-person-amount">${yen(result.perPerson)}</strong></span>`;
    }

    const collectionList = byId('seisan-collection-list');
    if (collectionList) collectionList.innerHTML = renderSettlementCollectionHtml(data, participants, state, result);

    const driverPayList = byId('seisan-driver-pay-list');
    if (driverPayList) driverPayList.innerHTML = renderSettlementDriverPayHtml(result, state);

    const shareNote = byId('seisan-share-note');
    if (shareNote) {
        shareNote.textContent = 'テキストのプレビュー';
    }
    const sharePreview = byId('seisan-share-preview');
    if (sharePreview && typeof buildSettlementOverviewText === 'function') {
        sharePreview.textContent = buildSettlementOverviewText({
            data,
            state,
            result,
            title: (data.roomName || '企画名未設定').trim()
        });
    }

    const breakdown = byId('seisan-breakdown');
    if (breakdown) breakdown.innerHTML = renderSettlementBreakdownHtml(result);
}

window.SanpoApp?.exposeCompat?.('toggleSettlementCarLayout', toggleSettlementCarLayout);
