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
    const carNames = new Set([...issues.rows]);
    const pageMessages = issues.messages.filter(message => ![...carNames].some(name => String(message || '').startsWith(`${name}車の`)));
    if (!pageMessages.length) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    box.style.display = 'block';
    const pageIssues = { ...issues, messages: pageMessages };
    box.innerHTML = window.SanpoApp?.templates?.settlement?.renderIssues
        ? window.SanpoApp.templates.settlement.renderIssues(pageIssues, { escapeHtml })
        : pageMessages.map(m => `・${escapeHtml(m)}`).join('<br>');
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
    const roundingOptionsEl = byId('seisanRoundingOptions');
    const organizerFreeEl = byId('seisanOrganizerFree');
    const organizerEl = byId('seisanOrganizerName');
    const organizerField = byId('seisanOrganizerField');
    const driverCollectionOffsetEl = byId('seisanDriverCollectionOffset');
    const driverCollectionFreeEl = byId('seisanDriverCollectionFree');
    const driverCollectionRuleEl = byId('seisanDriverCollectionRule');
    const rewardEl = byId('seisanDriverReward');
    const rewardTypeEl = byId('seisanDriverRewardType');
    const settlementModeEl = byId('seisanSettlementMode');
    const standaloneEnabledEl = byId('seisanStandaloneEnabled');
    const standaloneDriverCountEl = byId('seisanStandaloneDriverCount');
    const standaloneMemberCountEl = byId('seisanStandaloneMemberCount');
    const standaloneFieldsEl = byId('seisanStandaloneFields');
    if (roundingEl) roundingEl.value = state.rounding || '100';
    if (organizerFreeEl) organizerFreeEl.checked = state.organizerFree !== false;
    if (driverCollectionOffsetEl) driverCollectionOffsetEl.checked = state.driverCollectionOffset !== false;
    if (driverCollectionFreeEl) driverCollectionFreeEl.checked = state.driverCollectionFree === true;
    if (driverCollectionRuleEl) {
        const driverRule = state.driverCollectionFree === true ? 'free' : (state.driverCollectionOffset !== false ? 'offset' : 'normal');
        driverCollectionRuleEl.value = driverRule;
        driverCollectionRuleEl.setAttribute('value', driverRule);
    }
    if (rewardEl) rewardEl.value = state.driverReward ?? '0';
    if (rewardTypeEl) {
        const rewardType = getDriverRewardType(state);
        rewardTypeEl.value = rewardType;
        rewardTypeEl.setAttribute('value', rewardType);
    }
    const standalone = normalizeStandaloneSettlementState(state.standalone || {});
    const roundingValue = String(state.rounding || '100');
    if (roundingOptionsEl) {
        roundingOptionsEl.value = roundingValue;
        roundingOptionsEl.setAttribute('value', roundingValue);
    }
    if (settlementModeEl) {
        const mode = standalone.enabled ? 'standalone' : 'normal';
        settlementModeEl.value = mode;
        settlementModeEl.setAttribute('value', mode);
    }
    if (standaloneEnabledEl) standaloneEnabledEl.checked = standalone.enabled;
    if (standaloneDriverCountEl) standaloneDriverCountEl.value = standalone.driverCount || '';
    if (standaloneMemberCountEl) standaloneMemberCountEl.value = standalone.memberCount || '';
    if (standaloneFieldsEl) standaloneFieldsEl.hidden = !standalone.enabled;
    if (organizerField) organizerField.hidden = false;
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
    const organizerRuleEl = byId('seisanOrganizerRule');
    if (organizerRuleEl) {
        const organizerRule = state.organizerFree === false ? 'collect' : 'free';
        organizerRuleEl.value = organizerRule;
        organizerRuleEl.setAttribute('value', organizerRule);
    }
}

function settlementSettingsFieldValue(field) {
    const shadowInput = field?.shadowRoot?.querySelector?.('input');
    return shadowInput ? shadowInput.value : field?.value;
}

