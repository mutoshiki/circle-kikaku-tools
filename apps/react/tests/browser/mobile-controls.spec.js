import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createTemplateWorkspace, workspaceCacheKey } from '../../src/services/project-workspace.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

async function height(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box.height;
}

test('mobile controls keep readable type and touch targets across integrated tools', async ({ page }) => {
  const roomId = 'MOBILE-CONTROLS-AUDIT';
  await page.addInitScript(({ key, value, workspaceKey, workspace }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(workspaceKey, JSON.stringify(workspace));
  }, {
    key: `sanpo-react:v1:${roomId}:room`, value: fixture,
    workspaceKey: workspaceCacheKey(roomId), workspace: createTemplateWorkspace({ templateId: 'circle-mountain' }),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.setViewportSize({ width: 393, height: 852 });

  const summary = page.locator('.settlement-car-toggle').first();
  await expect(summary).toBeVisible();
  expect(await height(summary)).toBeGreaterThanOrEqual(44);
  expect(Number.parseFloat(await summary.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);

  const edit = page.locator('.settlement-car-edit-action').first();
  expect(await height(edit)).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: '精算設定', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(settings).toBeVisible();
  expect(await height(settings.locator('.cds--radio-button-wrapper').first())).toBeGreaterThanOrEqual(44);
  expect(await height(settings.locator('.cds--modal-footer .cds--btn').first())).toBeGreaterThanOrEqual(44);
  await settings.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '車割', exact: true }).click();
  const randomize = page.getByRole('button', { name: 'ランダム割り当て', exact: true });
  expect(await height(randomize)).toBeGreaterThanOrEqual(44);

  await page.getByRole('tab', { name: '登山計画書', exact: true }).click();
  const progress = page.locator('.mountain-plan-inline .progress__step').first();
  await expect(progress).toBeVisible();
  expect(await height(progress)).toBeGreaterThanOrEqual(44);
  expect(Number.parseFloat(await progress.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  const planInput = page.locator('.mountain-plan-inline input').first();
  expect(Number.parseFloat(await planInput.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const disclosure = page.locator('.mountain-plan-inline .details-panel summary').first();
  expect(await height(disclosure)).toBeGreaterThanOrEqual(44);

  await page.getByRole('tab', { name: '応募フォーム', exact: true }).click();
  const formName = page.getByRole('textbox', { name: '企画名（必須）' });
  await expect(formName).toBeVisible();
  expect(await height(formName)).toBeGreaterThanOrEqual(48);
  expect(Number.parseFloat(await formName.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const formNameBox = await formName.boundingBox();
  expect(formNameBox.width).toBeGreaterThanOrEqual(320);

  await page.getByRole('tab', { name: 'タブを編集', exact: true }).click();
  const reorder = page.getByRole('button', { name: '応募フォームを上へ', exact: true });
  expect(await height(reorder)).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  expect(await height(page.locator('.settlement-car-toggle').first())).toBeGreaterThanOrEqual(44);
});
