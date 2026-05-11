// Settlement typing/change events. Kept separate so keyboard-focus protection is easy to audit.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};

    function setupSettlementInputEvents() {
        if (document.documentElement.dataset.settlementInputEventsBound === 'true') return;
        document.documentElement.dataset.settlementInputEventsBound = 'true';

        document.addEventListener('focusin', event => {
            if (isSettlementCostField(event.target)) {
                protectSettlementEditing();
            }
        });

        document.addEventListener('compositionstart', event => {
            if (isSettlementCostField(event.target)) {
                settlementCompositionActive = true;
                protectSettlementEditing();
            }
        });

        document.addEventListener('compositionend', event => {
            if (isSettlementCostField(event.target)) {
                settlementCompositionActive = false;
                global.onSettlementInputDelayed?.();
                releaseSettlementEditingSoon(320);
            }
        });

        document.addEventListener('input', event => {
            const target = event.target;
            if (target?.matches?.('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]')) {
                global.onSettlementInputDelayed?.();
                return;
            }
            if (target?.matches?.('#routeStopList .route-stop-input')) {
                global.onRouteStopsChangedDelayed?.();
            }
        });

        document.addEventListener('focusout', event => {
            const target = event.target;
            if (isSettlementCostField(target)) {
                releaseSettlementEditingSoon(320);
                global.onSettlementInput?.();
            }
        });

        document.addEventListener('change', event => {
            const target = event.target;
            if (!target?.matches) return;

            if (target.matches('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]')) {
                global.onSettlementInput?.();
                return;
            }

            if (target.matches('[data-settlement-paid-name]')) {
                global.toggleSettlementPaid?.(target.dataset.settlementPaidName || '', target.checked);
                return;
            }

            if (target.matches('[data-settlement-driver-paid-name]')) {
                global.toggleSettlementDriverPaid?.(target.dataset.settlementDriverPaidName || '', target.checked);
                return;
            }

            if (target.matches('#routeStopList .route-stop-input')) {
                global.onRouteStopsChanged?.();
            }
        });
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupSettlementInputEvents
    });
})(window);
