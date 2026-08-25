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

async function shellMetrics(page) {
  return page.evaluate(() => {
    const region = document.getElementById('projectTitleRegion');
    const input = document.getElementById('roomNameInput');
    const regionStyle = getComputedStyle(region);
    const inputField = input?.closest('.app-room-field');
    const inputFieldStyle = inputField ? getComputedStyle(inputField) : null;
    return {
      region: {
        height: regionStyle.height,
        paddingTop: regionStyle.paddingTop,
        paddingRight: regionStyle.paddingRight,
        paddingBottom: regionStyle.paddingBottom,
        paddingLeft: regionStyle.paddingLeft
      },
      input: {
        tagName: input?.tagName || '',
        position: inputFieldStyle?.position || '',
        visible: Boolean(input && input.getBoundingClientRect().width > 0 && input.getBoundingClientRect().height > 0),
        contenteditableCount: document.querySelectorAll('[contenteditable]').length
      }
    };
  });
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
  const referenceShell = await shellMetrics(page);
  await page.locator('#tab-participants').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await seedManagedApplicants(page);
  return referenceShell;
}

test('Participants mobile flow keeps the shared shell and Carbon selection actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const referenceShell = await openManagedParticipants(page);

  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人');
  await expect(page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]')).toHaveCount(5);
  await expect(page.locator('#participantsSavedState')).toHaveCount(0);

  const participantShell = await shellMetrics(page);
  expect(participantShell).toEqual(referenceShell);

  for (const name of ['山本 陽翔', '小林 海斗', '佐々木 陽菜']) await clickApplicant(page, name);

  const apply = page.locator('#formApplicantApplyBtn');
  await expect(apply).toHaveText('3人を参加者として確定');
  await expect(page.locator('#participantsActionCount')).toHaveText('3人を選択中');
  await expect(page.locator('#participantsToolbarSelectionCount')).toBeHidden();
  await expect(page.locator('.participants-page__actions')).toBeVisible();

  const initialActionLayout = await page.locator('.participants-page__actions').evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      position: style.position,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      borderTopWidth: style.borderTopWidth,
      borderLeftWidth: style.borderLeftWidth,
      boxShadow: style.boxShadow
    };
  });
  expect(initialActionLayout.position).toBe('fixed');
  expect(initialActionLayout.left).toBe(0);
  expect(initialActionLayout.right).toBe(initialActionLayout.viewportWidth);
  expect(initialActionLayout.bottom).toBe(initialActionLayout.viewportHeight);
  expect(initialActionLayout.borderTopWidth).toBe('1px');
  expect(initialActionLayout.borderLeftWidth).toBe('0px');
  expect(initialActionLayout.boxShadow).toBe('none');

  await apply.click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(3);
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人　参加者 3人');
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('#formApplicantList')).toBeHidden();
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(page.locator('#participantsToolbarSelectionCount')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantsConfirmedControls')).toBeVisible();
  await expect(page.locator('#participantsEditToggle')).toHaveText('参加者を編集');

  const collapsedLayout = await page.evaluate(() => {
    const header = document.querySelector('.participants-page__header').getBoundingClientRect();
    const post = document.getElementById('participantsPostConfirmSection').getBoundingClientRect();
    return { headerBottom: header.bottom, postTop: post.top };
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
  await expect(page.locator('#participantsToolbarSelectionCount')).toBeHidden();
  await expect(apply).toHaveText('4人を参加者として保存');
  await expect(edit).toHaveAttribute('disabled', '');
  await expect(page.locator('#participantsPostConfirmSection')).toBeHidden();

  const dirtyLayout = await page.evaluate(() => {
    const actions = document.querySelector('.participants-page__actions').getBoundingClientRect();
    const pageNode = document.querySelector('.participants-page');
    const style = getComputedStyle(document.querySelector('.participants-page__actions'));
    const pageStyle = getComputedStyle(pageNode);
    return {
      actionsLeft: actions.left,
      actionsRight: actions.right,
      actionsBottom: actions.bottom,
      position: style.position,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pagePaddingBottom: parseFloat(pageStyle.paddingBottom)
    };
  });
  expect(dirtyLayout.position).toBe('fixed');
  expect(dirtyLayout.actionsLeft).toBe(0);
  expect(dirtyLayout.actionsRight).toBe(dirtyLayout.viewportWidth);
  expect(dirtyLayout.actionsBottom).toBe(dirtyLayout.viewportHeight);
  expect(dirtyLayout.pagePaddingBottom).toBeGreaterThanOrEqual(100);

  await apply.click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(4);
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('.participants-page__actions')).toBeHidden();
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人　参加者 4人');

  await edit.click();
  await clickApplicant(page, '山本 陽翔');
  const yamamotoRow = applicantRow(page, '山本 陽翔');
  await expect(yamamotoRow).toHaveClass(/is-pending-removal/);
  const removalTag = yamamotoRow.locator('cds-tag.participants-pending-removal');
  await expect(removalTag).toHaveText('除外予定');
  await expect(removalTag).toHaveAttribute('type', 'red');
  await expect(page.locator('#participantsActionCount')).toHaveText('参加者 4人 → 3人');
  await expect(page.locator('#participantsToolbarSelectionCount')).toBeHidden();
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

test('Participant announcement mobile flow uses Carbon footer, disclosure, and preview actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openManagedParticipants(page);

  for (const name of ['山本 陽翔', '小林 海斗', '佐々木 陽菜', '松本 結月', '田中 結衣']) {
    await clickApplicant(page, name);
  }
  await page.locator('#formApplicantApplyBtn').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length)).toBe(5);
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人　参加者 5人');
  await expect(page.locator('#participantsPostConfirmSection')).toBeVisible();
  await expect(page.locator('#participantAnnouncementOpenBtn')).toBeVisible();

  await page.locator('#participantAnnouncementOpenBtn').click();
  const modal = page.locator('#participantAnnouncementModal');
  const primaryAction = page.locator('#announcementPrimaryActionBtn');
  const secondaryAction = page.locator('#announcementSecondaryActionBtn');
  const advanced = page.locator('#announcementAdvancedDisclosure');

  await expect(modal).toHaveAttribute('open', '');
  await expect(modal).toHaveAttribute('data-announcement-step', 'edit');
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementPreviewStep')).toBeHidden();
  await expect(page.locator('#announcementEventDate')).toHaveJSProperty('value', '2026-08-24');
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '');
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(0);
  await expect(modal.locator('cds-modal-footer')).toHaveCount(1);
  await expect(primaryAction).toHaveText('発表文を確認');
  await expect(secondaryAction).toHaveText('キャンセル');
  await expect(advanced).not.toHaveAttribute('open', '');

  await primaryAction.click();
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementMeetingTime')).toHaveAttribute('invalid', '');

  await setCarbonValue(page, '#announcementEventDate', '2026-09-24');
  await setCarbonValue(page, '#announcementMeetingTime', '06:30');
  await page.locator('#announcementAddItineraryBtn').click();
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(1);
  await setCarbonValue(page, '#announcementItineraryList [data-itinerary-time]', '09:00');
  await setCarbonValue(page, '#announcementItineraryList [data-itinerary-step]', '登山開始');
  await setCarbonValue(page, '#announcementSupplement', '天候によっては中止する場合があります。');

  await advanced.locator('[slot="title"]').click();
  await expect(advanced).toHaveAttribute('open', '');
  await setCarbonValue(page, '#announcementOpening', 'お疲れ様です！テストです。');

  const addButtonGeometry = await page.locator('#announcementAddItineraryBtn').evaluate(element => {
    const button = element.getBoundingClientRect();
    const section = element.closest('.participant-announcement-itinerary').getBoundingClientRect();
    return { buttonWidth: button.width, sectionWidth: section.width };
  });
  expect(addButtonGeometry.buttonWidth).toBeLessThan(addButtonGeometry.sectionWidth);

  await primaryAction.click();
  await expect(modal).toHaveAttribute('data-announcement-step', 'preview');
  await expect(page.locator('#announcementEditStep')).toBeHidden();
  await expect(page.locator('#announcementPreviewStep')).toBeVisible();
  await expect(primaryAction).toHaveText('発表文をコピー');
  await expect(secondaryAction).toHaveText('編集に戻る');
  await expect(page.locator('#announcementCopyTitleBtn')).toHaveAttribute('aria-label', 'タイトルをコピー');
  await expect(page.locator('#announcementCopyBodyBtn')).toHaveAttribute('aria-label', '本文をコピー');
  await expect(page.locator('#announcementTitlePreview')).toHaveAttribute('aria-readonly', 'true');
  await expect(page.locator('#announcementBodyPreview')).toHaveAttribute('aria-readonly', 'true');
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
    scrollHeight: element.scrollHeight,
    borderTopWidth: getComputedStyle(element).borderTopWidth
  }));
  expect(bodyGeometry.tagName).toBe('PRE');
  expect(bodyGeometry.overflowY).not.toBe('scroll');
  expect(bodyGeometry.scrollHeight).toBeLessThanOrEqual(bodyGeometry.clientHeight + 1);
  expect(bodyGeometry.borderTopWidth).toBe('0px');

  await secondaryAction.click();
  await expect(modal).toHaveAttribute('data-announcement-step', 'edit');
  await expect(page.locator('#announcementEditStep')).toBeVisible();
  await expect(page.locator('#announcementPreviewStep')).toBeHidden();
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '06:30');
  await expect(primaryAction).toHaveText('発表文を確認');
  await expect(secondaryAction).toHaveText('キャンセル');

  expect(errors).toEqual([]);
});
