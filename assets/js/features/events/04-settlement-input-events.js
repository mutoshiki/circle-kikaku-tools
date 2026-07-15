// Settlement typing/change events. Kept separate so keyboard-focus protection is easy to audit.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};


    function isTimesRentalInput(row) {
        const rentalField = row?.querySelector?.('[data-field="rentalType"]');
        if (!rentalField) return false;
        return rentalField.type === 'checkbox' ? rentalField.checked : rentalField.value === 'times';
    }

    function updateTimesDistanceFeeInRow(row) {
        if (!row || !isTimesRentalInput(row) || typeof getTimesDistanceFee !== 'function') return;
        const dist = row.querySelector('[data-field="dist"]')?.value || '';
        const amount = String(getTimesDistanceFee(dist));
        const distanceRow = row.querySelector('.seisan-extra-row[data-times-extra="distance"]') || Array.from(row.querySelectorAll('.seisan-extra-row')).find(extraRow => {
            const name = extraRow.querySelector('[data-extra-field="name"]')?.value || '';
            return String(name).replace(/\s+/g, '').replace(/[（）()]/g, '') === 'タイムズ移動料金';
        });
        const amountInput = distanceRow?.querySelector?.('[data-extra-field="amount"]');
        if (amountInput && amountInput.value !== amount) amountInput.value = amount;
    }

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
            if (target?.matches?.('.seisan-car-row [data-field], .seisan-car-row [data-extra-field]')) {
                if (target.matches('[data-field="dist"]')) updateTimesDistanceFeeInRow(target.closest('.seisan-car-row'));
                global.onSettlementInputDelayed?.();
                return;
            }
            if (target?.matches?.('#seisanStandaloneDriverCount, #seisanStandaloneMemberCount')) {
                syncSettlementStateFromDOM?.();
                validateStandaloneSettlementSettings?.(true);
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

            if (target.matches('.seisan-car-row [data-field="rentalType"]')) {
                syncSettlementStateFromDOM?.();
                const row = target.closest('.seisan-car-row');
                const name = row?.dataset?.driverName || '';
                if (name && typeof refreshSettlementCarEditor === 'function') refreshSettlementCarEditor(name);
                renderSettlementView?.({ force: true });
                save?.();
                return;
            }

            if (target.matches('.seisan-car-row [data-field], .seisan-car-row [data-extra-field]')) {
                if (target.matches('[data-extra-field="type"]')) {
                    const type = typeof normalizeSettlementExtraType === 'function'
                        ? normalizeSettlementExtraType(target.value)
                        : target.value;
                    target.classList.remove('split', 'club', 'split-minus', 'club-minus');
                    target.classList.add(type.startsWith('club') ? 'club' : 'split', type);
                }
                global.onSettlementInput?.();
                return;
            }

            if (target.matches('#seisanStandaloneEnabled, #seisanStandaloneDriverCount, #seisanStandaloneMemberCount')) {
                syncSettlementStateFromDOM?.();
                syncSettlementControls?.(ensureSettlementState(), getParticipantList(getRoomDataOnly()));
                validateStandaloneSettlementSettings?.(true);
                return;
            }

            if (target.matches('#seisanOrganizerFree')) {
                syncSettlementStateFromDOM?.();
                syncSettlementControls?.(ensureSettlementState(), getParticipantList(getRoomDataOnly()));
                return;
            }

            if (target.matches('#seisanDriverCollectionOffset, #seisanDriverCollectionFree')) {
                const otherId = target.id === 'seisanDriverCollectionOffset'
                    ? 'seisanDriverCollectionFree'
                    : 'seisanDriverCollectionOffset';
                const other = document.getElementById(otherId);
                if (target.checked && other) other.checked = false;
                syncSettlementStateFromDOM?.();
                return;
            }

            if (target.matches('[data-settlement-paid-name]')) {
                global.toggleSettlementPaid?.(target.dataset.settlementPaidName || '', target.checked, target);
                return;
            }

            if (target.matches('[data-settlement-driver-paid-name]')) {
                global.toggleSettlementDriverPaid?.(target.dataset.settlementDriverPaidName || '', target.checked, target);
                return;
            }

            if (target.matches('#routeStopList .route-stop-input')) {
                global.onRouteStopsChanged?.();
            }
        });

        document.addEventListener('click', event => {
            const option = event.target.closest?.('[data-rounding-value]');
            if (!option) return;
            const rounding = document.getElementById('seisanRounding');
            if (!rounding) return;
            rounding.value = option.dataset.roundingValue || '100';
            syncSettlementStateFromDOM?.();
            syncSettlementControls?.(ensureSettlementState(), getParticipantList(getRoomDataOnly()));
        });
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupSettlementInputEvents
    });
})(window);
