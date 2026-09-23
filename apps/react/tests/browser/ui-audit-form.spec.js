import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outputRoot = join(process.cwd(), '..', '..', 'artifacts', 'ui-audit');
function shot(page, viewportName, number, name) {
  const directory = join(outputRoot, viewportName);
  mkdirSync(directory, { recursive: true });
  return page.mouse.move(1, 1).then(() => page.screenshot({ path: join(directory, `${String(number).padStart(2, '0')}-${name}.png`) }));
}
async function menu(page) {
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ', exact: true }).click();
}

test('capture form-linked and registration UI states', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const viewports = testInfo.project.name.includes('mobile')
    ? [['mobile', { width: 390, height: 844 }]]
    : [['desktop', { width: 1440, height: 1000 }]];
  for (const [viewportName, viewport] of viewports) {
    await page.setViewportSize(viewport);
    const room = `UI-AUDIT-FORM-${viewportName}`;
    await page.goto(`/?room=${room}`);
    await page.getByRole('tab', { name: '参加者', exact: true }).click();
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await shot(page, viewportName, 37, 'participant-registration-modal');
    await page.getByRole('button', { name: '貼り付け方を見る', exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, viewportName, 38, 'participant-registration-help-expanded');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();

    await menu(page);
    const sample = page.getByRole('dialog', { name: 'サンプルデータ' });
    await sample.getByRole('radio', { name: 'フォーム連携サンプル', exact: true }).check({ force: true });
    await sample.getByRole('button', { name: 'サンプルを入れる', exact: true }).click();
    await page.getByRole('tab', { name: '参加者', exact: true }).click();
    await shot(page, viewportName, 39, 'form-linked-participants-unconfirmed');
    const confirm = page.getByRole('button', { name: '参加者を確定', exact: true });
    if (await confirm.count()) await confirm.click();
    await shot(page, viewportName, 40, 'form-linked-participants-confirmed');
    const guidance = page.getByRole('button', { name: '発表文を作成', exact: true });
    if (await guidance.count()) {
      await guidance.click();
      await shot(page, viewportName, 41, 'guidance-modal');
      await page.locator('.cds--modal-close').click({ force: true });
    }
    const handoff = page.getByRole('button', { name: '引き継ぎデータを作成', exact: true });
    if (await handoff.count()) await shot(page, viewportName, 42, 'handoff-disabled-state');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
