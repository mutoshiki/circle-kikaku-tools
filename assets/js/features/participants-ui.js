// Participants selection presentation owner.
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  let participantAreaObserver = null;
  let uiUpdating = false;
  let editingConfirmedSelection = false;
  let pendingCollapseAfterSave = false;

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

  function ensureHeaderSummaryLayout() {
    const header = document.querySelector('.participants-page__header');
    const summary = byId('participantsViewSummary');
    if (!header || !summary) return;
    let heading = header.querySelector('.participants-page__heading');
    if (!heading) {
      heading = header.firstElementChild;
      if (heading) heading.classList.add('participants-page__heading');
    }
    if (heading && summary.parentElement !== heading) heading.appendChild(summary);
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
      <div id="participantsActiveFilters" class="participants-active-filters" aria-live="polite" hidden></div>
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

  function activeFilterLabels() {
    const labels = [];
    const selection = filterValue('participantsSelectionFilter');
    const grade = filterValue('participantsGradeFilter');
    const driver = filterValue('participantsDriverFilter');
    if (selection === 'selected') labels.push('選択済み');
    if (selection === 'unselected') labels.push('未選択');
    if (/^[1-4]$/.test(grade)) labels.push(`${grade}年`);
    if (driver === 'driver') labels.push('車出し可');
    if (driver === 'no-driver') labels.push('車出しなし');
    return labels;
  }

  function updateActiveFilters() {
    const container = byId('participantsActiveFilters');
    const toggle = byId('participantsFilterToggle');
    if (!container || !toggle) return;
    const labels = activeFilterLabels();
    const signature = labels.join('|');
    if (container.dataset.filterSignature !== signature) {
      container.replaceChildren(...labels.map(label => {
        const tag = document.createElement('cds-tag');
        tag.setAttribute('type', 'gray');
        tag.setAttribute('size', 'sm');
        tag.textContent = label;
        return tag;
      }));
      container.dataset.filterSignature = signature;
    }
    container.hidden = labels.length === 0;
    toggle.dataset.activeFilterCount = labels.length ? String(labels.length) : '';
    const ariaLabel = labels.length ? `絞り込み、${labels.length}件適用中` : '絞り込み';
    const title = labels.length ? `${labels.length}件の絞り込みを適用中` : '絞り込み';
    if (toggle.getAttribute('aria-label') !== ariaLabel) toggle.setAttribute('aria-label', ariaLabel);
    if (toggle.getAttribute('title') !== title) toggle.setAttribute('title', title);
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

  function ensureActionState() {
    const actions = document.querySelector('.participants-page__actions');
    if (!actions) return;

    if (!byId('participantsActionCount')) {
      const count = document.createElement('span');
      count.id = 'participantsActionCount';
      count.className = 'participants-action-count';
      actions.prepend(count);
    }

    byId('participantsSavedState')?.remove();

    const button = byId('formApplicantApplyBtn');
    if (button && !button.dataset.participantsCollapseBound) {
      button.dataset.participantsCollapseBound = 'true';
      button.addEventListener('click', () => {
        pendingCollapseAfterSave = true;
      }, { capture: true });
    }
  }

  function ensureConfirmedControls() {
    const header = document.querySelector('.participants-page__header');
    if (!header) return null;
    let controls = byId('participantsConfirmedControls');
    if (controls) return controls;

    controls = document.createElement('div');
    controls.id = 'participantsConfirmedControls';
    controls.className = 'participants-confirmed-controls';
    controls.hidden = true;
    controls.innerHTML = `
      <cds-tag id="participantsConfirmedTag" type="green" size="sm">確定済み</cds-tag>
      <cds-button id="participantsEditToggle" kind="ghost" size="sm" type="button" aria-expanded="false">参加者を編集</cds-button>`;
    const manualAdd = byId('participantManualAddBtn');
    header.insertBefore(controls, manualAdd || null);
    byId('participantsEditToggle')?.addEventListener('click', () => {
      if (applyButtonIsDirty()) return;
      editingConfirmedSelection = !editingConfirmedSelection;
      pendingCollapseAfterSave = false;
      refreshParticipantUi();
    });
    return controls;
  }

  function updateConfirmedPresentation() {
    const room = canonical();
    const page = document.querySelector('.participants-page');
    const controls = ensureConfirmedControls();
    if (!room || !page || !controls) return;

    const dirty = applyButtonIsDirty();
    const managed = Boolean(applicationSync(room));
    const participantCount = Object.keys(room.participants || {}).length;
    const confirmed = managed && participantCount > 0;

    if (!confirmed) {
      editingConfirmedSelection = false;
      pendingCollapseAfterSave = false;
    } else if (dirty) {
      editingConfirmedSelection = true;
    } else if (pendingCollapseAfterSave) {
      editingConfirmedSelection = false;
      pendingCollapseAfterSave = false;
    }

    const collapsed = confirmed && !dirty && !editingConfirmedSelection;
    page.classList.toggle('is-confirmed-collapsed', collapsed);
    page.classList.toggle('is-confirmed-editing', confirmed && !collapsed);
    page.classList.toggle('is-selection-dirty', dirty);
    controls.hidden = !confirmed;

    const editButton = byId('participantsEditToggle');
    if (editButton) {
      const editLabel = collapsed ? '参加者を編集' : '編集を閉じる';
      if (editButton.textContent !== editLabel) editButton.textContent = editLabel;
      const currentlyDisabled = editButton.disabled || editButton.hasAttribute('disabled');
      if (currentlyDisabled !== dirty) {
        editButton.disabled = dirty;
        editButton.toggleAttribute('disabled', dirty);
      }
      const expanded = String(!collapsed);
      if (editButton.getAttribute('aria-expanded') !== expanded) editButton.setAttribute('aria-expanded', expanded);
      const title = dirty
        ? '変更を保存すると編集画面を閉じられます。'
        : (collapsed ? '参加者の選択を編集' : '参加者の編集を閉じる');
      if (editButton.getAttribute('title') !== title) editButton.setAttribute('title', title);
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
          <h4>引き継ぎデータ</h4>
          <p>学務提出書類作成ツールに読み込むための引き継ぎデータを作成します。</p>
          <p id="handoffExportReason" class="participants-handoff-reason" hidden></p>
        </div>`;
      container.appendChild(panel);
    }
    if (button.getAttribute('kind') !== 'ghost') button.setAttribute('kind', 'ghost');
    if (button.getAttribute('size') !== 'lg') button.setAttribute('size', 'lg');
    if (button.parentElement !== panel) panel.appendChild(button);
    return panel;
  }

  function normalizeAnnouncementPanel(container) {
    const panel = byId('participantAnnouncementPanel');
    if (!panel || !container) return null;

    const description = panel.querySelector('p');
    const text = 'らくらく連絡網に投稿する参加者発表文を作成します。';
    if (description && description.textContent !== text) description.textContent = text;
    const button = byId('participantAnnouncementOpenBtn');
    if (button?.getAttribute('kind') !== 'ghost') button?.setAttribute('kind', 'ghost');
    if (button?.getAttribute('size') !== 'lg') button?.setAttribute('size', 'lg');
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
    const dirty = applyButtonIsDirty();
    const ready = Boolean(
      applicationSync(room)
      && participantCount > 0
      && !dirty
      && !editingConfirmedSelection
    );
    section.hidden = !ready || !(announcement || handoff);
  }

  function updateSummary() {
    const room = canonical();
    const summary = byId('participantsViewSummary');
    if (!room || !summary) return;

    const { selected, total } = selectionState();
    const participantCount = Object.keys(room.participants || {}).length;
    const managed = Boolean(applicationSync(room));
    const dirty = applyButtonIsDirty();
    const summaryText = managed && participantCount === 0
      ? `応募者 ${total}人`
      : `参加者 ${participantCount}人`;
    summary.classList.remove('is-manual');
    if (summary.textContent !== summaryText) summary.textContent = summaryText;

    const actions = document.querySelector('.participants-page__actions');
    if (actions) actions.hidden = !dirty;

    const button = byId('formApplicantApplyBtn');
    if (button) {
      const label = participantCount > 0
        ? `${selected}人を参加者として保存`
        : `${selected}人を参加者として確定`;
      if (button.textContent !== label) button.textContent = label;
      button.hidden = !dirty;
    }

    const actionCount = byId('participantsActionCount');
    if (actionCount) {
      const countText = participantCount > 0
        ? `参加者 ${participantCount}人 → ${selected}人`
        : `${selected}人を選択中`;
      if (actionCount.textContent !== countText) actionCount.textContent = countText;
    }

    const list = byId('formApplicantList');
    if (list) {
      list.setAttribute('role', 'list');
      list.setAttribute('aria-label', managed ? '応募者から参加者を選択' : '参加者を選択');
    }
  }

  function updateRows() {
    const room = canonical();
    const dirty = applyButtonIsDirty();
    byId('formApplicantList')?.querySelectorAll?.('.form-applicant-sync__row').forEach(row => {
      const checkbox = row.querySelector('cds-checkbox');
      const checked = checkboxChecked(checkbox);
      const label = String(checkbox?.getAttribute('label-text') || '').trim();
      const participantId = label
        ? window.SanpoCanonicalState?.findParticipantIdByName?.(room?.participants || {}, label) || ''
        : '';
      const pendingRemoval = Boolean(dirty && participantId && !checked);
      row.classList.toggle('is-selected', checked);
      row.classList.toggle('is-pending-removal', pendingRemoval);
      row.setAttribute('role', 'listitem');

      const person = row.querySelector('.form-applicant-sync__person');
      let removal = row.querySelector('.participants-pending-removal');
      if (pendingRemoval && person && !removal) {
        removal = document.createElement('span');
        removal.className = 'participants-pending-removal';
        removal.textContent = '参加者から外す予定';
        person.appendChild(removal);
      } else if (!pendingRemoval && removal) {
        removal.remove();
      }
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
      ensureHeaderSummaryLayout();
      ensureSelectionToolbar();
      ensureActionState();
      ensureConfirmedControls();
      updateRows();
      updateSummary();
      updateConfirmedPresentation();
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
