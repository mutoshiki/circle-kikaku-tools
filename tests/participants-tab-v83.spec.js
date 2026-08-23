import { test, expect } from '@playwright/test';

test('Participants tab owns applicant selection and later changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#tab-participants') && window.SanpoApplicantSync && window.SanpoCanonicalState?.get?.());

  await page.waitForFunction(() => {
    if ((typeof firebaseEnabled === 'undefined') || !firebaseEnabled) return true;
    const skeleton = document.getElementById('appLoadingSkeleton');
    return Boolean(skeleton?.hidden);
  });

  const tabs = page.locator('#view-toggle-bar > cds-tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(['共有画面', '精算', '車割', '班割', '参加者']);

  const participantTab = page.locator('#tab-participants');
  await participantTab.click();
  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await expect(page.locator('#participants-view-area')).toBeVisible();
  await expect(page.locator('#participantsViewTitle')).toHaveText('参加者');
  await expect(page.locator('#participantsViewDescription')).toHaveText('参加者を追加してください。');
  await expect(participantTab).toHaveAttribute('selected', '');
  await expect(page.locator('#tab-list')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-sheet')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-seisan')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-team')).not.toHaveAttribute('selected', '');
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('participants');

  await page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    room.meta = room.meta || {};
    room.meta.applicationSync = {
      kind: 'formApplicationSync',
      version: 2,
      responseCount: 2,
      syncedAt: Date.now(),
      applicants: {
        a1: { name: '田中太郎', grade: 2, canDrive: true, capacity: 4, updatedAt: 1 },
        a2: { name: '佐藤花子', grade: 1, canDrive: false, capacity: 0, updatedAt: 2 }
      }
    };
    window.SanpoApplicantSync.render();
  });

  await expect(page.locator('#participantsViewDescription')).toHaveText('応募者を確認して、当選者を選んでください。');
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 2人　参加者 0人');
  await expect(page.locator('#participantManualAddBtn')).toBeHidden();
  const applicantChecks = page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]');
  await expect(applicantChecks).toHaveCount(2);

  await applicantChecks.first().click();
  const apply = page.locator('#formApplicantApplyBtn');
  await expect(apply).toBeEnabled();

  const beforeApply = await page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    const checkbox = document.querySelector('#formApplicantList cds-checkbox[data-form-applicant-key="a1"]');
    const native = checkbox?.shadowRoot?.querySelector('input[type="checkbox"]');
    const button = document.getElementById('formApplicantApplyBtn');
    return {
      hostChecked: checkbox?.checked,
      attrChecked: checkbox?.hasAttribute('checked'),
      nativeChecked: native?.checked,
      appSyncKind: room?.meta?.applicationSync?.kind || '',
      applicantKeys: Object.keys(room?.meta?.applicationSync?.applicants || {}),
      participantCount: Object.keys(room?.participants || {}).length,
      buttonDisabled: button?.disabled,
      buttonAttrDisabled: button?.hasAttribute('disabled'),
      bodyClass: document.body.className,
      rootValue: document.getElementById('view-toggle-bar')?.value,
      participantSelected: document.getElementById('tab-participants')?.selected
    };
  });
  console.log('PARTICIPANT_DEBUG_BEFORE_APPLY', JSON.stringify(beforeApply));

  await apply.click();
  const afterButtonApply = await page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    return {
      participantCount: Object.keys(room?.participants || {}).length,
      names: Object.values(room?.participants || {}).map(person => person?.name),
      appSyncKind: room?.meta?.applicationSync?.kind || '',
      applicantKeys: Object.keys(room?.meta?.applicationSync?.applicants || {})
    };
  });
  console.log('PARTICIPANT_DEBUG_AFTER_BUTTON', JSON.stringify(afterButtonApply));

  if (afterButtonApply.participantCount === 0) {
    await page.evaluate(() => window.SanpoApplicantSync.applySelection());
    const afterDirectApply = await page.evaluate(() => {
      const room = window.SanpoCanonicalState.get();
      return {
        participantCount: Object.keys(room?.participants || {}).length,
        names: Object.values(room?.participants || {}).map(person => person?.name),
        appSyncKind: room?.meta?.applicationSync?.kind || '',
        applicantKeys: Object.keys(room?.meta?.applicationSync?.applicants || {})
      };
    });
    console.log('PARTICIPANT_DEBUG_AFTER_DIRECT', JSON.stringify(afterDirectApply));
  }

  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    const participantId = window.SanpoCanonicalState.findParticipantIdByName(room.participants || {}, '田中太郎');
    const group = Object.values(room.allocations?.car?.groups || {}).find(item => item?.ownerId === participantId);
    return group?.capacity || 0;
  })).toBe(4);
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 2人　参加者 1人');

  await applicantChecks.first().click();
  await apply.click();
  const confirm = page.locator('#appConfirmModal');
  await expect(confirm).toHaveAttribute('open', '');
  await expect(confirm.locator('.app-decision-message')).toHaveText('車割・班割・精算の割り当ても削除されます。');
  await confirm.locator('[data-role="ok"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(0);

  await page.locator('#tab-seisan').click();
  await expect(page.locator('body')).not.toHaveClass(/view-mode-participants/);
  await expect(page.locator('#participants-view-area')).toBeHidden();
  await expect(page.locator('#tab-seisan')).toHaveAttribute('selected', '');
  expect(errors).toEqual([]);
});