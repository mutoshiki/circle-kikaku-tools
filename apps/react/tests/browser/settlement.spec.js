import {test,expect} from '@playwright/test';
import {seedVehicleCostRoom,vehicleFixture,editFee} from './vehicle-cost-fixture.js';
import {navigateToProjectSection} from './project-navigation.js';
const pageErrors=new WeakMap(),browserConsoleIssues=new WeakMap();
const roomState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)));
const paymentRow=(page,name)=>page.getByRole('list',{name:/支払い対象/}).getByRole('listitem').filter({has:page.getByRole('heading',{name,exact:true})});
async function payments(page){await navigateToProjectSection(page,'精算');await page.getByRole('link',{name:'支払いを確認',exact:true}).click();await page.getByRole('tab',{name:'すべて',exact:true}).click();}
async function collection(page){await navigateToProjectSection(page,'精算');await page.getByRole('link',{name:'集金を確認',exact:true}).click();}
async function touchCheckbox(page,box){await page.locator(`label[for="${await box.getAttribute('id')}"]`).click();}
async function openCarExpenseEditor(page){await navigateToProjectSection(page,'車両費用');await page.getByRole('link',{name:'仮参加者A車の費用を入力',exact:true}).click();}
test.beforeEach(async({page},info)=>{
  const errors=[],issues=[];pageErrors.set(page,errors);browserConsoleIssues.set(page,issues);
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(['warning','error'].includes(message.type()))issues.push(`${message.type()}: ${message.text()}`);});
  const room=structuredClone(vehicleFixture);
  if(info.title==='settlement rows wrap long car names and format zero amount'){
    const old=room.cars[0].name,long='とても長い確認用のレンタカー車名'.repeat(3);room.cars[0].name=long;
    room.settlement.cars[long]={...room.settlement.cars[old],dist:'0',extras:[]};delete room.settlement.cars[old];
    room.settlement.driverPaid[long]=room.settlement.driverPaid[old];delete room.settlement.driverPaid[old];room.settlement.driverReward='0';room.settlement.driverCollectionOffset=false;
  }
  if(info.title.includes('excluded')){room.settlement.organizerFree=true;room.cars[0].members.push(...Array.from({length:18},(_,i)=>({name:`検証参加者${i+1}`,grade:1})));}
  const roomId=`SETTLEMENT-${info.project.name}-${info.testId}-${info.retry}`;await seedVehicleCostRoom(page,{roomId,room});await page.goto(`/?room=${roomId}&section=settlement`);
});
test.afterEach(async({page})=>{expect(browserConsoleIssues.get(page)).toEqual([]);expect(pageErrors.get(page)).toEqual([]);});

