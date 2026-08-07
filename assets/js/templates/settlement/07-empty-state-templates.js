// Settlement empty-state templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};

  function emptyState() {
    const shared = window.SanpoApp?.templates?.common?.entryChoice;
    return typeof shared === 'function'
      ? shared({ className: 'seisan-entry-choice' })
      : '<div class="app-empty-card empty-card app-entry-choice"><div class="seisan-empty-actions"><cds-button kind="primary" size="lg" type="button" data-action="open-batch">参加者登録(推奨)</cds-button><span class="seisan-empty-or">もしくは</span><cds-button kind="secondary" size="lg" type="button" data-action="switch-seisan-settings">人数だけで精算</cds-button></div></div>';
  }

  Object.assign(parts, { emptyState });
})();
