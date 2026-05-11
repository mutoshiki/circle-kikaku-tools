// Core storage/schema helpers
// Extracted from app.js during S cleanup.
// Owns HTML escaping, schema migration, and safe localStorage helpers.

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function migrateAppData(rawData) {
    const data = rawData && typeof rawData === 'object' ? rawData : {};
    const version = Number(data.schemaVersion || 1);
    const migrated = { ...data };

    if (version < 2) {
        migrated.schemaVersion = 2;
        migrated.meta = {
            ...(migrated.meta || {}),
            migratedAt: new Date().toISOString(),
            migratedFrom: version
        };
    }

    if (!migrated.schemaVersion) migrated.schemaVersion = APP_SCHEMA_VERSION;
    return migrated;
}

function stampSchemaVersion(data) {
    if (!data || typeof data !== 'object') return data;
    return {
        ...data,
        schemaVersion: APP_SCHEMA_VERSION,
        updatedAt: Date.now(),
        updatedBy: (typeof myClientId !== 'undefined' ? myClientId : 'local')
    };
}

function safeJsonParse(value, fallback = null) {
    if (value == null || value === '') return fallback;
    try { return JSON.parse(value); }
    catch (error) {
        console.warn('JSON parse failed:', error);
        return fallback;
    }
}

function safeLocalGet(key, fallback = null) {
    try {
        return safeJsonParse(localStorage.getItem(key), fallback);
    } catch (error) {
        console.warn('localStorage get failed:', error);
        return fallback;
    }
}

function safeLocalSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn('localStorage save failed:', error);
        window.showSaveStatus?.('保存失敗');
        return false;
    }
}

function safeLocalRemove(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn('localStorage remove failed:', error);
        return false;
    }
}
