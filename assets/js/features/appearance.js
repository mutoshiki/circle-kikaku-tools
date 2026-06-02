// Appearance and theme feature.
// Owns color mode, separated light/dark app-theme persistence, and the theme picker modal.

const APPEARANCE_KEY = 'sanpo_appearance_settings_v1';
const APPEARANCE_MODE_KEY = 'sanpo_color_mode_v1';
const APP_THEME_KEY = 'sanpo_app_theme';
const APP_LIGHT_THEME_KEY = 'sanpo_app_light_theme';
const APP_DARK_THEME_KEY = 'sanpo_app_dark_theme';
const DEFAULT_LIGHT_THEME = 'standard';
const DEFAULT_DARK_THEME = 'standard';
const appearanceMql = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener: null, addListener: null };
let appearanceMode = 'system';
let appThemeIds = { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME };
let appearanceMqlBound = false;
let appearanceUiBound = false;
let appearancePresetsRendered = false;

function normalizeAppearanceMode(value) {
    return ['light', 'dark', 'system'].includes(value) ? value : 'system';
}

function normalizeThemeScope(value) {
    return value === 'dark' ? 'dark' : 'light';
}

function getThemeRegistry() {
    return window.SanpoThemeRegistry || {
        defaultByScope: { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME },
        normalizePalette(value, scope = 'light') {
            const fallback = scope === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
            return value === fallback ? value : fallback;
        },
        getPresets() {
            return [];
        },
        getLabel(value, scope = 'light') {
            return '標準';
        }
    };
}

function getDefaultTheme(scope = 'light') {
    const normalizedScope = normalizeThemeScope(scope);
    return getThemeRegistry().defaultByScope?.[normalizedScope] || (normalizedScope === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);
}

function normalizeAppTheme(value, scope = 'light') {
    const normalizedScope = normalizeThemeScope(scope);
    return getThemeRegistry().normalizePalette(value || getDefaultTheme(normalizedScope), normalizedScope);
}

function normalizeAppThemes(value = appThemeIds) {
    return {
        light: normalizeAppTheme(value?.light, 'light'),
        dark: normalizeAppTheme(value?.dark, 'dark')
    };
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

function readStoredTheme(scope = 'light') {
    const normalizedScope = normalizeThemeScope(scope);
    const key = normalizedScope === 'dark' ? APP_DARK_THEME_KEY : APP_LIGHT_THEME_KEY;
    try {
        const storedTheme = localStorage.getItem(key);
        if (storedTheme) return normalizeAppTheme(storedTheme, normalizedScope);

        const oldSharedTheme = localStorage.getItem(APP_THEME_KEY);
        if (oldSharedTheme) return normalizeAppTheme(oldSharedTheme, normalizedScope);

        const legacyRaw = localStorage.getItem(APPEARANCE_KEY);
        if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) || {};
            return normalizeAppTheme(legacy[`${normalizedScope}Theme`] || legacy.appTheme || legacy.theme || legacy.palette, normalizedScope);
        }
    } catch (_) {}
    return getDefaultTheme(normalizedScope);
}

function readAppThemes() {
    return normalizeAppThemes({
        light: readStoredTheme('light'),
        dark: readStoredTheme('dark')
    });
}

function writeAppearanceSettings(mode = appearanceMode, themes = appThemeIds) {
    appearanceMode = normalizeAppearanceMode(mode);
    appThemeIds = normalizeAppThemes(themes);
    try {
        if (appearanceMode === 'system') localStorage.removeItem(APPEARANCE_MODE_KEY);
        else localStorage.setItem(APPEARANCE_MODE_KEY, appearanceMode);

        if (appThemeIds.light === getDefaultTheme('light')) localStorage.removeItem(APP_LIGHT_THEME_KEY);
        else localStorage.setItem(APP_LIGHT_THEME_KEY, appThemeIds.light);

        if (appThemeIds.dark === getDefaultTheme('dark')) localStorage.removeItem(APP_DARK_THEME_KEY);
        else localStorage.setItem(APP_DARK_THEME_KEY, appThemeIds.dark);

        localStorage.removeItem(APP_THEME_KEY);
        localStorage.removeItem(APPEARANCE_KEY);
        localStorage.removeItem('sanpo_theme_settings_v1');
    } catch (_) {}
}

