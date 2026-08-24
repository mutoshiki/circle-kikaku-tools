// Form-linked debug sample for participant-flow QA.
// Adds a sample option to the existing debug modal so managed-form-only UI can be tested
// without creating a real Google Form first.
(() => {
  'use strict';

  const SAMPLE_BUTTON_ID = 'executeFormLinkedDebugBtn';
  const SAMPLE_EVENT_DATE = '2026-09-24';
  const SAMPLE_ROOM_NAME = 'フォーム連携テスト企画';
  const DEBUG_SYNC_STORAGE_PREFIX = 'sanpoFormLinkedDebugSync:v1:';

  const sampleApplicants = [
    { key: 'sample-a1', name: '松本 結月', grade: 4, canDrive: true, capacity: 4 },
    { key: 'sample-a2', name: '佐々木 陽菜', grade: 3, canDrive: false, capacity: 0 },
    { key: 'sample-a3', name: '小林 海斗', grade: 2, canDrive: true, capacity: 3 },
    { key: 'sample-a4', name: '山本 陽翔', grade: 1, canDrive: false, capacity: 0 },
    { key: 'sample-a5', name: '田中 結衣', grade: 1, canDrive: false, capacity: 0 }
  ];

  function sampleMembers() {
    return sampleApplicants.map(applicant => ({
      name: applicant.name,
      memo: '',
      gender: 'unknown',
      grade: applicant.grade,
      locked: false,
      flag: 'none'
    }));
  }

  function createFormLinkedSampleData() {
    const now = window.SanpoClock?.now?.() ?? Date.now();
    const members = sampleMembers();
    const applicants = Object.fromEntries(sampleApplicants.map((applicant, index) => [
      applicant.key,
      {
        name: applicant.name,
        grade: applicant.grade,
        canDrive: applicant.canDrive,
        capacity: applicant.capacity,
        updatedAt: now + index
      }
    ]));

    return {
      schemaVersion: typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 6,
      roomName: SAMPLE_ROOM_NAME,
      trayMinimized: false,
      editLockEnabled: false,
      editLockPassphrase: '',
      editLockScopes: { allocation: false, settlement: false },
      activeCarPlanId: 'plan-car',
      carPlans: [
        {
          id: 'plan-car',
          name: '車割',
          templateType: 'car',
          waiting: members,
          cars: [],
          lastAutoAssignLabel: ''
        },
        {
          id: 'plan-team',
          name: '班割',
          templateType: 'team',
          waiting: members,
          cars: [],
          lastAutoAssignLabel: ''
        }
      ],
      waiting: members,
      cars: [],
      settlement: {},
      overview: {
        memo: 'フォーム連携機能の確認用サンプルです。',
        timetableItems: []
      },
      meta: {
        applicationSync: {
          kind: 'formApplicationSync',
          version: 2,
          title: SAMPLE_ROOM_NAME,
          eventDate: SAMPLE_EVENT_DATE,
          responseCount: sampleApplicants.length,
          syncedAt: now,
          applicants
        }
      },
      lastUpdatedAt: now,
      lastUpdatedBy: typeof myClientId !== 'undefined' ? myClientId : 'debug-sample'
    };
  }

  function debugSyncStorageKey() {
    return `${DEBUG_SYNC_STORAGE_PREFIX}${typeof roomId !== 'undefined' ? roomId : 'local'}`;
  }

  function isValidApplicationSync(sync) {
    return !!sync
      && sync.kind === 'formApplicationSync'
      && Number(sync.version || 0) === 2
      && sync.applicants
      && typeof sync.applicants === 'object';
  }

  function storeDebugApplicationSync(sync) {
    if (!isValidApplicationSync(sync)) return;
    try {
      localStorage.setItem(debugSyncStorageKey(), JSON.stringify(sync));
    } catch (error) {
      console.warn('Failed to store form-linked debug sync backup:', error);
    }
  }

  function readDebugApplicationSync() {
    try {
      const raw = localStorage.getItem(debugSyncStorageKey());
      if (!raw) return null;
      const sync = JSON.parse(raw);
      return isValidApplicationSync(sync) ? sync : null;
    } catch (_) {
      return null;
    }
  }

  function attachApplicationSyncToCanonical(sync) {
    if (!isValidApplicationSync(sync)) return false;
    const room = window.SanpoCanonicalState?.get?.();
    if (!room) return false;
    room.meta = room.meta && typeof room.meta === 'object' ? room.meta : {};
    room.meta.applicationSync = JSON.parse(JSON.stringify(sync));
    return true;
  }

  async function waitForFirebaseWrite(timeoutMs = 8000) {
    if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled === false) return false;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled === false) return false;
      if (
        typeof firebaseReady !== 'undefined' && firebaseReady
        && typeof db !== 'undefined' && db
        && typeof ref === 'function'
        && typeof set === 'function'
      ) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async function persistApplicationSyncLikeManagedForm(sync) {
    storeDebugApplicationSync(sync);
    attachApplicationSyncToCanonical(sync);

    const canWriteFirebase = await waitForFirebaseWrite();
    if (!canWriteFirebase) {
      // Awaiting transport readiness gives any queued normal room save a chance to replace
      // the canonical object. The normal save intentionally omits applicationSync, so put
      // the debug-owned metadata back after the await even when Firebase is unavailable.
      attachApplicationSyncToCanonical(sync);
      return false;
    }
    try {
      await set(ref(db, `rooms/${roomId}/meta/applicationSync`), sync);
      // The room listener may paint an older root snapshot while the direct managed-form
      // write is in flight. Re-attach locally after the authoritative path write so the
      // participant and announcement surfaces immediately share the same state.
      attachApplicationSyncToCanonical(sync);
      return true;
    } catch (error) {
      console.warn('Failed to persist form-linked debug application sync:', error);
      attachApplicationSyncToCanonical(sync);
      return false;
    }
  }

  function refreshManagedFormSurfaces() {
    window.SanpoApplicantSync?.render?.();
    window.SanpoParticipantAnnouncement?.refresh?.();
  }

  async function seedFormLinkedSample() {
    try {
      const sampleData = createFormLinkedSampleData();
      const applicationSync = sampleData.meta.applicationSync;
      const migrated = typeof migrateAppData === 'function' ? migrateAppData(sampleData) : sampleData;

      if (typeof roomId !== 'undefined' && typeof CFG !== 'undefined' && typeof L !== 'undefined' && typeof J !== 'undefined') {
        L.setItem(`${CFG.STORE}_${roomId}`, J.stringify(sampleData));
      }
      storeDebugApplicationSync(applicationSync);

      const previousCardSuspend = !!window.__suspendCardUpdateUi;
      const previousDomSyncSuspend = !!window.__suspendActiveDomPlanSync;
      window.__suspendCardUpdateUi = true;
      window.__suspendActiveDomPlanSync = true;
      try {
        if (typeof restore === 'function') restore(migrated);
        else window.SanpoCanonicalState?.set?.(migrated);
      } finally {
        window.__suspendCardUpdateUi = previousCardSuspend;
        window.__suspendActiveDomPlanSync = previousDomSyncSuspend;
      }

      attachApplicationSyncToCanonical(applicationSync);
      window.updateUI?.();
      refreshManagedFormSurfaces();
      if (typeof save === 'function') await Promise.resolve(save());

      // `meta/applicationSync` is deliberately outside the normal room save domain because
      // the application form owns it. The debug sample must therefore write that path just
      // like the real managed-form integration instead of relying on save().
      await persistApplicationSyncLikeManagedForm(applicationSync);
      refreshManagedFormSurfaces();

      window.modals?.debug?.hide?.({ reason: 'submit' });
      window.showAppNotice?.('フォーム連携サンプルを入れました');
      window.requestAnimationFrame(() => {
        if (typeof window.switchView === 'function') void window.switchView('participants');
        window.requestAnimationFrame(refreshManagedFormSurfaces);
      });
    } catch (error) {
      console.error('Failed to seed form-linked sample:', error);
      window.appAlert?.('フォーム連携サンプルを入れられませんでした。画面を更新してもう一度試してください。', {
        title: 'フォーム連携サンプル'
      });
    }
  }

  function rehydrateDebugApplicationSync() {
    const room = window.SanpoCanonicalState?.get?.();
    if (!room || String(room.roomName || '') !== SAMPLE_ROOM_NAME) return false;
    const sync = readDebugApplicationSync();
    if (!sync) return false;
    attachApplicationSyncToCanonical(sync);
    refreshManagedFormSurfaces();
    return true;
  }

  function scheduleDebugRehydrate() {
    if (!readDebugApplicationSync()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (rehydrateDebugApplicationSync() || attempts >= 80) window.clearInterval(timer);
    }, 125);
  }

  function installSampleButton() {
    if (document.getElementById(SAMPLE_BUTTON_ID)) return true;
    const stack = document.querySelector('#debugModal .debug-action-stack');
    if (!stack) return false;

    const button = document.createElement('cds-button');
    button.id = SAMPLE_BUTTON_ID;
    button.kind = 'secondary';
    button.size = 'lg';
    button.type = 'button';
    button.textContent = 'フォーム連携サンプルを入れる';
    button.addEventListener('click', () => { void seedFormLinkedSample(); });
    stack.appendChild(button);
    return true;
  }

  function start() {
    scheduleDebugRehydrate();
    if (installSampleButton()) return;
    const observer = new MutationObserver(() => {
      if (!installSampleButton()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.SanpoFormLinkedDebugSample = Object.freeze({
    seed: seedFormLinkedSample,
    createData: createFormLinkedSampleData,
    rehydrate: rehydrateDebugApplicationSync
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
