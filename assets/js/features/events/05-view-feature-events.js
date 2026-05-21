// View tabs, guide navigation, modal commands, and form controls.
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

    function setupGuideStepEvents() {
        document.querySelectorAll('.guide-step-btn[data-guide][data-step]').forEach(btn => {
            if (btn.dataset.eventOwnerBound === 'true') return;
            btn.dataset.eventOwnerBound = 'true';
            btn.addEventListener('click', event => {
                event.preventDefault();
                showGuideStep(btn.dataset.guide, Number(btn.dataset.step || 0));
            });
        });

        [
            ['globalGuidePrevBtn', 'global', -1],
            ['globalGuideNextBtn', 'global', 1],
            ['carGuidePrevBtn', 'car', -1],
            ['carGuideNextBtn', 'car', 1],
            ['seisanGuidePrevBtn', 'seisan', -1],
            ['seisanGuideNextBtn', 'seisan', 1],
        ].forEach(([id, guide, dir]) => bind(id, () => guideNavStep(guide, dir)));
    }

    function setupViewAndFeatureEvents() {
        bind('tab-list', () => switchView('list'));
        bind('tab-sheet', () => switchView('sheet'));
        bind('tab-seisan', () => switchView('seisan'));
        bind('carGuideBtn', () => global.modals?.guide?.show());
        bind('batchOpenBtn', () => openBatchModal());
        bind('sheetZoomInBtn', () => zoomIn());
        bind('sheetZoomOutBtn', () => zoomOut());
        bind('sheetZoomResetBtn', () => resetZoom());
        bind('sheet-quick-edit-btn', () => toggleQuickEdit());
        bind('seisanGuideBtn', () => global.modals?.seisanGuide?.show());
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('routeHelperBtn', () => openRouteDistanceHelper());
        bind('clearAllBtn', () => global.clearAll());
        bind('resetAppearanceBtn', () => resetAppearanceSettings());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bind('executeBatchBtn', () => executeBatch());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());

        setupSettlementOptionEvents();
        setupAutoAssignOptionEvents();
        setupGuideStepEvents();
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupViewAndFeatureEvents
    });
})(window);
