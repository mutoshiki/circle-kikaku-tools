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
            const commitRewardType = value => {
                const next = value === 'club' ? 'club' : 'split';
                rewardType.value = next;
                rewardType.querySelectorAll('cds-content-switcher-item').forEach(item => {
                    item.selected = item.value === next;
                });
                const state = ensureSettlementState();
                state.driverRewardType = next;
                global.onSettlementInput?.();
            };
            rewardType.addEventListener('change', () => commitRewardType(rewardType.value));
            rewardType.addEventListener('cds-content-switcher-selected', event => {
                const item = event.detail?.item;
                if (!item || !rewardType.contains(item)) return;
                commitRewardType(item.value);
            });
        }

        const reward = byId('seisanDriverReward');
        if (reward && reward.dataset.eventOwnerBound !== 'true') {
            reward.dataset.eventOwnerBound = 'true';
            reward.addEventListener('input', () => global.onSettlementInputDelayed?.());
            reward.addEventListener('change', () => global.onSettlementInput?.());
        }
    }

    async function openAllocationDestination(templateType) {
        if (!(await switchViewRemembering('list'))) return;
        const next = templateType === 'team' ? 'team' : 'car';
        if (typeof updateActiveCarPlanTemplate === 'function') updateActiveCarPlanTemplate(next);
        else if (typeof switchCarPlan === 'function') switchCarPlan(next);
        global.SanpoAssignmentWorkspace?.refresh?.();
        global.syncCarbonPrimaryNavigationState?.();
    }

    function setupCarbonAllocationTabSelection() {
        const tabs = byId('view-toggle-bar');
        if (!tabs || tabs.dataset.allocationSelectionBound === 'true') return;
        tabs.dataset.allocationSelectionBound = 'true';
        // Carbon Tabs dispatches this composed selection event from its lifecycle.
        // Safari/WebKit may commit it before a shadow-host click reaches a listener,
        // so using it keeps the first real tap on 車割/班割 reliable on every engine.
        tabs.addEventListener('cds-tabs-selected', event => {
            const item = event.detail?.item;
            const templateType = item?.id === 'tab-team' ? 'team' : (item?.id === 'tab-list' ? 'car' : '');
            if (!templateType) return;
            queueMicrotask(() => {
                const current = document.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
                if (current !== templateType) void openAllocationDestination(templateType);
            });
        });
    }

    function setupViewAndFeatureEvents() {
        setupCarbonAllocationTabSelection();
        bind('tab-seisan', () => switchViewRemembering('seisan'));
        bind('tab-list', () => openAllocationDestination('car'));
        bind('tab-team', () => openAllocationDestination('team'));
        bind('batchOpenBtn', () => openBatchModal());
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bindModalSubmit('executeBatchBtn', () => executeBatch());
        bindModalSubmit('saveSettlementSettingsBtn', () => global.saveSettlementSettings?.());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());
        setupSettlementOptionEvents();
    }

    global.SanpoEvents = Object.freeze({ ...events, setupViewAndFeatureEvents });
})(window);
