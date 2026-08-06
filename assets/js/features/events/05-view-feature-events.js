// View tabs, modal commands, and form controls.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;
    const bindModalSubmit = events.bindModalSubmit;

    function setupSettlementOptionEvents() {
        ['seisanRounding', 'seisanOrganizerName', 'seisanOrganizerFree', 'seisanDriverCollectionOffset'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => global.onSettlementInput?.());
            }
        });

        const rewardType = byId('seisanDriverRewardType');
        if (rewardType && rewardType.dataset.eventOwnerBound !== 'true') {
            rewardType.dataset.eventOwnerBound = 'true';
            rewardType.addEventListener('change', () => {
                const state = ensureSettlementState();
                state.driverRewardType = rewardType.value === 'club' ? 'club' : 'split';
                global.onSettlementInput?.();
            });
        }

        const reward = byId('seisanDriverReward');
        if (reward && reward.dataset.eventOwnerBound !== 'true') {
            reward.dataset.eventOwnerBound = 'true';
            reward.addEventListener('input', () => global.onSettlementInputDelayed?.());
            reward.addEventListener('change', () => global.onSettlementInput?.());
        }
    }

    function setupAutoAssignOptionEvents() {
        ['optFemale', 'optMale', 'optGrade'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => updateAutoAssignSummary());
            }
        });
    }

    function setupViewAndFeatureEvents() {
        bind('tab-list', () => switchView('list'));
        bind('tab-sheet', () => switchView('sheet'));
        bind('tab-seisan', () => switchView('seisan'));
        bind('batchOpenBtn', () => openBatchModal());
        bind('sheet-quick-edit-btn', () => toggleQuickEdit());
        bind('sheet-fit-view-btn', () => global.resetSheetViewport?.({ fitAll: true }));
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('clearAllBtn', () => global.clearAll());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bindModalSubmit('executeBatchBtn', () => executeBatch());
        bindModalSubmit('saveSettlementSettingsBtn', () => global.saveSettlementSettings?.());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());


        const registrationMode = byId('batchRegistrationMode');
        if (registrationMode && registrationMode.dataset.eventOwnerBound !== 'true') {
            registrationMode.dataset.eventOwnerBound = 'true';
            const commitMode = value => global.setBatchRegistrationMode?.(value, { focus: true });
            registrationMode.addEventListener('change', () => commitMode(registrationMode.value));
            registrationMode.addEventListener('cds-content-switcher-selected', event => {
                const item = event.detail?.item;
                if (item && registrationMode.contains(item)) commitMode(item.value);
            });
        }

        setupSettlementOptionEvents();
        setupAutoAssignOptionEvents();
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupViewAndFeatureEvents
    });
})(window);
