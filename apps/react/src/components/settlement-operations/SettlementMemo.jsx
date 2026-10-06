import {useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import {Button,TextArea} from '@carbon/react';
export default function SettlementMemo({room,controller}) {
  const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot),input=useRef(null),trigger=useRef(null),composing=useRef(false),previous=useRef(snapshot.editing),returnFocus=useRef(false);
  useLayoutEffect(()=>{
    if(previous.current!==snapshot.editing){previous.current=snapshot.editing;if(snapshot.editing)input.current?.focus();else returnFocus.current=true;}
    if(returnFocus.current && !snapshot.editing && !snapshot.frozen){returnFocus.current=false;trigger.current?.focus();}
  },[snapshot.editing,snapshot.frozen]);
  async function save(event){event.preventDefault();await controller.save({composing:composing.current || event.nativeEvent?.isComposing});}
  return <section aria-labelledby="operations-memo-title"><h2 id="operations-memo-title">精算メモ</h2>{snapshot.editing ? <form className="operations-memo-form" onSubmit={save} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}><TextArea ref={input} id="settlement-memo-editor" labelText="精算メモ" value={snapshot.raw} readOnly={snapshot.frozen} invalid={!!snapshot.error} invalidText={snapshot.error} onChange={event=>controller.setRaw(event.target.value)}/><p role="status">{snapshot.dirty?'未保存':'現在のメモ'}。戻る・再読み込みでは入力を保持します。</p>{snapshot.error && <Button kind="tertiary" type="button" disabled={snapshot.frozen} onClick={()=>controller.rebase()}>控えを残して現在のメモから編集し直す</Button>}<div className="operations-actions"><Button type="submit" disabled={snapshot.frozen}>メモを保存</Button><Button kind="secondary" type="button" disabled={snapshot.frozen} onClick={()=>controller.cancel()}>キャンセル</Button></div></form> : <><p className="operations-memo-text">{room.settlement.memo || 'メモなし'}</p><Button ref={trigger} kind="tertiary" disabled={snapshot.frozen} onClick={()=>controller.edit()}>精算メモを編集</Button></>}</section>;
}
