// Settlement empty-state templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};

  function emptyState() {
    return `<div class="empty-card app-empty-card">
            <i class="fas fa-calculator" aria-hidden="true"></i>
            <strong>まずは参加者登録から</strong>
            <div class="seisan-empty-actions">
              <button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button>
              <span class="seisan-empty-or">もしくは</span>
              <button class="seisan-btn" type="button" data-action="open-standalone-settlement-settings">人数だけで精算</button>
            </div>
        </div>`;
  }

  
  Object.assign(parts, { emptyState });
})();
