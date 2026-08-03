// Official Carbon modal adapter. Business owners keep show()/hide() only.
(function (global) {
    'use strict';

    const instances = new WeakMap();

    class AppModalAdapter {
        constructor(element) {
            this.element = element;
            this.returnFocus = null;
            this.closed = true;
            this.programmaticClose = false;
            this.element.addEventListener('cds-modal-beingclosed', event => {
                if (this.programmaticClose) return;
                const before = new CustomEvent('sanpo:modal-hiding', { bubbles: false, cancelable: true });
                if (!this.element.dispatchEvent(before)) event.preventDefault();
            });
            this.element.addEventListener('cds-modal-closed', () => this.finishClose());
        }

        show() {
            if (!this.element || this.element.open) return;
            this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.closed = false;
            this.element.open = true;
            this.element.dispatchEvent(new CustomEvent('sanpo:modal-shown'));
        }

        hide() {
            if (!this.element || !this.element.open) return;
            const before = new CustomEvent('sanpo:modal-hiding', { cancelable: true });
            if (!this.element.dispatchEvent(before)) return;
            this.programmaticClose = true;
            this.element.open = false;
            queueMicrotask(() => this.finishClose());
        }

        finishClose() {
            if (this.closed) return;
            this.closed = true;
            this.programmaticClose = false;
            this.element.open = false;
            this.element.dispatchEvent(new CustomEvent('sanpo:modal-hidden'));
            const target = this.returnFocus;
            this.returnFocus = null;
            if (target?.isConnected) requestAnimationFrame(() => target.focus({ preventScroll: true }));
        }

        static getOrCreateInstance(element) {
            if (!element) return null;
            if (!instances.has(element)) instances.set(element, new AppModalAdapter(element));
            return instances.get(element);
        }

        static getInstance(element) {
            return element ? instances.get(element) || null : null;
        }
    }

    function initializeAppModals() {
        const attach = id => AppModalAdapter.getOrCreateInstance(document.getElementById(id));
        modals.edit = attach('commonEditModal');
        modals.batch = attach('batchImportModal');
        modals.userGuide = attach('userGuideModal');
        modals.routeDistance = attach('routeDistanceModal');
        modals.settlementSettings = attach('settlementSettingsModal');
        modals.settlementCarEdit = attach('settlementCarEditModal');
        modals.history = attach('historyModal');
        modals.seatMember = attach('seatMemberPickerModal');
        modals.debug = attach('debugModal');
        modals.planningCheck = attach('planningCheckModal');
        global.modals = modals;

        const carEditModal = document.getElementById('settlementCarEditModal');
        if (carEditModal && carEditModal.dataset.settlementModalBound !== 'true') {
            carEditModal.dataset.settlementModalBound = 'true';
            carEditModal.addEventListener('sanpo:modal-hiding', () => global.saveSettlementCarEditDraft?.());
            carEditModal.addEventListener('sanpo:modal-hidden', () => global.clearSettlementCarEditor?.());
        }
        const settingsModal = document.getElementById('settlementSettingsModal');
        if (settingsModal && settingsModal.dataset.settlementModalBound !== 'true') {
            settingsModal.dataset.settlementModalBound = 'true';
            settingsModal.addEventListener('sanpo:modal-hiding', () => global.saveSettlementSettingsDraft?.());
        }
        applyRuntimeAccessibilityFixes();
    }

    global.AppModalAdapter = AppModalAdapter;
    global.initializeAppModals = initializeAppModals;
})(window);
