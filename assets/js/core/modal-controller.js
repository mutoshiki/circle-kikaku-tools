// Bootstrap modal controller.
// Owns modal instance creation so app.js remains a lifecycle bootstrap instead of a DOM wiring file.
function initializeAppModals() {
    modals.edit = new bootstrap.Modal($('#commonEditModal'));
    modals.batch = new bootstrap.Modal($('#batchImportModal'));
    modals.userGuide = new bootstrap.Modal($('#userGuideModal'));
    modals.routeDistance = new bootstrap.Modal($('#routeDistanceModal'));
    modals.settlementSettings = new bootstrap.Modal($('#settlementSettingsModal'));
    modals.settlementCarEdit = new bootstrap.Modal($('#settlementCarEditModal'));
    modals.history = new bootstrap.Modal($('#historyModal'));
    modals.seatMember = new bootstrap.Modal($('#seatMemberPickerModal'));
    window.modals = modals;
    const carEditModal = $('#settlementCarEditModal');
    if (carEditModal && carEditModal.dataset.settlementModalBound !== 'true') {
        carEditModal.dataset.settlementModalBound = 'true';
        carEditModal.addEventListener('hide.bs.modal', () => window.saveSettlementCarEditDraft?.());
        carEditModal.addEventListener('hidden.bs.modal', () => window.clearSettlementCarEditor?.());
    }
    const settingsModal = $('#settlementSettingsModal');
    if (settingsModal && settingsModal.dataset.settlementModalBound !== 'true') {
        settingsModal.dataset.settlementModalBound = 'true';
        settingsModal.addEventListener('hide.bs.modal', () => window.saveSettlementSettingsDraft?.());
    }
    applyRuntimeAccessibilityFixes();
}
