import { test, expect } from '@playwright/test';

test('Participants tab owns applicant selection and confirmed follow-up actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

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
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 0人');
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();
  await expect(page.locator('#participantAnnouncementPanel')).toHaveCount(0);
  await expect(participantTab).toHaveAttribute('selected', '');
  await expect(page.locator('#tab-list')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-sheet')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-seisan')).not.toHaveAttribute('selected', '');
  await expect(page.locator('#tab-team')).not.toHaveAttribute('selected', '');
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('participants');

  const shellOrder = await page.evaluate(() => {
    const nav = document.getElementById('app-view-navigation').getBoundingClientRect();
    const participants = document.getElementById('participants-view-area').getBoundingClientRect();
    const projectTitleRegion = document.querySelector('.project-title-region');
    return {
      navTop: nav.top,
      navBottom: nav.bottom,
      participantTop: participants.top,
      participantOrder: getComputedStyle(document.getElementById('participants-view-area')).order,
      projectTitleHeight: getComputedStyle(projectTitleRegion).height
    };
  });
  expect(shellOrder.participantOrder).toBe('3');
  expect(shellOrder.participantTop).toBeGreaterThanOrEqual(shellOrder.navBottom - 1);
  expect(shellOrder.navTop).toBeLessThan(shellOrder.participantTop);
  expect(shellOrder.projectTitleHeight).toBe('96px');

  await page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    room.meta = room.meta || {};
    room.meta.applicationSync = {
      kind: 'formApplicationSync',
      version: 2,
      title: '霧ヶ峰',
      eventDate: '2026-07-11',
      responseCount: 2,
      syncedAt: Date.now(),
      applicants: {
        a1: { name: '田中太郎', grade: 2, canDrive: true, capacity: 4, updatedAt: 1 },
        a2: { name: '佐藤花子', grade: 1, canDrive: false, capacity: 0, updatedAt: 2 }
      }
    };
    window.SanpoApplicantSync.render();
    window.SanpoParticipantAnnouncement?.refresh?.();
  });

  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 2人');
  await expect(page.locator('#participantManualAddBtn')).toBeHidden();
  await expect(page.locator('#participantAnnouncementPanel')).toHaveCount(0);
  await expect(page.locator('#handoffExportBtn')).not.toHaveCount(0);
  await expect(page.locator('#participantsSelectionToolbar #handoffExportBtn')).toHaveCount(0);
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();
  const applicantChecks = page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]');
  await expect(applicantChecks).toHaveCount(2);
  await expect(page.locator('#formApplicantList')).toHaveAttribute('role', 'list');
  await expect(page.locator('#formApplicantList .form-applicant-sync__row').first()).toHaveAttribute('role', 'listitem');

  const tanakaHost = applicantChecks.first();
  const tanakaRow = tanakaHost.locator('xpath=ancestor::div[contains(@class,"form-applicant-sync__row")]');
  const tanakaCheckbox = page.getByRole('checkbox', { name: '田中太郎' });
  await tanakaHost.locator('label').click();
  await expect(tanakaCheckbox).toBeChecked();
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 2人');
  await expect(page.locator('#participantsActionCount')).toHaveText('1人を選択中');
  await expect(page.locator('#participantsSavedState')).toBeHidden();
  await expect(tanakaRow).toHaveClass(/is-selected/);

  const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme || '');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const selectedDarkBackground = await tanakaRow.evaluate(element => getComputedStyle(element).backgroundColor);
  expect(selectedDarkBackground).not.toBe('rgb(232, 232, 232)');
  expect(selectedDarkBackground).not.toBe('rgb(255, 255, 255)');
  await page.evaluate(theme => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, originalTheme);

  const apply = page.locator('#formApplicantApplyBtn');
  await expect(apply).toHaveText('参加者を確定');
  await expect(apply).toBeVisible();
  await expect(apply).not.toHaveAttribute('disabled', '');
  await apply.click();

  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    const participantId = window.SanpoCanonicalState.findParticipantIdByName(room.participants || {}, '田中太郎');
    const group = Object.values(room.allocations?.car?.groups || {}).find(item => item?.ownerId === participantId);
    return group?.capacity || 0;
  })).toBe(4);
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 1人');
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('#participantsConfirmedControls')).toBeVisible();
  await expect(page.locator('#participantsConfirmedTag')).toHaveText('確定済み');
  const editToggle = page.locator('#participantsEditToggle');
  await expect(editToggle).toHaveText('参加者を編集');
  await expect(editToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#participantsSelectionToolbar')).toBeHidden();
  await expect(page.locator('#formApplicantList')).toBeHidden();
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(apply).toBeHidden();
  await expect(page.locator('#participantsSavedState')).toBeHidden();

  const postConfirm = page.locator('#participantsPostConfirmSection');
  await expect(postConfirm).toBeVisible();
  await expect(postConfirm.locator('#participantsPostConfirmTitle')).toHaveText('参加者確定後');
  await expect(postConfirm.locator('#participantsHandoffActionPanel')).toBeVisible();
  await expect(postConfirm.locator('#participantsHandoffActionPanel h4')).toHaveText('学務提出用データ');
  await expect(postConfirm.locator('#handoffExportBtn')).toBeVisible();

  const announcementPanel = page.locator('#participantAnnouncementPanel');
  await expect(announcementPanel).toBeVisible();
  await expect(announcementPanel.locator('p')).toHaveText('ラクラク連絡網に投稿する文章を作成します。');
  const announcementOpen = page.locator('#participantAnnouncementOpenBtn');
  await expect(announcementOpen).toHaveAttribute('kind', 'ghost');
  await expect(announcementOpen).not.toHaveAttribute('disabled', '');
  await announcementOpen.click();

  const announcementModal = page.locator('#participantAnnouncementModal');
  await expect(announcementModal).toHaveAttribute('open', '');
  const titlePreview = page.locator('#announcementTitlePreview');
  await expect(titlePreview).toHaveJSProperty('value', '【参加者発表】7月11日(土)霧ヶ峰企画');
  await expect(page.locator('#announcementCopyTitleBtn')).toBeVisible();
  await expect(page.locator('#announcementCopyTitleBtn')).toHaveText('タイトルをコピー');

  const announcementCopyBody = page.locator('#announcementCopyBodyBtn');
  await expect(announcementCopyBody).toHaveAttribute('disabled', '');
  await page.evaluate(() => {
    const input = document.getElementById('announcementMeetingTime');
    input.value = '06:30';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  await expect(announcementCopyBody).not.toHaveAttribute('disabled', '');
  const bodyPreview = page.locator('#announcementBodyPreview');
  const bodyValue = await bodyPreview.evaluate(element => element.value);
  expect(bodyValue).toContain('7月11日(土)の霧ヶ峰企画の参加者を発表します。');
  expect(bodyValue).toContain('○田中太郎');
  expect(bodyValue).toContain('当日は06:30にサークルボックス前に集合してください。');
  await announcementModal.locator('#announcementCloseBtn').click();

  await editToggle.click();
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-editing/);
  await expect(editToggle).toHaveText('編集を閉じる');
  await expect(editToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#participantsSelectionToolbar')).toBeVisible();
  await expect(page.locator('#formApplicantList')).toBeVisible();
  await expect(page.locator('.participants-page__actions')).toBeVisible();
  await expect(page.locator('#participantsSavedState')).toBeVisible();
  await expect(page.locator('#participantsSavedState')).toHaveText('✓ 保存済み');

  await tanakaHost.locator('label').click();
  await expect(tanakaCheckbox).not.toBeChecked();
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 1人');
  await expect(page.locator('#participantsActionCount')).toHaveText('0人を選択中');
  await expect(page.locator('#participantsSavedState')).toBeHidden();
  await expect(editToggle).toHaveAttribute('disabled', '');
  await expect(apply).toHaveText('変更を保存');
  await expect(apply).toBeVisible();
  await expect(apply).not.toHaveAttribute('disabled', '');
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();
  await expect(page.locator('#participantAnnouncementPanel')).toHaveCount(0);
  await apply.click();
  const confirm = page.locator('#appConfirmModal');
  await expect(confirm).toHaveAttribute('open', '');
  await expect(confirm.locator('.app-decision-message')).toHaveText('車割・班割・精算の割り当ても削除されます。');
  await confirm.locator('[data-role="ok"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(0);
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 2人');
  await expect(page.locator('#participantsConfirmedControls')).toBeHidden();
  await expect(page.locator('#formApplicantList')).toBeVisible();
  await expect(apply).toBeHidden();
  await expect(page.locator('#participantsSavedState')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();
  await expect(page.locator('#participantAnnouncementPanel')).toHaveCount(0);

  const statusStyle = await page.locator('#formApplicantStatus').evaluate(element => ({
    width: getComputedStyle(element).width,
    height: getComputedStyle(element).height,
    position: getComputedStyle(element).position
  }));
  expect(statusStyle).toEqual({ width: '1px', height: '1px', position: 'absolute' });

  await page.locator('#tab-seisan').click();
  await expect(page.locator('body')).not.toHaveClass(/view-mode-participants/);
  await expect(page.locator('#participants-view-area')).toBeHidden();
  await expect(page.locator('#tab-seisan')).toHaveAttribute('selected', '');
  expect(errors).toEqual([]);
});
