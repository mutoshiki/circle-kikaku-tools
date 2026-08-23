// Settlement empty-state templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};

  function emptyState() {
    const room = window.SanpoCanonicalState?.get?.() || {};
    const sync = room?.meta?.applicationSync;
    const managed = sync?.kind === 'formApplicationSync' && Number(sync?.version || 0) === 2;
    const applicantCount = managed
      ? Object.values(sync?.applicants || {}).filter(applicant => applicant?.name).length
      : 0;
    const heading = managed && applicantCount > 0 ? '参加者がまだ決まっていません' : '参加者がいません';
    const note = managed && applicantCount > 0 ? `<p class="seisan-entry-note">応募者 ${applicantCount}人</p>` : '';
    const primary = managed && applicantCount > 0 ? '応募者を確認' : '参加者を追加';
    return `
      <div class="app-empty-card empty-card app-entry-choice seisan-entry-choice">
        <div class="seisan-entry-copy">
          <h3 class="seisan-entry-title">${heading}</h3>
          ${note}
        </div>
        <div class="seisan-empty-actions app-entry-choice-actions">
          <cds-button class="seisan-btn primary" kind="primary" size="lg" type="button" data-action="open-participants">${primary}</cds-button>
          <cds-button class="seisan-btn" kind="secondary" size="lg" type="button" data-action="switch-seisan-settings">人数だけで精算</cds-button>
        </div>
      </div>`;
  }

  Object.assign(parts, { emptyState });
})();