test('settings cancel/save, signed extras, collection state and reload', async ({ page }) => {
  await expect(page.getByRole('link',{name:'集金を確認',exact:true})).toBeVisible();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  let settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await settings.getByText('10円単位', { exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '車への支払額から差し引く' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await settings.getByText('10円単位', { exact: true }).click();
  await settings.getByLabel('1台あたりの協力代（円）').fill('700');
  await settings.getByRole('button', { name: '精算ルールを保存' }).click();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '10円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await openCarExpenseEditor(page);
  await page.getByRole('button', { name: '費用を追加', exact:true }).click();
  const name=page.getByRole('textbox',{name:'費用名',exact:true});
  await name.dispatchEvent('compositionstart');
  await name.fill('にほんごへんかんちゅう');
  await name.press('Enter');
  await expect(page.getByRole('form')).toBeVisible();
  await name.dispatchEvent('compositionend',{data:'日本語変換中の返金'});
  await name.fill('日本語変換中の返金');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('300');
  await page.getByRole('group',{name:'負担区分',exact:true}).getByText('部費',{exact:true}).click();
  await page.getByText('部費の費用から差し引く',{exact:true}).click();
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await payments(page);
  const carA = paymentRow(page,'仮参加者A車');
  await carA.getByRole('button', { name: /割勘 .*・部費/ }).click();
  await expect(carA.getByText('日本語変換中の返金')).toBeVisible();

  await collection(page);
  await page.getByRole('tab', { name: 'すべて' }).click();
  await touchCheckbox(page,page.getByRole('checkbox',{name:'仮参加者Cの集金済み',exact:true}));
  await expect(page.getByRole('dialog', { name: '集金済みにする' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金済み' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '集金を確認' })).toHaveCount(0);
  const driverPaidBefore = await page.evaluate(() => JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)).settlement.driverPaid);

  await page.reload();
  await navigateToProjectSection(page, '精算');
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '10円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await payments(page);
  const reloadedCarA = paymentRow(page,'仮参加者A車');
  await reloadedCarA.getByRole('button', { name: /割勘 .*・部費/ }).click();
  await expect(reloadedCarA.getByText('日本語変換中の返金')).toBeVisible();
  await collection(page);
  await page.getByRole('tab', { name: 'すべて' }).click();
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金済み' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const driverPaidAfter = await page.evaluate(() => JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)).settlement.driverPaid);
  expect(driverPaidAfter).toEqual(driverPaidBefore);

  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('car fee list preserves reuse deletion standard rows and Japanese raw input', async ({page})=>{
  await page.setViewportSize({width:390,height:703});
  await openCarExpenseEditor(page);
  await expect(page.getByRole('heading',{level:1,name:'仮参加者A車の費用'})).toBeFocused();
  const list=page.getByRole('list',{name:'費目一覧',exact:true});
  await expect(list.getByRole('listitem')).toHaveCount(5);
  const reward=list.getByRole('listitem').filter({hasText:'車出し協力代'});
  await expect(reward.getByRole('link')).toHaveCount(0);
  await expect(reward.getByRole('button')).toHaveCount(0);
  await page.getByRole('combobox',{name:'登録済み費用',exact:true}).selectOption('駐車代');
  await page.getByRole('button',{name:'登録済みから追加',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('駐車代');
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('800');
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('再利用費用');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await page.getByRole('button',{name:'再利用費用の操作',exact:true}).click();
  await page.getByRole('menuitem',{name:'削除',exact:true}).click();
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await expect(list.getByRole('listitem').filter({hasText:'再利用費用'})).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(5);
});

test('mobile list and editor keep amounts separate from actions and preserve edits on Back', async({page})=>{
  await page.setViewportSize({width:390,height:703});
  await openCarExpenseEditor(page);
  const list=page.getByRole('list',{name:'費目一覧',exact:true});
  for(const width of [390,565]){
    await page.setViewportSize({width,height:703});
    const row=list.getByRole('listitem').filter({hasText:'駐車代'});
    const amount=await row.getByText('800円',{exact:true}).boundingBox(), action=await row.getByRole('link',{name:'駐車代を編集'}).boundingBox();
    expect(amount.x+amount.width<=action.x || amount.y+amount.height<=action.y || action.y+action.height<=amount.y).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('link',{name:'駐車代を編集',exact:true}).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('form')).toHaveCount(1);
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('900');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await page.getByRole('link',{name:'駐車代を編集',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('900');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
});

test('movement page has one document scroll with usable fields and commit actions in short viewport',async({page})=>{
  await page.setViewportSize({width:390,height:600});
  await openCarExpenseEditor(page);
  await editFee(page,'移動条件');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const label of ['走行距離（km）','燃費（km/L）','ガソリン単価（円/L）'])await expect(page.getByRole('textbox',{name:label,exact:true})).toHaveAttribute('inputmode','decimal');
  await expect(page.getByText('186km ÷ 18km/L × 158円/L',{exact:true})).toBeVisible();
  const save=page.getByRole('button',{name:'車両費用を保存',exact:true});
  await save.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  const box=await save.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y+box.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
});

test('desktop cost workspace shares one form and scan list without horizontal scroll',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await openCarExpenseEditor(page);
  const list=page.getByRole('list',{name:'費目一覧',exact:true}),form=page.getByRole('form');
  await expect(list).toBeVisible();await expect(form).toHaveCount(1);await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  const a=await list.boundingBox(),b=await form.boundingBox();expect(a.x+a.width).toBeLessThanOrEqual(b.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('人数だけで精算するdraft survives save and reload', async ({ page }) => {
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const modal = page.getByRole('form', { name: '精算ルール', exact: true });
  await modal.getByText('人数だけで精算', { exact: true }).click();
  await modal.getByLabel('運転手の人数').fill('2');
  await modal.getByLabel('同乗者の人数').fill('4');
  await modal.getByLabel('運転手1の名前').fill('第一運転手');
  await modal.getByLabel('運転手2の名前').fill('第二運転手');
  await modal.getByRole('button', { name: '精算ルールを保存' }).click();
  await payments(page);
  await expect(page.getByRole('heading', { name: '第一運転手車' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第二運転手車' })).toBeVisible();
  await page.reload();
  await navigateToProjectSection(page, '精算');
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const reloadedSettings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(reloadedSettings.getByLabel('運転手の人数')).toHaveValue('2');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('registered-participant collection records directly without asking for a collector',async({page})=>{
  await collection(page);await page.getByRole('tab',{name:'すべて',exact:true}).click();const box=page.getByRole('checkbox',{name:'仮参加者Cの集金済み',exact:true});await touchCheckbox(page,box);await expect(box).toBeChecked();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('collection page supports filters copy excluded labels and document scrolling',async({page})=>{
  const chromium=page.context().browser().browserType().name()==='chromium';if(chromium)await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await collection(page);await expect(page.getByRole('tab',{name:'未集金',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'未集金者をコピー',exact:true}).click();if(chromium)expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('仮参加者');
  await page.getByRole('tab',{name:'すべて',exact:true}).click();await expect(page.getByText(/免除|集金対象外/).first()).toBeVisible();
  const box=page.getByRole('checkbox',{name:'検証参加者1の集金済み',exact:true});await box.focus();await box.press('Space');await expect(box).toBeChecked();await box.press('Space');await expect(box).not.toBeChecked();
  await box.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('link',{name:'精算へ戻る',exact:true}).click();await expect(page.getByRole('link',{name:'集金を確認',exact:true})).toBeFocused();
});
test('vehicle costs entry remains visible independently of collapsed detail',async({page})=>{
  await payments(page);const row=paymentRow(page,'仮参加者A車'),entry=row.getByRole('link',{name:/費用を入力/}),detail=row.getByRole('button',{name:/内訳/});await expect(detail).toHaveAttribute('aria-expanded','false');await expect(entry).toBeVisible();await detail.click();await entry.click();await expect(page.getByRole('heading',{level:1,name:'仮参加者A車の費用'})).toBeVisible();
});
test('payment detail retains expense names and signed discount',async({page})=>{
  await payments(page);const row=paymentRow(page,'仮参加者A車');await row.getByRole('button',{name:/内訳/}).click();for(const name of ['高速代','駐車代','割引'])await expect(row.getByText(name,{exact:true})).toBeVisible();await expect(row.getByText('¥-200',{exact:true})).toBeVisible();
});
test('payment recipients remain identifiable for single and multiple drivers',async({page})=>{
  await payments(page);await expect(paymentRow(page,'仮参加者A車').getByText('運転手: 仮参加者A',{exact:true})).toBeVisible();await navigateToProjectSection(page,'車割');await page.getByRole('link',{name:'仮参加者A車の詳細',exact:true}).click();await page.getByRole('region',{name:'仮参加者A車',exact:true}).getByRole('button',{name:'仮参加者Bの操作',exact:true}).click();await page.getByRole('menuitem',{name:'運転手にする',exact:true}).click();await payments(page);await expect(paymentRow(page,'仮参加者A車').getByText('運転手: 仮参加者A、仮参加者B（車単位で一括支払い）',{exact:true})).toBeVisible();
});
test('vehicle settlement retains signed golden breakdown with keyboard disclosure',async({page})=>{
  await payments(page);const row=paymentRow(page,'仮参加者D車'),detail=row.getByRole('button',{name:'仮参加者D車の内訳（割勘 ¥2,200・部費 ¥-100）',exact:true});await expect(detail).toHaveAttribute('aria-expanded','false');await detail.focus();await detail.press('Enter');await expect(detail).toHaveAttribute('aria-expanded','true');await detail.press('Space');await expect(detail).toHaveAttribute('aria-expanded','false');await detail.click();await expect(row.getByText('部費返金',{exact:true})).toBeVisible();await expect(row.getByText('¥-100',{exact:true}).first()).toBeVisible();await expect(row.getByText('集金分差引',{exact:true})).toBeVisible();
});
test('settlement rows wrap long car names and format zero amount',async({page})=>{
  await payments(page);const row=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:/とても長い確認用のレンタカー車名/})});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await expect(row.getByRole('button',{name:/割勘 ¥0・部費 ¥0/})).toBeVisible();await expect(row.getByRole('link',{name:/費用を入力/})).toBeVisible();await expect(row.getByText('¥0',{exact:true}).first()).toBeVisible();
});
test('settlement memo stays summarized until lightweight inline editing is opened',async({page})=>{
  await expect(page.getByRole('textbox',{name:'精算メモ',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'精算メモを編集',exact:true}).click();await page.getByRole('textbox',{name:'精算メモ',exact:true}).fill('下書き');await page.getByRole('button',{name:'キャンセル',exact:true}).click();await page.getByRole('button',{name:'精算メモを編集',exact:true}).click();await page.getByRole('textbox',{name:'精算メモ',exact:true}).fill('高速料金は武内さんが立替済み。');await page.getByRole('button',{name:'メモを保存',exact:true}).click();await page.reload();await expect(page.getByText('高速料金は武内さんが立替済み。',{exact:true})).toBeVisible();
});
test('vehicle payment recording changes only the selected vehicle and survives reload',async({page})=>{
  await payments(page);const before=await roomState(page),box=paymentRow(page,'仮参加者D車').getByRole('checkbox');await box.focus();await box.press('Space');await expect(box).toBeChecked();const after=await roomState(page);expect(after.settlement.carsByParticipantId).toEqual(before.settlement.carsByParticipantId);expect(after.participants).toEqual(before.participants);expect(after.allocations).toEqual(before.allocations);await page.reload();await expect(box).toBeChecked();
});
