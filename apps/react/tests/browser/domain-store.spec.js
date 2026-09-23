import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
test('production bundle migrates a legacy fixture through the external store and persists an IME draft', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(input => {
    const key = 'sanpo-react:v1:DOMAIN-FIXTURE:room';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(input));
  }, fixture);
  await page.goto('/?room=DOMAIN-FIXTURE');
  await expect(page.getByRole('tabpanel')).toContainText('6人');
  const field = page.getByRole('textbox', { name: '企画名' });
  await expect(field).toHaveValue(fixture.roomName);
  await field.focus();
  await field.dispatchEvent('compositionstart');
  await field.fill('にほんご');
  await field.dispatchEvent('compositionend', { data: '日本語の企画' });
  await field.fill('日本語の企画');
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sanpo-react:v1:DOMAIN-FIXTURE:room')));
  expect(saved.schemaVersion).toBe(6);
  expect(saved.roomName).toBe('日本語の企画');
  expect(Object.keys(saved.participants)).toHaveLength(6);
  expect(saved.meta.applicationSync).toEqual(fixture.meta.applicationSync);
  await page.reload();
  await expect(field).toHaveValue('日本語の企画');
  expect(errors).toEqual([]);
});
