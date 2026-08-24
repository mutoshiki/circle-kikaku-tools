// Participants selection presentation owner.
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  let participantAreaObserver = null;
  let uiUpdating = false;
  let editorOpen = null;
  let selectionTouchedSinceCommit = false;

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

  function ensureParticipantTabOrder() {
    const bar = byId('view-toggle-bar');
    const participants = byId('tab-participants');
    const car = byId('tab-list');
    const team = byId('tab-team');
    const settlement = byId('tab-seisan');
    const sheet = byId('tab-sheet');
    if (!bar || !participants || !car || !team || !settlement || !sheet) return;
    const desired = [participants, car, team, settlement, sheet];
    const current = Array.from(bar.children).filter(node => desired.includes(node));
    if (current.length === desired.length && current.every((node, index) => node === desired[index])) return;
    desired.forEach(node => bar.appendChild(node));
  }

  function ensureSelectionToolbar() {
    const list = byId('formApplicantList');
    if (!list || byId('participantsSelectionToolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'participantsSelectionToolbar';
    toolbar.className = 'participants-selection-toolbar';
    toolbar.innerHTML = `
      <cds-table-toolbar-search id="participantsSearch" placeholder="名前を検索" label-text="名前を検索"></cds-table-toolbar-search>
      <cds-icon-button id="participantsFilterToggle" kind="ghost" size="lg" align="bottom-right" aria-label="絞り込み" title="絞り込み" aria-expanded="false">
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
      </div>
      <div id="participantsActiveFilters" class="participants-active-filters" aria-live="polite" hidden></div>`;
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

  function activeFilterLabels() {
    const labels = [];
    const selection = filterValue('participantsSelectionFilter');
    const grade = filterValue('participantsGradeFilter');
    const driver = filterValue('participantsDriverFilter');
    if (selection === 'selected') labels.push('選択: 選択済み');
    if (selection === 'unselected') labels.push('選択: 未選択');
    if (grade !== 'all') labels.push(`学年: ${grade}年`);
    if (driver === 'driver') labels.push('車出し: 可');
    if (driver === 'no-driver') labels.push('車出し: なし');
    return labels;
  }

  function updateActiveFilters() {
    const labels = activeFilterLabels();
    const host = byId('participantsActiveFilters');
    const toggle = byId('participantsFilterToggle');
    if (host) {
      host.hidden = labels.length === 0;
      host.replaceChildren(...labels.map(label => {
        const tag = document.createElement('cds-tag');
        tag.setAttribute('type', 'blue');
        tag.setAttribute('size', 'sm');
        tag.textContent = label;
        return tag;
      }));
    }
    if (toggle) {
      toggle.classList.toggle('is-filtered', labels.length > 0);
      const label = labels.length ? `絞り込み（${labels.length}件適用）` : '絞り込み';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    }
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
    updateActiveFilters();
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
      <h3 id="participantsPostConfirmTitle" class="participants-post-confirm__title">次の操作</h3>
      <div id="participantsPostConfirmActions" class="participants-post-confirm__actions"></div>`;

    const status = byId('formApplicantStatus');
    if (status?.parentElement === page) status.insertAdjacentElement('afterend', section);
    else page.appendChild(section);
    return section;
  }

  function decorateActionTile(panel, button, description) {
    if (!panel || !button) return;
    panel.classList.add('participants-action-tile');
    panel.setAttribute('role', 'button');
    panel.setAttribute('tabindex', '0');
    panel.querySelector('p')?.replaceChildren(document.createTextNode(description));
    button.classList.add('participants-action-tile__proxy');
    if (!panel.querySelector('.participants-action-tile__arrow')) {
      const arrow = document.createElement('span');
      arrow.className = 'participants-action-tile__arrow';
      arrow.dataset.carbonIcon = 'arrow--right';
      arrow.setAttribute('aria-hidden', 'true');
      panel.appendChild(arrow);
    }
    if (panel.dataset.tileBound !== 'true') {
      const activate = event => {
        if (button.disabled || button.hasAttribute('disabled')) return;
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        if (event.type === 'keydown') event.preventDefault();
        button.click();
      };
      panel.addEventListener('click', event => {
        if (event.target === button || event.target.closest?.('cds-button')) return;
        activate(event);
      });
      panel.addEventListener('keydown', activate);
      panel.dataset.tileBound = 'true';
    }
    const disabled = button.disabled || button.hasAttribute('disabled');
    panel.classList.toggle('is-disabled', disabled);
    panel.setAttribute('aria-disabled', String(disabled));
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
          <p>確定した参加者情報を引き継ぐ</p>
        </div>`;
      container.appendChild(panel);
    }
    if (button.parentElement !== panel) panel.appendChild(button);
    decorateActionTile(panel, button, '確定した参加者情報を引き継ぐ');
    return panel;
  }

  function normalizeAnnouncementPanel(container) {
    const panel = byId('participantAnnouncementPanel');
    if (!panel || !container) return null;
    if (panel.parentElement !== container) container.appendChild(panel);
    const button = byId('participantAnnouncementOpenBtn');
    decorateActionTile(panel, button, 'ラクラク連絡網に投稿する文章を作成');
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

    [announcement, handoff].filter(Boolean).forEach(panel => {
      const button = panel.querySelector('cds-button');
      if (!button) return;
      const disabled = button.disabled || button.hasAttribute('disabled');
      panel.classList.toggle('is-disabled', disabled);
      panel.setAttribute('aria-disabled', String(disabled));
    });

    const participantCount = Object.keys(room.participants || {}).length;
    const ready = Boolean(applicationSync(room) && participantCount > 0 && !applyButtonIsDirty());
    section.hidden = !ready || editorOpen !== false || !(announcement || handoff);
  }

  function renderSummary(summary, { sync, selected, total, participantCount, dirty }) {
    if (!summary) return;
    if (editorOpen === false && participantCount > 0) {
      summary.innerHTML = `
        <span class="participants-summary-primary">参加者 ${participantCount}人</span>
        <span class="participants-confirmed-state">✓ 確定済み</span>
        <cds-button id="participantsEditBtn" kind="ghost" size="sm" type="button">参加者を編集</cds-button>`;
      return;
    }

    const primary = sync ? `応募者 ${total}人` : `参加者 ${selected}人`;
    const secondary = sync ? `${selected}人を選択中` : `${selected}人を選択中`;
    summary.innerHTML = `
      <span class="participants-summary-primary">${primary}</span>
      <span class="participants-summary-secondary">${secondary}</span>
      ${participantCount > 0 && !dirty ? '<cds-button id="participantsCloseEditBtn" kind="ghost" size="sm" type="button">編集を閉じる</cds-button>' : ''}`;
  }

  function updateEditorVisibility({ participantCount, dirty }) {
    if (editorOpen === null) editorOpen = participantCount === 0;
    if (participantCount === 0 || dirty) editorOpen = true;

    const toolbar = byId('participantsSelectionToolbar');
    const list = byId('formApplicantList');
    const actions = document.querySelector('.participants-page__actions');
    const header = document.querySelector('.participants-page__header');
    const editing = editorOpen !== false;
    if (toolbar) toolbar.hidden = !editing;
    if (list) list.hidden = !editing;
    if (actions) actions.hidden = !editing;
    if (header) header.classList.toggle('is-confirmed', !editing && participantCount > 0);
    document.querySelector('.participants-page')?.classList.toggle('is-editing', editing);
  }

  function updateSummary() {
    const room = canonical();
    const summary = byId('participantsViewSummary');
    if (!room || !summary) return;

    const { selected, total } = selectionState();
    const participantCount = Object.keys(room.participants || {}).length;
    const dirty = applyButtonIsDirty();
    updateEditorVisibility({ participantCount, dirty });
    renderSummary(summary, { sync: applicationSync(room), selected, total, participantCount, dirty });

    const button = byId('formApplicantApplyBtn');
    if (button) {
      const label = participantCount > 0 ? '参加者を更新' : '参加者を確定';
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
      const data = rowData(row);
      row.classList.toggle('is-selected', checkboxChecked(checkbox));
      row.dataset.grade = data.grade;
      row.dataset.driver = data.canDrive ? 'true' : 'false';
    });
  }

  function bindPageEvents() {
    const page = document.querySelector('.participants-page');
    if (!page || page.dataset.participantsUiBound === 'true') return;
    page.addEventListener('click', event => {
      if (event.target?.closest?.('#participantsEditBtn')) {
        editorOpen = true;
        refreshParticipantUi();
        requestAnimationFrame(() => byId('participantsSearch')?.focus?.());
      }
      if (event.target?.closest?.('#participantsCloseEditBtn')) {
        editorOpen = false;
        refreshParticipantUi();
      }
    });
    page.dataset.participantsUiBound = 'true';
  }

  function refreshParticipantUi() {
    if (uiUpdating) return true;
    uiUpdating = true;
    try {
      removeAllocationRegistrationAction();
      const area = byId('participants-view-area');
      if (!area) return false;

      byId('participantsViewDescription')?.remove();
      ensureParticipantTabOrder();
      ensureSelectionToolbar();
      ensureStickyState();
      ensurePostConfirmSection();
      bindPageEvents();
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
      selectionTouchedSinceCommit = true;
      editorOpen = true;
      requestAnimationFrame(refreshParticipantUi);
    });
    window.addEventListener('sanpo:canonical-room-changed', () => {
      queueMicrotask(() => {
        const participantCount = Object.keys(canonical()?.participants || {}).length;
        if (selectionTouchedSinceCommit && participantCount > 0 && !applyButtonIsDirty()) {
          editorOpen = false;
          selectionTouchedSinceCommit = false;
        }
        refreshParticipantUi();
      });
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