function settlementSettingsFieldErrorVisible(field, showErrors) {
    return !!(showErrors && (field?.dataset?.touched === 'true' || settlementSettingsValidationRequested));
}

function setSettlementSettingsStep(step, { focus = false } = {}) {
    const nextStep = Math.min(3, Math.max(1, Number(step) || 1));
    settlementSettingsStep = nextStep;
    const modal = byId('settlementSettingsModal');
    const progress = modal?.querySelector('.seisan-settings-progress');
    if (progress) {
        progress.currentIndex = nextStep - 1;
        progress.onChange = event => goToSettlementSettingsStep(Number(event.detail?.index) + 1);
    }
    modal?.querySelectorAll('[data-settlement-step]').forEach(panel => {
        panel.hidden = Number(panel.dataset.settlementStep) !== nextStep;
    });
    modal?.querySelectorAll('.seisan-settings-progress cds-progress-step').forEach((progressStep, index) => {
        const stepNumber = Number(progressStep.dataset.step) || index + 1;
        if (stepNumber === nextStep) progressStep.setAttribute('aria-current', 'step');
        else progressStep.removeAttribute('aria-current');
    });
    const back = byId('settlementSettingsBackBtn');
    const saveButton = byId('saveSettlementSettingsBtn');
    if (back) {
        back.hidden = false;
        back.disabled = nextStep === 1;
        back.toggleAttribute('disabled', nextStep === 1);
    }
    if (saveButton) {
        const isFinalStep = nextStep === 3;
        saveButton.hidden = false;
        saveButton.textContent = isFinalStep ? '保存' : '次へ';
        saveButton.dataset.action = isFinalStep ? 'save-settlement-settings' : 'settlement-settings-next';
        saveButton.setAttribute('aria-label', isFinalStep ? '保存' : '次へ');
    }
    const body = modal?.querySelector(':scope > cds-modal-body.app-modal-body');
    if (body) body.scrollTop = 0;
    if (focus) {
        const heading = modal?.querySelector(`[data-settlement-step="${nextStep}"] .seisan-settings-step-title`);
        requestAnimationFrame(() => heading?.focus?.({ preventScroll: true }));
    }
}

function validateSettlementSettingsStep(step) {
    if (Number(step) !== 1) return true;
    const valid = validateSettlementSettings(true);
    if (!valid) {
        setSettlementSettingsStep(1);
        focusFirstSettlementSettingsValidationError();
    }
    return valid;
}

function goToSettlementSettingsStep(step) {
    const modal = byId('settlementSettingsModal');
    if (!modal?.open) return false;
    const requested = Math.min(3, Math.max(1, Number(step) || 1));
    if (requested === settlementSettingsStep) return true;
    syncSettlementStateFromDOM();
    if (requested > settlementSettingsStep && !validateSettlementSettingsStep(1)) return false;
    setSettlementSettingsStep(requested, { focus: true });
    return true;
}

function nextSettlementSettingsStep() {
    return goToSettlementSettingsStep(settlementSettingsStep + 1);
}

function previousSettlementSettingsStep() {
    return goToSettlementSettingsStep(settlementSettingsStep - 1);
}

