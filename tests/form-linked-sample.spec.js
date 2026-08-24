import { test, expect } from '@playwright/test';

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

test('form-linked sample exercises the Carbon participant flow without remote browser dependencies', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  // Browser-policy-safe QA path: keep the production loader in place while disabling
  // remote Firebase access before application scripts execute.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SANPO_FIREBASE_CONFIG', {
      configurable: true,
      get: () => ({}),
      set: () => {}
    });
  });

  await page.goto('/');
  await page.waitForFunction(() =>
    window.SanpoFormLinkedDebugSample
    && window.SanpoApplicantSync
    && window.SanpoCanonicalState?.get?.()
    && typeof window.openDebugModal === 'function'
  );

  await page.evaluate(() => window.openDebugModal());
  const debugModal = page.locator('#debugModal');
  await expect(debugModal).toHaveAttribute('open', '');
  const sampleButton = page.locator('#executeFormLinkedDebugBtn');
  await expect(sampleButton).toBeVisible();
  await expect(sampleButton).toHaveText('フォーム連携サンプルを入れる');

  await sampleButton.click();

  await expect(page.locator('body')).toHaveClass(/view-mode-participants/);
  await expect(page.locator('#participantsViewSummary')).toHaveText('参加者 13人');
  await expect(page.locator('#participantAnnouncementOpenBtn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const room = window.SanpoCanonicalState.get();
    return {
      roomName: room?.roomName,
      participants: Object.keys(room?.participants || {}).length,
      kind: room?.meta?.applicationSync?.kind,
      eventDate: room?.meta?.applicationSync?.eventDate,
      applicants: Object.keys(room?.meta?.applicationSync?.applicants || {}).length
    };
  })).toEqual({
    roomName: 'フォーム連携テスト企画',
    participants: 13,
    kind: 'formApplicationSync',
    eventDate: '2026-09-24',
    applicants: 13
  });

  await page.locator('#participantsEditToggle').click();
  await expect(page.locator('#formApplicantList')).toBeVisible();
  await expect(page.locator('#formApplicantList cds-checkbox[data-form-applicant-key]')).toHaveCount(13);
  await expect(page.locator('#participantsSelectionToolbar cds-table-toolbar')).toHaveCount(1);
  await expect(page.locator('#participantsSelectionToolbar cds-table-toolbar-content')).toHaveCount(1);

  await clickApplicant(page, '佐々木 陽菜');
  await clickApplicant(page, '山田 蓮');

  await expect(page.locator('#participantsSelectionStatus')).toBeVisible();
  await expect(page.locator('#participantsSelectionStatus')).toHaveText('11人を選択中');
  await expect(page.locator('.participants-pending-removal')).toHaveCount(2);
  await expect(page.locator('.participants-pending-removal')).toHaveText(['除外予定', '除外予定']);
  await expect(page.locator('#formApplicantApplyBtn')).toHaveText('11人を参加者として保存');

  const removalPresentation = await applicantRow(page, '佐々木 陽菜').evaluate(element => ({
    boxShadow: getComputedStyle(element).boxShadow,
    tagName: element.querySelector('.participants-pending-removal')?.tagName || ''
  }));
  expect(removalPresentation.boxShadow).toBe('none');
  expect(removalPresentation.tagName).toBe('CDS-TAG');

  const actionGeometry = await page.locator('.participants-page__actions').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight
    };
  });
  expect(actionGeometry.position).toBe('fixed');
  expect(actionGeometry.bottom).toBeLessThanOrEqual(actionGeometry.viewportHeight + 1);
  expect(actionGeometry.top).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/participants-carbon-dirty-mobile.png', fullPage: false });

  // Restore the same 13-person selection and commit it so the confirmed follow-up flow
  // can be exercised in the same deterministic sample session.
  await clickApplicant(page, '佐々木 陽菜');
  await clickApplicant(page, '山田 蓮');
  await expect(page.locator('#participantsSelectionStatus')).toHaveText('13人を選択中');
  await page.locator('#formApplicantApplyBtn').click();
  await expect(page.locator('.participants-page')).toHaveClass(/is-confirmed-collapsed/);
  await expect(page.locator('#participantsSelectionStatus')).toBeHidden();
  await expect(page.locator('#participantAnnouncementOpenBtn')).toBeVisible();

  await page.locator('#participantAnnouncementOpenBtn').click();
  await expect(page.locator('#participantAnnouncementModal')).toHaveAttribute('open', '');
  await expect(page.locator('#announcementEventDate')).toHaveJSProperty('value', '2026-09-24');
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '');
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(0);

  expect(errors).toEqual([]);
});