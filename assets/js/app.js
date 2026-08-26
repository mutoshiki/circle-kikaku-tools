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
        script.src = './assets/js/features/assignment-workspace.js?v=assignment-workspace-v12';
        script.async = true;
        script.dataset.assignmentWorkspaceFeature = 'true';
        script.addEventListener('load', () => resolve(window.SanpoAssignmentWorkspace), { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });
    return window.__assignmentWorkspaceFeaturePromise;
}

function normalizeLegacyAllocationShareUrl() {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.get('view') === 'sheet') {
        url.searchParams.delete('view');
        changed = true;
    }
    if (url.searchParams.has('allocation')) {
        url.searchParams.delete('allocation');
        changed = true;
    }
    if (changed) window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function suppressRetiredAllocationDragGuidance() {
    const key = `syawari_guidance_allocation_drag_${roomId || 'local'}_v3`;
    try {
        if (typeof safeLocalSet === 'function') safeLocalSet(key, true);
        else localStorage.setItem(key, JSON.stringify(true));
    } catch (_) {
        // Guidance is nonessential; storage restrictions must not block app startup.
    }
}

function installRetiredSheetViewCompatibility() {
    if (window.__retiredSheetViewCompatibilityInstalled || typeof window.switchView !== 'function') return;
    window.__retiredSheetViewCompatibilityInstalled = true;
    const baseSwitchView = window.switchView;
    window.switchView = async function switchWithoutSharedDestination(view) {
        let compatibilityTab = null;
        if (!document.getElementById('tab-sheet')) {
            compatibilityTab = document.createElement('span');
            compatibilityTab.id = 'tab-sheet';
            compatibilityTab.hidden = true;
            compatibilityTab.setAttribute('aria-hidden', 'true');
            document.body.appendChild(compatibilityTab);
        }
        try {
            return await baseSwitchView(view);
        } finally {
            compatibilityTab?.remove();
        }
    };
}

D.addEventListener('DOMContentLoaded', async () => {
    // Phones use one natural scroll owner. The old gesture owner converted a tiny
    // finger movement into a full project-title collapse, which felt much faster
    // than the physical scroll.
    if (window.matchMedia('(max-width: 768px)').matches) {
        document.documentElement.dataset.projectTitleRevealBound = 'true';
    }

    normalizeLegacyAllocationShareUrl();
    suppressRetiredAllocationDragGuidance();

    // Retired allocation controls are removed before feature owners can expose them.
    ['fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade']
        .forEach(id => document.getElementById(id)?.remove());
    document.getElementById('car-plan-switcher')?.remove();

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

    await roleStateReady;
    installRetiredSheetViewCompatibility();

    const requestedView = new URLSearchParams(window.location.search).get('view');
    const initialView = ['list', 'seisan'].includes(requestedView) ? requestedView : 'list';

    load();
    await window.switchView(initialView);
    if (requestedView === 'participants') {
        const showRequestedParticipants = () => window.SanpoApplicantSync?.showParticipantsView?.();
        // The participant feature is loaded asynchronously by Firebase configuration.
        // Apply the route only after the base shell has finished its initial list render,
        // otherwise that render can overwrite the participant view during startup.
        if (window.SanpoApplicantSync) showRequestedParticipants();
        else window.addEventListener('sanpo-applicant-sync-ready', showRequestedParticipants, { once: true });
    }

    const remoteReady = await initFirebaseSync();
    if (remoteReady) load();

    refreshRoomTitle();
    updateEditLockButton();
    await assignmentWorkspaceReady;
    window.SanpoAssignmentWorkspace?.initialize?.();

    if (firebaseEnabled && db && firebaseReady) {
        onValue(ref(db, '.info/connected'), snap => {
            if (snap.val() === true) updateStatus('connected', '共有同期中');
            else updateStatus('error', '同期切断中');
        });
    }

    startHistoryAutosave();
});