function renderSettlementSummaryHtml(result, issues) {
    return window.SanpoApp.templates.settlement.summary(result, { yen, issues });
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

let settlementCollectionUnpaidOnly = false;

function renderSettlementCollectionHtml(data, participants, state, result) {
    return window.SanpoApp.templates.settlement.collection({ data, participants, state, result, unpaidOnly: settlementCollectionUnpaidOnly, helpers: { escapeHtml } });
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

function renderSettlementStatusHtml(state, result, issues) {
    return window.SanpoApp.templates.settlement.statusSummary({ state, result, issues, helpers: { escapeHtml, yen } });
}

let activeSettlementCarEditName = '';
let settlementCarEditValidationActive = false;
let settlementCarEditClosePrepared = false;
let settlementCarEditOpeningSnapshot = null;
let settlementCarEditOpeningRoomSnapshot = null;
let settlementCarEditSyncBaseSnapshot = null;
let settlementCarEditDiscardPromptActive = false;
let settlementCarEditPreserveOnHidden = false;
let settlementSettingsOpeningSnapshot = null;
let settlementSettingsOpeningRoomSnapshot = null;
let settlementSettingsSyncBaseSnapshot = null;
let settlementSettingsClosePrepared = false;
let settlementSettingsDiscardPromptActive = false;
let settlementSettingsPreserveOnHidden = false;
let settlementSettingsStep = 1;
let settlementSettingsValidationRequested = false;

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

const SETTLEMENT_EXTRA_NAME_MIN_FONT_PX = 8;

function fitSettlementExtraNameField(host) {
    if (!host?.matches?.('#settlementCarEditModal [data-extra-field="name"]')) return;

    const applyFit = () => {
        const input = host.shadowRoot?.querySelector('input');
        if (!input) return;

        // Always return to Carbon's own type size first so deleting text grows the
        // value back naturally. Only the internal value text is adjusted; the
        // official Carbon field geometry, label, focus and validation remain intact.
        input.style.removeProperty('font-size');
        const value = String(host.value ?? input.value ?? '');
        if (!value) return;

        const width = input.clientWidth;
        if (width <= 0) return;
        const baseSize = Number.parseFloat(getComputedStyle(input).fontSize) || 16;
        const contentWidth = input.scrollWidth;
        if (contentWidth <= width + 1) return;

        let nextSize = Math.max(SETTLEMENT_EXTRA_NAME_MIN_FONT_PX, baseSize * (width / contentWidth) * 0.96);
        input.style.fontSize = `${nextSize.toFixed(2)}px`;

        // Browser font metrics can round differently on iOS. Step down only as
        // much as needed until the complete value fits inside the unchanged field.
        let guard = 0;
        while (input.scrollWidth > input.clientWidth + 1 && nextSize > SETTLEMENT_EXTRA_NAME_MIN_FONT_PX && guard < 12) {
            nextSize = Math.max(SETTLEMENT_EXTRA_NAME_MIN_FONT_PX, nextSize - 0.5);
            input.style.fontSize = `${nextSize.toFixed(2)}px`;
            guard += 1;
        }
    };

    const schedule = () => Promise.resolve(host.updateComplete).then(() => {
        requestAnimationFrame(() => requestAnimationFrame(applyFit));
    });

    if (!host.shadowRoot) customElements.whenDefined('cds-text-input').then(schedule);
    else schedule();
}

function fitSettlementExtraNameFields(root = byId('settlementCarEditBody')) {
    root?.querySelectorAll?.('[data-extra-field="name"]').forEach(fitSettlementExtraNameField);
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
    fitSettlementExtraNameFields(body);
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

function commitLiveSettlementExtraTypeControls(root = byId('settlementCarEditBody')) {
    root?.querySelectorAll?.('[data-extra-field="type"]').forEach(control => {
        const type = readSettlementExtraTypeControlValue(control);
        if (control.value !== type) control.value = type;
    });
}

function validateActiveSettlementCarEditor(showErrors = true) {
    if (!activeSettlementCarEditName) return true;
    // Commit the live Carbon controls first. Validation must never rebuild a valid editor:
    // rebuilding replaces upgraded cds-select hosts and can reset their public value before save.
    commitLiveSettlementExtraTypeControls();
    syncSettlementStateFromDOM();
    const issues = getSettlementCarEditIssues(activeSettlementCarEditName);
    const valid = issues.fields.size === 0;
    if (!showErrors) return valid;
    settlementCarEditValidationActive = !valid;
    if (!valid) {
        refreshSettlementCarEditor(activeSettlementCarEditName);
        focusFirstSettlementCarValidationError();
    }
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

function validateAndSaveSettlementCarEditBeforeClose(reason = 'dismiss') {
    if (settlementCarEditClosePrepared) {
        settlementCarEditClosePrepared = false;
        return true;
    }
    if (reason === 'submit') return true;

    // Transactional Carbon modal semantics: X, Escape and Cancel discard the
    // uncommitted editor snapshot. The explicit Save action is the only commit.
    restoreSettlementCarEditOpeningSnapshot();
    saveLocalDraftOnly?.();
    renderSettlementView({ force: true });
    return true;
}

function prepareSettlementCarEditTransition(options = {}) {
    const allowInvalid = options?.allowInvalid === true;
    const preserveSession = options?.preserveSession === true;
    if (!allowInvalid && !validateActiveSettlementCarEditor(true)) return false;
    saveSettlementCarEditDraft({ render: false, refreshEditor: preserveSession });
    settlementCarEditClosePrepared = true;
    if (preserveSession) settlementCarEditPreserveOnHidden = true;
    return true;
}

function openSettlementSettings() {
    syncSettlementStateFromDOM();
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    settlementSettingsOpeningSnapshot = cloneData(state);
    settlementSettingsOpeningRoomSnapshot = cloneData(getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }));
    settlementSettingsSyncBaseSnapshot = cloneData(lastSyncedData || settlementSettingsOpeningRoomSnapshot);
    settlementSettingsClosePrepared = false;
    settlementSettingsDiscardPromptActive = false;
    settlementSettingsPreserveOnHidden = false;
    settlementSettingsStep = 1;
    settlementSettingsValidationRequested = false;
    syncSettlementControls(state, getParticipantList(data));
    [byId('seisanStandaloneDriverCount'), byId('seisanStandaloneMemberCount')].forEach(field => {
        if (field) delete field.dataset.touched;
    });
    validateSettlementSettings(false);
    setSettlementSettingsStep(1);
    if (modals.settlementSettings) modals.settlementSettings.show();
}

function openStandaloneSettlementSettings() {
    syncSettlementStateFromDOM();
    const state = ensureSettlementState();
    settlementSettingsOpeningSnapshot = cloneData(state);
    settlementSettingsOpeningRoomSnapshot = cloneData(getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }));
    settlementSettingsSyncBaseSnapshot = cloneData(lastSyncedData || settlementSettingsOpeningRoomSnapshot);
    settlementSettingsClosePrepared = false;
    settlementSettingsDiscardPromptActive = false;
    settlementSettingsPreserveOnHidden = false;
    settlementSettingsStep = 1;
    settlementSettingsValidationRequested = false;
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
    const driverCollectionRule = byId('seisanDriverCollectionRule');
    const organizerFree = byId('seisanOrganizerFree');
    const organizerRule = byId('seisanOrganizerRule');
    if (standaloneEnabled) standaloneEnabled.checked = true;
    if (standaloneFields) standaloneFields.hidden = false;
    if (driverCollectionOffset) driverCollectionOffset.checked = false;
    if (driverCollectionFree) driverCollectionFree.checked = false;
    if (driverCollectionRule) {
        driverCollectionRule.value = 'normal';
        driverCollectionRule.setAttribute('value', 'normal');
    }
    if (organizerFree) organizerFree.checked = false;
    if (organizerRule) {
        organizerRule.value = 'collect';
        organizerRule.setAttribute('value', 'collect');
    }
    [byId('seisanStandaloneDriverCount'), byId('seisanStandaloneMemberCount')].forEach(field => {
        if (field) delete field.dataset.touched;
    });
    validateSettlementSettings(false);
    setSettlementSettingsStep(1);
    if (modals.settlementSettings) modals.settlementSettings.show();
}

