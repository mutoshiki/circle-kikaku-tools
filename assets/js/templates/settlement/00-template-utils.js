// Settlement template utilities.
// Shared helpers and CSS class contracts used by split settlement template files.
(function () {
  'use strict';

  window.SanpoApp = window.SanpoApp || {};
  window.SanpoApp.settlementTemplateParts = window.SanpoApp.settlementTemplateParts || {};
  const parts = window.SanpoApp.settlementTemplateParts;

  const UI_CLASS = Object.freeze({
    surfaceCard: 'ui-surface ui-surface--card',
    surfaceInset: 'ui-surface ui-surface--inset',
    amount: 'ui-amount',
    chip: 'ui-chip',
    input: 'ui-input'
  });

  function esc(value, helpers) {
    return (helpers?.escapeHtml || window.escapeHtml || (v => String(v ?? '')))(value);
  }

    function money(value, helpers) {
    return (helpers?.yen || (v => '¥' + Math.round(v || 0).toLocaleString()))(value);
  }

  
  Object.assign(parts, { UI_CLASS, esc, money });
})();
