import {useSyncExternalStore} from 'react';
import {Button} from '@carbon/react';
export default function ProjectHistory({controller}) {
  const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  return <div className="operations-workspace"><p>履歴はこの端末に保存されます。復元すると、共有企画の参加者・割り当て・費用・精算記録などが変わります。</p>{snapshot.status && <p role="status">{snapshot.status}</p>}{snapshot.loadIssue && <p role="alert">{snapshot.loadIssue}</p>}{snapshot.items.length ? <ul className="operations-list" aria-label="この端末の保存済み履歴">{snapshot.items.map(row=><li className="operations-history-row" key={row.key}><div className="operations-record-summary"><h2>{row.item?.data?.roomName || '企画名未設定'}</h2><p>{Number.isFinite(row.item?.time)?new Date(row.item.time).toLocaleString('ja-JP'):'保存日時不明'}</p>{row.current && <p>現在の状態と一致</p>}</div></li>)}</ul> : !snapshot.loadIssue && <p>この端末に履歴はありません。現在の状態を保存すると、ここから復元できます。</p>}</div>;
}
