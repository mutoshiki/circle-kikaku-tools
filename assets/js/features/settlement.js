// Settlement feature facade.
// Concrete owners are split under assets/js/features/settlement/:
// 01-state.js, 02-calculator.js, 03-render.js, 04-route-helper.js,
// 05-input-actions.js, 06-share-text.js.
// Rendering still uses window.SanpoApp.templates.settlement.

(function registerSettlementFeature(global) {
    const settlementApi = {
        getDefaultSettlementState,
        normalizeExtraItem,
        normalizeCarSettlementState,
        normalizeSettlementState,
        ensureSettlementState,
        getSettlementSnapshot,
        calculateSettlement,
        getSettlementIssues,
        syncSettlementControls,
        renderSettlementSummaryHtml,
        renderSettlementCarRowHtml,
        renderSettlementCarsHtml,
        renderSettlementCollectionHtml,
        renderSettlementDriverPayHtml,
        renderSettlementBreakdownHtml,
        renderSettlementView,
        openRouteDistanceHelper: global.openRouteDistanceHelper,
        copySettlementText: global.copySettlementText
    };
    global.SanpoApp = global.SanpoApp || {};
    global.SanpoApp.features = global.SanpoApp.features || {};
    global.SanpoApp.features.settlement = settlementApi;
})(window);
