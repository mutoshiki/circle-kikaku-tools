// Participants presentation owner.
// Keeps applicant selection semantics intact while presenting the dedicated view with Carbon patterns.
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  let participantAreaObserver = null;

  function canonical() {
    return window.SanpoCanonicalState?.get?.() || null;
  }

  function applicationSync(room = canonical()) {
    const sync = room?.meta?.applicationSync;
    return sync?.kind === 'formApplicationSync' && Number(sync.version || 0) === 2 ? sync : null;
  }

  function checkboxChecked(checkbox) {
    const native = checkbox?.shadowRoot?.querySelector?.('input[type="checkbox"]');
    if (native && typeof native.checked === 'boolean') return native.checked;
    if (typeof checkbox?.checked === 'boolean') return checkbox.checked;
    return Boolean(checkbox?.hasAttribute?.('checked'));
  }

  function removeAllocationRegistrationAction() {
    const button = byId('batchOpenBtn');
    if (!button) return;
    const toolbar = button.closest('.allocation-toolbar');
    button.remove();
    if (toolbar && !toolbar.querySelector('button, cds-button, cds-icon-button, cds-overflow-menu')) toolbar.remove();
  }

  function selectedCount(room, sync) {
    const checkboxes = Array.from(byId('formApplicantList')?.querySelectorAll?.('cds-checkbox') || []);
    if (checkboxes.length) return checkboxes.filter(checkboxChecked).length;
    return Object.keys(room?.participants || {}).length;
  }

  function updateSummary() {
    const room = canonical();
    const summary = byId('participantsViewSummary');
    if (!room || !summary) return;

    const sync = applicationSync(room);
    const participantCount = Object.keys(room.participants || {}).length;
    const selected = selectedCount(room, sync);
    const applicantCount = sync ? Object.values(sync.applicants || {}).filter(applicant => applicant?.name).length : 0;
    const key = sync ? `sync:${applicantCount}:${selected}` : `manual:${selected}`;

    if (summary.dataset.summaryKey !== key) {
      summary.dataset.summaryKey = key;
      summary.classList.toggle('is-manual', !sync);
      summary.innerHTML = sync
        ? `<div class="participants-summary__item"><span class="participants-summary__label">応募者</span><span class="participants-summary__value">${applicantCount}人</span></div><div class="participants-summary__item"><span class="participants-summary__label">当選者</span><span class="participants-summary__value">${selected}人</span></div>`
        : `<div class="participants-summary__item"><span class="participants-summary__label">参加者</span><span class="participants-summary__value">${selected}人</span></div>`;
    }

    const button = byId('formApplicantApplyBtn');
    if (button) {
      const label = sync
        ? (participantCount > 0 ? '参加者を更新' : '参加者を確定')
        : '参加者を更新';
      if (button.textContent !== label) button.textContent = label;
    }

    const list = byId('formApplicantList');
    if (list) list.setAttribute('aria-label', sync ? '当選者を選択' : '参加者を選択');
  }

  function updateRows() {
    byId('formApplicantList')?.querySelectorAll?.('.form-applicant-sync__row').forEach(row => {
      const checkbox = row.querySelector('cds-checkbox');
      row.classList.toggle('is-selected', checkboxChecked(checkbox));
    });
  }

  function refreshParticipantUi() {
    removeAllocationRegistrationAction();

    const area = byId('participants-view-area');
    if (!area) return false;

    byId('participantsViewDescription')?.remove();
    updateSummary();
    updateRows();
    return true;
  }

  function installParticipantObserver() {
    const area = byId('participants-view-area');
    if (!area || participantAreaObserver) return;

    participantAreaObserver = new MutationObserver(() => {
      queueMicrotask(refreshParticipantUi);
    });
    participantAreaObserver.observe(area, { childList: true, subtree: true });

    const list = byId('formApplicantList');
    list?.addEventListener('cds-checkbox-changed', () => {
      requestAnimationFrame(refreshParticipantUi);
    });
  }

  function start() {
    removeAllocationRegistrationAction();
    if (refreshParticipantUi()) installParticipantObserver();
    else {
      const timer = window.setInterval(() => {
        removeAllocationRegistrationAction();
        if (!refreshParticipantUi()) return;
        window.clearInterval(timer);
        installParticipantObserver();
      }, 100);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
