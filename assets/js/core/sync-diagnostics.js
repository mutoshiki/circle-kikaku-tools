// Local collaboration diagnostics. Kept out of the shared room so operational
// telemetry never creates another concurrent-write surface.
(function (global) {
    'use strict';

    const MAX_ENTRIES = 60;

    function storageKey() {
        return `syawari_sync_diagnostics_${typeof roomId === 'string' ? roomId : 'default'}`;
    }

    function read() {
        try {
            const raw = JSON.parse(localStorage.getItem(storageKey()) || '[]');
            return Array.isArray(raw) ? raw.slice(0, MAX_ENTRIES) : [];
        } catch (_) {
            return [];
        }
    }

    function write(entries) {
        try {
            localStorage.setItem(storageKey(), JSON.stringify((Array.isArray(entries) ? entries : []).slice(0, MAX_ENTRIES)));
        } catch (error) {
            console.warn('Failed to save sync diagnostics:', error);
        }
    }

    function record(entry = {}) {
        const item = {
            time: Date.now(),
            kind: String(entry.kind || 'sync'),
            paths: Array.isArray(entry.paths) ? entry.paths.slice(0, 12).map(String) : [],
            message: String(entry.message || ''),
            revision: Number(entry.revision || 0)
        };
        const next = [item, ...read()];
        write(next);
        return item;
    }

    function clear() {
        try { localStorage.removeItem(storageKey()); }
        catch (error) { console.warn('Failed to clear sync diagnostics:', error); }
    }

    global.SanpoSyncDiagnostics = Object.freeze({ read, record, clear });
})(window);
