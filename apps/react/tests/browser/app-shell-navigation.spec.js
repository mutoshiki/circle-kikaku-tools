import { test, expect } from '@playwright/test';

const projectNavigation = page => page.getByRole('navigation', { name: '企画内ナビゲーション' });

test('direct and legacy URLs open a stable current project section', async ({ page }) => {
  await page.goto('/?room=PHASE-B-DIRECT&section=participants');
  await expect(page).toHaveURL(/room=PHASE-B-DIRECT.*section=participants/);
  await expect(page.getByRole('heading', { level: 1, name: '参加者' })).toBeVisible();
  await expect(projectNavigation(page).getByRole('link', { name: '参加者', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.goto('/?room=PHASE-B-LEGACY&view=seisan');
  await expect(page.getByRole('heading', { level: 1, name: '精算' })).toBeVisible();
  await expect(projectNavigation(page).getByRole('link', { name: '精算', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('navigation owns browser history, refresh, current semantics and heading focus', async ({ page }) => {
  await page.goto('/?room=PHASE-B-HISTORY');
  const navigation = projectNavigation(page);
  await expect(navigation.getByRole('link', { name: '車割', exact: true })).toHaveAttribute('aria-current', 'page');

  await navigation.getByRole('link', { name: '参加者', exact: true }).click();
  await expect(page).toHaveURL(/section=participants/);
  const participantsHeading = page.getByRole('heading', { level: 1, name: '参加者' });
  await expect(participantsHeading).toBeFocused();
  await expect(navigation.getByRole('link', { name: '参加者', exact: true })).toHaveAttribute('aria-current', 'page');

  await navigation.getByRole('link', { name: '精算', exact: true }).focus();
  await page.keyboard.press('Enter');
  const settlementHeading = page.getByRole('heading', { level: 1, name: '精算' });
  await expect(settlementHeading).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '精算' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/section=participants/);
  await expect(page.getByRole('heading', { level: 1, name: '参加者' })).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/section=settlement/);
  await expect(page.getByRole('heading', { level: 1, name: '精算' })).toBeFocused();
});

test('shell exposes lifecycle navigation, landmarks and one page title', async ({ page }) => {
  await page.goto('/?room=PHASE-B-ANATOMY&section=overview');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(projectNavigation(page).getByRole('link')).toHaveText([
    '概要', '参加者', '車割', '班割', '精算', '履歴と設定',
  ]);
  await expect(page.getByText('PHASE-B-ANATOMY', { exact: true })).toBeVisible();
});

test('mobile project navigation is touch-operable and closes after selection', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile navigation contract');
  await page.goto('/?room=PHASE-B-MOBILE&section=overview');
  const menuButton = page.getByRole('button', { name: '企画メニューを開く' });
  await expect(menuButton).toBeVisible();
  await menuButton.tap();
  const navigation = projectNavigation(page);
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: '参加者', exact: true }).tap();
  await expect(page.getByRole('heading', { level: 1, name: '参加者' })).toBeFocused();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
