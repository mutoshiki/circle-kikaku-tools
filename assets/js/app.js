// Main app bootstrap after S-4 cleanup.
// Persistence, render, settlement edit guard, and history scheduling live in assets/js/core/.

D.addEventListener('DOMContentLoaded', async () => {
    initializeAppModals();

    // Event bindings are owned by assets/js/features/events.js after A cleanup.

    loadTrustedEditPassphrase();
    setupSortable($('#waiting-list'));
    // Person menus are delegated, so bind them before Firebase/network startup.
    // This keeps member menu buttons responsive even if remote sync is slow or blocked.
    setupCompactPersonMenu();
    ensureCompactMenuFallback();
    setupSeatMemberPicker();
    await initFirebaseSync();
    load();
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
