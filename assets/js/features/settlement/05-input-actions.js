// Settlement input/change actions.
// Split from features/settlement.js during S-3 cleanup.

window.onSettlementInput = function() {
    commitSettlementAfterKeyboardSettles();
};

window.onSettlementInputDelayed = function() {
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
};

window.addSettlementExtra = function(encodedName) {
    syncSettlementStateFromDOM();
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    const car = normalizeCarSettlementState(state.cars[name] || {});
    car.extras.push({ name: '', amount: '', type: 'split' });
    state.cars[name] = car;
    renderSettlementView();
    save();
};

window.removeSettlementExtra = async function(button) {
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
};

window.toggleSettlementPaid = function(encodedName, checked) {
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    state.paid[name] = !!checked;
    renderSettlementView();
    save();
};

window.toggleSettlementDriverPaid = function(encodedName, checked) {
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    state.driverPaid[name] = !!checked;
    renderSettlementView();
    save();
};
