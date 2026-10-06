import {createRoomStore} from '../store/room-store.js';
import {createApplicantSync} from '../sync/applicant-sync.js';
import {equalOperationValue} from './settlement-operations-model.js';

export function historyName(item){const name=item?.data?.roomName;return typeof name==='string' && name ? name : '企画名未設定';}

export function inspectLocalHistory({history,storage}) {
  let raw;try{raw=storage().getItem(history.key);}catch{return {kind:'unavailable',items:[],message:'この端末の履歴を読み込めません。保存先へのアクセスを確認してください。'};}
  try{const parsed=JSON.parse(raw || '[]');if(!Array.isArray(parsed))throw Error('not a list');const items=history.read();if(!equalOperationValue(items,parsed))return {kind:'unavailable',items:[],message:'この端末の履歴を読み込めません。保存先へのアクセスを確認してください。'};return {kind:'ready',items,message:''};}
  catch{return {kind:'corrupt',items:[],message:'この端末の履歴を読み込めません。保存済みデータは変更していません。'};}
}

export function historyImpact(before,after){
  const groupCount=(room,type)=>Object.keys(room.allocations?.[type]?.groups || {}).length;
  const paidCount=(room,type)=>Object.values(room.settlement?.[type] || {}).filter(Boolean).length;
  return [
    {label:'企画名・企画情報',changed:!equalOperationValue([before.roomName,before.overview],[after.roomName,after.overview])},
    {label:'参加者',before:Object.keys(before.participants || {}).length,after:Object.keys(after.participants || {}).length},
    {label:'車割',before:groupCount(before,'car'),after:groupCount(after,'car')},
    {label:'班割',before:groupCount(before,'team'),after:groupCount(after,'team')},
    {label:'距離・費用・精算ルール・精算メモ',changed:!equalOperationValue(before.settlement,after.settlement)},
    {label:'集金済み記録',before:paidCount(before,'paidByParticipantId')+paidCount(before,'paidByName'),after:paidCount(after,'paidByParticipantId')+paidCount(after,'paidByName')},
    {label:'支払い済み記録',before:paidCount(before,'driverPaidByParticipantId')+paidCount(before,'driverPaidByName'),after:paidCount(after,'driverPaidByParticipantId')+paidCount(after,'driverPaidByName')},
  ];
}

export function previewHistoryRestore({room,item}){
  const data=item?.data;
  const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
  if(object(data) && 'roomName' in data && typeof data.roomName!=='string')return {available:false,reason:'保存内容を確認できないため、この履歴は復元できません。',candidate:null,impact:[]};
  const malformed=!object(data) || !('participants' in data || 'cars' in data || 'allocations' in data) || 'participants' in data && (!object(data.participants) || Object.values(data.participants).some(person=>!object(person) || typeof person.name!=='string')) || 'allocations' in data && !object(data.allocations) || 'cars' in data && !Array.isArray(data.cars) || 'settlement' in data && !object(data.settlement) || 'schemaVersion' in data && !Number.isSafeInteger(data.schemaVersion);
  if(malformed)return {available:false,reason:'保存内容を確認できないため、この履歴は復元できません。',candidate:null,impact:[]};
  try{
    const preview=createRoomStore({initial:room});
    if(preview.domain.sync.isUnsupportedRemoteSchema(data))return {available:false,reason:'新しいバージョンの履歴です。このバージョンでは復元できません。',candidate:null,impact:[]};
    const applicantOwner=createApplicantSync({store:preview});
    try{applicantOwner.start();preview.command('restore',{value:structuredClone(data)});const candidate=preview.getSnapshot();return {available:true,reason:'',candidate,impact:historyImpact(room,candidate)};}
    finally{applicantOwner.dispose();}
  }
  catch{return {available:false,reason:'保存内容を確認できないため、この履歴は復元できません。',candidate:null,impact:[]};}
}