function validateStandaloneSettlementSettings(showErrors = true) {
    const enabled = byId('seisanStandaloneEnabled');
    const fields = [byId('seisanStandaloneDriverCount'), byId('seisanStandaloneMemberCount')].filter(Boolean);
    const shouldValidate = !!enabled?.checked;
    const invalidFields = shouldValidate ? fields.filter(field => String(settlementSettingsFieldValue(field) || '').trim() === '') : [];
    fields.forEach(field => {
        const invalid = invalidFields.includes(field) && settlementSettingsFieldErrorVisible(field, showErrors);
        field.invalid = invalid;
        const invalidText = `${field.getAttribute('aria-label') || '人数'}を入力してください`;
        field.invalidText = invalid ? invalidText : '';
        field.toggleAttribute('invalid', invalid);
        if (invalid) field.setAttribute('invalid-text', invalidText);
        else field.removeAttribute('invalid-text');
        field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    });
    return invalidFields.length === 0;
}


function validateOrganizerSettlementSettings(showErrors = true) {
    const organizerFree = byId('seisanOrganizerFree');
    const organizer = byId('seisanOrganizerName');
    const organizerField = byId('seisanOrganizerField');
    const missing = !!organizerFree?.checked && !String(organizer?.value || '').trim();
    if (organizerField) organizerField.hidden = false;
    if (organizer) {
        // Missing organizer is guidance, not a save-blocking data error. The calculator already
        // treats this condition as informational; the settings modal must follow the same rule.
        organizer.invalid = false;
        organizer.invalidText = '';
        organizer.removeAttribute('invalid');
        organizer.removeAttribute('invalid-text');
        organizer.setAttribute('aria-invalid', 'false');
        organizer.warn = showErrors && missing;
        organizer.warnText = showErrors && missing ? '企画者を選ぶと、集金対象外を正確にできます' : '';
        organizer.toggleAttribute('warn', showErrors && missing);
        if (organizer.warnText) organizer.setAttribute('warn-text', organizer.warnText);
        else organizer.removeAttribute('warn-text');
    }
    return true;
}

