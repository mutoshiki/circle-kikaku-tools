(function () {
  'use strict';

  const HIDDEN_CLASS = 'bottom-toolbar-is-hidden';
  const IDLE_DELAY_MS = 1600;
  const toolbarSelector = '#view-toggle-bar';
  let hideTimer = 0;

  function getToolbar() {
    return document.querySelector(toolbarSelector);
  }

  function setHidden(hidden) {
    if (!getToolbar()) return;
    document.body.classList.toggle(HIDDEN_CLASS, hidden);
  }

  function clearHideTimer() {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      setHidden(true);
    }, IDLE_DELAY_MS);
  }

  function showToolbar() {
    setHidden(false);
    scheduleHide();
  }

  function handleUserAction() {
    showToolbar();
  }

  function initBottomToolbarAutoHide() {
    if (!getToolbar()) return;

    document.body.classList.remove(HIDDEN_CLASS);
    scheduleHide();

    document.addEventListener('pointerdown', handleUserAction, { passive: true, capture: true });
    document.addEventListener('touchstart', handleUserAction, { passive: true, capture: true });
    document.addEventListener('keydown', showToolbar, { passive: true });
    document.addEventListener('focusin', showToolbar, { passive: true });
    window.addEventListener('resize', showToolbar, { passive: true });
    window.addEventListener('orientationchange', showToolbar, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) showToolbar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBottomToolbarAutoHide, { once: true });
  } else {
    initBottomToolbarAutoHide();
  }
})();
