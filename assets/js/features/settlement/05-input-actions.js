// Settlement input/change actions.
// Split from features/settlement.js during S-3 cleanup.

function onSettlementInput() {
    commitSettlementAfterKeyboardSettles();
}

function onSettlementInputDelayed() {
    protectSettlementEditing();
    // 入力中に精算画面全体を再描画・クラウド同期すると、iPhoneなどで
    // フォーカスが外れてキーボードが閉じることがある。
    // 入力中はDOMから状態を拾ってローカル下書きだけ保存し、再描画と同期は
    // change / focusout の確定タイミングまで待つ。
    syncSettlementStateFromDOM();
    clearTimeout(settlementRenderTimer);
    settlementRenderTimer = setTimeout(() => {
        saveLocalDraftOnly();
    }, 450);
}

function addSettlementExtra(encodedName) {
    syncSettlementStateFromDOM();
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    const car = normalizeCarSettlementState(state.cars[name] || {});
    car.extras.push({ id: createSettlementExtraId(), name: '', amount: '', type: 'split', pending: true });
    state.cars[name] = car;
    if (typeof refreshSettlementCarEditor === 'function') refreshSettlementCarEditor(name);
    saveLocalDraftOnly();
}

function addSettlementExtraCandidate(encodedName, encodedCandidate, encodedAmount = '', type = 'split') {
    syncSettlementStateFromDOM();
    const name = decodeURIComponent(encodedName || '');
    const candidate = decodeURIComponent(encodedCandidate || '').trim();
    const amount = decodeURIComponent(encodedAmount || '');
    const normalizedType = normalizeSettlementExtraType(type);
    if (!name || !candidate) return;
    const state = ensureSettlementState();
    const car = normalizeCarSettlementState(state.cars[name] || {});
    const blankExtra = car.extras.find(extra => !String(extra?.name || '').trim());
    if (blankExtra) {
        blankExtra.name = candidate;
        blankExtra.amount = amount;
        blankExtra.type = normalizedType;
    } else {
        car.extras.push({ id: createSettlementExtraId(), name: candidate, amount, type: normalizedType });
    }
    state.cars[name] = car;
    if (typeof refreshSettlementCarEditor === 'function') refreshSettlementCarEditor(name);
    saveLocalDraftOnly();
}

async function removeSettlementExtra(button) {
    const row = button.closest('.seisan-extra-row');
    const carRow = button.closest('.seisan-car-row');
    if (!row || !carRow) return;

    const extraName = row.querySelector('[data-extra-field="name"]')?.value.trim() || '名称未入力';
    const amountRaw = row.querySelector('[data-extra-field="amount"]')?.value.trim();
    const amountNumber = Number(amountRaw || 0);
    const amountText = amountRaw ? `${amountNumber.toLocaleString('ja-JP')}円` : '金額未入力';
    const type = normalizeSettlementExtraType(row.querySelector('[data-extra-field="type"]')?.value || 'split');
    const typeValue = ({ split: '割勘', club: '部費', 'split-minus': '割勘 −', 'club-minus': '部費 −' })[type] || '割勘';

    const message = `以下の諸経費を削除しますか？\n\n名目：${extraName}\n金額：${amountText}\n扱い：${typeValue}\n\n入力内容は元に戻せません。`;
    if (!await appConfirm(message, { title: '諸経費を削除', okText: '削除', danger: true })) return;

    row.remove();
    syncSettlementStateFromDOM();
    saveLocalDraftOnly();
}

async function confirmSettlementCheckChange(message, options = {}, input = null, checked = false) {
    const ok = await appConfirm(message, options);
    if (!ok && input) {
        input.checked = !checked;
        if ('toggled' in input) input.toggled = !checked;
    }
    return ok;
}

function captureSettlementScrollPosition() {
    return typeof captureSettlementViewportState === 'function'
        ? captureSettlementViewportState()
        : null;
}

function consumeSettlementCheckScrollPosition() {
    const snapshot = window.__settlementCheckScrollSnapshot || captureSettlementScrollPosition();
    window.__settlementCheckScrollSnapshot = null;
    return snapshot;
}

function restoreSettlementScrollPosition(snapshot) {
    if (typeof restoreSettlementViewportState === 'function') {
        restoreSettlementViewportState(snapshot);
    }
}

function stabilizeSettlementScrollPosition(snapshot) {
    if (typeof stabilizeSettlementViewportState === 'function') {
        stabilizeSettlementViewportState(snapshot);
        return;
    }
    restoreSettlementScrollPosition(snapshot);
}

function renderSettlementViewPreservingScroll(snapshot = captureSettlementScrollPosition()) {
    renderSettlementView();
    stabilizeSettlementScrollPosition(snapshot);
}

