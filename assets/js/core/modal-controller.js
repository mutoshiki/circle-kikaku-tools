// Official Carbon modal adapter. Business owners keep show()/hide() only.
(function (global) {
    'use strict';

    const instances = new WeakMap();
    let keyboardInteraction = false;

    function setKeyboardInteraction(next) {
        keyboardInteraction = next === true;
        document.body?.classList.toggle('app-keyboard-navigation', keyboardInteraction);
    }

    document.addEventListener('keydown', event => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        setKeyboardInteraction(true);
    }, true);
    document.addEventListener('pointerdown', () => setKeyboardInteraction(false), true);
    document.addEventListener('touchstart', () => setKeyboardInteraction(false), { capture: true, passive: true });

    function deepestActiveElement(root) {
        let active = root?.activeElement || null;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active;
    }

    function clearPointerFocus(target) {
        if (keyboardInteraction) return;
        requestAnimationFrame(() => {
            const documentActive = deepestActiveElement(document);
            const targetActive = deepestActiveElement(target?.shadowRoot);
            targetActive?.blur?.();
            if (target && (documentActive === target || target.contains?.(documentActive) || target.shadowRoot?.contains?.(documentActive))) {
                documentActive?.blur?.();
            }
            target?.blur?.();
        });
    }

    global.SanpoFocusModality = Object.freeze({
        isKeyboard: () => keyboardInteraction,
        clearPointerFocus
    });

    document.addEventListener('cds-popover-closed', event => {
        const path = event.composedPath?.() || [];
        const trigger = path.find(node => node?.matches?.('cds-overflow-menu, cds-popover'));
        clearPointerFocus(trigger);
    }, true);


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


    function updateModalScrollAffordance(modal) {
        const body = modal?.querySelector?.(':scope > cds-modal-body.app-modal-body');
        if (!body) return;
        const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
        const scrollable = maxScroll > 2;
        const atBottom = !scrollable || body.scrollTop >= maxScroll - 2;
        body.toggleAttribute('data-scrollable', scrollable);
        body.toggleAttribute('data-scroll-more', scrollable && !atBottom);
    }

    function bindModalScrollAffordance(modal) {
        const body = modal?.querySelector?.(':scope > cds-modal-body.app-modal-body');
        if (!body || body.dataset.scrollAffordanceBound === 'true') return;
        body.dataset.scrollAffordanceBound = 'true';
        const update = () => updateModalScrollAffordance(modal);
        body.addEventListener('scroll', update, { passive: true });
        if (global.ResizeObserver) {
            const observer = new ResizeObserver(update);
            observer.observe(body);
            Array.from(body.children).forEach(child => observer.observe(child));
        }
        modal.addEventListener('sanpo:modal-shown', () => {
            requestAnimationFrame(() => requestAnimationFrame(update));
            setTimeout(update, 180);
        });
        update();
    }

    function resolveModalInitialFocus(modal) {
        if (!modal) return null;
        const explicit = modal.querySelector('[data-modal-primary-focus]');
        if (explicit && !explicit.disabled && explicit.getAttribute('aria-hidden') !== 'true') return explicit;
        const heading = modal.querySelector('cds-modal-heading, [data-modal-heading]');
        if (heading) {
            heading.tabIndex = -1;
            return heading;
        }
        const body = modal.querySelector('cds-modal-body');
        if (body) {
            body.tabIndex = -1;
            return body;
        }
        return modal;
    }

    function focusModalStart(modal) {
        const apply = () => {
            if (!modal?.open) return;
            const target = resolveModalInitialFocus(modal);
            target?.focus?.({ preventScroll: true });
        };
        Promise.resolve(modal?.updateComplete).then(() => {
            requestAnimationFrame(() => requestAnimationFrame(apply));
        });
    }

    class AppModalAdapter {
        constructor(element) {
            this.element = element;
            this.returnFocus = null;
            this.restoreFocusForKeyboard = false;
            this.closed = true;
            this.programmaticClose = false;
            this.element.hidden = !this.element.open;
            bindModalScrollAffordance(this.element);
            this.element.querySelectorAll('[data-modal-close]').forEach(control => {
                control.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.hide({ reason: 'dismiss' });
                });
            });
            this.element.addEventListener('cds-modal-beingclosed', event => {
                if (this.programmaticClose) return;
                const before = new CustomEvent('sanpo:modal-hiding', { bubbles: false, cancelable: true });
                if (!this.element.dispatchEvent(before)) event.preventDefault();
            });
            this.element.addEventListener('cds-modal-closed', () => this.finishClose());
        }

        isOpen() {
            return !!(this.element && (this.element.open || this.element.hasAttribute('open')));
        }

        show() {
            if (!this.element || this.isOpen()) return;
            global.dismissPlanningCoach?.();
            this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.restoreFocusForKeyboard = keyboardInteraction;
            this.closed = false;
            this.element.hidden = false;
            this.element.open = true;
            syncModalPageState(true);
            requestAnimationFrame(() => syncModalPageState());
            removeUnnamedModalBodyStop(this.element);
            focusModalStart(this.element);
            this.element.dispatchEvent(new CustomEvent('sanpo:modal-shown'));
            updateModalScrollAffordance(this.element);
        }

        hide(options = {}) {
            if (!this.element || !this.isOpen()) return;
            const reason = String(options.reason || 'programmatic');
            const before = new CustomEvent('sanpo:modal-hiding', {
                cancelable: true,
                detail: { reason }
            });
            if (!this.element.dispatchEvent(before)) return;
            this.programmaticClose = true;
            this.element.open = false;
            this.element.removeAttribute('open');
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
            const restoreForKeyboard = this.restoreFocusForKeyboard;
            this.returnFocus = null;
            this.restoreFocusForKeyboard = false;
            if (target?.isConnected && restoreForKeyboard) requestAnimationFrame(() => target.focus({ preventScroll: true }));
            else clearPointerFocus(target);

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
            carEditModal.addEventListener('sanpo:modal-hiding', event => {
                const validateAndSave = global.validateAndSaveSettlementCarEditBeforeClose;
                if (typeof validateAndSave === 'function') {
                    if (!validateAndSave()) event.preventDefault();
                    return;
                }
                global.saveSettlementCarEditDraft?.();
            });
            carEditModal.addEventListener('sanpo:modal-hidden', () => {
                if (!global.shouldPreserveSettlementCarEditorOnHidden?.()) global.clearSettlementCarEditor?.();
            });
        }
        const settingsModal = document.getElementById('settlementSettingsModal');
        if (settingsModal && settingsModal.dataset.settlementModalBound !== 'true') {
            settingsModal.dataset.settlementModalBound = 'true';
            settingsModal.addEventListener('sanpo:modal-hiding', event => {
                const validateAndSave = global.validateAndSaveSettlementSettingsBeforeClose;
                if (typeof validateAndSave === 'function') {
                    if (!validateAndSave(event.detail?.reason || 'dismiss')) event.preventDefault();
                    return;
                }
                if (event.detail?.reason !== 'submit') global.saveSettlementSettingsDraft?.();
            });
            settingsModal.addEventListener('sanpo:modal-hidden', () => global.clearSettlementSettingsEditor?.());
        }
        applyRuntimeAccessibilityFixes();
    }

    global.AppModalAdapter = AppModalAdapter;
    global.initializeAppModals = initializeAppModals;
})(window);
