import { test, expect } from '@playwright/test';
import { seedVehicleCostRoom, editFee, costNav } from './vehicle-cost-fixture.js';
test.beforeEach(async({page},info)=>{
  const roomId=`ROUTE-F-${info.project.name}-${info.testId}`;
  await seedVehicleCostRoom(page,{roomId,routeMode:info.title.includes('retry')?'retry':'normal'});
  await page.goto(`/?room=${roomId}&section=organization-car`);
  await page.getByRole('link',{name:'仮参加者A車の費用',exact:true}).click();
  await editFee(page,'移動条件');
  await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
});
async function selectStop(page,role,query){
  await page.getByRole('link',{name:`${role}を検索`,exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:`${role}を検索`,exact:true})).toBeFocused();
  await page.getByRole('searchbox',{name:'場所を検索',exact:true}).fill(query);
  await page.getByRole('button',{name:new RegExp(query)}).click();
}
test('allocation route Apply edits the same unsaved car; radio Arrow keys and Back do not save',async({page})=>{
  await expect(page.getByText('地点とルートはこの端末の入力履歴です。')).toBeVisible();
  await selectStop(page,'出発地','集合場所');await selectStop(page,'目的地','登山口');
  await expect(page.getByRole('radio',{name:/候補1/})).toBeChecked();
  await page.getByRole('radio',{name:/候補1/}).press('ArrowDown');
  await expect(page.getByRole('radio',{name:/候補2/})).toBeChecked();
  await page.getByRole('button',{name:'この距離を適用',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('18');
  await expect(page.getByRole('status').filter({hasText:'未保存の入力あり'})).toBeVisible();
  await page.getByRole('link',{name:'車割へ戻る',exact:true}).click();
  await costNav(page,'精算');
  await page.getByRole('button',{name:'仮参加者A車の費用を入力',exact:true}).click();await editFee(page,'移動条件');
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('18');
  await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
  await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
  await expect(page.getByRole('button',{name:'ルートから距離を計算',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await page.getByRole('button',{name:'仮参加者A車の費用を入力',exact:true}).click();await editFee(page,'移動条件');
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('186');
});
test('search current query owns empty error delayed results and reload',async({page})=>{
  await page.getByRole('link',{name:'出発地を検索',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'場所を検索',exact:true});
  await search.fill('なし');await expect(page.getByText('一致する場所がありません。')).toBeVisible();
  await search.fill('失敗');await expect(page.getByText('場所を検索できませんでした。検索語を確認して再試行してください。')).toBeVisible();
  await expect(search).toHaveValue('失敗');await expect(page.getByRole('button',{name:'検索を再試行',exact:true})).toBeVisible();
  await search.fill('遅い');await page.waitForTimeout(220);await search.fill('新しい');
  await expect(page.getByRole('button',{name:/新しい/})).toBeVisible();await page.waitForTimeout(750);
  await expect(page.getByRole('button',{name:/遅い/})).toHaveCount(0);
  await page.reload();await expect(search).toHaveValue('新しい');
  await page.getByRole('link',{name:'ルートに戻る',exact:true}).click();
  await expect(page.getByRole('link',{name:'出発地を検索',exact:true})).toBeFocused();
});
test('retry route failure and map failure leave text and manual fallback usable',async({page})=>{
  await selectStop(page,'出発地','出発');await selectStop(page,'目的地','目的地');
  await expect(page.getByText('ルートを計算できませんでした。地点・通信環境を確認して再試行してください。')).toBeVisible();
  await page.getByRole('button',{name:'ルートを再計算',exact:true}).click();
  await expect(page.getByRole('radio',{name:/候補1/})).toBeChecked();
  await page.getByRole('button',{name:'地図を表示',exact:true}).click();
  await expect(page.getByText('地図を表示できません。文字のルート候補、または走行距離の直接入力を使用できます。')).toBeVisible();
  await expect(page.getByRole('button',{name:'この距離を適用',exact:true})).toBeEnabled();
  await expect(page.getByRole('application')).toHaveCount(0);
  await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('100');
});
test('stop reorder removal have logical keyboard focus and announce order',async({page})=>{
  await selectStop(page,'出発地','出発');await selectStop(page,'目的地','目的地');
  for(const name of ['経由A','経由B']){await page.getByRole('link',{name:'経由地を追加',exact:true}).click();await page.getByRole('searchbox',{name:'場所を検索',exact:true}).fill(name);await page.getByRole('button',{name:new RegExp(name)}).click();}
  await page.getByRole('button',{name:'経由地 2を上へ',exact:true}).press('Enter');
  await expect(page.getByRole('button',{name:'経由地 1を下へ',exact:true})).toBeFocused();
  await expect(page.getByRole('status').filter({hasText:'経由地の順序を変更しました'})).toBeVisible();
  await page.getByRole('button',{name:'経由地 1を削除',exact:true}).press('Enter');
  await expect(page.getByRole('link',{name:'経由地を追加',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
