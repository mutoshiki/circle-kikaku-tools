// Theme controller: follow the device by default, while keeping manual light/dark switching available.
(function () {
  'use strict';

  const STORAGE_KEY = 'sanpo-theme';
  const SYSTEM_AT_OVERRIDE_KEY = 'sanpo-theme-system-at-override';
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Local storage can be unavailable in private or restricted environments.
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Local storage can be unavailable in private or restricted environments.
    }
  }

  function systemTheme() {
    return media?.matches ? 'dark' : 'light';
  }

  function storedManualTheme() {
    const value = readStorage(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }

  function clearManualTheme() {
    removeStorage(STORAGE_KEY);
    removeStorage(SYSTEM_AT_OVERRIDE_KEY);
  }

  function initialTheme() {
    const currentSystemTheme = systemTheme();
    const manualTheme = storedManualTheme();
    const systemThemeAtOverride = readStorage(SYSTEM_AT_OVERRIDE_KEY);

    // A manual choice remains valid while the device setting has not changed.
    // If the device changed while the page was closed, return to automatic following.
    if (manualTheme && systemThemeAtOverride === currentSystemTheme) {
      return manualTheme;
    }

    clearManualTheme();
    return currentSystemTheme;
  }

  function effectiveTheme() {
    return root.dataset.theme || initialTheme();
  }

  function updateControls(theme) {
    const button = document.getElementById('themeToggleBtn');
    if (!button) return;

    const isDark = theme === 'dark';
    const nextLabel = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', nextLabel);

    const icon = button.querySelector('i');
    const label = button.querySelector('.theme-toggle-label');
    if (icon) icon.className = `fas ${isDark ? 'fa-sun' : 'fa-moon'} me-2`;
    if (label) label.textContent = nextLabel;
  }

  function updateThemeColor(theme) {
    if (!themeMeta) return;
    themeMeta.setAttribute('content', theme === 'dark' ? '#181912' : '#f4f1ea');
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    updateControls(next);
    updateThemeColor(next);
    window.dispatchEvent(new CustomEvent('sanpo-theme-change', { detail: { theme: next } }));
    return next;
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    writeStorage(STORAGE_KEY, next);
    writeStorage(SYSTEM_AT_OVERRIDE_KEY, systemTheme());
    return applyTheme(next);
  }

  function syncWithSystem(event) {
    clearManualTheme();
    return applyTheme(typeof event?.matches === 'boolean' ? (event.matches ? 'dark' : 'light') : systemTheme());
  }

  applyTheme(initialTheme());

  document.addEventListener('DOMContentLoaded', () => {
    updateControls(effectiveTheme());
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  });

  if (media?.addEventListener) {
    media.addEventListener('change', syncWithSystem);
  } else {
    media?.addListener?.(syncWithSystem);
  }

  window.SanpoTheme = { applyTheme, toggleTheme, effectiveTheme, systemTheme, syncWithSystem };
})();
