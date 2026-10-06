import {Button} from '@carbon/react';
export const money=value=>`¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;
export const normalClick=event=>event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey;
const text={local:'この端末に記録',pending:'記録を保存しています',saved:'共有保存済み',failed:'記録を保存できませんでした。同じ内容で再試行できます。',unresolved:'保存結果を確認できません。',adjusted:'記録が更新されています。現在の内容を確認してください。',reset:'企画がリセットされました。現在の内容を確認してください。','accepted-needs-review':'変更は受理されています。現在の企画を確認してください。'};
export default function OperationFeedback({controller,snapshot}) {
  const op=snapshot.operation, receipt=op?.receipt, disposition=receipt?.disposition || op?.disposition;
  const review=disposition==='reset'||['adjusted','accepted-needs-review'].includes(disposition)&&(receipt?.acknowledged || op?.acknowledged);
  function act(event) {
    if(!review){if(receipt?.canRetry)void controller.retry();else void controller.observe();return;}
    const ownedFocus=document.activeElement===event.currentTarget;
    if(controller.confirmCurrent() && ownedFocus)document.getElementById('project-page-title')?.focus();
  }
  return <div className="operations-feedback">
    {snapshot.cacheWarning && <p role="status">{snapshot.cacheWarning}</p>}
    {op && <p role="status">{text[disposition] || '記録を確認してください'}</p>}
    {snapshot.reason && snapshot.blocked && <p>{snapshot.reason}</p>}
    {op && !['saved','local'].includes(disposition) && <Button kind="tertiary" type="button" size="sm" onClick={act}>{review?'現在の内容を確認':receipt?.canRetry?'同じ内容を再試行':'保存結果を確認'}</Button>}
  </div>;
}
