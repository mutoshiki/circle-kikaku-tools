import { test, expect } from '@playwright/test';

test('production preview loads assets and preserves a room edit across critical views and reload', async ({ page }) => {
  const origin = 'http://127.0.0.1:4174';
  const runtimeErrors = [];
  const badResponses = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/?room=PHASE8PRODUCTION');
  await expect(page).toHaveTitle('サークル企画ツール');
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('Phase 8 production smoke');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('heading', { name: '参加者', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await expect(page.getByRole('heading', { name: '車割', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await expect(page.getByRole('heading', { name: '班割', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue('Phase 8 production smoke');
  expect(runtimeErrors).toEqual([]);
  expect(badResponses).toEqual([]);
});
