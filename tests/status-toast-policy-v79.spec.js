import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.waitForFunction(() => window.AppUI?.setSyncStatus && typeof window.showSaveStatus === 'function' && customElements.get('cds-toast-notification'));
}

async function toastCopy(page) {
  const toast = page.locator('#appSyncStatusToast');
  return {
    title: (await toast.locator('[slot="title"]').textContent())?.trim(),
    subtitle: (await toast.locator('[slot="subtitle"]').textContent())?.trim(),
    kind: await toast.getAttribute('kind')
  };
}

test.describe('Status toast policy v79', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('routine autosave completion stays quiet while meaningful states use clear two-line copy', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);

    await page.evaluate(() => window.AppUI.setSyncStatus('neutral', 'reset'));
    await page.evaluate(() => window.showSaveStatus('保存中...', 'saving'));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.showSaveStatus('同期完了', 'connected'));
    await page.waitForTimeout(100);
    await expect(page.locator('#appSyncStatusToast')).toHaveCount(0);

    await page.evaluate(() => window.showSaveStatus('保存中...', 'saving'));
    await page.waitForTimeout(750);
    await expect(page.locator('#appSyncStatusToast')).toBeVisible();
    expect(await toastCopy(page)).toEqual({
      title: '保存しています',
      subtitle: '変更内容を共有データへ保存しています。',
      kind: 'info'
    });

    await page.evaluate(() => window.showSaveStatus('同期完了', 'connected'));
    await page.waitForTimeout(100);
    await expect(page.locator('#appSyncStatusToast')).toHaveCount(0);

    await page.evaluate(() => window.showSaveStatus('入力中のため同期保留', 'local'));
    await expect(page.locator('#appSyncStatusToast')).toBeVisible();
    expect(await toastCopy(page)).toEqual({
      title: '変更を一時的に保留しています',
      subtitle: '操作が終わるか接続が戻ると、自動で同期します。',
      kind: 'warning'
    });

    await page.evaluate(() => window.showSaveStatus('保留中の変更を再送しました', 'connected'));
    expect(await toastCopy(page)).toEqual({
      title: '保存を再開しました',
      subtitle: '保留していた変更を保存しました。',
      kind: 'success'
    });
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
