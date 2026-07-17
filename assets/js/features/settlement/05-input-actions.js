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
    car.extras.push({ name: '', amount: '', type: 'split' });
    state.cars[name] = car;
    if (typeof refreshSettlementCarEditor === 'function') refreshSettlementCarEditor(name);
    renderSettlementView({ force: true });
    save();
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
    renderSettlementView({ force: true });
    save();
}

async function removeSettlementExtra(button) {
    const row = button.closest('.seisan-extra-row');
    const carRow = button.closest('.seisan-car-row');
    if (!row || !carRow) return;

    const extraName = row.querySelector('[data-extra-field="name"]')?.value.trim() || '名称未入力';
    const amountRaw = row.querySelector('[data-extra-field="amount"]')?.value.trim();
    const amountNumber = Number(amountRaw || 0);
    const amountText = amountRaw ? `${amountNumber.toLocaleString('ja-JP')}円` : '金額未入力';
    const typeValue = row.querySelector('[data-extra-field="type"]')?.value === 'club' ? '部費' : '割勘';

    const message = `以下の諸経費を削除しますか？

名目：${extraName}
金額：${amountText}
扱い：${typeValue}

入力内容は元に戻せません。`;
    if (!await appConfirm(message, { title: '諸経費を削除', okText: '削除', danger: true })) return;

    row.remove();
    syncSettlementStateFromDOM();
    renderSettlementView();
    save();
}

async function confirmSettlementCheckChange(message, options = {}, input = null, checked = false) {
    const ok = await appConfirm(message, options);
    if (!ok && input) input.checked = !checked;
    return ok;
}

async function toggleSettlementPaid(encodedName, checked, input = null) {
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
    if (!confirmed) return;
    state.paid[name] = !!checked;
    if (!checked && state.paidBy) delete state.paidBy[name];
    renderSettlementView();
    save();
}

async function toggleSettlementDriverPaid(encodedName, checked, input = null) {
    const name = decodeURIComponent(encodedName);
    const confirmed = await confirmSettlementCheckChange(
        checked ? `${name}さんへの支払いを完了にしますか？` : `${name}さんへの支払いを未払いに戻しますか？`,
        { title: '支払いチェック', okText: checked ? '記録' : '戻す' },
        input,
        checked
    );
    if (!confirmed) return;
    const state = ensureSettlementState();
    state.driverPaid[name] = !!checked;
    renderSettlementView();
    save();
}

window.SanpoApp?.exposeCompat?.('onSettlementInput', onSettlementInput);
window.SanpoApp?.exposeCompat?.('onSettlementInputDelayed', onSettlementInputDelayed);
window.SanpoApp?.exposeCompat?.('addSettlementExtra', addSettlementExtra);
window.SanpoApp?.exposeCompat?.('addSettlementExtraCandidate', addSettlementExtraCandidate);
window.SanpoApp?.exposeCompat?.('removeSettlementExtra', removeSettlementExtra);
window.SanpoApp?.exposeCompat?.('toggleSettlementPaid', toggleSettlementPaid);
window.SanpoApp?.exposeCompat?.('toggleSettlementDriverPaid', toggleSettlementDriverPaid);
