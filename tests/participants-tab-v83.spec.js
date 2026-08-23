import { test, expect } from '@playwright/test';

test('Participants tab owns applicant selection and later changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  // Keep firebase-config.js and its participant feature loader in the browser path, but make
  // this deterministic UI test local-only. Otherwise a real RTDB room snapshot can overwrite
  // the synthetic applicants while Carbon interaction assertions are running.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SANPO_FIREBASE_CONFIG', {
      configurable: true,
      get: () => ({}),
      set: () => {}
    });
  });

  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#tab-participants') && window.SanpoApplicantSync && window.SanpoCanonicalState?.get?.());
  await page.waitForFunction(() => (typeof firebaseEnabled === 'undefined') || firebaseEnabled === false);
  await expect(page.locator('#batchOpenBtn')).toHaveCount(0);

  const tabs = page.locator('#view-toggle-bar > cds-tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(['共有画面', '精算', '車割', '班割', '参加者']);

  await page.locator('#tab-team').click();
  await expect(page.locator('#batchOpenBtn')).toHaveCount(0);
  await page.locator('#tab-list').click();
  await expect(page.locator('#batchOpenBtn')).toHaveCount(0);

  const participantTab = page.locator('#tab-participants');
  await participantTab.click();
  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await expect(page.locator('#participants-view-area')).toBeVisible();
  await expect(page.locator('#participantsViewTitle')).toHaveText('参加者');
  await expect(page.locator('#participantsViewDescription')).toHaveCount(0);
  await expect(page.locator('#participantsViewSummary')).toContainText('参加者');
  await expect(page.locator('#participantsViewSummary')).toContainText('0人');
  await expect(participantTab).toHaveAttribute('selected', '');
  await expect(page.locator('#tab-list')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-sheet')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-seisan')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-team')).not.toHaveAttribute('selected', '');
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('participants');

  const shellOrder = await page.evaluate(() => {
    const nav = document.getElementById('app-view-navigation').getBoundingClientRect();
    const participants = document.getElementById('participants-view-area').getBoundingClientRect();
    return {
      navTop: nav.top,
      navBottom: nav.bottom,
      participantTop: participants.top,
      participantOrder: getComputedStyle(document.getElementById('participants-view-area')).order
    };
  });
  expect(shellOrder.participantOrder).toBe('3');
  expect(shellOrder.participantTop).toBeGreaterThanOrEqual(shellOrder.navBottom - 1);
  expect(shellOrder.navTop).toBeLessThan(shellOrder.participantTop);

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

  await expect(page.locator('#participantsViewSummary')).toContainText('応募者');
  await expect(page.locator('#participantsViewSummary')).toContainText('2人');
  await expect(page.locator('#participantsViewSummary')).toContainText('当選者');
  await expect(page.locator('#participantManualAddBtn')).toBeHidden();
  const applicantChecks = page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]');
  await expect(applicantChecks).toHaveCount(2);

  const tanakaHost = applicantChecks.first();
  const tanakaCheckbox = page.getByRole('checkbox', { name: '田中太郎' });
  // Carbon renders a label over the native input. Click the same visible label a user taps.
  await tanakaHost.locator('label').click();
  await expect(tanakaCheckbox).toBeChecked();
  await expect(page.locator('#participantsViewSummary')).toContainText('1人');
  await expect(tanakaHost.locator('xpath=ancestor::div[contains(@class,"form-applicant-sync__row")]')).toHaveClass(/is-selected/);
  const apply = page.locator('#formApplicantApplyBtn');
  await expect(apply).toHaveText('参加者を確定');
  await expect(apply).not.toHaveAttribute('disabled', '');
  await expect(participantTab).toHaveAttribute('selected', '');
  await expect(page.locator('#tab-list')).not.toHaveAttribute('selected', '');
  await apply.click();

  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    const participantId = window.SanpoCanonicalState.findParticipantIdByName(room.participants || {}, '田中太郎');
    const group = Object.values(room.allocations?.car?.groups || {}).find(item => item?.ownerId === participantId);
    return group?.capacity || 0;
  })).toBe(4);
  await expect(apply).toHaveText('参加者を更新');
  await expect(page.locator('#participantsViewSummary')).toContainText('当選者');
  await expect(page.locator('#participantsViewSummary')).toContainText('1人');

  await tanakaHost.locator('label').click();
  await expect(tanakaCheckbox).not.toBeChecked();
  await expect(page.locator('#participantsViewSummary')).toContainText('0人');
  await expect(apply).not.toHaveAttribute('disabled', '');
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
