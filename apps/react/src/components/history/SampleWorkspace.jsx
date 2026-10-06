import {useLayoutEffect,useRef,useState} from 'react';
import {Button,Checkbox,RadioButton,RadioButtonGroup,Select,SelectItem} from '@carbon/react';
import {createProjectDomain} from '../../services/project-domain.js';
import {sameBusinessState} from '../../ui/settlement-operations-model.js';
import TaskModal from '../TaskModal.jsx';
function SampleConfirmation({confirmation,stale,onConfirm,onCancel,onRecheck,launcher}) {
  const [understood,setUnderstood]=useState(false);
  return <TaskModal taskId="sample-replace-confirm" open danger size="sm" modalHeading="サンプルで置き換えますか？" primaryButtonText="サンプルで置き換える" secondaryButtonText="キャンセル" closeButtonLabel="閉じる" primaryButtonDisabled={!understood||stale} onRequestSubmit={()=>onConfirm(understood)} onRequestClose={onCancel} launcherButtonRef={launcher} selectorPrimaryFocus="#sample-understanding"><p>ローカル環境の「{confirmation.opening.roomName || '企画名未設定'}」を、選択したサンプルで置き換えます。</p><p>現在の参加者・車割・班割・距離・費用・精算ルール・集金と支払いの記録・企画情報が置き換わります。実際の金銭移動は取り消されません。端末の履歴や未保存入力は対象外です。</p>{stale && <><p role="alert">企画または選択が変更されました。最新の内容で確認し直してください。</p><Button kind="tertiary" onClick={onRecheck}>最新の内容で確認し直す</Button></>}<Checkbox id="sample-understanding" labelText="現在の企画データがサンプルに置き換わることを確認しました" checked={understood} onChange={(_, {checked})=>setUnderstood(checked)}/></TaskModal>;
}
export default function SampleWorkspace({runtime,room,controller,snapshot}) {
  const [type,setType]=useState('normal'),[carCount,setCarCount]=useState('3'),[confirmation,setConfirmation]=useState(null),[error,setError]=useState('');
  const launcher=useRef(null),wasConfirming=useRef(false),returnFocus=useRef(false),nextId=useRef(0);
  useLayoutEffect(()=>{if(wasConfirming.current&&!confirmation)returnFocus.current=true;wasConfirming.current=!!confirmation;if(returnFocus.current&&!confirmation&&!snapshot.blocked){returnFocus.current=false;launcher.current?.focus();}},[confirmation,snapshot.blocked]);
  const stale=!!confirmation && (confirmation.type!==type || confirmation.carCount!==carCount || confirmation.opening.resetGeneration!==room.resetGeneration || !sameBusinessState({before:confirmation.opening,after:room,domain:runtime.store.domain}));
  function review(){if(!runtime.sampleDataEnabled||snapshot.blocked)return;setConfirmation({id:++nextId.current,type,carCount,opening:structuredClone(runtime.store.getSnapshot())});setError('');}
  async function confirm(understood){
    const latest=runtime.store.getSnapshot();
    if(!runtime.sampleDataEnabled||!understood||!confirmation||snapshot.blocked||stale||latest.resetGeneration!==confirmation.opening.resetGeneration||!sameBusinessState({before:confirmation.opening,after:latest,domain:runtime.store.domain}))return;
    const chosen=confirmation;setConfirmation(null);
    const outcome=await controller.publishHistory({kind:'sample',perform:()=>{const project=createProjectDomain({getRoom:runtime.store.getSnapshot,settlement:runtime.store.domain.settlement});const value=chosen.type==='form'?project.createFormLinkedSampleData():project.createSampleAppData({missing:chosen.type==='missing',carCount:Number(chosen.carCount)});return runtime.store.command('restore',{value});}});
    if(outcome.disposition==='unavailable')setError(controller.getSnapshot().reason);
  }
  if(!runtime.sampleDataEnabled)return <p>この企画ではサンプル置換を利用できません。</p>;
  return <div className="operations-workspace"><p>ローカル・開発用の操作です。選択しただけでは企画を変更しません。</p><RadioButtonGroup legendText="サンプルの種類" name="sample-type" orientation="vertical" valueSelected={type} onChange={value=>setType(value)} disabled={snapshot.blocked}><RadioButton id="sample-normal" value="normal" labelText="通常サンプル"/><RadioButton id="sample-form" value="form" labelText="フォーム連携サンプル"/><RadioButton id="sample-missing" value="missing" labelText="入力漏れサンプル"/></RadioButtonGroup>{type!=='form' && <Select id="sample-car-count" labelText="車の数" value={carCount} onChange={event=>setCarCount(event.target.value)} disabled={snapshot.blocked}>{['2','3','4','5'].map(value=><SelectItem key={value} value={value} text={`${value}台`}/>)}</Select>}<div><Button ref={launcher} kind="tertiary" disabled={snapshot.blocked} onClick={review}>置換内容を確認</Button></div>{error && <p role="alert">{error}</p>}{confirmation && <SampleConfirmation key={confirmation.id} confirmation={confirmation} stale={stale} onConfirm={confirm} onCancel={()=>setConfirmation(null)} onRecheck={review} launcher={launcher}/>}</div>;
}
