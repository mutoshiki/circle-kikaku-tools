// Form-linked debug sample for participant-flow QA.
// Adds a sample option to the existing debug modal so managed-form-only UI can be tested
// without creating a real Google Form first.
(() => {
  'use strict';

  const SAMPLE_BUTTON_ID = 'executeFormLinkedDebugBtn';
  const SAMPLE_EVENT_DATE = '2026-09-24';

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
      roomName: 'フォーム連携テスト企画',
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
          title: 'フォーム連携テスト企画',
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

  function seedFormLinkedSample() {
    try {
      const sampleData = createFormLinkedSampleData();
      const migrated = typeof migrateAppData === 'function' ? migrateAppData(sampleData) : sampleData;

      if (typeof roomId !== 'undefined' && typeof CFG !== 'undefined' && typeof L !== 'undefined' && typeof J !== 'undefined') {
        L.setItem(`${CFG.STORE}_${roomId}`, J.stringify(sampleData));
      }

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

      window.updateUI?.();
      window.SanpoApplicantSync?.render?.();
      if (typeof save === 'function') save();

      window.modals?.debug?.hide?.({ reason: 'submit' });
      window.showAppNotice?.('フォーム連携サンプルを入れました');
      window.requestAnimationFrame(() => {
        if (typeof window.switchView === 'function') void window.switchView('participants');
      });
    } catch (error) {
      console.error('Failed to seed form-linked sample:', error);
      window.appAlert?.('フォーム連携サンプルを入れられませんでした。画面を更新してもう一度試してください。', {
        title: 'フォーム連携サンプル'
      });
    }
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
    button.addEventListener('click', seedFormLinkedSample);
    stack.appendChild(button);
    return true;
  }

  function start() {
    if (installSampleButton()) return;
    const observer = new MutationObserver(() => {
      if (!installSampleButton()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.SanpoFormLinkedDebugSample = Object.freeze({
    seed: seedFormLinkedSample,
    createData: createFormLinkedSampleData
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
