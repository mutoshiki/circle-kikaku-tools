// Direct form applicant sync (v2).
// Managed forms are attached to a planning room when they are created. Form answers
// live as applicants; only organizer-selected applicants become canonical participants.

(() => {
  'use strict';

  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const POLL_MS = 1200;
  let lastRenderKey = '';
  let syncingAcceptedDrivers = false;
  let liveApplicationSync = null;
  let applicationUnsubscribe = null;

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
        setStatus('応募フォームとの接続が切れました。再接続を待っています。', 'warning');
      }
    );
  }

  function ensureUi() {
    const modal = byIdSafe('batchImportModal');
    const helper = modal?.querySelector('.batch-import-helper-card');
    if (!modal || !helper) return false;

    if (!byIdSafe('formApplicantPanel')) {
      const panel = document.createElement('section');
      panel.id = 'formApplicantPanel';
      panel.className = 'form-applicant-sync';
      panel.innerHTML = `
        <div class="form-applicant-sync__heading-row">
          <div>
            <div class="form-applicant-sync__heading">応募者</div>
            <p class="form-applicant-sync__description">応募フォームの回答は自動でここに届きます。当選者だけを選ぶと、車割・班割・精算で共通して使う参加者になります。</p>
          </div>
          <span id="formApplicantCount" class="form-applicant-sync__count"></span>
        </div>
        <div id="formApplicantList" class="form-applicant-sync__list" role="list"></div>
        <div class="form-applicant-sync__actions">
          <cds-button id="formApplicantSelectAllBtn" kind="ghost" size="md" type="button">未確定を全員選択</cds-button>
          <cds-button id="formApplicantClearBtn" kind="ghost" size="md" type="button">選択を解除</cds-button>
          <cds-button id="formApplicantAcceptBtn" kind="primary" size="md" type="button">選択した人を参加者にする</cds-button>
        </div>
        <p id="formApplicantStatus" class="form-applicant-sync__status" aria-live="polite"></p>
      `;
      helper.insertBefore(panel, helper.firstChild);
      byIdSafe('formApplicantSelectAllBtn')?.addEventListener('click', selectAllPending);
      byIdSafe('formApplicantClearBtn')?.addEventListener('click', clearSelection);
      byIdSafe('formApplicantAcceptBtn')?.addEventListener('click', acceptSelected);
    }
    return true;
  }

  function setManagedMode(enabled) {
    const modal = byIdSafe('batchImportModal');
    if (!modal) return;
    modal.dataset.formApplicantMode = enabled ? 'true' : 'false';

    const title = byIdSafe('batchImportModalTitle');
    if (title) title.textContent = enabled ? '応募者' : '参加者登録';

    const openButton = byIdSafe('batchOpenBtn');
    const openLabel = openButton?.querySelector('span:last-child');
    if (openLabel) openLabel.textContent = enabled ? '応募者' : '参加者登録';

    const execute = byIdSafe('executeBatchBtn');
    if (execute) execute.hidden = enabled;
    const secondary = execute?.parentElement?.querySelector('[data-modal-close]');
    if (secondary) secondary.textContent = enabled ? '閉じる' : 'キャンセル';
  }

  function setStatus(message, tone = 'neutral') {
    const status = byIdSafe('formApplicantStatus');
    if (!status) return;
    status.textContent = String(message || '');
    status.dataset.tone = tone;
  }

  function setBusy(value) {
    ['formApplicantSelectAllBtn', 'formApplicantClearBtn', 'formApplicantAcceptBtn'].forEach(id => {
      const button = byIdSafe(id);
      if (!button) return;
      button.disabled = Boolean(value);
      if (value) button.setAttribute('disabled', '');
      else button.removeAttribute('disabled');
    });
  }

  function render(force = false) {
    if (!ensureUi()) return;
    const room = canonical();
    const sync = applicationSync(room);
    const managed = Boolean(sync);
    setManagedMode(managed);

    const panel = byIdSafe('formApplicantPanel');
    if (panel) panel.hidden = !managed;
    if (!managed) {
      lastRenderKey = '';
      return;
    }

    const entries = applicantEntries(sync);
    const acceptedIds = entries.map(([, applicant]) => participantIdForApplicant(room, applicant)).filter(Boolean);
    const key = JSON.stringify({
      syncedAt: Number(sync.syncedAt || 0),
      responseCount: Number(sync.responseCount || 0),
      acceptedIds: acceptedIds.sort(),
      revision: Number(room?.revision || 0)
    });
    if (!force && key === lastRenderKey) return;
    lastRenderKey = key;

    const count = byIdSafe('formApplicantCount');
    if (count) count.textContent = `${entries.length}人`;
    const list = byIdSafe('formApplicantList');
    if (!list) return;
    list.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'form-applicant-sync__empty';
      empty.textContent = 'まだ応募はありません。回答が届くと自動で表示されます。';
      list.appendChild(empty);
    } else {
      entries.forEach(([responseKey, applicant]) => {
        const accepted = Boolean(participantIdForApplicant(room, applicant));
        const row = document.createElement('div');
        row.className = `form-applicant-sync__row${accepted ? ' is-accepted' : ''}`;
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <cds-checkbox data-form-applicant-key="${escapeHtml(responseKey)}" label-text="${escapeHtml(applicant.name)}" ${accepted ? 'checked disabled' : ''}></cds-checkbox>
          <div class="form-applicant-sync__person">
            <div class="form-applicant-sync__name">${escapeHtml(applicant.name)}</div>
            <div class="form-applicant-sync__meta">${escapeHtml(applicantMeta(applicant))}</div>
          </div>
          <span class="form-applicant-sync__state">${accepted ? '参加者' : '未確定'}</span>
        `;
        list.appendChild(row);
      });
    }

    const acceptedCount = entries.filter(([, applicant]) => participantIdForApplicant(room, applicant)).length;
    setStatus(`応募 ${entries.length}人 / 参加者 ${acceptedCount}人 / 未確定 ${Math.max(0, entries.length - acceptedCount)}人`, 'success');
  }

  function selectedKeys() {
    return [...document.querySelectorAll('#formApplicantList cds-checkbox[data-form-applicant-key]')]
      .filter(checkbox => !checkbox.disabled && (checkbox.checked || checkbox.hasAttribute('checked')))
      .map(checkbox => String(checkbox.dataset.formApplicantKey || ''))
      .filter(Boolean);
  }

  function selectAllPending() {
    document.querySelectorAll('#formApplicantList cds-checkbox[data-form-applicant-key]:not([disabled])').forEach(checkbox => {
      checkbox.checked = true;
      checkbox.setAttribute('checked', '');
    });
  }

  function clearSelection() {
    document.querySelectorAll('#formApplicantList cds-checkbox[data-form-applicant-key]:not([disabled])').forEach(checkbox => {
      checkbox.checked = false;
      checkbox.removeAttribute('checked');
    });
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
    });
  }

  async function acceptSelected() {
    const keys = selectedKeys();
    if (!keys.length) {
      setStatus('参加者にする応募者を選択してください。', 'warning');
      return;
    }

    const room = canonical();
    const sync = applicationSync(room);
    if (!room || !sync) return;

    setBusy(true);
    try {
      room.participants = room.participants || {};
      room.participantTombstones = room.participantTombstones || {};
      const now = window.SanpoClock?.now?.() ?? Date.now();
      const newParticipantIds = [];
      let acceptedNow = 0;

      keys.forEach(responseKey => {
        const applicant = sync.applicants?.[responseKey];
        if (!applicant?.name || participantIdForApplicant(room, applicant)) return;

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
        acceptedNow += 1;
      });

      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.car, room.participants);
      window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations?.team, room.participants);
      persist(room);
      newParticipantIds.forEach(id => {
        const name = room.participants?.[id]?.name;
        if (name) detectGender(name);
      });
      clearSelection();
      setStatus(`${acceptedNow}人を参加者にしました。`, 'success');
    } catch (error) {
      console.error('Applicant acceptance failed:', error);
      setStatus(error?.message || '参加者への反映に失敗しました。', 'error');
    } finally {
      setBusy(false);
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
      if (participant && !Number(participant.grade) && grade) {
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
    window.setInterval(tick, POLL_MS);
  }

  window.SanpoApplicantSync = Object.freeze({
    render: () => render(true),
    acceptSelected: () => acceptSelected()
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
