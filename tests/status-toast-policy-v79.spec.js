import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.waitForFunction(() => window.AppUI?.setSyncStatus && typeof window.showSaveStatus === 'function' && customElements.get('cds-toast-notification'));
}

async function toastCopy(page, selector = '#appSyncStatusToast') {
  const toast = page.locator(selector);
  return {
    title: (await toast.locator('[slot="title"]').textContent())?.trim(),
    subtitle: (await toast.locator('[slot="subtitle"]').textContent())?.trim(),
    kind: await toast.getAttribute('kind')
  };
}

test.describe('Status toast policy v79', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('routine saves and internal retry states stay quiet while useful feedback remains clear', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.evaluate(() => {
      window.AppUI.resumeSyncFeedback();
      window.AppUI.setSyncStatus('neutral', 'reset');
    });

    // Routine autosave completion is intentionally quiet. Opening views/settings can
    // trigger these saves, so announcing every completion would be notification noise.
    await page.evaluate(() => window.showSaveStatus('保存中...', 'saving'));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.showSaveStatus('同期完了', 'connected'));
    await page.waitForTimeout(100);
    await expect(page.locator('#appSyncStatusToast')).toHaveCount(0);

    // Transport initialization/retry wording is internal implementation detail and
    // must not surface as a scary permanent-rejection message on first load.
    await page.evaluate(() => window.showSaveStatus('保存を拒否、再送停止', 'error'));
    await page.waitForTimeout(100);
    await expect(page.locator('#appSyncStatusToast')).toHaveCount(0);

    // A real connection problem is useful to surface, but with calm user-facing copy.
    await page.evaluate(() => window.showSaveStatus('network offline', 'error'));
    const syncToast = page.locator('#appSyncStatusToast');
    await expect(syncToast).toBeVisible();
    expect(await toastCopy(page)).toEqual({
      title: '接続を待っています',
      subtitle: '変更はこの端末に残っています。接続が戻ると自動で反映されます。',
      kind: 'warning'
    });
    await expect(syncToast.locator('[slot="title"]')).toHaveCount(1);
    await expect(syncToast.locator('[slot="subtitle"]')).toHaveCount(1);
    expect((await syncToast.getAttribute('title')) || '').toBe('');
    await page.waitForTimeout(2600);
    await expect(page.locator('#appSyncStatusToast')).toHaveCount(0);

    // Generic success feedback also has a single title/subtitle and uses the shorter duration.
    await page.evaluate(() => window.showMiniToast('リンクをコピーしました', 'success'));
    const statusToast = page.locator('#appStatusToast');
    await expect(statusToast).toBeVisible();
    expect(await toastCopy(page, '#appStatusToast')).toEqual({
      title: '完了しました',
      subtitle: 'リンクをコピーしました',
      kind: 'success'
    });
    await expect(statusToast.locator('[slot="title"]')).toHaveCount(1);
    expect((await statusToast.getAttribute('title')) || '').toBe('');
    await page.waitForTimeout(2600);
    await expect(page.locator('#appStatusToast')).toHaveCount(0);
  });

  test('transaction transport readiness is retryable instead of a permanent rejection', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.waitForFunction(() => typeof window.isPermanentSyncError === 'function');

    const permanent = await page.evaluate(() => {
      const savedRetry = window.save;
      window.save = () => {};
      const result = window.isPermanentSyncError(new Error('Firebase Realtime Database transaction support is required for shared sync'));
      window.save = savedRetry;
      return result;
    });
    expect(permanent).toBe(false);
  });

  test('private-car movement settings warn even when all gas calculation fields are blank', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.evaluate(() => window.executeDebugMode?.());
    await page.waitForTimeout(250);
    await page.locator('#tab-seisan').evaluate(node => node.click());
    await page.waitForFunction(() => document.body.classList.contains('view-mode-seisan'));

    const result = await page.evaluate(() => {
      const data = getRoomDataOnly();
      const state = ensureSettlementState();
      const car = (data.cars || [])[0];
      if (!car) return null;
      const current = normalizeCarSettlementState(state.cars[car.name] || {});
      current.rentalType = 'private';
      current.dist = '';
      current.eco = '';
      current.price = '';
      state.cars[car.name] = current;
      const calc = calculateSettlement(data, state);
      const issues = getSettlementIssues(data, state, calc);
      return { name: car.name, messages: issues.messages, fields: [...issues.fields] };
    });

    expect(result).not.toBeNull();
    expect(result.messages.some(message => message.includes(`${result.name}車のガソリン代を計算するため`))).toBeTruthy();
    expect(result.fields).toEqual(expect.arrayContaining([
      `${result.name}:dist`,
      `${result.name}:eco`,
      `${result.name}:price`
    ]));
  });
});
