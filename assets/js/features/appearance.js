// Single appearance feature
// Theme presets/picker are removed, but light/dark mode follows the device setting.

const APPEARANCE_KEY = 'sanpo_appearance_settings_v1';
const APPEARANCE_MODE_KEY = 'sanpo_color_mode_v1';
const appearanceMql = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener: null, addListener: null };
let appearanceMode = 'system';
let appearanceMqlBound = false;

function normalizeAppearanceMode(value) {
    return ['light', 'dark', 'system'].includes(value) ? value : 'system';
}

function readAppearanceMode() {
    try {
        const storedMode = localStorage.getItem(APPEARANCE_MODE_KEY);
        if (storedMode) return normalizeAppearanceMode(storedMode);

        const legacyRaw = localStorage.getItem(APPEARANCE_KEY);
        if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) || {};
            return normalizeAppearanceMode(legacy.mode);
        }
    } catch (_) {}
    return 'system';
}

function writeAppearanceMode(mode) {
    appearanceMode = normalizeAppearanceMode(mode);
    try {
        if (appearanceMode === 'system') localStorage.removeItem(APPEARANCE_MODE_KEY);
        else localStorage.setItem(APPEARANCE_MODE_KEY, appearanceMode);

        // Old palette/theme selections are intentionally discarded.
        localStorage.removeItem(APPEARANCE_KEY);
        localStorage.removeItem('sanpo_theme_settings_v1');
        localStorage.removeItem('sanpo_app_theme');
    } catch (_) {}
}

function resolveAppearanceTheme(mode = appearanceMode) {
    const normalized = normalizeAppearanceMode(mode);
    if (normalized === 'light' || normalized === 'dark') return normalized;
    return appearanceMql.matches ? 'dark' : 'light';
}

function applySingleAppearance(mode = readAppearanceMode(), persist = false) {
    appearanceMode = normalizeAppearanceMode(mode);
    if (persist) writeAppearanceMode(appearanceMode);
    else {
        try {
            localStorage.removeItem(APPEARANCE_KEY);
            localStorage.removeItem('sanpo_theme_settings_v1');
            localStorage.removeItem('sanpo_app_theme');
        } catch (_) {}
    }

    const resolvedTheme = resolveAppearanceTheme(appearanceMode);
    D.body.dataset.theme = resolvedTheme;
    D.body.dataset.appTheme = 'single';
    D.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    D.documentElement.setAttribute('data-theme', resolvedTheme);
    D.documentElement.setAttribute('data-app-theme', 'single');
}

function setupAppearanceControls() {
    applySingleAppearance(readAppearanceMode(), false);

    if (appearanceMqlBound) return;
    appearanceMqlBound = true;
    const refreshBySystem = () => {
        if (appearanceMode === 'system') applySingleAppearance('system', false);
    };
    if (appearanceMql.addEventListener) appearanceMql.addEventListener('change', refreshBySystem);
    else if (appearanceMql.addListener) appearanceMql.addListener(refreshBySystem);
}

function setupAppearanceFooterSafety() {
    // Compatibility shim for the old appearance modal event path.
    // The modal itself was removed, but this keeps event bootstrap safe.
    applySingleAppearance(readAppearanceMode(), false);
}

window.setupAppearanceFooterSafety = setupAppearanceFooterSafety;

window.openAppearanceModal = function() {
    applySingleAppearance(readAppearanceMode(), false);
    showMiniToast?.('表示は端末設定に合わせて自動で切り替わります');
};

window.setDebugAppearanceMode = function(mode = 'system') {
    const nextMode = normalizeAppearanceMode(mode);
    applySingleAppearance(nextMode, true);
    showMiniToast?.(nextMode === 'system' ? '端末設定に戻しました' : `${nextMode === 'dark' ? 'ダーク' : 'ライト'}表示に切り替えました`);
};

window.resetAppearanceSettings = function() {
    applySingleAppearance('system', true);
    showMiniToast?.('端末設定に戻しました');
};
