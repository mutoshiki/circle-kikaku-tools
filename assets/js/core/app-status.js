// App save/sync status facade.
// Split from app.js during S-4 cleanup.

let saveFeedbackCycle = 0;
let activeSaveFeedbackCycle = 0;

function statusMessageForCycle(kind, message) {
    const text = String(message || '');
    if (kind === 'saving') {
        activeSaveFeedbackCycle = ++saveFeedbackCycle;
        return `${text}\u2063${activeSaveFeedbackCycle}`;
    }
    if (kind === 'connected' && activeSaveFeedbackCycle) {
        const cycle = activeSaveFeedbackCycle;
        activeSaveFeedbackCycle = 0;
        return `${text}\u2063${cycle}`;
    }
    if (kind === 'error' || kind === 'local') activeSaveFeedbackCycle = 0;
    return text;
}

function updateStatus(kind = 'neutral', message = '') {
    if (!message) return;
    // Every real save is a distinct UI feedback cycle even when consecutive saves use
    // the same human-readable status text. The invisible separator keeps AppUI's
    // duplicate-status guard from accidentally swallowing a later save completion.
    setPersistentSaveStatus(kind, statusMessageForCycle(kind, message));
}

// Backward-compatible status API used by extracted core modules.
window.showSaveStatus = function showSaveStatus(message, kind = 'neutral') {
    updateStatus(kind, message);
};

function installDynamicCarbonValidationSync() {
    if (window.__sanpoDynamicCarbonValidationSyncInstalled || !window.MutationObserver) return;
    window.__sanpoDynamicCarbonValidationSyncInstalled = true;

    const selector = 'cds-text-input, cds-textarea, cds-number-input, cds-select, cds-checkbox, cds-toggle';
    const pending = new Set();
    let flushQueued = false;

    const queueSync = host => {
        if (!host?.matches?.(selector)) return;
        pending.add(host);
        if (flushQueued) return;
        flushQueued = true;
        queueMicrotask(() => {
            flushQueued = false;
            const hosts = Array.from(pending);
            pending.clear();
            hosts.forEach(host => {
                if (!host.isConnected) return;
                if (typeof window.syncCarbonFormControlAccessibility === 'function') {
                    void window.syncCarbonFormControlAccessibility(host);
                } else if (typeof syncCarbonFormControlAccessibility === 'function') {
                    void syncCarbonFormControlAccessibility(host);
                }
            });
        });
    };

    const observer = new MutationObserver(records => {
        records.forEach(record => queueSync(record.target));
    });
    observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: [
            'class',
            'data-warning-text',
            'warn-text',
            'warn',
            'data-invalid-text',
            'invalid-text',
            'invalid'
        ]
    });
}

function scheduleSyncTransportRetry() {
    if (window.__sanpoSyncTransportRetryScheduled) return;
    window.__sanpoSyncTransportRetryScheduled = true;
    window.__sanpoSyncWaitingForTransport = true;

    const retry = () => {
        window.__sanpoSyncTransportRetryScheduled = false;
        if (typeof window.runTransaction !== 'function' && typeof window.firebaseModules?.runTransaction === 'function') {
            window.runTransaction = window.firebaseModules.runTransaction;
        }
        if (typeof window.runTransaction !== 'function') {
            window.__sanpoSyncWaitingForTransport = false;
            window.showSaveStatus?.('同期機能を準備できませんでした', 'error');
            return;
        }
        window.__sanpoSyncWaitingForTransport = false;
        // The failed transaction was intentionally kept in the durable outbox. A normal
        // save rebuilds the narrow intent against the latest synced base and retries it.
        window.save?.();
    };

    const ready = window.firebaseReadyPromise;
    if (ready?.then) {
        ready.then(() => setTimeout(retry, 60)).catch(() => {
            window.__sanpoSyncTransportRetryScheduled = false;
            window.__sanpoSyncWaitingForTransport = false;
        });
    } else {
        setTimeout(retry, 180);
    }
}

function installSyncTransportReadinessGuard() {
    if (window.__sanpoSyncTransportGuardInstalled) return;
    const originalPermanentCheck = window.isPermanentSyncError;
    if (typeof originalPermanentCheck !== 'function') return;
    window.__sanpoSyncTransportGuardInstalled = true;

    window.isPermanentSyncError = function guardedPermanentSyncError(error) {
        const code = String(error?.code || '').toLowerCase();
        const message = String(error?.message || error || '').toLowerCase();
        const transportNotReady = code === 'sync-not-ready'
            || message.includes('transaction support is required');
        if (transportNotReady) {
            scheduleSyncTransportRetry();
            return false;
        }
        return originalPermanentCheck(error);
    };
}

function installAppStatusGuards() {
    installDynamicCarbonValidationSync();
    installSyncTransportReadinessGuard();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAppStatusGuards, { once: true });
} else {
    installAppStatusGuards();
}
