import { test, expect } from '@playwright/test';

test('registration methods are explicit and manual attributes stay with their names', async ({ page }) => {
  await page.goto('/?room=REGISTRATION-METHODS&view=participants');
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  const manualMethod = dialog.getByRole('radio', { name: '名前を入力', exact: true });
  const spreadsheetMethod = dialog.getByRole('radio', { name: '回答表を貼り付ける', exact: true });
  await expect(manualMethod).toBeChecked();
  await expect(dialog.getByRole('textbox', { name: '参加者の名前', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '回答データ', exact: true })).toHaveCount(0);

  const names = dialog.getByRole('textbox', { name: '参加者の名前', exact: true });
  await names.fill('属性なしの人');
  await names.press('End');
  await names.press('Enter');
  await names.pressSequentially('属性ありの人');
  await expect(dialog).toBeVisible();
  await expect(names).toHaveValue('属性なしの人\n属性ありの人');
  await dialog.getByText('学年・車出しを設定（任意）', { exact: true }).click();
  await dialog.getByLabel('属性ありの人の学年').selectOption('3');
  const driverCheckbox = dialog.getByRole('checkbox', { name: '属性ありの人を車出しに指定', exact: true });
  await driverCheckbox.scrollIntoViewIfNeeded();
  await dialog.getByText('属性ありの人を車出しに指定', { exact: true }).click();
  await expect(driverCheckbox).toBeChecked();
  await expect(dialog.locator('.registration-modal__summary')).toContainText('2人');

  await spreadsheetMethod.check({ force: true });
  await expect(dialog.getByRole('textbox', { name: '回答データ', exact: true })).toBeVisible();
  await expect(names).toHaveCount(0);
  await manualMethod.check({ force: true });
  await expect(names).toHaveValue('属性なしの人\n属性ありの人');
  await expect(dialog.getByLabel('属性ありの人の学年')).toHaveValue('3');

  await dialog.getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const people = await page.evaluate(roomId => JSON.parse(localStorage.getItem(`sanpo-react:v1:${roomId}:room`)).participants, 'REGISTRATION-METHODS');
  expect(Object.values(people).find(person => person.name === '属性なしの人').grade).toBe(0);
  expect(Object.values(people).find(person => person.name === '属性ありの人').grade).toBe(3);
  expect(Object.values(people).find(person => person.name === '属性ありの人').name).toBe('属性ありの人');
});

test('spreadsheet registration shows deduplicated results and parser warnings before saving', async ({ page }) => {
  await page.goto('/?room=REGISTRATION-SPREADSHEET&view=participants');
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  await dialog.getByRole('radio', { name: '回答表を貼り付ける', exact: true }).check({ force: true });
  await dialog.getByRole('textbox', { name: '回答データ', exact: true }).fill('氏名\t学年\t車出し\n回答者A\t3\t可\n回答者A\t2\tいいえ');
  await expect(dialog.locator('.registration-modal__summary')).toContainText('登録対象1人');
  await expect(dialog.getByText(/複数行で学年が一致しません/)).toBeVisible();
  await dialog.getByRole('button', { name: '読み取り結果を確認', exact: true }).click();
  await expect(dialog.getByText('回答者A', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '参加者を登録', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('empty manual registration points to the name field and cancel leaves the room unchanged', async ({ page }) => {
  const roomId = 'REGISTRATION-CANCEL';
  await page.goto(`/?room=${roomId}&view=participants`);
  const key = `sanpo-react:v1:${roomId}:room`;
  const before = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  await dialog.getByRole('button', { name: '参加者を登録', exact: true }).click();
  const nameField = dialog.getByRole('textbox', { name: '参加者の名前', exact: true });
  await expect(nameField).toHaveAttribute('aria-invalid', 'true');
  await expect(nameField).toBeFocused();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(before);
});

test('form-linked applicant rooms keep their existing selection flow without the count-only shortcut', async ({ page }) => {
  await page.goto('/?room=REGISTRATION-FORM-LINKED');
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ', exact: true }).click();
  const sample = page.getByRole('dialog', { name: 'サンプルデータ', exact: true });
  await sample.getByRole('radio', { name: 'フォーム連携サンプル', exact: true }).check({ force: true });
  await sample.getByRole('button', { name: 'サンプルを入れる', exact: true }).click();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('button', { name: '人数だけで精算', exact: true })).toHaveCount(0);
  await expect(page.getByText('応募者', { exact: false }).first()).toBeVisible();
});

test('long manual attributes scroll inside the mobile modal while the Carbon footer stays reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?room=REGISTRATION-LONG-MOBILE&view=participants');
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  const names = Array.from({ length: 40 }, (_, index) => `参加者${index + 1}の長い表示名を折り返す確認`).join('\n');
  await dialog.getByRole('textbox', { name: '参加者の名前', exact: true }).fill(names);
  await dialog.getByText('学年・車出しを設定（任意）', { exact: true }).click();
  const geometry = await dialog.evaluate(node => {
    const body = node.querySelector('.cds--modal-content');
    const footer = node.querySelector('.cds--modal-footer');
    const before = { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, footerBottom: footer.getBoundingClientRect().bottom, viewport: innerHeight };
    body.scrollTop = 0;
    body.scrollBy({ top: 600 });
    return { ...before, scrollTopAfter: body.scrollTop, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  expect(geometry.scrollTopAfter).toBeGreaterThan(0);
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog.getByRole('button', { name: '参加者を登録', exact: true })).toBeVisible();
});

test('empty unlinked participant state opens count-only settlement settings without saving a draft', async ({ page }) => {
  await page.goto('/?room=REGISTRATION-COUNT-ONLY&view=participants');
  const before = await page.evaluate(() => localStorage.getItem('sanpo-react:v1:REGISTRATION-COUNT-ONLY:room'));
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '参加者' }).getByRole('heading', { name: '参加者を登録して始める', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '人数だけで精算', exact: true }).click();
  await expect(page.getByRole('tab', { name: '精算', exact: true })).toHaveAttribute('aria-selected', 'true');
  const settings = page.getByRole('dialog', { name: '精算設定を編集', exact: true });
  await expect(settings.getByRole('radio', { name: '人数だけで精算', exact: true })).toBeChecked();
  await expect(settings.getByRole('spinbutton', { name: '運転手の人数' })).toBeVisible();
  await expect(settings.getByRole('spinbutton', { name: '同乗者の人数' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sanpo-react:v1:REGISTRATION-COUNT-ONLY:room'))).toBe(before);
  await settings.getByRole('spinbutton', { name: '運転手の人数' }).fill('1');
  await settings.getByRole('spinbutton', { name: '同乗者の人数' }).fill('3');
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '保存', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.locator('.settlement-car-list')).toBeVisible();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('sanpo-react:v1:REGISTRATION-COUNT-ONLY:room')));
  expect(persisted.settlement?.standalone?.enabled).toBe(true);
  await page.reload();
  await expect(page.locator('.settlement-car-list')).toBeVisible();
});
