import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';

test('production preview loads assets and preserves a room edit across critical views and reload', async ({ page }) => {
  const origin = 'http://127.0.0.1:4174';
  const runtimeErrors = [];
  const badResponses = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/?room=PHASE8PRODUCTION');
  await expect(page).toHaveTitle('山歩会企画ツール');
  await navigateToProjectSection(page, '概要');
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('Phase 8 production smoke');
  await projectName.blur();
  await navigateToProjectSection(page, '参加者');
  await expect(page.getByRole('heading', { name: '参加者', exact: true })).toBeVisible();
  await navigateToProjectSection(page, '車割');
  await expect(page.getByRole('heading', { name: '車割', exact: true })).toBeVisible();
  await navigateToProjectSection(page, '班割');
  await expect(page.getByRole('heading', { name: '班割', exact: true })).toBeVisible();
  await navigateToProjectSection(page, '精算');
  await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  await page.reload();
  await navigateToProjectSection(page, '概要');
  await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue('Phase 8 production smoke');
  expect(runtimeErrors).toEqual([]);
  expect(badResponses).toEqual([]);
});
