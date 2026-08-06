import { test, expect } from '@playwright/test';

const loaderPath = '/assets/js/core/google-maps-loader.js';

async function bootLoader(page) {
  await page.goto('/');
  await page.evaluate(() => {
    delete window.google;
    document.querySelectorAll('script[data-sanpo-google-maps]').forEach(node => node.remove());
  });
}

test('failed script is removed and the next load retries cleanly', async ({ page }) => {
  let requestCount = 0;
  await page.route('https://maps.googleapis.com/**', async route => {
    requestCount += 1;
    if (requestCount === 1) await route.abort('failed');
    else await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: "window.google={maps:{importLibrary:async name=>({name})}};window.__sanpoGoogleMapsReady();"
    });
  });
  await bootLoader(page);
  const first = await page.evaluate(() => SanpoGoogleMaps.load({ timeoutMs: 1000 }).then(() => null).catch(error => ({ code: error.code })));
  expect(first.code).toBe('NETWORK_ERROR');
  await expect(page.locator('script[data-sanpo-google-maps]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => SanpoGoogleMaps.load({ timeoutMs: 1000 }).then(() => true).catch(() => false))).toBe(true);
  expect(requestCount).toBe(2);
});

test('gm_authFailure is classified and remains retryable', async ({ page }) => {
  let requestCount = 0;
  await page.route('https://maps.googleapis.com/**', async route => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: requestCount === 1
        ? 'window.gm_authFailure();'
        : "window.google={maps:{importLibrary:async name=>({name})}};window.__sanpoGoogleMapsReady();"
    });
  });
  await bootLoader(page);
  const first = await page.evaluate(() => SanpoGoogleMaps.load({ timeoutMs: 1000 }).then(() => null).catch(error => ({ code: error.code })));
  expect(first.code).toBe('AUTH_FAILURE');
  await expect.poll(() => page.evaluate(() => SanpoGoogleMaps.load({ timeoutMs: 1000 }).then(() => true).catch(() => false))).toBe(true);
  expect(requestCount).toBe(2);
});
