// Compatibility entry point for the split settlement template bundle.
// The actual pure template builders live in assets/js/templates/settlement/*.js.
// Keep this file thin so older pages or tests that still reference it can re-run registration.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  if (typeof parts.registerSettlementTemplates === 'function') {
    parts.registerSettlementTemplates();
  } else if (!window.SanpoApp?.templates?.settlement) {
    console.warn('Split settlement template files must load before settlement-templates.js.');
  }
})();
