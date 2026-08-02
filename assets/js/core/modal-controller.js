// Official Carbon modal adapter. Business owners keep show()/hide() only.
(function (global) {
    'use strict';

    const instances = new WeakMap();

    function syncModalPageState(forceOpen) {
        const hasOpenModal = typeof forceOpen === 'boolean'
            ? forceOpen
            : !!document.querySelector('.app-modal[open]');
        document.body.classList.toggle('app-modal-open', hasOpenModal);
    }

    function removeUnnamedModalBodyStop(modal) {
        requestAnimationFrame(() => {
            const body = modal?.shadowRoot?.querySelector('cds-modal-body, [part="body"]');
            if (!body) return;
            const hasName = body.getAttribute('aria-label') || body.getAttribute('aria-labelledby');
            if (!hasName && body.getAttribute('tabindex') === '0') body.setAttribute('tabindex', '-1');
        });
    }

    function prepareModalPrimaryFocus(modal) {
        if (!modal) return null;
        let sentinel = modal.querySelector(':scope > .modal-focus-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('span');
            sentinel.className = 'modal-focus-sentinel';
            sentinel.tabIndex = -1;
            sentinel.setAttribute('aria-hidden', 'true');
            modal.prepend(sentinel);
        }
        sentinel.setAttribute('data-modal-primary-focus', '');
        return sentinel;
    }

    function focusModalHeading(modal) {
        const apply = () => {
            if (!modal?.open) return;
            const sentinel = prepareModalPrimaryFocus(modal);
            sentinel?.focus?.({ preventScroll: true });
        };
        Promise.resolve(modal?.updateComplete).then(() => {
            requestAnimationFrame(() => requestAnimationFrame(apply));
        });
    }

    class AppModalAdapter {
        constructor(element) {
            this.element = element;
            this.returnFocus = null;
            this.closed = true;
            this.programmaticClose = false;
            this.element.hidden = !this.element.open;
            this.element.querySelectorAll('[data-modal-close]').forEach(control => {
                control.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.hide();
                });
            });
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
            prepareModalPrimaryFocus(this.element);
            this.element.hidden = false;
            this.element.open = true;
            syncModalPageState(true);
            requestAnimationFrame(() => syncModalPageState());
            removeUnnamedModalBodyStop(this.element);
            focusModalHeading(this.element);
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
            this.element.hidden = true;
            syncModalPageState();
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
