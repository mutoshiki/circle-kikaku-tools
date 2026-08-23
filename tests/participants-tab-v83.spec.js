import { test, expect } from '@playwright/test';

test('Participants tab owns applicant selection and later changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#tab-participants') && window.SanpoApplicantSync && window.SanpoCanonicalState?.get?.());

  // This test injects managed-form data directly into the canonical room. Wait until the
  // new room's initial Firebase snapshot has arrived first, otherwise that legitimate empty
  // bootstrap snapshot can race the synthetic fixture and erase it before selection is applied.
  await page.waitForFunction(() => (typeof firebaseEnabled === 'undefined') || !firebaseEnabled || firebaseReady === true);
  await page.waitForTimeout(800);

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
  await apply.click();

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