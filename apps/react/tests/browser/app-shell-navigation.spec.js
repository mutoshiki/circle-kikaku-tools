import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';

const projectNavigation = page => page.getByRole('navigation', { name: '企画内ナビゲーション' });
async function openMobileNavigation(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const menuButton = page.getByRole('button', { name: /企画メニューを/ });
  if (await menuButton.getAttribute('aria-expanded') !== 'true') await menuButton.click();
}

test('direct and legacy URLs open a stable current project section', async ({ page }) => {
  await page.goto('/?room=PHASE-B-DIRECT&section=participants');
  await expect(page).toHaveURL(/room=PHASE-B-DIRECT.*section=participants/);
  await expect(page.getByRole('heading', { level: 1, name: '参加者' })).toBeVisible();
  await expect(projectNavigation(page).getByRole('link', { name: '参加者', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.goto('/?room=PHASE-B-LEGACY&view=seisan');
  await expect(page.getByRole('heading', { level: 1, name: '精算' })).toBeVisible();
  await expect(projectNavigation(page).getByRole('link', { name: '精算', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('navigation owns browser history, refresh, current semantics and heading focus', async ({ page }, testInfo) => {
  await page.goto('/?room=PHASE-B-HISTORY');
  const navigation = projectNavigation(page);
  await expect(navigation.getByRole('link', { name: '概要', exact: true })).toHaveAttribute('aria-current', 'page');

  await openMobileNavigation(page, testInfo);
  await navigation.getByRole('link', { name: '参加者', exact: true }).click();
  await expect(page).toHaveURL(/section=participants/);
  const participantsHeading = page.getByRole('heading', { level: 1, name: '参加者' });
  await expect(participantsHeading).toBeFocused();
  await expect(navigation.getByRole('link', { name: '参加者', exact: true })).toHaveAttribute('aria-current', 'page');

  await openMobileNavigation(page, testInfo);
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
  await expect(page.getByRole('main').getByText('PHASE-B-ANATOMY', { exact: true })).toBeVisible();
});

test('mobile project navigation is touch-operable and closes after selection', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile navigation contract');
  await page.goto('/?room=PHASE-B-MOBILE&section=overview');
  const menuButton = page.getByRole('button', { name: /企画メニューを/ });
  await expect(menuButton).toBeVisible();
  await menuButton.tap();
  const navigation = projectNavigation(page);
  await expect(navigation).toBeVisible();
  await expect
    .poll(async () => (await navigation.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(255);
  await expect
    .poll(async () => (await page.getByRole('main').boundingBox())?.x ?? -1)
    .toBe(0);
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menuButton).toBeFocused();
  await menuButton.tap();
  await navigation.getByRole('link', { name: '参加者', exact: true }).tap();
  await expect(page.getByRole('heading', { level: 1, name: '参加者' })).toBeFocused();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shell navigation preserves populated project and route draft state', async ({ page }) => {
  const roomId = 'PHASE-B-PROTECTED';
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ', exact: true }).click();
  const sample = page.getByRole('dialog', { name: 'サンプルデータ' });
  await sample.getByRole('radio', { name: '通常サンプル', exact: true }).check({ force: true });
  await sample.getByRole('button', { name: 'サンプルを入れる', exact: true }).click();
  const storedBefore = await page.evaluate(id => {
    localStorage.setItem(`sanpo.routePlannerState.v2:${id}`, JSON.stringify({ origin: '保存済み出発地' }));
    return localStorage.getItem(`sanpo-react:v1:${id}:room`);
  }, roomId);

  await navigateToProjectSection(page, '参加者');
  await expect(page.locator('.participant-row-copy strong', { hasText: '藤原 拓海' })).toBeVisible();
  await navigateToProjectSection(page, '車割');
  await expect(page.getByRole('heading', { name: '藤原 拓海車', exact: true })).toBeVisible();
  await navigateToProjectSection(page, '班割');
  await expect(page.locator('.allocation-group').first()).toBeVisible();
  await navigateToProjectSection(page, '精算');
  await expect(page.getByRole('heading', { name: '各車への支払い', exact: true })).toBeVisible();

  const storedAfter = await page.evaluate(id => ({
    room: localStorage.getItem(`sanpo-react:v1:${id}:room`),
    route: JSON.parse(localStorage.getItem(`sanpo.routePlannerState.v2:${id}`)),
  }), roomId);
  expect(storedAfter.room).toBe(storedBefore);
  expect(storedAfter.route).toEqual({ origin: '保存済み出発地' });
});

test('long project names remain readable without horizontal overflow after refresh', async ({ page }) => {
  const longName = '令和八年度秋季縦走登山安全講習および新入部員歓迎を兼ねた非常に長い企画名';
  await page.goto('/?room=PHASE-B-LONG&section=overview');
  const input = page.getByRole('textbox', { name: '企画名' });
  await input.fill(longName);
  await input.blur();
  await expect(page.getByRole('main').getByText(longName, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue(longName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shell geometry separates persistent desktop navigation from mobile content', async ({ page }, testInfo) => {
  await page.goto('/?room=PHASE-B-GEOMETRY&section=overview');
  const main = await page.getByRole('main').boundingBox();
  const navigation = await projectNavigation(page).boundingBox();
  expect(main).not.toBeNull();
  if (testInfo.project.name.includes('mobile')) {
    await expect(page.getByRole('button', { name: '企画メニューを開く' })).toBeVisible();
    expect(navigation?.width || 0).toBe(0);
    expect(main.x).toBe(0);
  } else {
    await expect(page.getByRole('button', { name: '企画メニューを開く' })).toBeHidden();
    expect(navigation.width).toBeGreaterThan(0);
    expect(main.x).toBeGreaterThanOrEqual(navigation.x + navigation.width - 1);
  }
});
