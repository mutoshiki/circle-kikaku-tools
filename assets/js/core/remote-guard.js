// Collaborative remote-update guard.
//
// Remote Firebase snapshots must never repaint a local write surface while the user is
// interacting with it.  The old implementation only watched `input/change` for 1.8s,
// which left a large race window: a snapshot arriving between pointerdown and click on a
// Carbon modal footer could restore the page and invalidate the save interaction.
//
// This guard owns the *UI transaction boundary*.  It does not merge data; sync-controller
// owns that.  A write modal, focused editable control, composition session, or card drag
// keeps the visible UI stable.  Incoming snapshots are queued and applied after the local
// interaction is complete.

(function (global) {
    'use strict';

    const WRITE_MODAL_IDS = new Set([
        'commonEditModal',
        'batchImportModal',
        'settlementSettingsModal',
        'settlementCarEditModal',
        'routeDistanceModal',
        'planningCheckModal'
    ]);

    const EDITABLE_SELECTOR = [
        'input:not([readonly]):not([disabled])',
        'textarea:not([readonly]):not([disabled])',
        'select:not([disabled])',
        'cds-text-input:not([readonly]):not([disabled])',
        'cds-textarea:not([readonly]):not([disabled])',
        'cds-number-input:not([readonly]):not([disabled])',
        'cds-select:not([disabled])',
        'cds-dropdown:not([disabled])',
        'cds-combo-box:not([disabled])',
        'cds-checkbox:not([disabled])',
        'cds-radio-button:not([disabled])',
        'cds-radio-button-group:not([disabled])',
        'cds-toggle:not([disabled])',
        'cds-content-switcher:not([disabled])'
    ].join(',');

    let localEditUntil = 0;
    let compositionDepth = 0;
    let pointerTransactionDepth = 0;
    let pendingApplyTimer = 0;

    function deepestActiveElement(root = document) {
        let active = root?.activeElement || null;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active;
    }

    function isModalOpen(modal) {
        return !!modal && modal.hidden !== true && (modal.open === true || modal.hasAttribute?.('open'));
    }

    function modalOwnsLocalWrite(modal) {
        if (!isModalOpen(modal)) return false;
        if (WRITE_MODAL_IDS.has(modal.id)) return true;
        // Future write modals are protected automatically; read-only help/history modals are not.
        return !!modal.querySelector?.(EDITABLE_SELECTOR);
    }

    function isCollaborativeEditModalOpen() {
        return Array.from(document.querySelectorAll('.app-modal')).some(modalOwnsLocalWrite);
    }

    function isEditableControlFocused() {
        const active = deepestActiveElement(document);
        if (!active) return false;
        if (active.matches?.(EDITABLE_SELECTOR)) return true;
        if (active.closest?.(EDITABLE_SELECTOR)) return true;
        return Array.from(document.querySelectorAll(EDITABLE_SELECTOR)).some(control => {
            const shadowActive = control.shadowRoot?.activeElement;
            return !!shadowActive && (shadowActive === active || shadowActive.contains?.(active));
        });
    }

    function isCardGestureActive() {
        return (typeof isDraggingCards !== 'undefined' && !!isDraggingCards)
            || (typeof manualCardDrag !== 'undefined' && !!manualCardDrag)
            || (typeof manualSheetDrag !== 'undefined' && !!manualSheetDrag);
    }

    function isSettlementGestureActive() {
        return (typeof settlementCompositionActive !== 'undefined' && !!settlementCompositionActive)
            || (typeof settlementEditingLock !== 'undefined' && !!settlementEditingLock);
    }

    function markLocalEditing(duration = 700) {
        localEditUntil = Math.max(localEditUntil, Date.now() + Math.max(0, Number(duration) || 0));
    }

    function isBusy() {
        return isCollaborativeEditModalOpen()
            || isEditableControlFocused()
            || compositionDepth > 0
            || pointerTransactionDepth > 0
            || isCardGestureActive()
            || isSettlementGestureActive()
            || Date.now() < localEditUntil;
    }

    function requestPendingApply(delay = 0) {
        clearTimeout(pendingApplyTimer);
        pendingApplyTimer = setTimeout(() => {
            pendingApplyTimer = 0;
            if (isBusy()) {
                requestPendingApply(120);
                return;
            }
            global.applyPendingRemoteRoomData?.();
        }, Math.max(0, Number(delay) || 0));
    }

    function beginPointerTransaction(event) {
        const path = event.composedPath?.() || [];
        const inWriteModal = path.some(node => node instanceof Element && node.classList?.contains('app-modal') && modalOwnsLocalWrite(node));
        if (!inWriteModal) return;
        pointerTransactionDepth += 1;
        markLocalEditing(450);
    }

    function endPointerTransaction() {
        if (pointerTransactionDepth > 0) pointerTransactionDepth -= 1;
        markLocalEditing(220);
        requestPendingApply(240);
    }

    document.addEventListener('pointerdown', beginPointerTransaction, true);
    document.addEventListener('pointerup', endPointerTransaction, true);
    document.addEventListener('pointercancel', endPointerTransaction, true);
    document.addEventListener('touchend', endPointerTransaction, { capture: true, passive: true });
    document.addEventListener('touchcancel', endPointerTransaction, { capture: true, passive: true });

    document.addEventListener('input', () => markLocalEditing(700), true);
    document.addEventListener('change', () => markLocalEditing(500), true);
    document.addEventListener('compositionstart', () => {
        compositionDepth += 1;
        markLocalEditing(1200);
    }, true);
    document.addEventListener('compositionend', () => {
        compositionDepth = Math.max(0, compositionDepth - 1);
        markLocalEditing(320);
        requestPendingApply(340);
    }, true);
    document.addEventListener('focusout', () => requestPendingApply(260), true);
    document.addEventListener('sanpo:modal-hidden', () => {
        // The submit/dismiss click is complete once Carbon has closed the write modal. Do not
        // keep an arbitrary pointer grace period that leaves the underlying page on a stale
        // canonical base; apply the queued merged snapshot before the next user action.
        if (!isCollaborativeEditModalOpen()) {
            pointerTransactionDepth = 0;
            localEditUntil = 0;
            // Modal hidden is the transaction boundary. Rebase synchronously before another
            // click/input task can sample the stale underlay as a new local change.
            global.applyPendingRemoteRoomData?.();
            return;
        }
        requestPendingApply(0);
    }, true);

    global.SanpoRemoteGuard = Object.freeze({
        isBusy,
        isModalOpen: isCollaborativeEditModalOpen,
        isEditableControlFocused,
        markLocalEditing,
        requestPendingApply,
        shouldApply: data => !!data && typeof data === 'object' && !isBusy()
    });
})(window);
