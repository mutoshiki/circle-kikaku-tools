import { test, expect } from '@playwright/test';

async function seedManagedApplicants(page) {
  await page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    room.roomName = '5人テスト企画 E2E5-1787568822623';
    room.meta = room.meta || {};
    room.meta.applicationSync = {
      kind: 'formApplicationSync',
      version: 2,
      title: room.roomName,
      eventDate: '2026-08-24',
      responseCount: 5,
      syncedAt: Date.now(),
      applicants: {
        a1: { name: '山本 陽翔', grade: 1, canDrive: true, capacity: 4, updatedAt: 1 },
        a2: { name: '小林 海斗', grade: 2, canDrive: false, capacity: 0, updatedAt: 2 },
        a3: { name: '佐々木 陽菜', grade: 3, canDrive: false, capacity: 0, updatedAt: 3 },
        a4: { name: '松本 結月', grade: 4, canDrive: false, capacity: 0, updatedAt: 4 },
        a5: { name: '田中 結衣', grade: 1, canDrive: false, capacity: 0, updatedAt: 5 }
      }
    };
    window.SanpoApplicantSync.render();
    window.updateUI?.();
  });
}

function applicantRow(page, name) {
  return page
    .locator('#formApplicantList .form-applicant-sync__row')
    .filter({ has: page.locator(`cds-checkbox[label-text="${name}"]`) })
    .first();
}

async function clickApplicant(page, name) {
  const row = applicantRow(page, name);
  await expect(row).toBeVisible();
  await row.locator('cds-checkbox label').click();
}

async function setCarbonValue(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
}

async function openManagedParticipants(page) {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.locator('#tab-participants').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await seedManagedApplicants(page);
}

test('Participants mobile flow has no saved-state overlay or broken sticky layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openManagedParticipants(page);

  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人');
  await expect(page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]')).toHaveCount(5);
  await expect(page.locator('#participantsSavedState')).toHaveCount(0);

  const titleStyle = await page.locator('.project-title-editor').evaluate(element => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    fontSize: getComputedStyle(element).fontSize,
    maxHeight: getComputedStyle(element).maxHeight
  }));
  expect(titleStyle.whiteSpace).not.toBe('nowrap');
  expect(parseFloat(titleStyle.fontSize)).toBeLessThanOrEqual(24);

  for (const name of ['山本 陽翔', '小林 海斗', '佐々木 陽菜']) await clickApplicant(page, name);

  const apply = page.locator('#formApplicantApplyBtn');
  await expect(apply).toHaveText('3人を参加者として確定');
  await expect(page.locator('#participantsActionCount')).toHaveText('3人を選択中');
  await expect(page.locator('.participants-page__actions')).toBeVisible();

  const initialActionStyle = await page.locator('.participants-page__actions').evaluate(element => getComputedStyle(element).position);
  expect(initialActionStyle).toBe('static');

  await apply.click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(3);
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 3人');
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('#formApplicantList')).toBeHidden();
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantsConfirmedControls')).toBeVisible();
  await expect(page.locator('#participantsEditToggle')).toHaveText('参加者を編集');

  const collapsedLayout = await page.evaluate(() => {
    const header = document.querySelector('.participants-page__header').getBoundingClientRect();
    const post = document.getElementById('participantsPostConfirmSection').getBoundingClientRect();
    const area = document.getElementById('participants-view-area').getBoundingClientRect();
    return {
      headerBottom: header.bottom,
      postTop: post.top,
      postBottom: post.bottom,
      areaBottom: area.bottom
    };
  });
  expect(collapsedLayout.postTop).toBeGreaterThanOrEqual(collapsedLayout.headerBottom - 1);

  const edit = page.locator('#participantsEditToggle');
  await edit.click();
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-editing/);
  await expect(page.locator('#formApplicantList')).toBeVisible();
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();
  await expect(edit).toHaveText('編集を閉じる');

  await clickApplicant(page, '松本 結月');
  await expect(page.locator('.participants-page__actions')).toBeVisible();
  await expect(page.locator('#participantsActionCount')).toHaveText('参加者 3人 → 4人');
  await expect(apply).toHaveText('4人を参加者として保存');
  await expect(edit).toHaveAttribute('disabled', '');
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();

  const dirtyLayout = await page.evaluate(() => {
    const list = document.getElementById('formApplicantList').getBoundingClientRect();
    const actions = document.querySelector('.participants-page__actions').getBoundingClientRect();
    const style = getComputedStyle(document.querySelector('.participants-page__actions'));
    return {
      listBottom: list.bottom,
      actionsTop: actions.top,
      actionsBottom: actions.bottom,
      position: style.position,
      marginBottom: style.marginBottom
    };
  });
  expect(dirtyLayout.position).toBe('static');
  expect(dirtyLayout.actionsTop).toBeGreaterThanOrEqual(dirtyLayout.listBottom - 1);
  expect(dirtyLayout.marginBottom).not.toBe('-112px');

  await page.locator('.participants-page__actions').scrollIntoViewIfNeeded();
  const actionAndArea = await page.evaluate(() => {
    const actions = document.querySelector('.participants-page__actions').getBoundingClientRect();
    const area = document.getElementById('participants-view-area').getBoundingClientRect();
    return { actionsBottom: actions.bottom, areaBottom: area.bottom };
  });
  expect(actionAndArea.actionsBottom).toBeLessThanOrEqual(actionAndArea.areaBottom + 1);

  await apply.click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(4);
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 4人');

  await edit.click();
  await clickApplicant(page, '山本 陽翔');
  const yamamotoRow = applicantRow(page, '山本 陽翔');
  await expect(yamamotoRow).toHaveClass(/is-pending-removal/);
  await expect(yamamotoRow.locator('.participants-pending-removal')).toHaveText('参加者から外す予定');
  await expect(page.locator('#participantsActionCount')).toHaveText('参加者 4人 → 3人');
  await expect(apply).toHaveText('3人を参加者として保存');

  await apply.click();
  const confirm = page.locator('#appConfirmModal');
  await expect(confirm).toHaveAttribute('open', '');
  await expect(confirm.locator('.app-decision-message')).toContainText('車割・班割・精算');
  await confirm.locator('[data-role="cancel"]').click();
  await expect(page.locator('.participants-page__actions')).toBeVisible();
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();

  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const selectedRow = applicantRow(page, '小林 海斗');
  const darkColors = await selectedRow.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color
  }));
  expect(darkColors.background).not.toBe('rgb(232, 232, 232)');
  expect(darkColors.background).not.toBe('rgb(255, 255, 255)');

  expect(errors).toEqual([]);
});

