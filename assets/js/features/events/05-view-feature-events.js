// View tabs, modal commands, and form controls.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;

    function setupSettlementOptionEvents() {
        ['seisanRounding', 'seisanOrganizerName', 'seisanOrganizerFree', 'seisanDriverCollectionOffset'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => global.onSettlementInput?.());
            }
        });

        const reward = byId('seisanDriverReward');
        if (reward && reward.dataset.eventOwnerBound !== 'true') {
            reward.dataset.eventOwnerBound = 'true';
            reward.addEventListener('input', () => global.onSettlementInputDelayed?.());
            reward.addEventListener('change', () => global.onSettlementInput?.());
        }
    }

    function setupAutoAssignOptionEvents() {
        const ids = ['optFemale', 'optMale', 'optGrade'];
        ids.forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => updateAutoAssignSummary());
            }
        });
        const overflow = document.querySelector('.tray-settings-dropdown cds-overflow-menu');
        if (overflow && overflow.dataset.outsideCloseBound !== 'true') {
            overflow.dataset.outsideCloseBound = 'true';
            document.addEventListener('pointerdown', event => {
                if (!(overflow.open || overflow.hasAttribute('open'))) return;
                if (event.composedPath().includes(overflow)) return;
                overflow.open = false;
            });
        }
        if (document.documentElement.dataset.autoAssignTabBound !== 'true') {
            document.documentElement.dataset.autoAssignTabBound = 'true';
            global.addEventListener('keydown', event => {
                const host = event.composedPath().find(node => node instanceof HTMLElement && ids.includes(node.id));
                if (event.key === ' ' && host) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    host.checked = !host.checked;
                    host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    Promise.resolve(host.updateComplete).then(() => {
                        host.shadowRoot?.querySelector('input')?.focus({ preventScroll: true });
                    });
                    return;
                }
                if (event.key !== 'Tab') return;
                const index = host ? ids.indexOf(host.id) : -1;
                const nextIndex = index + (event.shiftKey ? -1 : 1);
                const next = byId(ids[nextIndex])?.shadowRoot?.querySelector('input');
                if (index < 0 || !next) return;
                event.preventDefault();
                event.stopPropagation();
                queueMicrotask(() => next.focus());
            }, true);
        }
    }

    function setupViewAndFeatureEvents() {
        bind('tab-list', () => switchView('list'));
        bind('tab-sheet', () => switchView('sheet'));
        bind('tab-seisan', () => switchView('seisan'));
        bind('batchOpenBtn', () => openBatchModal());
        bind('sheet-quick-edit-btn', () => toggleQuickEdit());
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('clearAllBtn', () => global.clearAll());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bind('executeBatchBtn', () => executeBatch());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());

        setupSettlementOptionEvents();
        setupAutoAssignOptionEvents();
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupViewAndFeatureEvents
    });
})(window);