function focusFirstSettlementSettingsValidationError() {
    const modal = byId('settlementSettingsModal');
    const host = modal?.querySelector('[data-settlement-step="1"]:not([hidden]) [invalid], [data-settlement-step="1"]:not([hidden]) [aria-invalid="true"]');
    if (!host) return;
    const apply = () => {
        host.scrollIntoView?.({ block: 'center', inline: 'nearest' });
        const control = host.shadowRoot?.querySelector('input, select, textarea, button');
        (control || host).focus?.({ preventScroll: true });
    };
    Promise.resolve(host.updateComplete).then(() => requestAnimationFrame(() => requestAnimationFrame(apply)));
}

function validateSettlementSettings(showErrors = true) {
    if (showErrors) settlementSettingsValidationRequested = true;
    const standaloneValid = validateStandaloneSettlementSettings(showErrors);
    const organizerValid = validateOrganizerSettlementSettings(showErrors);
    const valid = standaloneValid && organizerValid;
    if (showErrors && !valid) focusFirstSettlementSettingsValidationError();
    return valid;
}

function restoreSettlementSettingsOpeningSnapshot() {
    if (!settlementSettingsOpeningSnapshot) return;
    settlementState = normalizeSettlementState(cloneData(settlementSettingsOpeningSnapshot));
}

function waitForSettlementSettingsModalHidden() {
    const modal = byId('settlementSettingsModal');
    if (!modal || !modal.open) return Promise.resolve();
    return new Promise(resolve => modal.addEventListener('sanpo:modal-hidden', resolve, { once: true }));
}

function validateAndSaveSettlementSettingsBeforeClose(reason = 'dismiss') {
    if (settlementSettingsClosePrepared) {
        settlementSettingsClosePrepared = false;
        return true;
    }
    if (reason === 'submit') return true;
    // Carbon close, Escape and Cancel all discard the modal session. The only
    // path that commits to Firebase is the explicit final Save action.
    clearTimeout(settlementRenderTimer);
    clearTimeout(settlementCommitTimer);
    restoreSettlementSettingsOpeningSnapshot();
    saveLocalDraftOnly?.();
    renderSettlementView({ force: true });
    return true;
}

function clearSettlementSettingsEditor() {
    if (settlementSettingsPreserveOnHidden) return;
    settlementSettingsOpeningSnapshot = null;
    settlementSettingsOpeningRoomSnapshot = null;
    settlementSettingsSyncBaseSnapshot = null;
    settlementSettingsClosePrepared = false;
    settlementSettingsDiscardPromptActive = false;
    settlementSettingsStep = 1;
    settlementSettingsValidationRequested = false;
}

