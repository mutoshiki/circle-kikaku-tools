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
