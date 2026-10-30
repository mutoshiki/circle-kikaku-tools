import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const token = `h_${'R'.repeat(48)}`;

test('worker CSV export returns a private Drive link and disables duplicate requests', async ({ page }, testInfo) => {
  const roomId = `HANDOFF-${testInfo.project.name}-${testInfo.retry}`;
  const room = structuredClone(fixture);
  room.meta.applicationSync.handoffVersion = 1;

  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.__handoffCalls = [];
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      async handoff(payload) {
        window.__handoffCalls.push(payload);
        await new Promise(resolve => setTimeout(resolve, 80));
        return {
          ok: true,
          downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123456',
          count: 1,
        };
      },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: room });

  await page.goto(`/?room=${roomId}&view=sheet&allocation=car&handoff=${token}`);
  await expect(page).toHaveURL(new RegExp(`\\?room=${roomId}$`));
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await page.getByRole('button', { name: '学務書類用CSVを作成' }).click();

  const dialog = page.getByRole('dialog', { name: '学務書類用CSV' });
  const submit = dialog.getByRole('button', { name: '学務書類用CSVを作成' });
  await submit.dblclick();

  const download = dialog.getByRole('link', { name: 'CSVをダウンロード' });
  await expect(download).toHaveAttribute('href', /^https:\/\/drive\.google\.com\//);
  await expect(dialog.getByText(/24時間後に削除/)).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(await page.evaluate(() => window.__handoffCalls.length)).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(window.__handoffCalls))).not.toContain('仮参加者');
});
