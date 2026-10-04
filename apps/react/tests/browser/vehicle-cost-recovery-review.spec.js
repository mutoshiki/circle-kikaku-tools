import {test,expect} from '@playwright/test';
import {seedVehicleCostRoom,editFee} from './vehicle-cost-fixture.js';

test('vehicle list distinguishes receipt recovery from a shared saved total',async({page},info)=>{
  const roomId=`F-RECEIPT-${info.project.name}`;
  await seedVehicleCostRoom(page,{roomId});
  await page.goto(`/?room=${roomId}&section=vehicle-costs`);
  const cases=[['pending','共有保存中'],['failed','共有保存に失敗'],['unresolved','保存結果は未確認'],['adjusted','同時編集の結果を確認']];
  for(const [disposition,label] of cases){
    await page.evaluate(({roomId,disposition})=>sessionStorage.setItem(`sanpo-ui:vehicle-cost:v1:${encodeURIComponent(roomId)}:participant%3Ap_1xeyc8h`,JSON.stringify({version:1,data:{name:'仮参加者A',resetGeneration:0,fields:{movement:{dist:'222'}},before:{movement:{dist:'186'}},added:[],removed:[],receipt:{type:'cost',label:'仮参加者A車の費用',resetGeneration:0,operationId:'review-held-operation',patch:{'settlement/carsByParticipantId/p_1xeyc8h/dist':'222'},before:{'settlement/carsByParticipantId/p_1xeyc8h/dist':'186'},diagnosticCount:0,disposition,canRetry:disposition==='failed',acknowledged:disposition==='adjusted'}}})),{roomId,disposition});
    await page.reload();
    const row=page.getByRole('listitem').filter({has:page.getByRole('link',{name:'仮参加者A車の費用を入力',exact:true})});
    await expect(row.getByText(label,{exact:true})).toBeVisible();
    await expect(row.getByText(/^保存済み合計/)).toHaveCount(0);
    await expect(row.getByText(/^現在の合計（共有保存を確認）/)).toBeVisible();
    await expect(page.getByRole('listitem').filter({has:page.getByRole('link',{name:'仮参加者D車の費用を入力',exact:true})}).getByText(/^保存済み合計/)).toBeVisible();
  }
});

test('Times fee remains recoverable when toggling private and reopening the car',async({page},info)=>{
  const roomId=`F-TYPE-${info.project.name}`;await seedVehicleCostRoom(page,{roomId});await page.goto(`/?room=${roomId}&section=vehicle-costs`);
  await page.getByRole('link',{name:'仮参加者A車の費用を入力',exact:true}).click();await editFee(page,'移動条件');
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('210');
  await page.getByRole('radio',{name:'自家用車',exact:true}).press('ArrowDown');await editFee(page,'タイムズ時間料金');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('2500');await editFee(page,'移動条件');
  await page.getByRole('radio',{name:'タイムズ',exact:true}).press('ArrowUp');await page.reload();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toBeEnabled();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('210');
  await page.getByRole('radio',{name:'自家用車',exact:true}).press('ArrowDown');await editFee(page,'タイムズ時間料金');
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('2500');
});
