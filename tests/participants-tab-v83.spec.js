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

async function clickApplicant(page, name) {
  const host = page.locator('#formApplicantList cds-checkbox').filter({ has: page.locator(`label:has-text("${name}")`) });
  if (await host.count()) {
    await host.first().locator('label').click();
    return;
  }
  const checkbox = page.getByRole('checkbox', { name, exact: true });
  const row = checkbox.locator('xpath=ancestor::div[contains(@class,"form-applicant-sync__row")]');
  await row.locator('cds-checkbox label').click();
}

test('Participants mobile flow has no saved-state overlay or broken sticky layout', async ({ page }) => {
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

  await page.locator('#tab-participants').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await seedManagedApplicants(page);

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
  const yamamoto = page.getByRole('checkbox', { name: '山本 陽翔', exact: true });
  const yamamotoRow = yamamoto.locator('xpath=ancestor::div[contains(@class,"form-applicant-sync__row")]');
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
  const selectedRow = page.getByRole('checkbox', { name: '小林 海斗', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"form-applicant-sync__row")]');
  const darkColors = await selectedRow.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color
  }));
  expect(darkColors.background).not.toBe('rgb(232, 232, 232)');
  expect(darkColors.background).not.toBe('rgb(255, 255, 255)');

  expect(errors).toEqual([]);
});