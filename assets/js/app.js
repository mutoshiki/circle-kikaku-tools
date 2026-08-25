// Main app startup after S-4 cleanup.
// Persistence, render, settlement edit guard, and history scheduling live in assets/js/core/.

function loadScriptOnce(src, marker, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
    });
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.setAttribute(marker, 'true');
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });
}

function loadAllocationRoleState() {
    if (window.__allocationRoleStateInstalled) return Promise.resolve();
    if (window.__allocationRoleStatePromise) return window.__allocationRoleStatePromise;
    window.__allocationRoleStatePromise = loadScriptOnce(
        './assets/js/core/allocation-role-state.js?v=allocation-role-v1',
        'data-allocation-role-state',
        () => window.__allocationRoleStateInstalled === true
    );
    return window.__allocationRoleStatePromise;
}

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
        script.src = './assets/js/features/assignment-workspace.js?v=assignment-workspace-v6';
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
    // Mobile uses one natural shell scroll. Prevent the legacy 16px touch gesture
    // from collapsing a 240px title region and making content outrun the finger.
    document.documentElement.dataset.projectTitleRevealBound = 'true';

    // Remove retired gender controls before the event owner binds form actions.
    ['optFemale', 'optMale'].forEach(id => document.getElementById(id)?.closest('.auto-assign-option-row')?.remove());

    const roleStateReady = loadAllocationRoleState().catch(error => {
        console.warn('Allocation role state failed to load:', error);
    });
    const assignmentWorkspaceReady = loadAssignmentWorkspaceFeature().catch(error => {
        console.warn('Assignment workspace failed to load:', error);
        return null;
    });

    initializeAppModals();
    setupPlanningAssurance?.();

    loadTrustedEditPassphrase();
    setupCompactPersonMenu();
    ensureCompactMenuFallback();
    setupSeatMemberPicker();

    // Canonical reads/writes must use the role/gender-migration adapter from the
    // first local restore onward so stale gender fields never re-enter new saves.
    await roleStateReady;

    const requestedView = new URLSearchParams(window.location.search).get('view');
    const initialView = ['list', 'sheet', 'seisan'].includes(requestedView) ? requestedView : currentView;

    load();
    await switchView(initialView);

    const remoteReady = await initFirebaseSync();
    if (remoteReady) load();

    refreshRoomTitle();
    updateEditLockButton();
    await assignmentWorkspaceReady;
    window.SanpoAssignmentWorkspace?.initialize?.();
    protectSharedAssignmentControls();
    setupManualSheetDrag();

    if (firebaseEnabled && db && firebaseReady) {
        onValue(ref(db, ".info/connected"), (snap) => {
            if (snap.val() === true) updateStatus('connected', '共有同期中');
            else updateStatus('error', '同期切断中');
        });
    }

    startHistoryAutosave();
});
