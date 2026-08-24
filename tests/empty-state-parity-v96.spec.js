import { test, expect } from '@playwright/test';

async function disableRemoteSync(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SANPO_FIREBASE_CONFIG', {
      configurable: true,
      get: () => ({}),
      set: () => {}
    });
  });
}

async function openEmptyRoom(page) {
  await disableRemoteSync(page);
  const room = `EMPTY-PARITY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    typeof window.switchView === 'function'
    && typeof window.updateActiveCarPlanTemplate === 'function'
    && typeof window.updateUI === 'function'
    && window.SanpoCanonicalState?.get?.()
  ));
}

async function expectGenericEmptyState(page, selector) {
  const empty = page.locator(selector);
  await expect(empty).toBeVisible();
  await expect(empty.locator('cds-button')).toHaveCount(2);
  await expect(empty).toContainText('参加者がいません');
  await expect(empty).toContainText('参加者を追加');
  await expect(empty).toContainText('人数だけで精算');
  await expect(empty.locator('[data-action="open-participants"]')).toHaveCount(1);
  await expect(empty.locator('[data-action="switch-seisan-settings"]')).toHaveCount(1);
}

async function expectApplicantEmptyState(page, selector, applicantCount) {
  const empty = page.locator(selector);
  await expect(empty).toBeVisible();
  await expect(empty.locator('cds-button')).toHaveCount(2);
  await expect(empty).toContainText('参加者がまだ決まっていません');
  await expect(empty).toContainText(`応募者 ${applicantCount}人`);
  await expect(empty).toContainText('応募者を確認');
  await expect(empty).toContainText('人数だけで精算');
  await expect(empty.locator('[data-action="open-participants"]')).toHaveCount(1);
  await expect(empty.locator('[data-action="switch-seisan-settings"]')).toHaveCount(1);
}

async function visitFourNonParticipantStates(page, assertion) {
  await page.evaluate(() => {
    window.switchView('list');
    window.updateActiveCarPlanTemplate('car');
  });
  await expect(page.locator('body')).toHaveAttribute('data-active-plan-template', 'car');
  await assertion(page, '#list-empty-hint .app-entry-choice');

  await page.evaluate(() => {
    window.switchView('list');
    window.updateActiveCarPlanTemplate('team');
  });
  await expect(page.locator('body')).toHaveAttribute('data-active-plan-template', 'team');
  await assertion(page, '#list-empty-hint .app-entry-choice');

  await page.evaluate(() => window.switchView('sheet'));
  await assertion(page, '#sheet-content .app-entry-choice');

  await page.evaluate(() => window.switchView('seisan'));
  await assertion(page, '#seisan-empty-state .app-entry-choice');
}

test.describe('Participant empty-state parity across non-participant tabs', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shared view, settlement, car allocation, and team allocation show the same empty actions', async ({ page }) => {
    await openEmptyRoom(page);
    await visitFourNonParticipantStates(page, expectGenericEmptyState);
  });

  test('managed-form rooms with applicants use the same applicant guidance on all four tabs', async ({ page }) => {
    await openEmptyRoom(page);
    await page.evaluate(() => {
      const room = window.SanpoCanonicalState.get();
      room.meta = room.meta || {};
      room.meta.applicationSync = {
        kind: 'formApplicationSync',
        version: 2,
        title: '空状態テスト企画',
        responseCount: 2,
        syncedAt: Date.now(),
        applicants: {
          r_test_1: { name: '山田 太郎', grade: 2, canDrive: false, updatedAt: 1 },
          r_test_2: { name: '佐藤 花子', grade: 3, canDrive: true, capacity: 3, updatedAt: 2 }
        }
      };
      room.participants = {};
      window.SanpoApplicantSync?.render?.();
      window.updateUI();
    });

    await visitFourNonParticipantStates(page, (targetPage, selector) => expectApplicantEmptyState(targetPage, selector, 2));
  });
});