function renderSettlementAfterModalCommit(modalId) {
    const modal = byId(modalId);
    const render = () => {
        if (modal?.open) return;
        renderSettlementView({ force: true });
    };
    // Carbon closes asynchronously.  Render the underlying screen after the top-layer modal
    // is gone so a remote/UI rebuild cannot invalidate the footer click that initiated save.
    queueMicrotask(render);
    requestAnimationFrame(render);
}

function saveSettlementSettingsDraft({ render = true } = {}) {
    syncSettlementStateFromDOM();
    saveLocalDraftOnly?.();
    if (render) renderSettlementAfterModalCommit('settlementSettingsModal');
}

async function saveSettlementSettings() {
    settlementSettingsValidationRequested = true;
    if (!validateSettlementSettings(true)) {
        setSettlementSettingsStep(1, { focus: true });
        focusFirstSettlementSettingsValidationError();
        return false;
    }
    syncSettlementStateFromDOM();
    clearTimeout(settlementRenderTimer);
    clearTimeout(settlementCommitTimer);
    const currentRoom = cloneData(getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }));
    const openingRoom = cloneData(settlementSettingsOpeningRoomSnapshot || lastSyncedData || currentRoom);
    const syncBase = cloneData(settlementSettingsSyncBaseSnapshot || lastSyncedData || openingRoom);
    const preExistingPatch = window.SanpoEntitySyncTest?.buildEntityPatch?.(syncBase, openingRoom) || {};
    const intentPatch = window.SanpoSync?.buildSettlementSettingsIntentPatch?.(openingRoom, currentRoom)
        || window.SanpoSync?.buildSettlementIntentPatch?.(openingRoom, currentRoom)
        || {};
    const commitPatch = { ...preExistingPatch, ...intentPatch };
    const saveButton = byId('saveSettlementSettingsBtn');
    if (saveButton) saveButton.disabled = true;
    const committed = await window.SanpoSync?.saveImmediate?.({ snapshot: currentRoom, baseSnapshot: syncBase, patchOverride: commitPatch });
    if (saveButton) saveButton.disabled = false;
    if (!committed) {
        window.showAppNotice?.('保存できませんでした。入力内容は残しています。もう一度保存してください。', true);
        return false;
    }
    settlementSettingsClosePrepared = true;
    if (modals.settlementSettings) modals.settlementSettings.hide({ reason: 'submit' });
    renderSettlementAfterModalCommit('settlementSettingsModal');
    return true;
}

function openSettlementCarEditor(encodedName) {
    syncSettlementStateFromDOM();
    settlementCarEditValidationActive = false;
    settlementCarEditClosePrepared = false;
    settlementCarEditDiscardPromptActive = false;
    settlementCarEditPreserveOnHidden = false;
    settlementCarEditOpeningSnapshot = cloneData(ensureSettlementState());
    settlementCarEditOpeningRoomSnapshot = cloneData(getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }));
    settlementCarEditSyncBaseSnapshot = cloneData(lastSyncedData || settlementCarEditOpeningRoomSnapshot);
    const name = decodeURIComponent(encodedName || '');
    activeSettlementCarEditName = name;
    const title = byId('settlementCarEditModalTitle');
    if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(name)}車の費用を編集`;
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
    if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(name)}車の費用を編集`;
    refreshSettlementCarEditor(name);
    if (modals.settlementCarEdit) modals.settlementCarEdit.show();
}

function readStandaloneDriverNameFromEditor() {
    const row = byId('settlementCarEditBody')?.querySelector?.('.seisan-car-row[data-standalone-driver-index]');
    if (!row) return '';
    const index = Number(row.dataset.standaloneDriverIndex);
    const input = row.querySelector('[data-field="standaloneDriverName"]');
    return normalizeStandaloneDriverName(input?.value || row.dataset.driverName, Number.isInteger(index) ? index : 0);
}

