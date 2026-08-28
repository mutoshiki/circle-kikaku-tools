// View tabs, modal commands, and form controls.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;
    const bindModalSubmit = events.bindModalSubmit;

    function persistMainView(view) {
        if (!['list', 'seisan'].includes(view)) return;
        const url = new URL(global.location.href);
        if (view === 'list') url.searchParams.delete('view');
        else url.searchParams.set('view', view);
        url.searchParams.delete('allocation');
        global.history.replaceState(global.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function switchViewRemembering(view) {
        await switchView(view);
        if (typeof currentView === 'undefined' || currentView !== view) return false;
        persistMainView(view);
        return true;
    }

    function setupSettlementOptionEvents() {
        const selectedRadioValue = group => {
            const selected = group?.querySelector('cds-radio-button[checked]');
            return group?.value || selected?.getAttribute('value') || group?.getAttribute('value') || '';
        };
        const eventRadioValue = (event, group) => event.detail?.value || event.detail?.item?.value || selectedRadioValue(group) || event.target?.value || event.target?.getAttribute?.('value') || '';
        ['seisanRounding', 'seisanOrganizerName', 'seisanOrganizerFree', 'seisanDriverCollectionOffset', 'seisanDriverCollectionFree'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => global.onSettlementInput?.());
            }
        });

        const driverCollectionRule = byId('seisanDriverCollectionRule');
        if (driverCollectionRule && driverCollectionRule.dataset.eventOwnerBound !== 'true') {
            driverCollectionRule.dataset.eventOwnerBound = 'true';
            const commitDriverCollectionRule = value => {
                const next = ['normal', 'offset', 'free'].includes(value) ? value : 'offset';
                const offset = byId('seisanDriverCollectionOffset');
                const free = byId('seisanDriverCollectionFree');
                if (offset) offset.checked = next === 'offset';
                if (free) free.checked = next === 'free';
                driverCollectionRule.value = next;
                syncSettlementStateFromDOM?.();
                global.onSettlementInput?.();
            };
            driverCollectionRule.addEventListener('change', event => commitDriverCollectionRule(eventRadioValue(event, driverCollectionRule)));
            driverCollectionRule.addEventListener('cds-radio-button-group-changed', event => commitDriverCollectionRule(eventRadioValue(event, driverCollectionRule)));
        }

        const organizerRule = byId('seisanOrganizerRule');
        if (organizerRule && organizerRule.dataset.eventOwnerBound !== 'true') {
            organizerRule.dataset.eventOwnerBound = 'true';
            const commitOrganizerRule = value => {
                const next = value === 'collect' ? 'collect' : 'free';
                const organizerFree = byId('seisanOrganizerFree');
                if (organizerFree) organizerFree.checked = next === 'free';
                organizerRule.value = next;
                syncSettlementStateFromDOM?.();
                validateOrganizerSettlementSettings?.(false);
                global.onSettlementInput?.();
            };
            organizerRule.addEventListener('change', event => commitOrganizerRule(eventRadioValue(event, organizerRule)));
            organizerRule.addEventListener('cds-radio-button-group-changed', event => commitOrganizerRule(eventRadioValue(event, organizerRule)));
        }

        const rewardType = byId('seisanDriverRewardType');
        if (rewardType && rewardType.dataset.eventOwnerBound !== 'true') {
            rewardType.dataset.eventOwnerBound = 'true';
            const commitRewardType = value => {
                const next = value === 'club' ? 'club' : 'split';
                rewardType.value = next;
                const state = ensureSettlementState();
                state.driverRewardType = next;
                global.onSettlementInput?.();
            };
            rewardType.addEventListener('change', event => commitRewardType(eventRadioValue(event, rewardType)));
            rewardType.addEventListener('cds-radio-button-group-changed', event => commitRewardType(eventRadioValue(event, rewardType)));
        }

        const roundingOptions = byId('seisanRoundingOptions');
        if (roundingOptions && roundingOptions.dataset.eventOwnerBound !== 'true') {
            roundingOptions.dataset.eventOwnerBound = 'true';
            roundingOptions.addEventListener('cds-radio-button-group-changed', event => {
                const rounding = byId('seisanRounding');
                if (!rounding) return;
                rounding.value = eventRadioValue(event, roundingOptions) || '100';
                global.onSettlementInput?.();
            });
            roundingOptions.addEventListener('change', () => {
                const rounding = byId('seisanRounding');
                if (!rounding) return;
                rounding.value = selectedRadioValue(roundingOptions) || '100';
                global.onSettlementInput?.();
            });
        }

        const settlementMode = byId('seisanSettlementMode');
        if (settlementMode && settlementMode.dataset.eventOwnerBound !== 'true') {
            settlementMode.dataset.eventOwnerBound = 'true';
            settlementMode.addEventListener('cds-radio-button-group-changed', event => {
                const standalone = byId('seisanStandaloneEnabled');
                if (!standalone) return;
                standalone.checked = eventRadioValue(event, settlementMode) === 'standalone';
                syncSettlementStateFromDOM?.();
                syncSettlementControls?.(ensureSettlementState(), getParticipantList(getRoomDataOnly()));
                validateStandaloneSettlementSettings?.(false);
            });
            settlementMode.addEventListener('change', event => {
                const standalone = byId('seisanStandaloneEnabled');
                if (!standalone) return;
                standalone.checked = eventRadioValue(event, settlementMode) === 'standalone';
                syncSettlementStateFromDOM?.();
                syncSettlementControls?.(ensureSettlementState(), getParticipantList(getRoomDataOnly()));
                validateStandaloneSettlementSettings?.(false);
            });
        }

        const reward = byId('seisanDriverReward');
        if (reward && reward.dataset.eventOwnerBound !== 'true') {
            reward.dataset.eventOwnerBound = 'true';
            reward.addEventListener('input', () => global.onSettlementInputDelayed?.());
            reward.addEventListener('change', () => global.onSettlementInput?.());
        }


        const memo = byId('seisanMemoInput');
        if (memo && memo.dataset.eventOwnerBound !== 'true') {
            memo.dataset.eventOwnerBound = 'true';
            memo.addEventListener('input', () => global.onSettlementInputDelayed?.());
            memo.addEventListener('change', () => global.onSettlementInput?.());
        }
    }

    function setupViewAndFeatureEvents() {
        bind('tab-seisan', () => switchViewRemembering('seisan'));
        bind('batchOpenBtn', () => openBatchModal());
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bindModalSubmit('executeBatchBtn', () => executeBatch());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());
        setupSettlementOptionEvents();
    }

    global.SanpoEvents = Object.freeze({ ...events, setupViewAndFeatureEvents });
})(window);
