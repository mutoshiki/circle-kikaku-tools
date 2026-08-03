// Main app startup after S-4 cleanup.
// Persistence, render, settlement edit guard, and history scheduling live in assets/js/core/.

D.addEventListener('DOMContentLoaded', async () => {
    initializeAppModals();
    setupPlanningAssurance?.();

    // Event bindings are owned by assets/js/features/events.js after A cleanup.

    loadTrustedEditPassphrase();
    setupSortable($('#waiting-list'));
    // Person menus are delegated, so bind them before Firebase/network startup.
    // This keeps member menu buttons responsive even if remote sync is slow or blocked.
    setupCompactPersonMenu();
    ensureCompactMenuFallback();
    setupSeatMemberPicker();

    // Paint the local/default state before any Firebase import or authentication wait.
    // Carbon's content switcher also manages target[hidden], so normalize the selected
    // panel explicitly during boot instead of waiting for the first tab interaction.
    load();
    await switchView(currentView);

    const remoteReady = await initFirebaseSync();
    if (remoteReady) load();

    refreshRoomTitle();
    updateEditLockButton();
    setupManualCardDrag();
    setupManualSheetDrag();

    if (firebaseEnabled && db && firebaseReady) {
        onValue(ref(db, ".info/connected"), (snap) => {
            if (snap.val() === true) {
                updateStatus('connected', '共有同期中');
            } else {
                updateStatus('error', '同期切断中');
            }
        });
    }

    startHistoryAutosave();
});