function saveSettlementCarEditDraft({ render = true, refreshEditor = false } = {}) {
    const renamedStandaloneDriver = readStandaloneDriverNameFromEditor();
    syncSettlementStateFromDOM();
    if (renamedStandaloneDriver) activeSettlementCarEditName = renamedStandaloneDriver;
    save();

    if (renamedStandaloneDriver && refreshEditor) {
        const title = byId('settlementCarEditModalTitle');
        if (title) title.innerHTML = `<span data-carbon-icon="car-small" class="app-modal-heading-icon" aria-hidden="true"></span>${escapeHtml(renamedStandaloneDriver)}車の費用を編集`;
        refreshSettlementCarEditor(renamedStandaloneDriver);
    }
    if (render) renderSettlementAfterModalCommit('settlementCarEditModal');
}

async function saveSettlementCarEdit() {
    // The editor's car key can change in standalone mode. Set the active key
    // before validation and intent-patch filtering so the renamed car is part
    // of the explicit remote-save scope as well as the local snapshot.
    const renamedStandaloneDriver = readStandaloneDriverNameFromEditor();
    if (renamedStandaloneDriver) activeSettlementCarEditName = renamedStandaloneDriver;
    if (!validateActiveSettlementCarEditor(true)) return false;
    syncSettlementStateFromDOM();
    const currentRoom = cloneData(getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }));
    const openingRoom = cloneData(settlementCarEditOpeningRoomSnapshot || lastSyncedData || currentRoom);
    const syncBase = cloneData(settlementCarEditSyncBaseSnapshot || lastSyncedData || openingRoom);
    const preExistingPatch = window.SanpoEntitySyncTest?.buildEntityPatch?.(syncBase, openingRoom) || {};
    const participantId = window.SanpoCanonicalState?.findParticipantIdByName?.(openingRoom.participants || currentRoom.participants || {}, activeSettlementCarEditName) || '';
    const intentPatch = window.SanpoSync?.buildSettlementCarIntentPatch?.(openingRoom, currentRoom, {
        participantId,
        name: activeSettlementCarEditName
    }) || {};
    const commitPatch = { ...preExistingPatch, ...intentPatch };
    const saveButton = byId('saveSettlementCarEditBtn');
    if (saveButton) saveButton.disabled = true;
    const committed = await window.SanpoSync?.saveImmediate?.({ snapshot: currentRoom, baseSnapshot: syncBase, patchOverride: commitPatch });
    if (saveButton) saveButton.disabled = false;
    if (!committed) {
        window.showAppNotice?.('保存できませんでした。入力内容は残しています。もう一度保存してください。', true);
        return false;
    }
    settlementCarEditClosePrepared = true;
    if (modals.settlementCarEdit) modals.settlementCarEdit.hide({ reason: 'submit' });
    renderSettlementAfterModalCommit('settlementCarEditModal');
    return true;
}

function shouldPreserveSettlementCarEditorOnHidden() {
    return settlementCarEditPreserveOnHidden;
}

function clearSettlementCarEditor() {
    if (settlementCarEditPreserveOnHidden) return;
    settlementCarEditValidationActive = false;
    settlementCarEditClosePrepared = false;
    settlementCarEditOpeningSnapshot = null;
    settlementCarEditOpeningRoomSnapshot = null;
    settlementCarEditSyncBaseSnapshot = null;
    settlementCarEditDiscardPromptActive = false;
    const body = byId('settlementCarEditBody');
    if (body) body.innerHTML = '';
    activeSettlementCarEditName = '';
}

