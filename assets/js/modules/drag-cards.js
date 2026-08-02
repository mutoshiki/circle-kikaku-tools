// Drag helper utilities. Kept tiny so the existing drag implementation can use it safely.
(function () {
  const interactiveSelector = '.action-btn, .delete-btn-overlay, button, cds-button, cds-icon-button, cds-content-switcher-item, input, textarea, select, cds-text-input, cds-textarea, cds-number-input, cds-select, cds-checkbox, cds-toggle, .memo-popup, .person-pop-menu';

  window.SanpoDrag = {
    interactiveSelector,
    isInteractiveTarget(target) {
      return !!target?.closest?.(interactiveSelector);
    },
    distance(x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },
    isScrollableGesture(startX, startY, currentX, currentY, threshold = 22) {
      return Math.hypot(currentX - startX, currentY - startY) > threshold;
    }
  };
})();
