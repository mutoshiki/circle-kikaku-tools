import { test, expect } from '@playwright/test';

test('form-linked sample keeps managed-form state and announcement after reload', async ({ page }) => {
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
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人　参加者 5人');
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
    participants: 5,
    kind: 'formApplicationSync',
    eventDate: '2026-09-24',
    applicants: 5
  });

  await page.locator('#participantAnnouncementOpenBtn').click();
  await expect(page.locator('#participantAnnouncementModal')).toHaveAttribute('open', '');
  await expect(page.locator('#announcementEventDate')).toHaveJSProperty('value', '2026-09-24');
  await expect(page.locator('#announcementMeetingTime')).toHaveJSProperty('value', '');
  await expect(page.locator('#announcementItineraryList .participant-announcement-itinerary__row')).toHaveCount(0);

  // Reproduce the user-visible regression: after a reload the five people must still be
  // recognized as form applicants, not downgraded to five manually-added participants.
  await page.reload();
  await page.waitForFunction(() =>
    window.SanpoFormLinkedDebugSample
    && window.SanpoApplicantSync
    && window.SanpoCanonicalState?.get?.()
  );
  await page.evaluate(() => window.SanpoApplicantSync.showParticipantsView());
  await expect(page.locator('#participantsViewSummary')).toHaveText('応募者 5人　参加者 5人');
  await expect(page.locator('#participantAnnouncementOpenBtn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SanpoCanonicalState.get()?.meta?.applicationSync?.eventDate || '')).toBe('2026-09-24');

  expect(errors).toEqual([]);
});