window.SanpoApp?.exposeCompat?.('openSettlementSettings', openSettlementSettings);
window.SanpoApp?.exposeCompat?.('openStandaloneSettlementSettings', openStandaloneSettlementSettings);
window.SanpoApp?.exposeCompat?.('saveSettlementSettingsDraft', saveSettlementSettingsDraft);
window.SanpoApp?.exposeCompat?.('saveSettlementSettings', saveSettlementSettings);
window.SanpoApp?.exposeCompat?.('validateSettlementSettings', validateSettlementSettings);
window.SanpoApp?.exposeCompat?.('validateAndSaveSettlementSettingsBeforeClose', validateAndSaveSettlementSettingsBeforeClose);
window.SanpoApp?.exposeCompat?.('clearSettlementSettingsEditor', clearSettlementSettingsEditor);
window.SanpoApp?.exposeCompat?.('nextSettlementSettingsStep', nextSettlementSettingsStep);
window.SanpoApp?.exposeCompat?.('previousSettlementSettingsStep', previousSettlementSettingsStep);
window.SanpoApp?.exposeCompat?.('goToSettlementSettingsStep', goToSettlementSettingsStep);
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

    if (!options.preserveSettingsControls) syncSettlementControls(state, participants);

    const result = calculateSettlement(data, state);
    const summaryIssues = getSettlementIssues(data, state, result);
    renderSettlementIssues(summaryIssues);

    const statusSummary = byId('seisan-status-summary');
    if (statusSummary) statusSummary.innerHTML = renderSettlementStatusHtml(state, result, summaryIssues);

    const settingsSummary = byId('seisan-settings-summary');
    if (settingsSummary) settingsSummary.innerHTML = renderSettlementSettingSummaryHtml(state, result);

    const summary = byId('seisan-summary');
    if (summary) summary.innerHTML = renderSettlementSummaryHtml(result, summaryIssues);

    const carList = byId('seisan-car-list');
    if (carList) {
        carList.innerHTML = renderSettlementCarsHtml(data, state, result, summaryIssues);
        applySettlementCarLayout(carList, (data.cars || []).length);
    }

    const clubExpenseList = byId('seisan-club-expense-list');
    if (clubExpenseList) clubExpenseList.innerHTML = renderSettlementClubExpenseBreakdownHtml(result);

    const collectionList = byId('seisan-collection-list');
    if (collectionList) collectionList.innerHTML = renderSettlementCollectionHtml(data, participants, state, result);

    const collectionProgress = byId('seisan-collection-progress');
    if (collectionProgress) collectionProgress.textContent = `${result.paidCount}/${result.payerCount}人・${yen(result.expectedCollected - result.unpaidAmount)} / ${yen(result.expectedCollected)}・残り ${yen(result.unpaidAmount || 0)}`;
    const unpaidFilter = byId('seisan-unpaid-filter');
    if (unpaidFilter) {
        unpaidFilter.setAttribute('aria-pressed', settlementCollectionUnpaidOnly ? 'true' : 'false');
        unpaidFilter.textContent = settlementCollectionUnpaidOnly ? '全員を表示' : '未回収のみ';
    }

    const paidCarCount = (result.cars || []).filter(car => state.driverPaid?.[car.name]).length;
    const paymentRemaining = (result.cars || []).filter(car => !state.driverPaid?.[car.name]).reduce((sum, car) => sum + Number(car.adjustedTotalPay || 0), 0);
    const paymentProgress = byId('seisan-payment-progress');
    if (paymentProgress) paymentProgress.textContent = `支払い済み ${paidCarCount}/${(result.cars || []).length}台・残り ${yen(paymentRemaining)}`;

    const driverPayList = byId('seisan-driver-pay-list');
    if (driverPayList) driverPayList.innerHTML = renderSettlementDriverPayHtml(result, state);

    const memo = byId('seisanMemoInput');
    if (memo && document.activeElement !== memo) memo.value = state.memo || '';

    const breakdown = byId('seisan-breakdown');
    if (breakdown) breakdown.innerHTML = renderSettlementBreakdownHtml(result);
}

window.SanpoApp?.exposeCompat?.('fitSettlementExtraNameField', fitSettlementExtraNameField);
window.SanpoApp?.exposeCompat?.('fitSettlementExtraNameFields', fitSettlementExtraNameFields);
window.SanpoApp?.exposeCompat?.('toggleSettlementCarLayout', toggleSettlementCarLayout);
