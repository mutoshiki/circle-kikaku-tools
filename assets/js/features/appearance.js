// Appearance settings feature
// Extracted from app.js during S cleanup.
// Owns palette selection, system light/dark resolution, and appearance modal wiring.

const APPEARANCE_KEY = 'sanpo_appearance_settings_v1';
const DEFAULT_APPEARANCE = { mode: 'system', lightPalette: 'natural', darkPalette: 'natural' };
const THEME_REGISTRY = window.SanpoThemeRegistry;
let appearanceSettings = { ...DEFAULT_APPEARANCE };
const appearanceMql = window.matchMedia('(prefers-color-scheme: dark)');

function normalizeAppearancePalette(value, mode = 'light') {
    return THEME_REGISTRY?.normalizePalette
        ? THEME_REGISTRY.normalizePalette(value, mode)
        : (value || 'natural');
}
function getAppearancePaletteLabel(value) {
    return THEME_REGISTRY?.getLabel ? THEME_REGISTRY.getLabel(value) : '標準';
}
function readAppearanceSettings() {
    try {
        const parsed = safeLocalGet(APPEARANCE_KEY, {});
        const legacyPalette = parsed.palette || parsed.appTheme;
        const lightPalette = normalizeAppearancePalette(parsed.lightPalette || legacyPalette || DEFAULT_APPEARANCE.lightPalette, 'light');
        const darkPalette = normalizeAppearancePalette(parsed.darkPalette || legacyPalette || DEFAULT_APPEARANCE.darkPalette, 'dark');
        return { mode: 'system', lightPalette, darkPalette };
    } catch (_) {
        return { ...DEFAULT_APPEARANCE };
    }
}
function resolveAppearanceMode() {
    return appearanceMql.matches ? 'dark' : 'light';
}
function getActiveAppearancePalette(settings = appearanceSettings) {
    return resolveAppearanceMode() === 'dark' ? settings.darkPalette : settings.lightPalette;
}
function applyAppearanceSettings(settings = readAppearanceSettings(), persist = true) {
    const next = { ...DEFAULT_APPEARANCE, ...settings, mode: 'system' };
    next.lightPalette = normalizeAppearancePalette(next.lightPalette, 'light');
    next.darkPalette = normalizeAppearancePalette(next.darkPalette, 'dark');
    appearanceSettings = next;
    const resolvedTheme = resolveAppearanceMode();
    const activePalette = getActiveAppearancePalette(appearanceSettings);
    D.body.dataset.theme = resolvedTheme;
    D.body.dataset.appTheme = activePalette;
    D.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    D.documentElement.setAttribute('data-theme', resolvedTheme);
    D.documentElement.setAttribute('data-app-theme', activePalette);
    if (persist) safeLocalSet(APPEARANCE_KEY, appearanceSettings);
    updateAppearanceControls();
}
function updateAppearanceControls() {
    const resolvedTheme = resolveAppearanceMode();
    $$('[data-theme-scope][data-theme-palette]').forEach(btn => {
        const scope = btn.dataset.themeScope;
        const expected = scope === 'dark' ? appearanceSettings.darkPalette : appearanceSettings.lightPalette;
        const isStored = btn.dataset.themePalette === expected;
        btn.classList.toggle('stored', isStored);
        btn.classList.toggle('active', isStored && scope === resolvedTheme);
    });
    const darkLabel = $('#darkThemeSummary');
    const lightLabel = $('#lightThemeSummary');
    if (darkLabel) darkLabel.textContent = getAppearancePaletteLabel(appearanceSettings.darkPalette);
    if (lightLabel) lightLabel.textContent = getAppearancePaletteLabel(appearanceSettings.lightPalette);
    const label = $('#appearanceCurrentLabel');
    if (label) label.textContent = resolvedTheme === 'dark' ? '端末：ダーク' : '端末：ライト';
}


function setupAppearanceFooterSafety() {
    const modal = byId('appearanceModal');
    if (!modal || modal.dataset.footerSafetyBound === 'true') return;
    modal.dataset.footerSafetyBound = 'true';

    const closeThemePickers = () => {
        modal.querySelectorAll('.theme-picker[open]').forEach(picker => {
            picker.removeAttribute('open');
        });
    };

    modal.querySelectorAll('.modal-footer .btn').forEach(button => {
        button.addEventListener('pointerdown', closeThemePickers, { passive: true });
        button.addEventListener('click', closeThemePickers);
    });
}

function setupThemePickerDropdowns() {
    const pickers = $$('#appearanceModal .theme-picker');
    if (!pickers.length || setupThemePickerDropdowns.ready) return;
    setupThemePickerDropdowns.ready = true;

    const updatePickerMenuHeight = () => {
        const modalEl = $('#appearanceModal');
        const footer = modalEl ? modalEl.querySelector('.modal-footer') : null;
        const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
        pickers.forEach(picker => {
            if (!picker.open) return;
            const summary = picker.querySelector('summary');
            if (!summary) return;
            const summaryRect = summary.getBoundingClientRect();
            const available = Math.max(150, Math.floor(footerTop - summaryRect.bottom - 18));
            picker.style.setProperty('--theme-choice-max-height', `${available}px`);
        });
    };

    pickers.forEach(picker => {
        picker.addEventListener('toggle', () => {
            if (picker.open) requestAnimationFrame(updatePickerMenuHeight);
        });
    });

    document.addEventListener('click', event => {
        if (event.target.closest('#appearanceModal .theme-picker')) return;
        pickers.forEach(picker => picker.removeAttribute('open'));
    });

    window.addEventListener('resize', updatePickerMenuHeight);
    window.addEventListener('orientationchange', updatePickerMenuHeight);

    const modalEl = $('#appearanceModal');
    if (modalEl) {
        modalEl.addEventListener('shown.bs.modal', updatePickerMenuHeight);
        modalEl.addEventListener('hidden.bs.modal', () => {
            pickers.forEach(picker => {
                picker.removeAttribute('open');
                picker.style.removeProperty('--theme-choice-max-height');
            });
        });
    }
}

function setupAppearanceControls() {
    applyAppearanceSettings(readAppearanceSettings(), true);
    setupThemePickerDropdowns();
    $$('[data-theme-scope][data-theme-palette]').forEach(btn => {
        btn.addEventListener('click', () => {
            const scope = btn.dataset.themeScope === 'dark' ? 'dark' : 'light';
            const palette = btn.dataset.themePalette;
            const next = { ...appearanceSettings, mode: 'system' };
            if (scope === 'dark') next.darkPalette = palette;
            else next.lightPalette = palette;
            applyAppearanceSettings(next);
        });
    });
    const refreshBySystem = () => applyAppearanceSettings({ ...appearanceSettings, mode: 'system' }, false);
    if (appearanceMql.addEventListener) appearanceMql.addEventListener('change', refreshBySystem);
    else if (appearanceMql.addListener) appearanceMql.addListener(refreshBySystem);
}
window.openAppearanceModal = function() {
    applyAppearanceSettings({ ...appearanceSettings, mode: 'system' }, false);
    if (modals.appearance) modals.appearance.show();
};
window.resetAppearanceSettings = function() {
    applyAppearanceSettings({ ...DEFAULT_APPEARANCE });
    showMiniToast('標準テーマに戻しました');
};
