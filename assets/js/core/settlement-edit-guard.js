// Settlement edit protection. Prevents re-render/sync from stealing mobile keyboard focus.
// Split from app.js during S-4 cleanup.

function isSettlementCostField(target = document.activeElement) {
    return !!(target?.matches?.('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]'));
}

function isEditingSettlementCostField() {
    return isSettlementCostField(document.activeElement);
}

function protectSettlementEditing() {
    settlementEditingLock = true;
    clearTimeout(settlementEditingLockTimer);
}

function releaseSettlementEditingSoon(delay = 320) {
    clearTimeout(settlementEditingLockTimer);
    settlementEditingLockTimer = setTimeout(() => {
        if (isEditingSettlementCostField() || settlementCompositionActive) return;
        settlementEditingLock = false;
        applyPendingRemoteSettlementData();
    }, delay);
}

function isSettlementInputProtected() {
    return settlementEditingLock || settlementCompositionActive || isEditingSettlementCostField();
}

function saveLocalDraftOnly() {
    try {
        lastUpdatedAt = Date.now();
        const d = getData();
        d.lastUpdatedBy = myClientId;
        d.lastUpdatedAt = lastUpdatedAt;
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(d));
    } catch (err) {
        console.warn('Failed to save local settlement draft:', err);
    }
}

function commitSettlementAfterKeyboardSettles() {
    clearTimeout(settlementRenderTimer);
    clearTimeout(settlementCommitTimer);

    if (isEditingSettlementCostField() || settlementCompositionActive) {
        protectSettlementEditing();
        syncSettlementStateFromDOM();
        settlementRenderDeferred = true;
        saveLocalDraftOnly();
        return;
    }

    settlementCommitTimer = setTimeout(() => {
        syncSettlementStateFromDOM();
        if (isEditingSettlementCostField() || settlementCompositionActive) {
            protectSettlementEditing();
            settlementRenderDeferred = true;
            saveLocalDraftOnly();
            return;
        }
        settlementEditingLock = false;
        settlementRenderDeferred = false;
        renderSettlementView({ force: true });
        save();
        applyPendingRemoteSettlementData();
    }, 320);
}
