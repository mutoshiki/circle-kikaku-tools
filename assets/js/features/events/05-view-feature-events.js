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
