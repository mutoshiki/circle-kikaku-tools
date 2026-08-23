// Shared first-run entry choice used by allocation and shared view.
(function () {
  'use strict';

  function entryChoice(options = {}) {
    const extraClass = String(options.className || '').trim();
    const classes = ['app-empty-card', 'empty-card', 'app-entry-choice', extraClass].filter(Boolean).join(' ');
    return `
      <div class="${classes}">
        <div class="seisan-empty-actions app-entry-choice-actions">
          <cds-button class="seisan-btn primary" kind="primary" size="lg" type="button" data-action="open-participants">参加者</cds-button>
          <cds-button class="seisan-btn" kind="secondary" size="lg" type="button" data-action="switch-seisan-settings">人数だけで精算</cds-button>
        </div>
      </div>`;
  }

  window.SanpoApp?.registerTemplates?.('common', { entryChoice });
})();
