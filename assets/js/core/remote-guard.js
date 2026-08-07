// Remote update guard
// Extracted from app.js during S cleanup.
// Owns local editing detection and remote update safety checks.

let lastRemoteUpdatedAt = 0;
let isLocalEditing = false;
let remoteUpdateTimer = null;

function markLocalEditing() {
    isLocalEditing = true;
    clearTimeout(remoteUpdateTimer);
    remoteUpdateTimer = setTimeout(() => { isLocalEditing = false; }, 1800);
}

document.addEventListener('input', markLocalEditing, true);
document.addEventListener('change', markLocalEditing, true);

function shouldApplyRemoteData(remoteData) {
    if (!remoteData || typeof remoteData !== 'object') return false;
    const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
    const localUpdatedAt = Number(window.__lastLocalUpdatedAt || 0);

    if (remoteUpdatedAt && remoteUpdatedAt < lastRemoteUpdatedAt) return false;
    if (isLocalEditing && remoteUpdatedAt && localUpdatedAt && remoteUpdatedAt < localUpdatedAt) {
        window.showSaveStatus?.('編集中のため同期保留');
        return false;
    }

    if (remoteUpdatedAt) lastRemoteUpdatedAt = remoteUpdatedAt;
    return true;
}
