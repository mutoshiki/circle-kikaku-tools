// Settlement edit protection. Prevents re-render/sync from stealing mobile keyboard focus.
// Split from app.js during S-4 cleanup.

let settlementProjectTitleState = null;
let settlementProjectTitleObserver = null;

function isSettlementCarEditorOpen() {
    return !!document.getElementById('settlementCarEditModal')?.open;
}

function readSettlementProjectTitleState() {
    const region = document.getElementById('projectTitleRegion');
    return region?.dataset?.state === 'collapsed' ? 'collapsed' : 'expanded';
}

function applySettlementProjectTitleState(state) {
    const region = document.getElementById('projectTitleRegion');
    const editor = document.getElementById('projectTitleEditor');
    if (!region || !editor) return;
    const expanded = state !== 'collapsed';
    region.dataset.state = expanded ? 'expanded' : 'collapsed';
    editor.inert = !expanded;
    editor.tabIndex = expanded ? 0 : -1;
}

function lockSettlementProjectTitleState() {
    const region = document.getElementById('projectTitleRegion');
    if (!region) return;
    settlementProjectTitleState = readSettlementProjectTitleState();
    settlementProjectTitleObserver?.disconnect();
    settlementProjectTitleObserver = new MutationObserver(() => {
        if (!isSettlementCarEditorOpen() || !settlementProjectTitleState) return;
        if (readSettlementProjectTitleState() !== settlementProjectTitleState) {
            applySettlementProjectTitleState(settlementProjectTitleState);
        }
    });
    settlementProjectTitleObserver.observe(region, { attributes: true, attributeFilter: ['data-state'] });
}

function releaseSettlementProjectTitleState() {
    settlementProjectTitleObserver?.disconnect();
    settlementProjectTitleObserver = null;
    if (settlementProjectTitleState) applySettlementProjectTitleState(settlementProjectTitleState);
    settlementProjectTitleState = null;
}

function bindSettlementProjectTitleGuard() {
    const modal = document.getElementById('settlementCarEditModal');
    if (!modal || modal.dataset.projectTitleGuardBound === 'true') return;
    modal.dataset.projectTitleGuardBound = 'true';
    modal.addEventListener('sanpo:modal-shown', lockSettlementProjectTitleState);
    modal.addEventListener('sanpo:modal-hidden', releaseSettlementProjectTitleState);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSettlementProjectTitleGuard, { once: true });
} else {
    bindSettlementProjectTitleGuard();
}

function isSettlementCostField(target = document.activeElement) {
    return !!(target?.matches?.('.seisan-car-row [data-field], .seisan-car-row [data-extra-field]'));
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

function resetSettlementEditingAfterEditorClose() {
    clearTimeout(settlementEditingLockTimer);
    clearTimeout(settlementRenderTimer);
    clearTimeout(settlementCommitTimer);
    settlementEditingLock = false;
    settlementCompositionActive = false;
    settlementRenderDeferred = false;
    releaseSettlementProjectTitleState();
}

function isSettlementInputProtected() {
    return settlementEditingLock || settlementCompositionActive || isEditingSettlementCostField();
}

function saveLocalDraftOnly() {
    try {
        lastUpdatedAt = (window.SanpoClock?.now?.() ?? Date.now());
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
        if (isEditingSettlementCostField() || settlementCompositionActive || isSettlementCarEditorOpen()) {
            if (isEditingSettlementCostField() || settlementCompositionActive) protectSettlementEditing();
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
