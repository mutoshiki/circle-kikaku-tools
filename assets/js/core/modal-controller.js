// Bootstrap modal controller.
// Owns modal instance creation so app.js remains a lifecycle bootstrap instead of a DOM wiring file.
function initializeAppModals() {
    modals.edit = new bootstrap.Modal($('#commonEditModal'));
    modals.batch = new bootstrap.Modal($('#batchImportModal'));
    modals.globalGuide = new bootstrap.Modal($('#globalGuideModal'));
    modals.appearance = new bootstrap.Modal($('#appearanceModal'));
    modals.guide = new bootstrap.Modal($('#guideModal'));
    modals.seisanGuide = new bootstrap.Modal($('#seisanGuideModal'));
    modals.routeDistance = new bootstrap.Modal($('#routeDistanceModal'));
    modals.history = new bootstrap.Modal($('#historyModal'));
    window.modals = modals;
    applyRuntimeAccessibilityFixes();
}
