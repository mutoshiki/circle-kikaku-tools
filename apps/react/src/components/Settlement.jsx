import SettlementOverview from './settlement-operations/SettlementOverview.jsx';
import SettlementMemo from './settlement-operations/SettlementMemo.jsx';

export default function Settlement({runtime,room,view,memoController}) {
  return <SettlementOverview runtime={runtime} view={view}><SettlementMemo room={room} controller={memoController}/></SettlementOverview>;
}
