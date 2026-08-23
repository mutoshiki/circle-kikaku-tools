// Direct form applicant sync (v2).
// Managed form answers live as applicants; only organizer-selected applicants become canonical participants.
// Participant selection is owned by the dedicated Participants view.

(() => {
  'use strict';

  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const POLL_MS = 1200;
  let lastRenderKey = '';
  let syncingAcceptedDrivers = false;
  let liveApplicationSync = null;
  let applicationUnsubscribe = null;
  let selectionDirty = false;
  let baseSwitchView = null;
  let participantNavObserver = null;

  const byIdSafe = id => document.getElementById(id);

  function canonical() {
    return window.SanpoCanonicalState?.get?.() || null;
  }

  function validApplicationSync(sync) {
    return !!sync
      && sync.kind === APPLICATION_KIND
      && Number(sync.version || 0) === APPLICATION_VERSION;
  }

  function applicationSync(room = canonical()) {
    if (validApplicationSync(liveApplicationSync)) return liveApplicationSync;
    const sync = room?.meta?.applicationSync;
    return validApplicationSync(sync) ? sync : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applicantMeta(applicant) {
    const parts = [];
    const grade = Math.max(0, Math.min(4, parseInt(applicant?.grade, 10) || 0));
    if (grade) parts.push(`${grade}年`);
    if (applicant?.canDrive) {
      const capacity = Math.max(0, Math.min(20, parseInt(applicant?.capacity, 10) || 0));
      parts.push(capacity ? `車出し可・同乗${capacity}人` : '車出し可');
    } else {
      parts.push('車出しなし');
    }
    return parts.join(' ・ ');
  }

  function participantMeta(participant) {
    const grade = Math.max(0, Math.min(4, parseInt(participant?.grade, 10) || 0));
    return grade ? `${grade}年` : '';
  }

  function applicantEntries(sync = applicationSync()) {
    return Object.entries(sync?.applicants || {})
      .filter(([, applicant]) => applicant?.name)
      .sort(([, a], [, b]) => {
        const timeDiff = Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0);
        return timeDiff || String(a?.name || '').localeCompare(String(b?.name || ''), 'ja');
      });
  }

  function participantIdForApplicant(room, applicant) {
    if (!room || !applicant?.name) return '';
    return window.SanpoCanonicalState?.findParticipantIdByName?.(room.participants || {}, applicant.name) || '';
  }

  function checkboxChecked(checkbox) {
    const native = checkbox?.shadowRoot?.querySelector?.('input[type="checkbox"]');
    if (native && typeof native.checked === 'boolean') return native.checked;
    if (typeof checkbox?.checked === 'boolean') return checkbox.checked;
    return Boolean(checkbox?.hasAttribute?.('checked'));
  }

  function captureDraftSelection() {
    const applicant = new Map();
    document.querySelectorAll('#formApplicantList cds-checkbox[data-form-applicant-key]').forEach(checkbox => {
      applicant.set(String(checkbox.dataset.formApplicantKey || ''), checkboxChecked(checkbox));
    });
    const manual = new Map();
    document.querySelectorAll('#formApplicantList cds-checkbox[data-manual-participant-id]').forEach(checkbox => {
      manual.set(String(checkbox.dataset.manualParticipantId || ''), checkboxChecked(checkbox));
    });
    return { applicant, manual };
  }

  function participantCheckboxFromEvent(event) {
    const selector = 'cds-checkbox[data-form-applicant-key], cds-checkbox[data-manual-participant-id]';
    if (event.target?.matches?.(selector)) return event.target;
    return event.composedPath?.().find(node => node?.matches?.(selector)) || null;
  }

  function markSelectionDirty(event) {
    if (!participantCheckboxFromEvent(event)) return;
    selectionDirty = true;
    updateApplyButton();
    queueMicrotask(syncParticipantNavigationState);
    requestAnimationFrame(syncParticipantNavigationState);
  }

  function ensureParticipantViewArea() {
    let area = byIdSafe('participants-view-area');
    if (area) return area;

    area = document.createElement('section');
    area.id = 'participants-view-area';
    area.className = 'participants-view-area';
    area.hidden = true;
    area.setAttribute('aria-labelledby', 'participantsViewTitle');
    area.innerHTML = `
      <div class="participants-page">
        <div class="participants-page__header">
          <div>
            <h2 id="participantsViewTitle" class="participants-page__title">参加者</h2>
            <p id="participantsViewDescription" class="participants-page__description">参加者を追加してください。</p>
          </div>
          <cds-button id="participantManualAddBtn" kind="ghost" size="md" type="button">追加</cds-button>
        </div>
        <div id="participantsViewSummary" class="participants-page__summary" aria-live="polite"></div>
        <div id="formApplicantList" class="form-applicant-sync__list" role="group" aria-label="参加者を選択"></div>
        <div class="participants-page__actions">
          <cds-button id="formApplicantApplyBtn" kind="primary" size="lg" type="button" disabled>選択を反映</cds-button>
        </div>
        <p id="formApplicantStatus" class="participants-page__status" aria-live="polite"></p>
      </div>`;

    const anchor = byIdSafe('seisan-view-area');
    if (anchor?.parentElement) anchor.parentElement.insertBefore(area, anchor);
    else byIdSafe('app')?.appendChild(area);

    byIdSafe('formApplicantApplyBtn')?.addEventListener('click', applySelection);
    byIdSafe('participantManualAddBtn')?.addEventListener('click', () => {
      const modal = byIdSafe('batchImportModal');
      const title = byIdSafe('batchImportModalTitle');
      if (title) title.textContent = '参加者を追加';
      if (modal) modal.setAttribute('aria-label', '参加者を追加');
      window.openBatchModal?.();
    });
    const list = byIdSafe('formApplicantList');
    list?.addEventListener('change', markSelectionDirty);
    list?.addEventListener('cds-checkbox-changed', markSelectionDirty);
    return area;
  }

  function ensureParticipantTab() {
    const bar = byIdSafe('view-toggle-bar');
    if (!bar) return false;
    let tab = byIdSafe('tab-participants');
    if (!tab) {
      tab = document.createElement('cds-tab');
      tab.id = 'tab-participants';
      tab.className = 'view-tab';
      tab.setAttribute('value', 'participants');
      tab.setAttribute('aria-label', '参加者');
      tab.innerHTML = '<span class="view-tab-label">参加者</span>';
      bar.appendChild(tab);
      tab.addEventListener('click', event => {
        event.preventDefault();
        void showParticipantsView();
      });
    }
    bar.dataset.carbonFiveViewNav = 'true';
    return true;
  }

  function syncParticipantNavigationState() {
    const active = document.body.classList.contains('view-mode-participants');
    const participantTab = byIdSafe('tab-participants');
    if (!participantTab) return;

    if (!active) {
      participantTab.classList.remove('active');
      participantTab.removeAttribute('selected');
      participantTab.removeAttribute('aria-current');
      if ('selected' in participantTab) participantTab.selected = false;
      return;
    }

    ['tab-sheet', 'tab-seisan', 'tab-list', 'tab-team'].forEach(id => {
      const tab = byIdSafe(id);
      if (!tab) return;
      tab.classList.remove('active');
      tab.removeAttribute('selected');
      tab.removeAttribute('aria-current');
      if ('selected' in tab) tab.selected = false;
    });

    participantTab.classList.add('active');
    participantTab.setAttribute('selected', '');
    participantTab.setAttribute('aria-current', 'page');
    if ('selected' in participantTab) participantTab.selected = true;

    const bar = byIdSafe('view-toggle-bar');
    if (bar) {
      bar.setAttribute('value', 'participants');
      if ('value' in bar) bar.value = 'participants';
    }
  }

  function hideParticipantsView() {
    const area = byIdSafe('participants-view-area');
    if (area) {
      area.hidden = true;
      area.classList.remove('active');
    }
    document.body.classList.remove('view-mode-participants');
    syncParticipantNavigationState();
  }

  function restoreAllocationVisibility() {
    const room = canonical();
    const hasParticipants = Object.keys(room?.participants || {}).length > 0;
    const bottomTray = byIdSafe('bottom-tray');
    if (bottomTray) bottomTray.hidden = !hasParticipants;
    window.updateUI?.();
  }

  async function showParticipantsView() {
    ensureParticipantViewArea();
    ensureParticipantTab();
    try {
      if (typeof completeQuickEdit === 'function') completeQuickEdit({ showNotice: false, rerender: false });
    } catch (_) {}

    document.body.classList.remove('view-mode-list', 'view-mode-sheet', 'view-mode-seisan', 'sheet-mode');
    document.body.classList.add('view-mode-participants');
    const listArea = byIdSafe('top-area');
    const sheetArea = byIdSafe('sheet-view-area');
    const seisanArea = byIdSafe('seisan-view-area');
    const bottomTray = byIdSafe('bottom-tray');
    const participantArea = byIdSafe('participants-view-area');
    if (listArea) { listArea.hidden = true; listArea.style.display = 'none'; }
    if (sheetArea) { sheetArea.hidden = true; sheetArea.classList.remove('active'); }
    if (seisanArea) { seisanArea.hidden = true; seisanArea.classList.remove('active'); }
    if (bottomTray) { bottomTray.hidden = true; bottomTray.style.display = 'none'; }
    if (participantArea) { participantArea.hidden = false; participantArea.classList.add('active'); }

    const url = new URL(window.location.href);
    url.searchParams.set('view', 'participants');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    syncParticipantNavigationState();
    render(true);
  }

  function installViewBridge() {
    if (!baseSwitchView && typeof window.switchView === 'function') {
      baseSwitchView = window.switchView;
      window.switchView = async function participantAwareSwitchView(view) {
        if (view === 'participants') return showParticipantsView();
        hideParticipantsView();
        const result = await baseSwitchView(view);
        if (view === 'list') restoreAllocationVisibility();
        return result;
      };
    }
    if (!participantNavObserver) {
      participantNavObserver = new MutationObserver(() => syncParticipantNavigationState());
      participantNavObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    window.SanpoApp?.registerActions?.({
      'open-participants': () => showParticipantsView()
    });
  }

  async function waitForFirebaseReady(timeoutMs = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (firebaseReady && db && ref && onValue) return true;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return false;
  }

  async function subscribeApplicationSync() {
    if (!await waitForFirebaseReady()) return;
    if (typeof applicationUnsubscribe === 'function') return;

    applicationUnsubscribe = onValue(
      ref(db, `rooms/${roomId}/meta/applicationSync`),
      snapshot => {
        const next = snapshot.val();
        liveApplicationSync = validApplicationSync(next) ? next : null;
        render(true);
        syncAcceptedDriverCapacities();
      },
      error => {
        console.error('Applicant sync listener failed:', error);
        window.AppUI?.showStatus?.('応募フォームとの接続を確認できません。', { tone: 'warning' });
      }
    );
  }

  function ensureUi() {
    ensureParticipantViewArea();
    ensureParticipantTab();
    installViewBridge();
    return Boolean(byIdSafe('participants-view-area') && byIdSafe('tab-participants'));
  }

  function currentApplicantParticipantIds(room, sync) {
    return new Set(applicantEntries(sync).map(([, applicant]) => participantIdForApplicant(room, applicant)).filter(Boolean));
  }

  function updateApplyButton() {
    const button = byIdSafe('formApplicantApplyBtn');
    if (!button) return;
    button.disabled = !selectionDirty;
    button.toggleAttribute('disabled', !selectionDirty);
  }

  function render(force = false) {
    if (!ensureUi()) return;
    const room = canonical();
    if (!room) return;
    const sync = applicationSync(room);
    const entries = applicantEntries(sync);
    const acceptedIds = currentApplicantParticipantIds(room, sync);
    const manualEntries = Object.entries(room.participants || {})
      .filter(([id]) => !acceptedIds.has(id))
      .sort(([, a], [, b]) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ja'));
    const key = JSON.stringify({
      syncedAt: Number(sync?.syncedAt || 0),
      responseCount: Number(sync?.responseCount || 0),
      participantIds: Object.keys(room.participants || {}).sort(),
      revision: Number(room?.revision || 0)
    });
    if (!force && key === lastRenderKey) return;
    lastRenderKey = key;

    const draft = selectionDirty ? captureDraftSelection() : { applicant: new Map(), manual: new Map() };
    const description = byIdSafe('participantsViewDescription');
    if (description) description.textContent = sync
      ? '応募者を確認して、当選者を選んでください。'
      : '参加者を追加してください。';

    const manualAdd = byIdSafe('participantManualAddBtn');
    if (manualAdd) manualAdd.hidden = Boolean(sync);

    const summary = byIdSafe('participantsViewSummary');
    const participantCount = Object.keys(room.participants || {}).length;
    if (summary) summary.textContent = sync
      ? `応募者 ${entries.length}人　参加者 ${participantCount}人`
      : `参加者 ${participantCount}人`;

    const list = byIdSafe('formApplicantList');
    if (!list) return;
    list.replaceChildren();

    entries.forEach(([responseKey, applicant]) => {
      const participantId = participantIdForApplicant(room, applicant);
      const checked = selectionDirty && draft.applicant.has(responseKey)
        ? draft.applicant.get(responseKey)
        : Boolean(participantId);
      const row = document.createElement('div');
      row.className = 'form-applicant-sync__row';
      row.innerHTML = `
        <cds-checkbox data-form-applicant-key="${escapeHtml(responseKey)}" label-text="${escapeHtml(applicant.name)}" ${checked ? 'checked' : ''}></cds-checkbox>
        <div class="form-applicant-sync__person">
          <div class="form-applicant-sync__meta">${escapeHtml(applicantMeta(applicant))}</div>
        </div>`;
      list.appendChild(row);
    });

    manualEntries.forEach(([participantId, participant]) => {
      const checked = selectionDirty && draft.manual.has(participantId)
        ? draft.manual.get(participantId)
        : true;
      const meta = participantMeta(participant);
      const row = document.createElement('div');
      row.className = 'form-applicant-sync__row';
      row.innerHTML = `
        <cds-checkbox data-manual-participant-id="${escapeHtml(participantId)}" label-text="${escapeHtml(participant.name)}" ${checked ? 'checked' : ''}></cds-checkbox>
        <div class="form-applicant-sync__person">
          ${meta ? `<div class="form-applicant-sync__meta">${escapeHtml(meta)}</div>` : ''}
        </div>`;
      list.appendChild(row);
    });

    if (!entries.length && !manualEntries.length) {
      const empty = document.createElement('div');
      empty.className = 'form-applicant-sync__empty';
      empty.textContent = sync ? 'まだ応募はありません。' : '参加者がいません。';
      list.appendChild(empty);
    }
    updateApplyButton();
    syncParticipantNavigationState();
  }

  function makeDriverGroupId(participantId) {
    return `g_car_${String(participantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
  }

  function ensureDriver(room, participantId, applicant, now) {
    if (!applicant?.canDrive || !participantId) return false;
    const allocation = room.allocations?.car;
    if (!allocation) return false;
    allocation.groups = allocation.groups || {};
    allocation.placements = allocation.placements || {};

    const incomingCapacity = Math.max(1, Math.min(20, parseInt(applicant.capacity, 10) || 3));
    const owned = Object.entries(allocation.groups).find(([, group]) => group?.ownerId === participantId);
    const groupId = owned?.[0] || makeDriverGroupId(participantId);
    const existing = owned?.[1] || allocation.groups[groupId];
    let changed = false;

    if (existing) {
      if (Number(existing.capacity || 0) !== incomingCapacity || existing.ownerId !== participantId) changed = true;
      allocation.groups[groupId] = {
        ...existing,
        ownerId: participantId,
        capacity: incomingCapacity,
        updatedAt: changed ? now : Number(existing.updatedAt || now)
      };
    } else {
      allocation.groups[groupId] = {
        id: groupId,
        ownerId: participantId,
        capacity: incomingCapacity,
        order: Object.keys(allocation.groups).length,
        createdAt: now,
        updatedAt: now
      };
      changed = true;
    }

    const previousPlacement = allocation.placements[participantId];
    if (!previousPlacement || previousPlacement.kind !== 'driver' || previousPlacement.groupId !== groupId) {
      allocation.placements[participantId] = {
        kind: 'driver',
        groupId,
        order: Number(allocation.groups[groupId].order || 0),
        updatedAt: now
      };
      changed = true;
    }
    if (changed) allocation.updatedAt = now;
    return changed;
  }

  function persist(room) {
    carPlans = window.SanpoCanonicalState.projectPlans(room);
    const previousSuspend = Boolean(window.__suspendActiveDomPlanSync);
    window.__suspendActiveDomPlanSync = true;
    try {
      save();
    } finally {
      window.__suspendActiveDomPlanSync = previousSuspend;
    }
    queueMicrotask(() => {
      renderActiveCarPlanToDom();
      updateUI();
      render(true);
      syncParticipantNavigationState();
    });
  }

  function participantHasDependentData(room, participantId) {
    const allocationUsed = ['car', 'team'].some(type => {
      const placement = room.allocations?.[type]?.placements?.[participantId];
      return placement && placement.kind !== 'waiting';
    });
    const settlement = room.settlement || {};
    const settlementUsed = Boolean(
      settlement.carsByParticipantId?.[participantId]
      || Object.prototype.hasOwnProperty.call(settlement.paidByParticipantId || {}, participantId)
      || Object.prototype.hasOwnProperty.call(settlement.paidCollectorByParticipantId || {}, participantId)
      || Object.prototype.hasOwnProperty.call(settlement.driverPaidByParticipantId || {}, participantId)
      || settlement.organizerParticipantId === participantId
    );
    return allocationUsed || settlementUsed;
  }

  async function confirmParticipantRemovals(room, ids) {
    const risky = ids.filter(id => participantHasDependentData(room, id));
    if (!risky.length) return true;
    return window.AppUI?.confirm?.(
      '車割・班割・精算の割り当ても削除されます。',
      { title: '参加者から外しますか？', okText: '外す', cancelText: 'キャンセル', danger: true }
    ) ?? false;
  }

  async function applySelection() {
    if (!selectionDirty) return;
    const room = canonical();
    if (!room) return;
    const sync = applicationSync(room);
    const selectedApplicantKeys = new Set(
      [...document.querySelectorAll('#formApplicantList cds-checkbox[data-form-applicant-key]')]
        .filter(checkboxChecked)
        .map(checkbox => String(checkbox.dataset.formApplicantKey || ''))
        .filter(Boolean)
    );
    const selectedManualIds = new Set(
      [...document.querySelectorAll('#formApplicantList cds-checkbox[data-manual-participant-id]')]
        .filter(checkboxChecked)
        .map(checkbox => String(checkbox.dataset.manualParticipantId || ''))
        .filter(Boolean)
    );

    const removals = [];
    applicantEntries(sync).forEach(([responseKey, applicant]) => {
      const participantId = participantIdForApplicant(room, applicant);
      if (participantId && !selectedApplicantKeys.has(responseKey)) removals.push(participantId);
    });
    document.querySelectorAll('#formApplicantList cds-checkbox[data-manual-participant-id]').forEach(checkbox => {
      const id = String(checkbox.dataset.manualParticipantId || '');
      if (id && room.participants?.[id] && !selectedManualIds.has(id)) removals.push(id);
    });

    if (!await confirmParticipantRemovals(room, [...new Set(removals)])) return;

    const applyButton = byIdSafe('formApplicantApplyBtn');
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.setAttribute('disabled', '');
    }
    try {
      room.participants = room.participants || {};
      room.participantTombstones = room.participantTombstones || {};
      const now = window.SanpoClock?.now?.() ?? Date.now();
      [...new Set(removals)].forEach(id => window.SanpoCanonicalState?.deleteParticipant?.(id, { deletedAt: now }));

      const newParticipantIds = [];
      applicantEntries(sync).forEach(([responseKey, applicant]) => {
        if (!selectedApplicantKeys.has(responseKey) || participantIdForApplicant(room, applicant)) return;
        const participantId = window.SanpoCanonicalState.ensureParticipant(
          room.participants,
          {
            name: applicant.name,
            memo: '',
            gender: 'unknown',
            grade: Math.max(0, Math.min(4, parseInt(applicant.grade, 10) || 0)),
            locked: false,
            flag: 'none'
          },
          '',
          room.participantTombstones
        );
        if (!participantId) return;
        newParticipantIds.push(participantId);
        ensureDriver(room, participantId, applicant, now);
      });

      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.car, room.participants);
      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.team, room.participants);
      selectionDirty = false;
      persist(room);
      newParticipantIds.forEach(id => {
        const name = room.participants?.[id]?.name;
        if (name) detectGender(name);
      });
      window.AppUI?.showStatus?.('参加者を更新しました。', { tone: 'success' });
    } catch (error) {
      console.error('Participant selection update failed:', error);
      window.AppUI?.showStatus?.(error?.message || '参加者を更新できませんでした。', { tone: 'error' });
    } finally {
      updateApplyButton();
      render(true);
      syncParticipantNavigationState();
    }
  }

  function syncAcceptedDriverCapacities() {
    if (syncingAcceptedDrivers) return;
    const room = canonical();
    const sync = applicationSync(room);
    if (!room || !sync) return;

    const now = window.SanpoClock?.now?.() ?? Date.now();
    let changed = false;
    applicantEntries(sync).forEach(([, applicant]) => {
      const participantId = participantIdForApplicant(room, applicant);
      if (!participantId) return;

      const participant = room.participants?.[participantId];
      const grade = Math.max(0, Math.min(4, parseInt(applicant.grade, 10) || 0));
      if (participant && Number(participant.grade || 0) !== grade && grade) {
        participant.grade = grade;
        participant.updatedAt = now;
        changed = true;
      }
      if (applicant.canDrive && ensureDriver(room, participantId, applicant, now)) changed = true;
    });

    if (!changed) return;
    syncingAcceptedDrivers = true;
    try {
      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.car, room.participants || {});
      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.team, room.participants || {});
      persist(room);
    } finally {
      syncingAcceptedDrivers = false;
    }
  }

  function tick() {
    if (!ensureUi()) return;
    syncAcceptedDriverCapacities();
    render();
  }

  function start() {
    if (!ensureUi()) {
      setTimeout(start, 250);
      return;
    }
    render(true);
    void subscribeApplicationSync();
    if (new URLSearchParams(window.location.search).get('view') === 'participants') void showParticipantsView();
    window.setInterval(tick, POLL_MS);
  }

  window.SanpoApplicantSync = Object.freeze({
    render: () => render(true),
    showParticipantsView: () => showParticipantsView(),
    applySelection: () => applySelection()
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();