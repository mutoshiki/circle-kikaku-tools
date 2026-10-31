import { test, expect } from '@playwright/test';

test('shared section heading and spacing foundation keep semantic roles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?room=UI-FOUNDATION-HEADING&view=tools');
  await page.getByRole('tab', { name: 'ツール', exact: true }).click();

  const app = page.locator('.application');
  await expect(app).toBeVisible();
  await expect.poll(() => app.evaluate(element => getComputedStyle(element).getPropertyValue('--sanpo-ui-section-gap').trim())).toBe('2rem');

  const heading = page.locator('.project-tools-workspace .ui-section-heading');
  await expect(heading.getByRole('heading', { name: 'ツール', exact: true, level: 2 })).toBeVisible();
  await expect(heading.getByText('使うツールと、タブに表示するツールを選びます。', { exact: true })).toBeVisible();
  await expect(heading).toHaveCSS('display', 'flex');
  await expect(heading.getByRole('heading')).toHaveCSS('font-size', '16px');
  await expect(page.getByRole('heading', { name: '利用するツール', exact: true })).toHaveCSS('font-size', '14px');
});

test('project entry headings share the action layout without changing page-title hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const entryHeading = page.locator('.project-entry-heading');
  await expect(entryHeading).toHaveClass(/ui-section-heading/);
  await expect(entryHeading.getByRole('heading', { name: '企画一覧', level: 1 })).toBeVisible();
  await expect(entryHeading.getByRole('link', { name: '新しい企画を作成' })).toBeVisible();
  await expect(entryHeading).toHaveCSS('display', 'flex');
  await expect(entryHeading.getByRole('heading')).toHaveCSS('font-size', '28px');

  await page.goto('/?screen=create');
  const createHeading = page.locator('.project-entry-heading');
  await expect(createHeading.getByRole('heading', { name: '新しい企画', level: 1 })).toBeVisible();
  await expect(createHeading.getByRole('button', { name: '企画一覧へ戻る' })).toBeVisible();
});

test('all five application panels share one 16px inset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?room=VISUAL-PANEL-INSET&view=participants');

  const panels = page.locator('.app-tab-panel');
  await expect(panels).toHaveCount(5);
  for (const tabName of ['参加者', '車割', '班割', '精算', 'ツール']) {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
    const visiblePanel = page.locator('.app-tab-panel:visible');
    await expect(visiblePanel).toHaveCount(1);
    await expect.poll(() => visiblePanel.evaluate(element => getComputedStyle(element).paddingInlineStart)).toBe('16px');
  }
});

