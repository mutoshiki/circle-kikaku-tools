import {replaceSample} from './sample-workspace.js';
import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';
test('five-screen Carbon consistency at mobile width', async ({ page }) => {
  const roomId = 'VISUAL-CONSISTENCY-RC';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?room=${roomId}&view=participants`);
  await replaceSample(page);

  await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' }).getByRole('link')).toHaveText(['参加者','車割','班割','車両費用','精算','概要','履歴']);
  const participantHeading = page.getByRole('heading', { name: '参加者', exact: true });
  await expect(participantHeading).toBeVisible();
  const participantInset = (await participantHeading.boundingBox()).x;
  await expect(page.getByText('参加者を追加してください。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '参加者を追加', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  await expect(page.getByRole('form', { name: '参加者を登録' })).toBeVisible();
  await page.getByRole('form', { name: '参加者を登録' }).getByRole('button', { name: 'キャンセル' }).click();

  await navigateToProjectSection(page, '班割');
  const teamHeading = page.getByRole('heading', { name: '班割', exact: true });
  await expect(teamHeading).toBeVisible();
  expect(Math.abs((await teamHeading.boundingBox()).x - participantInset)).toBeLessThanOrEqual(1);
  const randomize = page.getByRole('button', { name: 'ランダム割り当て', exact: true });
  await randomize.hover();
  expect(await randomize.evaluate(element => getComputedStyle(element).cursor)).toBe('pointer');
  await randomize.focus();
  await expect(randomize).toBeFocused();
  await page.getByRole('button', { name: /班の操作$/ }).first().click();
  const removeGroup = page.getByRole('menuitem', { name: '削除', exact: true }).first();
  await expect(removeGroup).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /班の詳細$/ }).first().click();
  const assignment = page.getByRole('link', { name: '参加者を割り当て', exact: true });
  if (await assignment.count()) {
    await assignment.click();
    await expect(page.getByRole('list', { name: /^未割り当て/ })).toBeVisible();
    await expect(page).toHaveURL(/task=assign/);
  } else {
    await expect(page.getByRole('main')).toContainText('空き0人');
  }

  await navigateToProjectSection(page, '精算');
  await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', {name:'集金・支払い',exact:true})).toBeVisible();
  const settlementInset = (await page.getByRole('heading', { level: 1, name: '精算', exact: true }).boundingBox()).x;
  expect(Math.abs(settlementInset - participantInset)).toBeLessThanOrEqual(1);
  const settingsButton = page.getByRole('link', { name: '精算ルール', exact: true });
  await expect(settingsButton).toHaveAttribute('href', /section=settlement.*task=rules/);
  expect((await settingsButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole('link',{name:'集金を確認',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'集金',exact:true})).toBeVisible();
  const switcher=page.getByRole('tablist',{name:'集金対象者の表示'});
  await switcher.getByRole('tab',{name:'すべて',exact:true}).click();
  await expect(page.getByText(/免除|集金対象外/).first()).toBeVisible();
  await page.getByRole('link',{name:'支払いへ',exact:true}).click();
  await page.getByRole('tab',{name:'すべて',exact:true}).click();
  const payment=page.getByRole('list',{name:/支払い対象/}).getByRole('listitem').first();
  await payment.getByRole('link',{name:/費用を入力/}).click();
  await expect(page.getByRole('heading',{level:1,name:/藤原 拓海車の費用/})).toBeVisible();
  await editFee(page,'移動条件');await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await payment.getByRole('button',{name:/内訳/}).click();
  await expect(payment.getByText('集金分差引',{exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
