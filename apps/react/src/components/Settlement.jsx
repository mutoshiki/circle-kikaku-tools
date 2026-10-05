import {useState} from 'react';
import {Button,TextArea} from '@carbon/react';
import SettlementOverview from './settlement-operations/SettlementOverview.jsx';

// Task 5 adds recovery and conflict handling to the supporting memo editor.
export default function Settlement({runtime,room,view,controller,snapshot}) {
  const [draft,setDraft]=useState(null),[error,setError]=useState('');
  async function save(event){event.preventDefault();const result=await controller.publishMemo(draft);if(['saved','local','unchanged'].includes(result.disposition))setDraft(null);else setError(controller.getSnapshot().reason);}
  return <SettlementOverview runtime={runtime} view={view}><section aria-labelledby="operations-memo-title"><h2 id="operations-memo-title">精算メモ</h2>{draft ? <form onSubmit={save}><TextArea id="settlement-memo-editor" labelText="精算メモ" value={draft.raw} readOnly={snapshot.blocked} onChange={event=>setDraft({...draft,raw:event.target.value})}/>{error && <p role="alert">{error}</p>}<div className="operations-actions"><Button type="submit" disabled={snapshot.blocked}>保存</Button><Button kind="secondary" type="button" disabled={snapshot.blocked} onClick={()=>setDraft(null)}>キャンセル</Button></div></form> : <><p className="operations-memo-text">{room.settlement.memo || 'メモなし'}</p><Button kind="ghost" onClick={()=>setDraft({raw:room.settlement.memo || '',openingMemo:room.settlement.memo || '',resetGeneration:room.resetGeneration})}>精算メモを編集</Button></>}</section></SettlementOverview>;
}
