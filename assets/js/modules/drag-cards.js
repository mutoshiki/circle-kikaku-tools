// Drag helper utilities. Kept tiny so the existing drag implementation can use it safely.
(function () {
  const interactiveSelector = '.action-btn, .delete-btn-overlay, button, input, textarea, select, .memo-popup, .person-pop-menu';

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
