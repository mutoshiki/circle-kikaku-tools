(function () {
  'use strict';

  const STORAGE_KEY = 'sanpo-theme';
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function storedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function effectiveTheme() {
    return root.dataset.theme || storedTheme() || systemTheme();
  }

  function updateControls(theme) {
    const button = document.getElementById('themeToggleBtn');
    if (!button) return;
    const isDark = theme === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    const icon = button.querySelector('i');
    const label = button.querySelector('.theme-toggle-label');
    if (icon) icon.className = `fas ${isDark ? 'fa-sun' : 'fa-moon'} me-2`;
    if (label) label.textContent = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
  }

  function updateThemeColor(theme) {
    if (!themeMeta) return;
    themeMeta.setAttribute('content', theme === 'dark' ? '#181912' : '#f4f1ea');
  }

  function applyTheme(theme, { persist = false } = {}) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* local storage can be unavailable */ }
    }
    updateControls(next);
    updateThemeColor(next);
    window.dispatchEvent(new CustomEvent('sanpo-theme-change', { detail: { theme: next } }));
    return next;
  }

  function toggleTheme() {
    return applyTheme(effectiveTheme() === 'dark' ? 'light' : 'dark', { persist: true });
  }

  applyTheme(storedTheme() || systemTheme());

  document.addEventListener('DOMContentLoaded', () => {
    updateControls(effectiveTheme());
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  });

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', event => {
    if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light');
  });

  window.SanpoTheme = { applyTheme, toggleTheme, effectiveTheme };
})();
