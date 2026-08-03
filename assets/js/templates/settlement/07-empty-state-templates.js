// Settlement empty-state templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};

  function emptyState() {
    return `<div class="empty-card app-empty-card">
            <span data-carbon-icon="calculator" aria-hidden="true"></span>
            <strong>精算するデータがありません</strong>
            <span class="empty-card-text">まずは参加者登録から。参加者と車出しを登録すると、支払いと集金の計算を開始できます。</span>
            <div class="seisan-empty-actions">
              <cds-button class="seisan-btn primary" kind="primary" size="lg" type="button" data-action="open-batch">参加者登録を開く</cds-button>
              <span class="seisan-empty-or">もしくは</span>
              <cds-button class="seisan-btn" kind="secondary" size="lg" type="button" data-action="open-standalone-settlement-settings">人数だけで精算</cds-button>
            </div>
        </div>`;
  }

  
  Object.assign(parts, { emptyState });
})();
