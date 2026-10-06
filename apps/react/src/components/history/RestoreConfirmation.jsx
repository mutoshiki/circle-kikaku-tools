import {useState} from 'react';
import {Button,Checkbox} from '@carbon/react';
import TaskModal from '../TaskModal.jsx';
import {historyName} from '../../ui/project-history-model.js';
export default function RestoreConfirmation({confirmation,controller,launcher}) {
  const [understood,setUnderstood]=useState(false);const undo=confirmation.kind==='undo',action=undo?'復元を取り消す':'この状態を復元';
  return <TaskModal taskId="history-restore-confirm" open size="sm" danger modalHeading={undo?'復元を取り消しますか？':'この履歴を復元しますか？'} primaryButtonText={action} secondaryButtonText="キャンセル" closeButtonLabel="閉じる" primaryButtonDisabled={!understood||confirmation.stale} onRequestSubmit={()=>void (undo?controller.confirmUndo({understood}):controller.confirmRestore({understood}))} onRequestClose={()=>controller.cancelConfirmation()} launcherButtonRef={launcher} selectorPrimaryFocus="#history-restore-understanding">
    {confirmation.item && <p>{historyName(confirmation.item)}・{new Date(confirmation.item.time).toLocaleString('ja-JP')}</p>}
    <p>共有企画の状態を変更します。記録を復元しても、実際の集金や支払いは取り消されません。</p>
    <ul className="operations-impact">{confirmation.impact.map(item=><li key={item.label}>{item.label}: {item.before===undefined?(item.changed?'変更あり':'変更なし'):`${item.before} → ${item.after}`}</li>)}</ul>
    <p>この端末の未保存入力・履歴一覧・ルート作業の控え・認証は対象外です。応募フォーム自体や連携解除を戻す操作ではありません。</p>
    {confirmation.stale && <><p role="alert">企画または履歴が変更されました。最新の状態で確認し直してください。</p>{!undo && <Button kind="tertiary" onClick={()=>controller.selectRestore(confirmation.item)}>最新の状態で確認し直す</Button>}</>}
    <Checkbox id="history-restore-understanding" labelText="参加者・割り当て・費用・集金と支払いの記録が変わることを確認しました" checked={understood} onChange={(_, {checked})=>setUnderstood(checked)}/>
  </TaskModal>;
}
