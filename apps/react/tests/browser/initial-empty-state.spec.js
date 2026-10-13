import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';

const cases = [
  { view: 'participants', tab: '参加者', heading: '参加者を登録して始める', description: '参加者を登録すると、車割・班割・精算ができます。', primary: '参加者を追加', alternate: '人数だけで精算' },
  { view: 'car', tab: '車割', heading: '車割を始める', description: 'まず参加者を登録してください。', primary: '参加者を追加' },
  { view: 'team', tab: '班割', heading: '班割を始める', description: 'まず参加者を登録してください。', primary: '参加者を追加' },
  { view: 'seisan', tab: '精算', heading: '精算を始める', description: '名前を登録せず、人数だけでも精算できます。', primary: '人数だけで精算', alternate: '参加者を追加' },
];

for (const state of cases) {
  test(`initial ${state.tab} state explains how to start`, async ({ page }) => {
    await page.goto(`/?room=INITIAL-${state.view.toUpperCase()}&view=${state.view}`);
    await page.getByRole('tab', { name: state.tab, exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: state.tab, exact: true });
    await expect(panel.getByRole('heading', { name: state.heading, exact: true })).toBeVisible();
    await expect(panel.getByText(state.description, { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: state.primary, exact: true })).toBeVisible();
    if (state.alternate) await expect(panel.getByRole('button', { name: state.alternate, exact: true })).toBeVisible();
    if (state.tab === '参加者') {
      await expect(panel.getByRole('searchbox')).toHaveCount(0);
      await expect(panel.getByRole('button', { name: '絞り込み', exact: true })).toHaveCount(0);
      await expect(panel.getByText('参加者がいません', { exact: true })).toHaveCount(0);
    }
  });
}

test('applicant selection remains available when the participant room itself is empty', async ({ page }) => {
  const room = structuredClone(fixture);
  room.participants = {};
  await page.addInitScript(value => localStorage.setItem('sanpo-react:v1:INITIAL-APPLICANTS:room', JSON.stringify(value)), room);
  await page.goto('/?room=INITIAL-APPLICANTS&view=participants');
  const panel = page.getByRole('tabpanel', { name: '参加者', exact: true });
  await expect(panel.getByText(/応募者/).first()).toBeVisible();
  await expect(panel.getByRole('heading', { name: '参加者を登録して始める', exact: true })).toHaveCount(0);
});

test('allocation and settlement empty states route form-linked rooms to applicant selection', async ({ page }) => {
  const roomId = 'INITIAL-FORM-LINKED-ROUTE';
  const room = structuredClone(fixture);
  room.cars = [];
  room.waiting = [];
  room.settlement.cars = {};
  await page.addInitScript(({ id, value }) => localStorage.setItem(`sanpo-react:v1:${id}:room`, JSON.stringify(value)), { id: roomId, value: room });
  await page.goto(`/?room=${roomId}&view=participants`);

  for (const tabName of ['車割', '班割', '精算']) {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: tabName, exact: true });
    await expect(panel.getByRole('button', { name: '参加者を確認', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: '参加者を確認', exact: true }).click();
    await expect(page.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: '参加者', exact: true }).getByText(/応募者/).first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: '参加者を登録', exact: true })).toHaveCount(0);
  }
});

test('saving from the initial registration flow enters the participant list', async ({ page }) => {
  await page.goto('/?room=INITIAL-REGISTER-SAVE&view=participants');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  await dialog.getByRole('textbox', { name: '参加者の名前' }).fill('登録テスト');
  await dialog.getByRole('button', { name: '参加者を登録', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  const panel = page.getByRole('tabpanel', { name: '参加者', exact: true });
  await expect(panel.getByRole('heading', { name: '参加者 1人', exact: true })).toBeVisible();
  await expect(panel.getByRole('searchbox', { name: '名前を検索' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '参加者を登録', exact: true })).toHaveCount(0);
});

for (const origin of [
  { view: 'car', tab: '車割' },
  { view: 'team', tab: '班割' },
  { view: 'seisan', tab: '精算' },
]) {
  test(`${origin.tab} empty state opens participant registration without saving on cancel`, async ({ page }) => {
    const roomId = `INITIAL-REGISTER-${origin.view.toUpperCase()}`;
    await page.goto(`/?room=${roomId}&view=${origin.view}`);
    await page.getByRole('tab', { name: origin.tab, exact: true }).click();
    const key = `sanpo-react:v1:${roomId}:room`;
    const before = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
    await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
    await expect(page.getByRole('tab', { name: '参加者', exact: true })).toHaveAttribute('aria-selected', 'true');
    const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(before);
    await expect(page.getByRole('button', { name: '参加者を追加', exact: true })).toBeFocused();
  });
}

test('participant registration cancel returns focus to its visible start action', async ({ page }) => {
  const roomId = 'INITIAL-REGISTER-FOCUS';
  await page.goto(`/?room=${roomId}&view=participants`);
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  const start = page.getByRole('button', { name: '参加者を追加', exact: true });
  const key = `sanpo-react:v1:${roomId}:room`;
  const before = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
  await start.click();
  const dialog = page.getByRole('dialog', { name: '参加者を登録', exact: true });
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(before);
  await expect(start).toBeFocused();
});

test('count-only setup opens from participant and settlement empty states, cancels without saving, and restores focus', async ({ page }) => {
  const roomId = 'INITIAL-COUNT-ONLY-FOCUS';
  await page.goto(`/?room=${roomId}&view=participants`);
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  const participantsPanel = page.getByRole('tabpanel', { name: '参加者', exact: true });
  const participantStart = participantsPanel.getByRole('button', { name: '人数だけで精算', exact: true });
  const settlementStart = page.getByRole('tabpanel', { name: '精算', exact: true }).getByRole('button', { name: '人数だけで精算', exact: true });
  const key = `sanpo-react:v1:${roomId}:room`;
  const before = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
  for (const start of [participantStart, settlementStart]) {
    await start.click();
    await expect(page.getByRole('tab', { name: '精算', exact: true })).toHaveAttribute('aria-selected', 'true');
    const dialog = page.getByRole('dialog', { name: '精算設定を編集', exact: true });
    await expect(dialog.getByRole('radio', { name: '人数だけで精算', exact: true })).toBeChecked();
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(before);
    await expect(settlementStart).toBeFocused();
  }
});
