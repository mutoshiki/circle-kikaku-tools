// Participants selection presentation owner.
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  let participantAreaObserver = null;
  let uiUpdating = false;

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

  function ensureSelectionToolbar() {
    const list = byId('formApplicantList');
    if (!list || byId('participantsSelectionToolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'participantsSelectionToolbar';
    toolbar.className = 'participants-selection-toolbar';
    toolbar.innerHTML = `
      <cds-table-toolbar-search id="participantsSearch" placeholder="名前を検索" label-text="名前を検索"></cds-table-toolbar-search>
      <cds-icon-button id="participantsFilterToggle" kind="ghost" size="lg" align="bottom-right" aria-label="絞り込み" aria-expanded="false">
        <span data-carbon-icon="settings--adjust" slot="icon" aria-hidden="true"></span>
      </cds-icon-button>
      <div id="participantsFilterPanel" class="participants-filter-panel" hidden>
        <cds-select id="participantsSelectionFilter" label-text="選択状態" size="md">
          <cds-select-item value="all" selected>すべて</cds-select-item>
          <cds-select-item value="selected">選択済み</cds-select-item>
          <cds-select-item value="unselected">未選択</cds-select-item>
        </cds-select>
        <cds-select id="participantsGradeFilter" label-text="学年" size="md">
          <cds-select-item value="all" selected>すべて</cds-select-item>
          <cds-select-item value="1">1年</cds-select-item>
          <cds-select-item value="2">2年</cds-select-item>
          <cds-select-item value="3">3年</cds-select-item>
          <cds-select-item value="4">4年</cds-select-item>
        </cds-select>
        <cds-select id="participantsDriverFilter" label-text="車出し" size="md">
          <cds-select-item value="all" selected>すべて</cds-select-item>
          <cds-select-item value="driver">車出し可</cds-select-item>
          <cds-select-item value="no-driver">車出しなし</cds-select-item>
        </cds-select>
      </div>`;
    list.before(toolbar);

    const toggle = byId('participantsFilterToggle');
    toggle?.addEventListener('click', () => {
      const panel = byId('participantsFilterPanel');
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });

    const filter = () => applyFilters();
    const search = byId('participantsSearch');
    search?.addEventListener('cds-search-input', filter);
    search?.addEventListener('input', filter);
    ['participantsSelectionFilter', 'participantsGradeFilter', 'participantsDriverFilter'].forEach(id => {
      byId(id)?.addEventListener('change', filter);
    });
  }

  function currentSearchValue() {
    return String(byId('participantsSearch')?.value || '').trim().toLocaleLowerCase('ja');
  }

  function rowData(row) {
    const checkbox = row.querySelector('cds-checkbox');
    const label = String(checkbox?.getAttribute('label-text') || '').trim();
    const meta = String(row.querySelector('.form-applicant-sync__meta')?.textContent || '').trim();
    const grade = (/([1-4])年/.exec(meta) || [])[1] || '';
    const canDrive = meta.includes('車出し可');
    return { checkbox, label, meta, grade, canDrive, selected: checkboxChecked(checkbox) };
  }

  function filterValue(id) {
    return String(byId(id)?.value || 'all');
  }

  function applyFilters() {
    const query = currentSearchValue();
    const selectionFilter = filterValue('participantsSelectionFilter');
    const gradeFilter = filterValue('participantsGradeFilter');
    const driverFilter = filterValue('participantsDriverFilter');

    byId('formApplicantList')?.querySelectorAll?.('.form-applicant-sync__row').forEach(row => {
      const data = rowData(row);
      const matchesSearch = !query || `${data.label} ${data.meta}`.toLocaleLowerCase('ja').includes(query);
      const matchesSelection = selectionFilter === 'all'
        || (selectionFilter === 'selected' && data.selected)
        || (selectionFilter === 'unselected' && !data.selected);
      const matchesGrade = gradeFilter === 'all' || data.grade === gradeFilter;
      const matchesDriver = driverFilter === 'all'
        || (driverFilter === 'driver' && data.canDrive)
        || (driverFilter === 'no-driver' && !data.canDrive);
      row.hidden = !(matchesSearch && matchesSelection && matchesGrade && matchesDriver);
    });
  }

  function selectionState() {
    const rows = Array.from(byId('formApplicantList')?.querySelectorAll?.('.form-applicant-sync__row') || []);
    const selected = rows.filter(row => checkboxChecked(row.querySelector('cds-checkbox'))).length;
    return { selected, total: rows.length };
  }

  function applyButtonIsDirty() {
    const button = byId('formApplicantApplyBtn');
    return Boolean(button && !button.disabled && !button.hasAttribute('disabled'));
  }

  function ensureStickyState() {
    const actions = document.querySelector('.participants-page__actions');
    if (!actions) return;

    if (!byId('participantsActionCount')) {
      const count = document.createElement('span');
      count.id = 'participantsActionCount';
      count.className = 'participants-action-count';
      actions.prepend(count);
    }

    if (!byId('participantsSavedState')) {
      const saved = document.createElement('span');
      saved.id = 'participantsSavedState';
      saved.className = 'participants-saved-state';
      saved.textContent = '✓ 保存済み';
      saved.hidden = true;
      const button = byId('formApplicantApplyBtn');
      actions.insertBefore(saved, button || null);
    }
  }

  function ensurePostConfirmSection() {
    const page = document.querySelector('.participants-page');
    if (!page) return null;
    let section = byId('participantsPostConfirmSection');
    if (section) return section;

    section = document.createElement('section');
    section.id = 'participantsPostConfirmSection';
    section.className = 'participants-post-confirm';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'participantsPostConfirmTitle');
    section.innerHTML = `
      <h3 id="participantsPostConfirmTitle" class="participants-post-confirm__title">参加者確定後</h3>
      <div id="participantsPostConfirmActions" class="participants-post-confirm__actions"></div>`;

    const status = byId('formApplicantStatus');
    if (status?.parentElement === page) status.insertAdjacentElement('afterend', section);
    else page.appendChild(section);
    return section;
  }

  function ensureHandoffActionPanel(container) {
    const button = byId('handoffExportBtn');
    if (!button || !container) return null;

    let panel = byId('participantsHandoffActionPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'participantsHandoffActionPanel';
      panel.className = 'participants-post-confirm__item participants-handoff-panel';
      panel.innerHTML = `
        <div>
          <h4>学務提出用データ</h4>
          <p>確定した参加者情報を引き継ぎます。</p>
        </div>`;
      container.appendChild(panel);
    }
    if (button.parentElement !== panel) panel.appendChild(button);
    return panel;
  }

  function normalizeAnnouncementPanel(container) {
    const panel = byId('participantAnnouncementPanel');
    if (!panel || !container) return null;

    const description = panel.querySelector('p');
    const text = 'ラクラク連絡網に投稿する文章を作成します。';
    if (description && description.textContent !== text) description.textContent = text;
    if (panel.parentElement !== container) container.appendChild(panel);
    return panel;
  }

  function updatePostConfirmActions() {
    const room = canonical();
    const section = ensurePostConfirmSection();
    const container = byId('participantsPostConfirmActions');
    if (!room || !section || !container) return;

    const announcement = normalizeAnnouncementPanel(container);
    const handoff = ensureHandoffActionPanel(container);
    if (announcement && handoff && announcement.nextElementSibling !== handoff) {
      container.insertBefore(announcement, handoff);
    }

    const participantCount = Object.keys(room.participants || {}).length;
    const ready = Boolean(applicationSync(room) && participantCount > 0 && !applyButtonIsDirty());
    section.hidden = !ready || !(announcement || handoff);
  }

  function updateSummary() {
    const room = canonical();
    const summary = byId('participantsViewSummary');
    if (!room || !summary) return;

    const { selected } = selectionState();
    const participantCount = Object.keys(room.participants || {}).length;
    const dirty = applyButtonIsDirty();
    const summaryText = `参加者 ${participantCount}人`;
    summary.classList.remove('is-manual');
    if (summary.textContent !== summaryText) summary.textContent = summaryText;

    const button = byId('formApplicantApplyBtn');
    if (button) {
      const label = participantCount > 0 ? '変更を保存' : '参加者を確定';
      if (button.textContent !== label) button.textContent = label;
      button.hidden = !dirty;
    }

    const actionCount = byId('participantsActionCount');
    if (actionCount) {
      const countText = `${selected}人を選択中`;
      if (actionCount.textContent !== countText) actionCount.textContent = countText;
    }

    const saved = byId('participantsSavedState');
    if (saved) saved.hidden = dirty || participantCount === 0;

    const list = byId('formApplicantList');
    if (list) list.setAttribute('aria-label', applicationSync(room) ? '当選者を選択' : '参加者を選択');
  }

  function updateRows() {
    byId('formApplicantList')?.querySelectorAll?.('.form-applicant-sync__row').forEach(row => {
      const checkbox = row.querySelector('cds-checkbox');
      row.classList.toggle('is-selected', checkboxChecked(checkbox));
    });
  }

  function refreshParticipantUi() {
    if (uiUpdating) return true;
    uiUpdating = true;
    try {
      removeAllocationRegistrationAction();
      const area = byId('participants-view-area');
      if (!area) return false;

      byId('participantsViewDescription')?.remove();
      ensureSelectionToolbar();
      ensureStickyState();
      updateRows();
      updateSummary();
      updatePostConfirmActions();
      applyFilters();
      return true;
    } finally {
      uiUpdating = false;
    }
  }

  function installParticipantObserver() {
    const area = byId('participants-view-area');
    if (!area || participantAreaObserver) return;

    participantAreaObserver = new MutationObserver(() => queueMicrotask(refreshParticipantUi));
    participantAreaObserver.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

    byId('formApplicantList')?.addEventListener('cds-checkbox-changed', () => {
      requestAnimationFrame(refreshParticipantUi);
    });
    window.addEventListener('sanpo:canonical-room-changed', refreshParticipantUi);
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
