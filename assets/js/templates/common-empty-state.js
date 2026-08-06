// Shared first-run entry choice used by allocation, shared view, and settlement.
(function () {
  'use strict';

  function entryChoice(options = {}) {
    const extraClass = String(options.className || '').trim();
    const classes = ['app-empty-card', 'empty-card', 'app-entry-choice', extraClass].filter(Boolean).join(' ');
    return `
      <div class="${classes}">
        <div class="seisan-empty-actions app-entry-choice-actions">
          <span class="app-entry-recommended-action"><cds-button class="seisan-btn primary" kind="primary" size="lg" type="button" data-action="open-batch">参加者登録</cds-button><cds-tag class="app-entry-recommended-tag" type="blue" size="sm">推奨</cds-tag></span>
          <span class="seisan-empty-or">もしくは</span>
          <cds-button class="seisan-btn" kind="secondary" size="lg" type="button" data-action="switch-seisan-settings">人数だけで精算</cds-button>
        </div>
      </div>`;
  }

  window.SanpoApp?.registerTemplates?.('common', { entryChoice });
})();