test('five-screen Carbon consistency at mobile width', async ({ page }) => {
  const roomId = 'VISUAL-CONSISTENCY-RC';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?room=${roomId}&view=participants`);
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ', exact: true }).click();
  const sample = page.getByRole('dialog', { name: 'サンプルデータ' });
  await sample.getByRole('radio', { name: '通常のサンプル', exact: true }).check({ force: true });
  await sample.getByRole('button', { name: 'サンプルに置き換える', exact: true }).click();

  const tabs = page.getByRole('tablist', { name: '企画のツール' });
  await expect(tabs.getByRole('tab')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: '参加者', exact: true })).toHaveCount(0);
  const participantSummary = page.locator('.participants-page > .section-heading h2');
  await expect(participantSummary).toContainText(/参加者\s*\d+人/);
  expect(await participantSummary.evaluate(element => getComputedStyle(element).marginBlockStart)).toBe('0px');
  const participantInset = (await participantSummary.boundingBox()).x;
  await expect(page.getByText('参加者を追加してください。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '参加者を追加', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '参加者を登録' })).toBeVisible();
  await page.getByRole('dialog', { name: '参加者を登録' }).getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await expect(page.getByRole('heading', { name: '班割', exact: true })).toHaveCount(0);
  await expect(page.locator('.allocation-page[aria-label="班割"] .allocation-toolbar-summary')).toContainText(/\d+人・\d+班/);
  const randomize = page.getByRole('button', { name: 'ランダム割り当て', exact: true });
  await expect(randomize).toHaveClass(/cds--btn--ghost/);
  await randomize.hover();
  expect(await randomize.evaluate(element => getComputedStyle(element).cursor)).toBe('pointer');
  await randomize.focus();
  await expect(randomize).toBeFocused();
  await page.getByRole('button', { name: /班の操作$/ }).first().click();
  const removeGroup = page.getByRole('menuitem', { name: '班を削除', exact: true }).first();
  await expect(removeGroup).toBeVisible();
  await expect(removeGroup.locator('xpath=ancestor::li[1]')).toHaveClass(/--danger/);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.locator('.settlement-car-list')).toBeVisible();
  const collectionRegion = page.getByRole('region', { name: '集金', exact: true });
  await expect(collectionRegion).toBeVisible();
  const settlementInset = (await page.locator('.settlement-car-list').boundingBox()).x;
  expect(Math.abs(settlementInset - participantInset)).toBeLessThanOrEqual(1);
  const settingsButton = page.getByRole('button', { name: '精算設定', exact: true });
  await expect(settingsButton).toHaveClass(/cds--btn--ghost/);
  expect((await settingsButton.boundingBox()).width).toBeLessThan((await page.locator('.settlement-card').nth(1).boundingBox()).width * 0.6);
  const collectionTrigger = page.getByRole('button', { name: '集金を記録', exact: true });
  await expect(collectionTrigger).toHaveClass(/cds--btn--primary/);
  await expect(collectionTrigger).toHaveClass(/cds--btn--md/);
  expect((await collectionTrigger.boundingBox()).height).toBe(40);
  await expect(page.locator('.settlement-collection-summary__header > span')).toHaveText('1人あたりの集金額');
  await expect(page.locator('.settlement-collection-summary__amount')).toHaveText(/^¥[\d,]+$/);
  expect(await page.locator('.settlement-collection-summary__header > span').evaluate(element => getComputedStyle(element).fontSize)).toBe('14px');
  expect(await page.locator('.settlement-collection-summary__amount').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px');
  await collectionTrigger.click();
  const collectionDialog = page.getByRole('dialog', { name: '集金状況' });
  await expect(collectionDialog).toBeVisible();
  const switcher = collectionDialog.getByRole('tablist', { name: '集金対象者の表示' });
  const allTab = switcher.getByRole('tab', { name: 'すべて' });
  await expect(allTab).toBeVisible();
  await expect(allTab).toHaveAttribute('aria-selected', 'true');
  await expect(switcher.getByRole('tab', { name: '未集金' })).toBeVisible();
  await switcher.getByRole('tab', { name: '未集金' }).click();
  await expect(switcher.getByRole('tab', { name: '未集金' })).toHaveAttribute('aria-selected', 'true');
  await switcher.getByRole('tab', { name: 'すべて' }).click();
  await expect(collectionDialog.locator('.settlement-collection-row.excluded .cds--tag').first()).toBeVisible();
  await collectionDialog.getByRole('button', { name: '閉じる', exact: true }).last().click();
  await expect(collectionTrigger).toBeFocused();
  const paymentCard = page.locator('.settlement-car').first();
  const costAction = paymentCard.locator('.settlement-car-edit-action');
  await expect(costAction).toHaveClass(/cds--btn--ghost/);
  await expect(costAction).toHaveAttribute('aria-label', /費用を(?:入力|編集)/);
  await expect(costAction).toBeVisible();
  const expand = paymentCard.getByRole('button', { name: /支払い内訳/ });
  await costAction.click();
  const editCost = page.getByRole('dialog', { name: /藤原 拓海車/ });
  await expect(editCost).toBeVisible();
  await editCost.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(paymentCard.locator('.settlement-cost-group h4')).toHaveCount(0);
  await expect(paymentCard.locator('.settlement-cost-item').first()).toBeVisible();
  await expect(paymentCard.getByText('費用小計', { exact: true })).toHaveCount(0);
  await expect(paymentCard.getByText('支払総額', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
