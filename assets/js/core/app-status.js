// App save/sync status facade.
// Split from app.js during S-4 cleanup.

function updateStatus(kind = 'neutral', message = '') {
    if (!message) return;
    setPersistentSaveStatus(kind, message);
}

// Backward-compatible status API used by extracted core modules.
window.showSaveStatus = function showSaveStatus(message, kind = 'neutral') {
    updateStatus(kind, message);
};
