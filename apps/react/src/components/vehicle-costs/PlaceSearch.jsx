import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Button, ContainedList, ContainedListItem, InlineLoading, Search } from '@carbon/react';

export default function PlaceSearch({controller,stopKey,onResolved}) {
  const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const {search,state}=snapshot;
  const active=useRef(true);
  useEffect(()=>{
    active.current=true;
    if(search.query)controller.setQuery(search.query);
    return()=>{active.current=false;};
  },[controller,stopKey]);
  const entries=search.status==='ready'?search.predictions:search.status==='idle' && !search.query?state.recentPlaces:[];
  async function choose(entry){if(await controller.resolveStop(stopKey,entry) && active.current)onResolved();}
  return <section className="vehicle-place-search" aria-label="地点検索">
    <Search id="vehicle-place-search" labelText="場所を検索" placeholder="施設名や住所" value={search.query} size="lg" autoComplete="off" closeButtonLabelText="検索語を消去" onChange={event=>controller.setQuery(event.target.value)} onClear={()=>controller.setQuery('')} />
    <p role="status" aria-live="polite">{search.status==='ready'?`${entries.length}件の検索結果`:search.status==='empty'?'一致する場所がありません。':search.status==='error'?search.error:search.status==='idle' && !entries.length?'場所を検索してください。':''}</p>
    {search.status==='pending' && <InlineLoading description="場所を検索・確認しています" />}
    {search.status==='error' && <Button kind="tertiary" onClick={()=>controller.setQuery(search.query)}>検索を再試行</Button>}
    {entries.length>0 && <ContainedList label={search.query?'検索結果':'最近選んだ場所'} size="lg">{entries.map((entry,index)=><ContainedListItem key={entry.placeId || index} onClick={()=>choose(entry)}><div className="vehicle-place-result"><strong>{entry.name || entry.mainText?.text || entry.text?.text || '候補'}</strong><span>{entry.address || entry.secondaryText?.text || ''}</span></div></ContainedListItem>)}</ContainedList>}
  </section>;
}
