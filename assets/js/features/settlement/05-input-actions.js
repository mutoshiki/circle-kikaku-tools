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
    car.extras.push({ name: '', amount: '', type: 'split', pending: true });
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
        car.extras.push({ name: candidate, amount, type: normalizedType });
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

    const message = `以下の諸経費を削除しますか？

名目：${extraName}
金額：${amountText}
扱い：${typeValue}

入力内容は元に戻せません。`;
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
    const area = byId('seisan-view-area');
    const layout = byId('app-layout');
    return {
        top: Number(area?.scrollTop || 0),
        left: Number(area?.scrollLeft || 0),
        windowY: Number(window.scrollY || 0),
        documentTop: Number(document.scrollingElement?.scrollTop || 0),
        documentElementTop: Number(document.documentElement?.scrollTop || 0),
        bodyTop: Number(document.body?.scrollTop || 0),
        layoutTop: Number(layout?.scrollTop || 0)
    };
}

function consumeSettlementCheckScrollPosition() {
    const snapshot = window.__settlementCheckScrollSnapshot || captureSettlementScrollPosition();
    window.__settlementCheckScrollSnapshot = null;
    return snapshot;
}

function restoreSettlementScrollPosition(snapshot) {
    const area = byId('seisan-view-area');
    const layout = byId('app-layout');
    if (!snapshot) return;
    if (area?.isConnected) {
        area.scrollTop = snapshot.top;
        area.scrollLeft = snapshot.left;
    }
    window.scrollTo({ top: snapshot.windowY, left: 0, behavior: 'auto' });
    if (document.scrollingElement) document.scrollingElement.scrollTop = snapshot.documentTop;
    if (document.documentElement) document.documentElement.scrollTop = snapshot.documentElementTop;
    if (document.body) document.body.scrollTop = snapshot.bodyTop;
    if (layout?.isConnected) layout.scrollTop = snapshot.layoutTop;
}

function stabilizeSettlementScrollPosition(snapshot) {
    const restore = () => restoreSettlementScrollPosition(snapshot);
    restore();
    requestAnimationFrame(restore);
    [0, 80, 240, 800].forEach(delay => setTimeout(restore, delay));
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
        input.closest('.seisan-check-item')?.classList.toggle('paid', !!checked);
        const displayName = state.paidBy?.[name] || name;
        const nameEl = input.closest('.seisan-check-item')?.querySelector('.seisan-check-name');
        if (nameEl) nameEl.textContent = displayName;
        input.setAttribute('aria-label', `${displayName}の支払いチェック`);
    }

    const data = getRoomDataOnly();
    const result = calculateSettlement(data, state);
    const note = byId('seisan-collection-note');
    if (note) {
        note.innerHTML = `<span class="seisan-collection-note-left"><span>集金済み ${result.paidCount}/${result.payerCount}名</span><span>未回収 ${yen(result.unpaidAmount)}</span></span><span class="seisan-collection-per-person"><span class="seisan-collection-per-person-label">1人あたり /</span><strong class="seisan-collection-per-person-amount">${yen(result.perPerson)}</strong></span>`;
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
}

async function toggleSettlementPaid(encodedName, checked, input = null) {
    const scrollSnapshot = consumeSettlementCheckScrollPosition();
    input?.focus?.({ preventScroll: true });
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    let confirmed = false;
    if (checked && state.standalone?.enabled) {
        const paidByName = await appPrompt('集金した人の名前を入力してください', state.paidBy?.[name] || '', {
            title: '集金済みにする人',
            okText: '記録'
        });
        const normalizedPaidByName = String(paidByName || '').trim();
        if (!normalizedPaidByName) {
            if (input) input.checked = false;
            return;
        }
        state.paidBy = { ...(state.paidBy || {}), [name]: normalizedPaidByName };
        confirmed = true;
    } else {
        confirmed = await confirmSettlementCheckChange(
            checked ? `${name}さんを集金済みにしますか？` : `${name}さんを未回収に戻しますか？`,
            { title: '集金チェック', okText: checked ? '記録' : '戻す' },
            input,
            checked
        );
    }
    restoreSettlementScrollPosition(scrollSnapshot);
    if (!confirmed) return;
    state.paid[name] = !!checked;
    if (!checked && state.paidBy) delete state.paidBy[name];
    refreshSettlementCollectionStatus(encodedName, name, checked, state);
    stabilizeSettlementScrollPosition(scrollSnapshot);
    save();
}

async function toggleSettlementDriverPaid(encodedName, checked, input = null) {
    const scrollSnapshot = consumeSettlementCheckScrollPosition();
    input?.focus?.({ preventScroll: true });
    const name = decodeURIComponent(encodedName);
    const confirmed = await confirmSettlementCheckChange(
        checked ? `${name}さんへの支払いを完了にしますか？` : `${name}さんへの支払いを未払いに戻しますか？`,
        { title: '支払いチェック', okText: checked ? '記録' : '戻す' },
        input,
        checked
    );
    restoreSettlementScrollPosition(scrollSnapshot);
    if (!confirmed) return;
    const state = ensureSettlementState();
    state.driverPaid[name] = !!checked;
    renderSettlementViewPreservingScroll(scrollSnapshot);
    save();
}

window.SanpoApp?.exposeCompat?.('onSettlementInput', onSettlementInput);
window.SanpoApp?.exposeCompat?.('onSettlementInputDelayed', onSettlementInputDelayed);
window.SanpoApp?.exposeCompat?.('addSettlementExtra', addSettlementExtra);
window.SanpoApp?.exposeCompat?.('addSettlementExtraCandidate', addSettlementExtraCandidate);
window.SanpoApp?.exposeCompat?.('removeSettlementExtra', removeSettlementExtra);
window.SanpoApp?.exposeCompat?.('captureSettlementScrollPosition', captureSettlementScrollPosition);
window.SanpoApp?.exposeCompat?.('toggleSettlementPaid', toggleSettlementPaid);
window.SanpoApp?.exposeCompat?.('toggleSettlementDriverPaid', toggleSettlementDriverPaid);
