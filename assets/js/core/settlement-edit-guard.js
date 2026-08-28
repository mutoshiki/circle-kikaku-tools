// Settlement edit protection. Prevents re-render/sync from stealing mobile keyboard focus.
// Split from app.js during S-4 cleanup.

let settlementProjectTitleState = null;
let settlementProjectTitleObserver = null;
let settlementEditViewportSnapshot = null;

function isSettlementCarEditorOpen() {
    return !!document.getElementById('settlementCarEditModal')?.open;
}

function isSettlementEditSessionActive() {
    const carEditor = document.getElementById('settlementCarEditModal');
    const movementEditor = document.getElementById('settlementGasEditModal');
    const settingsEditor = document.getElementById('settlementSettingsModal');
    return !!(
        carEditor?.open
        || movementEditor?.open
        || settingsEditor?.open
        || window.shouldPreserveSettlementCarEditorOnHidden?.()
    );
}

function readSettlementProjectTitleState() {
    const region = document.getElementById('projectTitleRegion');
    return region?.dataset?.state === 'collapsed' ? 'collapsed' : 'expanded';
}

function applySettlementProjectTitleState(state) {
    const region = document.getElementById('projectTitleRegion');
    const input = document.getElementById('roomNameInput');
    if (!region || !input) return;
    const expanded = state !== 'collapsed';
    region.dataset.state = expanded ? 'expanded' : 'collapsed';
    input.inert = !expanded;
    input.tabIndex = expanded ? 0 : -1;
}

function captureSettlementViewportState() {
    const ids = ['seisan-view-area', 'app-layout', 'top-area', 'sheet-view-area', 'sheet-canvas'];
    const nodes = ids.map(id => document.getElementById(id)).filter(Boolean);
    return {
        titleState: readSettlementProjectTitleState(),
        windowX: Number(window.scrollX || 0),
        windowY: Number(window.scrollY || 0),
        documentTop: Number(document.scrollingElement?.scrollTop || 0),
        documentElementTop: Number(document.documentElement?.scrollTop || 0),
        bodyTop: Number(document.body?.scrollTop || 0),
        nodes: nodes.map(node => ({ node, top: Number(node.scrollTop || 0), left: Number(node.scrollLeft || 0) }))
    };
}

function restoreSettlementViewportState(snapshot) {
    if (!snapshot) return;
    if (snapshot.titleState) applySettlementProjectTitleState(snapshot.titleState);
    (snapshot.nodes || []).forEach(({ node, top, left }) => {
        if (!node?.isConnected) return;
        node.scrollTop = Number(top || 0);
        node.scrollLeft = Number(left || 0);
    });
    window.scrollTo(Number(snapshot.windowX || 0), Number(snapshot.windowY || 0));
    if (document.scrollingElement) document.scrollingElement.scrollTop = Number(snapshot.documentTop || 0);
    if (document.documentElement) document.documentElement.scrollTop = Number(snapshot.documentElementTop || 0);
    if (document.body) document.body.scrollTop = Number(snapshot.bodyTop || 0);
}

function stabilizeSettlementViewportState(snapshot, delays = [0, 80, 240, 800]) {
    if (!snapshot) return;
    let cancelled = false;
    const cancel = () => { cancelled = true; cleanup(); };
    const cleanup = () => {
        document.removeEventListener('pointerdown', cancel, true);
        document.removeEventListener('touchstart', cancel, true);
        document.removeEventListener('wheel', cancel, true);
        document.removeEventListener('keydown', cancel, true);
    };
    const restore = () => {
        if (!cancelled) restoreSettlementViewportState(snapshot);
    };
    document.addEventListener('pointerdown', cancel, true);
    document.addEventListener('touchstart', cancel, true);
    document.addEventListener('wheel', cancel, true);
    document.addEventListener('keydown', cancel, true);
    restore();
    requestAnimationFrame(() => requestAnimationFrame(restore));
    delays.forEach(delay => setTimeout(restore, delay));
    setTimeout(cleanup, Math.max(...delays, 0) + 80);
}

function lockSettlementProjectTitleState() {
    const region = document.getElementById('projectTitleRegion');
    if (!region) return;

    // A movement-settings modal temporarily hides the car editor. That is still the
    // same editing session, so never replace the opening viewport snapshot during
    // the child-modal transition or when the parent editor resumes.
    if (!settlementProjectTitleState) {
        settlementProjectTitleState = readSettlementProjectTitleState();
        settlementEditViewportSnapshot = captureSettlementViewportState();
    }
    applySettlementProjectTitleState(settlementProjectTitleState);

    settlementProjectTitleObserver?.disconnect();
    settlementProjectTitleObserver = new MutationObserver(() => {
        if (!isSettlementEditSessionActive() || !settlementProjectTitleState) return;
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
    const snapshot = settlementEditViewportSnapshot;
    settlementProjectTitleState = null;
    settlementEditViewportSnapshot = null;
    stabilizeSettlementViewportState(snapshot);
}

function maybeReleaseSettlementProjectTitleState() {
    if (window.shouldPreserveSettlementCarEditorOnHidden?.()) return;
    releaseSettlementProjectTitleState();
}

function bindSettlementProjectTitleGuard() {
    const modal = document.getElementById('settlementCarEditModal');
    if (!modal || modal.dataset.projectTitleGuardBound === 'true') return;
    modal.dataset.projectTitleGuardBound = 'true';
    modal.addEventListener('sanpo:modal-shown', lockSettlementProjectTitleState);
    modal.addEventListener('sanpo:modal-hidden', maybeReleaseSettlementProjectTitleState);
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
        if (isEditingSettlementCostField() || settlementCompositionActive || isSettlementEditSessionActive()) {
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