function refreshSettlementCollectionStatus(encodedName, name, checked, state) {
    const input = Array.from(document.querySelectorAll('[data-settlement-paid-name]'))
        .find(candidate => candidate.dataset.settlementPaidName === encodedName);
    if (input) {
        input.checked = !!checked;
        const item = input.closest('.seisan-check-item');
        item?.classList.toggle('paid', !!checked);
        if (item) item.hidden = settlementCollectionUnpaidOnly && !!checked;
        const displayName = state.paidBy?.[name] || name;
        const nameEl = item?.querySelector('.seisan-check-name');
        if (nameEl) nameEl.textContent = displayName;
        const noteEl = item?.querySelector('.seisan-check-note');
        if (noteEl) noteEl.textContent = checked ? '回収済み' : '未回収';
        input.setAttribute('aria-label', `${displayName}の集金チェック`);
    }

    const data = getRoomDataOnly();
    const result = calculateSettlement(data, state);
    const collectionProgress = byId('seisan-collection-progress');
    if (collectionProgress) collectionProgress.textContent = `${result.paidCount}/${result.payerCount}人・${yen(result.expectedCollected - result.unpaidAmount)} / ${yen(result.expectedCollected)}・残り ${yen(result.unpaidAmount || 0)}`;
    const statusSummary = byId('seisan-status-summary');
    if (statusSummary) statusSummary.innerHTML = renderSettlementStatusHtml(state, result, getSettlementIssues(data, state, result));
}

async function toggleSettlementPaid(encodedName, checked, input = null) {
    const scrollSnapshot = consumeSettlementCheckScrollPosition();
    input?.focus?.({ preventScroll: true });
    if (!window.SanpoFocusModality?.isKeyboard?.()) window.SanpoFocusModality?.clearPointerFocus?.(input);
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    const previousPaid = { ...(state.paid || {}) };
    const previousPaidBy = { ...(state.paidBy || {}) };
    if (checked && state.standalone?.enabled) {
        const paidByName = await appPrompt('集金した人の名前を入力してください', state.paidBy?.[name] || '', {
            title: '集金済みにする人',
            okText: '記録'
        });
        const normalizedPaidByName = String(paidByName || '').trim();
        if (!normalizedPaidByName) {
            if (input) input.checked = false;
            stabilizeSettlementScrollPosition(scrollSnapshot);
            return;
        }
        state.paidBy = { ...(state.paidBy || {}), [name]: normalizedPaidByName };
    }
    stabilizeSettlementScrollPosition(scrollSnapshot);
    state.paid[name] = !!checked;
    if (!checked && state.paidBy) delete state.paidBy[name];
    refreshSettlementCollectionStatus(encodedName, name, checked, state);
    save();
    showUndoRestoreToast(checked ? `${name}さんを回収済みにしました` : `${name}さんを未回収に戻しました`, () => {
        const currentState = ensureSettlementState();
        currentState.paid = previousPaid;
        currentState.paidBy = previousPaidBy;
        renderSettlementViewPreservingScroll(scrollSnapshot);
        save();
    });
    stabilizeSettlementScrollPosition(scrollSnapshot);
}

async function toggleSettlementDriverPaid(encodedName, checked, input = null) {
    const scrollSnapshot = consumeSettlementCheckScrollPosition();
    input?.focus?.({ preventScroll: true });
    if (!window.SanpoFocusModality?.isKeyboard?.()) window.SanpoFocusModality?.clearPointerFocus?.(input);
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    const previousDriverPaid = { ...(state.driverPaid || {}) };
    state.driverPaid[name] = !!checked;
    renderSettlementViewPreservingScroll(scrollSnapshot);
    save();
    showUndoRestoreToast(checked ? `${name}車への支払いを完了にしました` : `${name}車を未払いに戻しました`, () => {
        const currentState = ensureSettlementState();
        currentState.driverPaid = previousDriverPaid;
        renderSettlementViewPreservingScroll(scrollSnapshot);
        save();
    });
    stabilizeSettlementScrollPosition(scrollSnapshot);
}

function toggleSettlementUnpaidFilter() {
    const snapshot = captureSettlementScrollPosition();
    settlementCollectionUnpaidOnly = !settlementCollectionUnpaidOnly;
    renderSettlementViewPreservingScroll(snapshot);
}

function copySettlementUnpaid() {
    const state = ensureSettlementState();
    const data = getRoomDataOnly();
    const result = calculateSettlement(data, state);
    const names = result.participants
        .filter(person => !result.excludedNames.has(person.name) && !state.paid?.[person.name])
        .map(person => person.name);
    if (!names.length) {
        showAppNotice('未回収者はいません');
        return;
    }
    copyTextWithFallback(names.join('、'), '未回収者をコピーしました');
}

window.SanpoApp?.exposeCompat?.('onSettlementInput', onSettlementInput);
window.SanpoApp?.exposeCompat?.('onSettlementInputDelayed', onSettlementInputDelayed);
window.SanpoApp?.exposeCompat?.('addSettlementExtra', addSettlementExtra);
window.SanpoApp?.exposeCompat?.('addSettlementExtraCandidate', addSettlementExtraCandidate);
window.SanpoApp?.exposeCompat?.('removeSettlementExtra', removeSettlementExtra);
window.SanpoApp?.exposeCompat?.('captureSettlementScrollPosition', captureSettlementScrollPosition);
window.SanpoApp?.exposeCompat?.('toggleSettlementPaid', toggleSettlementPaid);
window.SanpoApp?.exposeCompat?.('toggleSettlementDriverPaid', toggleSettlementDriverPaid);
window.SanpoApp?.exposeCompat?.('toggleSettlementUnpaidFilter', toggleSettlementUnpaidFilter);
window.SanpoApp?.exposeCompat?.('copySettlementUnpaid', copySettlementUnpaid);
