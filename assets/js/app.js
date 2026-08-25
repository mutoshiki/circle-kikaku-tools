// Main app startup after S-4 cleanup.
// Persistence, render, settlement edit guard, and history scheduling live in assets/js/core/.

function loadAssignmentWorkspaceFeature() {
    if (window.SanpoAssignmentWorkspace) return Promise.resolve(window.SanpoAssignmentWorkspace);
    if (window.__assignmentWorkspaceFeaturePromise) return window.__assignmentWorkspaceFeaturePromise;

    window.__assignmentWorkspaceFeaturePromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-assignment-workspace-feature]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.SanpoAssignmentWorkspace), { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = './assets/js/features/assignment-workspace.js?v=assignment-workspace-v3';
        script.async = true;
        script.dataset.assignmentWorkspaceFeature = 'true';
        script.addEventListener('load', () => resolve(window.SanpoAssignmentWorkspace), { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });
    return window.__assignmentWorkspaceFeaturePromise;
}

function protectSharedAssignmentControls() {
    if (!window.SanpoAssignmentWorkspace?.isReadOnly?.()) return;

    const makeCapacityReadOnly = () => {
        document.querySelectorAll('.capacity-edit-pill').forEach(control => {
            control.setAttribute('aria-disabled', 'true');
            control.tabIndex = -1;
        });
    };
    makeCapacityReadOnly();

    const cars = document.getElementById('cars-container');
    if (cars && !window.__assignmentReadOnlyCapacityObserver) {
        const observer = new MutationObserver(makeCapacityReadOnly);
        observer.observe(cars, { childList: true, subtree: true });
        window.__assignmentReadOnlyCapacityObserver = observer;
    }

    if (!window.__assignmentReadOnlyCapacityGuard) {
        D.addEventListener('click', event => {
            if (!window.SanpoAssignmentWorkspace?.isReadOnly?.()) return;
            const capacityControl = (event.composedPath?.() || []).find(node => node?.classList?.contains?.('capacity-edit-pill'));
            if (!capacityControl) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        window.__assignmentReadOnlyCapacityGuard = true;
    }
}

D.addEventListener('DOMContentLoaded', async () => {
    const assignmentWorkspaceReady = loadAssignmentWorkspaceFeature().catch(error => {
        console.warn('Assignment workspace failed to load:', error);
        return null;
    });

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

    // A copied room link may explicitly request one of the primary views. Keep
    // this as a presentation-only URL concern; it does not enter persisted room state.
    const requestedView = new URLSearchParams(window.location.search).get('view');
    const initialView = ['list', 'sheet', 'seisan'].includes(requestedView) ? requestedView : currentView;

    // Paint the local/default state before any Firebase import or authentication wait.
    // Carbon's content switcher also manages target[hidden], so normalize the selected
    // panel explicitly during boot instead of waiting for the first tab interaction.
    load();
    await switchView(initialView);

    const remoteReady = await initFirebaseSync();
    if (remoteReady) load();

    refreshRoomTitle();
    updateEditLockButton();
    await assignmentWorkspaceReady;
    window.SanpoAssignmentWorkspace?.initialize?.();
    protectSharedAssignmentControls();
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