function resolveAppearanceTheme(mode = appearanceMode) {
    const normalized = normalizeAppearanceMode(mode);
    if (normalized === 'light' || normalized === 'dark') return normalized;
    return appearanceMql.matches ? 'dark' : 'light';
}

function getEffectiveAppTheme(mode = appearanceMode, themes = appThemeIds) {
    const resolvedTheme = resolveAppearanceTheme(mode);
    const normalizedThemes = normalizeAppThemes(themes);
    return normalizedThemes[resolvedTheme];
}

function applyAppearance(mode = readAppearanceMode(), themes = readAppThemes(), persist = false) {
    appearanceMode = normalizeAppearanceMode(mode);
    appThemeIds = normalizeAppThemes(themes);
    if (persist) writeAppearanceSettings(appearanceMode, appThemeIds);

    const resolvedTheme = resolveAppearanceTheme(appearanceMode);
    const effectiveAppTheme = getEffectiveAppTheme(appearanceMode, appThemeIds);
    D.body.dataset.theme = resolvedTheme;
    D.body.dataset.appTheme = effectiveAppTheme;
    D.body.dataset.lightTheme = appThemeIds.light;
    D.body.dataset.darkTheme = appThemeIds.dark;
    D.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    D.documentElement.setAttribute('data-theme', resolvedTheme);
    D.documentElement.setAttribute('data-app-theme', effectiveAppTheme);
    D.documentElement.setAttribute('data-light-theme', appThemeIds.light);
    D.documentElement.setAttribute('data-dark-theme', appThemeIds.dark);
    syncAppearancePickerState();
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function renderThemePresetCard(preset) {
    const swatches = (preset.swatches || [])
        .slice(0, 3)
        .map(color => `<span class="theme-preset-swatch" style="background: ${escapeHtml(color)}"></span>`)
        .join('');
    return `
        <button class="theme-preset-card" type="button" data-theme-scope="${escapeHtml(preset.scope)}" data-theme-preset="${escapeHtml(preset.palette)}" data-preview-mode="${escapeHtml(preset.previewMode || preset.scope)}" aria-pressed="false">
            <span class="theme-preset-swatch-row" aria-hidden="true">${swatches}</span>
            <span class="theme-preset-label"><span>${escapeHtml(preset.label)}</span><i class="fas fa-check theme-preset-check" aria-hidden="true"></i></span>
        </button>`;
}

function renderThemePresets() {
    const registry = getThemeRegistry();
    D.querySelectorAll('[data-theme-preset-list]').forEach(list => {
        const scope = normalizeThemeScope(list.dataset.themePresetList || 'light');
        list.innerHTML = registry.getPresets(scope).map(renderThemePresetCard).join('');
    });
    appearancePresetsRendered = true;
    syncAppearancePickerState();
}

function getAppearanceModeLabel(mode = appearanceMode) {
    return ({ system: '自動', light: 'ライト', dark: 'ダーク' })[normalizeAppearanceMode(mode)] || '自動';
}

function syncAppearancePickerState() {
    if (!D.body) return;
    D.querySelectorAll('[data-appearance-mode]').forEach(button => {
        const active = button.dataset.appearanceMode === appearanceMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    D.querySelectorAll('[data-theme-preset]').forEach(button => {
        const scope = normalizeThemeScope(button.dataset.themeScope || button.closest('[data-theme-preset-list]')?.dataset.themePresetList);
        const active = button.dataset.themePreset === appThemeIds[scope];
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const modeLabel = byId('appearanceCurrentModeLabel');
    if (modeLabel) modeLabel.textContent = getAppearanceModeLabel(appearanceMode);
    const lightLabel = byId('appearanceLightThemeLabel');
    if (lightLabel) lightLabel.textContent = getThemeRegistry().getLabel(appThemeIds.light, 'light');
    const darkLabel = byId('appearanceDarkThemeLabel');
    if (darkLabel) darkLabel.textContent = getThemeRegistry().getLabel(appThemeIds.dark, 'dark');
    const themeLabel = byId('appearanceCurrentThemeLabel');
    if (themeLabel) {
        const resolvedTheme = resolveAppearanceTheme(appearanceMode);
        themeLabel.textContent = getThemeRegistry().getLabel(appThemeIds[resolvedTheme], resolvedTheme);
    }
}

function bindAppearancePickerUi() {
    if (appearanceUiBound) return;
    appearanceUiBound = true;
    bindClick('appearanceSettingsBtn', () => window.openAppearanceModal());
    D.addEventListener('click', event => {
        const modeButton = event.target.closest('[data-appearance-mode]');
        if (modeButton && byId('appearanceModal')?.contains(modeButton)) {
            applyAppearance(modeButton.dataset.appearanceMode, appThemeIds, true);
            return;
        }
        const themeButton = event.target.closest('[data-theme-preset]');
        if (themeButton && byId('appearanceModal')?.contains(themeButton)) {
            const scope = normalizeThemeScope(themeButton.dataset.themeScope);
            const nextThemes = { ...appThemeIds, [scope]: normalizeAppTheme(themeButton.dataset.themePreset, scope) };
            applyAppearance(appearanceMode, nextThemes, true);
            const toggle = themeButton.closest('.theme-choice-toggle');
            if (toggle) toggle.open = false;
        }
    });
    D.querySelectorAll('#appearanceModal .theme-choice-toggle').forEach(toggle => {
        if (toggle.dataset.toggleBound === 'true') return;
        toggle.dataset.toggleBound = 'true';
        toggle.addEventListener('toggle', () => {
            if (!toggle.open) return;
            D.querySelectorAll('#appearanceModal .theme-choice-toggle[open]').forEach(other => {
                if (other !== toggle) other.open = false;
            });
        });
    });
}

function setupAppearanceControls() {
    applyAppearance(readAppearanceMode(), readAppThemes(), false);
    bindAppearancePickerUi();
    renderThemePresets();

    if (appearanceMqlBound) return;
    appearanceMqlBound = true;
    const refreshBySystem = () => {
        if (appearanceMode === 'system') applyAppearance('system', appThemeIds, false);
    };
    if (appearanceMql.addEventListener) appearanceMql.addEventListener('change', refreshBySystem);
    else if (appearanceMql.addListener) appearanceMql.addListener(refreshBySystem);
}

function setupAppearanceFooterSafety() {
    // Compatibility shim for the modal event path. Keeps the selected themes applied
    // even when event bootstrap runs before the main app bootstrap finishes.
    applyAppearance(readAppearanceMode(), readAppThemes(), false);
    bindAppearancePickerUi();
}

window.setupAppearanceFooterSafety = setupAppearanceFooterSafety;

window.openAppearanceModal = function() {
    if (!appearancePresetsRendered) renderThemePresets();
    syncAppearancePickerState();
    const modalEl = byId('appearanceModal');
    if (!modalEl || !window.bootstrap?.Modal) {
        showMiniToast?.('表示テーマを開けませんでした');
        return;
    }
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.setDebugAppearanceMode = function(mode = 'system') {
    const nextMode = normalizeAppearanceMode(mode);
    applyAppearance(nextMode, appThemeIds, true);
    showMiniToast?.(nextMode === 'system' ? '自動に戻しました' : `${nextMode === 'dark' ? 'ダーク' : 'ライト'}表示にしました`);
};

window.setDebugAppTheme = function(theme, scope = resolveAppearanceTheme(appearanceMode)) {
    const normalizedScope = normalizeThemeScope(scope);
    const nextTheme = normalizeAppTheme(theme, normalizedScope);
    const nextThemes = { ...appThemeIds, [normalizedScope]: nextTheme };
    applyAppearance(appearanceMode, nextThemes, true);
    showMiniToast?.(`${getThemeRegistry().getLabel(nextTheme, normalizedScope)}にしました`);
};

window.resetAppearanceSettings = function() {
    applyAppearance('system', { light: getDefaultTheme('light'), dark: getDefaultTheme('dark') }, true);
    showMiniToast?.('表示テーマを戻しました');
};
