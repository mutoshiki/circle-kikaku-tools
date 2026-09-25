import { test, expect } from '@playwright/test';

test('legacy UI browser tests receive no Firebase production config', async ({ page }) => {
  const databaseRequests = [];
  page.on('request', request => {
    if (/\.firebaseio\.com(?:\/|$)/i.test(new URL(request.url()).host)) databaseRequests.push(new URL(request.url()).host);
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.SANPO_FIREBASE_CONFIG)).toEqual({});
  await page.evaluate(() => window.executeDebugMode?.());
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBeGreaterThan(0);
  expect(databaseRequests).toEqual([]);
});