test('Participant announcement mobile flow starts safely and separates editing from preview', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openManagedParticipants(page);

  for (const name of ['山本 陽翔', '小林 海斗', '佐々木 陽菜', '松本 結月', '田中 結衣']) {
    await clickApplicant(page, name);
  }
  await page.locator('#formApplicantApplyBtn').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(5);
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantAnnouncementOpenBtn')).toBeVisible();

  await page.locator('#participantAnnouncementOpenBtn').click();
  const modal = page.locator('#participantAnnouncementModal');
  await expect(modal).toHaveAttribute('open', '');
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementPreviewStep')).toBeHidden();
  await expect(page.locator('#announcementEventDate')).toHaveJSProperty('value', '2026-08-24');
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '');
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(0);
  await expect(page.locator('#announcementAdvancedFields')).toBeHidden();
  await expect(modal.locator('cds-modal-footer')).toHaveCount(0);

  await page.locator('#announcementPreviewBtn').click();
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementMeetingTime')).toHaveAttribute('invalid', '');

  await setCarbonValue(page, '#announcementEventDate', '2026-09-24');
  await setCarbonValue(page, '#announcementMeetingTime', '06:30');
  await page.locator('#announcementAddItineraryBtn').click();
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(1);
  await setCarbonValue(page, '#announcementItineraryList [data-itinerary-time]', '09:00');
  await setCarbonValue(page, '#announcementItineraryList [data-itinerary-step]', '登山開始');
  await setCarbonValue(page, '#announcementSupplement', '天候によっては中止する場合があります。');

  await page.locator('#announcementAdvancedToggleBtn').click();
  await expect(page.locator('#announcementAdvancedFields')).toBeVisible();
  await setCarbonValue(page, '#announcementOpening', 'お疲れ様です！テストです。');

  await page.locator('#announcementPreviewBtn').click();
  await expect(page.locator('#announcementEditStep')).toBeHidden();
  await expect(page.locator('#announcementPreviewStep')).toBeVisible();
  await expect(page.locator('#announcementTitlePreview')).toContainText('9月24日(木)');
  await expect(page.locator('#announcementBodyPreview')).toContainText('9月24日(木)');
  await expect(page.locator('#announcementBodyPreview')).toContainText('今回は応募してくださった方全員が参加できることになりました。');
  await expect(page.locator('#announcementBodyPreview')).toContainText('○は車出し');
  await expect(page.locator('#announcementBodyPreview')).toContainText('当日は06:30にサークルボックス前に集合してください。');
  await expect(page.locator('#announcementBodyPreview')).toContainText('～大まかな予定～');
  await expect(page.locator('#announcementBodyPreview')).toContainText('09:00 登山開始');
  await expect(page.locator('#announcementBodyPreview')).not.toContainText('の5人テスト企画');

  const bodyGeometry = await page.locator('#announcementBodyPreview').evaluate(element => ({
    tagName: element.tagName,
    overflowY: getComputedStyle(element).overflowY,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(bodyGeometry.tagName).toBe('PRE');
  expect(bodyGeometry.overflowY).not.toBe('scroll');
  expect(bodyGeometry.scrollHeight).toBeLessThanOrEqual(bodyGeometry.clientHeight + 1);

  await page.locator('#announcementEditBtn').click();
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementPreviewStep')).toBeHidden();
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '06:30');

  expect(errors).toEqual([]);
});