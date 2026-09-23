import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, Callout, Checkbox, ContainedList, ContainedListItem, IconButton, InlineLoading, InlineNotification, Search } from '@carbon/react';
import { Add, ArrowDown, ArrowUp, Close, Map, SettingsAdjust } from '@carbon/icons-react';
import { distanceKilometers } from '../route/service.js';
import { createRouteDomain } from '../route/legacy-domain.js';

const empty = { origin: null, destination: null, waypoints: [], routes: [], selectedRouteIndex: 0, avoidTolls: true, avoidHighways: true, avoidFerries: false, roundTrip: false, recentPlaces: [] };
const roleLabel = target => target.role === 'origin' ? '出発地' : target.role === 'destination' ? '目的地' : `経由地 ${target.index + 1}`;

function PlaceSearch({ runtime, target, recent, onSelect }) {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState({ status: 'idle', entries: recent });
  useEffect(() => {
    if (!query.trim()) { setSearchState({ status: 'idle', entries: recent }); return undefined; }
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const entries = await runtime.routeService.search(query.trim());
        if (!current) return;
        setSearchState(entries.length ? { status: 'results', entries } : { status: 'empty' });
      } catch (caught) {
        if (!current) return;
        console.error('Route place search failed', caught);
        setSearchState({ status: 'error' });
      }
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [query, recent, runtime]);
  async function choose(entry) {
    setSearchState({ status: 'loading', operation: 'resolve' });
    try { await onSelect(entry.placeId && entry.latitude != null ? entry : await runtime.routeService.resolve(entry)); }
    catch (caught) { console.error('Route place selection failed', caught); setSearchState({ status: 'error' }); }
  }
  function updateQuery(event) {
    const next = event.target.value;
    setQuery(next);
    setSearchState(next.trim() ? { status: 'loading', operation: 'search' } : { status: 'idle', entries: recent });
  }
  const entries = searchState.status === 'results' ? searchState.entries : searchState.status === 'idle' ? searchState.entries : [];
  const listLabel = query.trim() ? '検索結果' : '最近選んだ場所';
  return <section className="route-place-search" aria-label={`${roleLabel(target)}を検索`}>
    <Search id="route-place-search" labelText="場所を検索" placeholder="場所を検索" value={query} size="lg" autoComplete="off" closeButtonLabelText="検索語を消去" onChange={updateQuery} onClear={() => { setQuery(''); setSearchState({ status: 'idle', entries: recent }); }} />
    {searchState.status === 'loading' && <InlineLoading description={searchState.operation === 'resolve' ? '場所を確認しています' : '場所を検索しています'} />}
    {searchState.status === 'error' && <InlineNotification kind="error" title="場所を検索できませんでした" subtitle="もう一度お試しください。" hideCloseButton lowContrast />}
    {searchState.status === 'empty' && <p className="route-place-empty">一致する場所がありません。</p>}
    {entries.length > 0 && (searchState.status === 'results' || searchState.status === 'idle') && <ContainedList className="route-place-results" label={listLabel} size="lg">{entries.map((entry, index) => <ContainedListItem key={entry.placeId || entry.id || index} onClick={() => choose(entry)}><span className="route-place-result"><strong>{entry.name || entry.mainText?.text || entry.text?.text || entry.query || '候補'}</strong>{entry.address && <small>{entry.address}</small>}</span></ContainedListItem>)}</ContainedList>}
    {searchState.status === 'idle' && !entries.length && <p className="route-place-empty">場所を検索してください。</p>}
  </section>;
}

const RoutePlanner = forwardRef(function RoutePlanner({ runtime, onApply, onStatusChange }, ref) {
  const stored = runtime.routeDraft.read(empty);
  const [draft, setDraft] = useState({ ...empty, ...stored, roundTrip: false, waypoints: Array.isArray(stored.waypoints) ? stored.waypoints : [], routes: Array.isArray(stored.routes) ? stored.routes : [], recentPlaces: Array.isArray(stored.recentPlaces) ? stored.recentPlaces : [] });
  const [searchTarget, setSearchTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mapRef = useRef(null);
  const routeDomain = createRouteDomain();
  const selected = routeDomain.getSelectedRoute(draft);
  function persist(next) { runtime.routeDraft.write(next); setDraft(next); return next; }
  async function calculate(next = draft) {
    if (!runtime.routeService) { setError('Google Maps / Routes adapterが設定されていません。'); return; }
    if (!next.origin || !next.destination) return;
    setLoading(true); setError('');
    try { persist(await runtime.routeService.calculate({ ...next, roundTrip: false })); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }
  async function selectPlace(place) {
    const recentPlaces = [place, ...draft.recentPlaces.filter(item => item.placeId !== place.placeId)].slice(0, 12);
    let next = { ...draft, recentPlaces, routes: [], selectedRouteIndex: 0 };
    if (searchTarget.role === 'origin') next.origin = place;
    else if (searchTarget.role === 'destination') next.destination = place;
    else {
      const waypoints = [...next.waypoints];
      if (searchTarget.index >= waypoints.length) waypoints.push(place); else waypoints[searchTarget.index] = place;
      next.waypoints = waypoints;
    }
    persist(next); setSearchTarget(null); await calculate(next);
  }
  function remove(role, index = -1) {
    const next = { ...draft, routes: [], selectedRouteIndex: 0 };
    if (role === 'origin') next.origin = null;
    else if (role === 'destination') next.destination = null;
    else next.waypoints = draft.waypoints.filter((_, itemIndex) => itemIndex !== index);
    persist(next);
  }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= draft.waypoints.length) return;
    const waypoints = [...draft.waypoints]; [waypoints[index], waypoints[target]] = [waypoints[target], waypoints[index]];
    const next = { ...draft, waypoints, routes: [], selectedRouteIndex: 0 }; persist(next); void calculate(next);
  }
  function option(changes) { const next = { ...draft, ...changes, routes: [], selectedRouteIndex: 0, roundTrip: false }; persist(next); void calculate(next); }
  function apply() {
    const value = distanceKilometers(draft, routeDomain);
    if (!value) { setError('適用するルートを選択してください。'); return; }
    onApply(String(value));
  }
  function returnToPlanner() {
    if (!searchTarget) return false;
    setSearchTarget(null);
    return true;
  }
  useImperativeHandle(ref, () => ({ apply, returnToPlanner }), [draft, loading, searchTarget]);
  useEffect(() => {
    if (!mapOpen || !mapRef.current || !selected || !runtime.routeService?.renderMap) return;
    runtime.routeService.renderMap(mapRef.current, draft).catch(caught => setError(caught.message));
  }, [mapOpen, selected, draft, runtime]);
  const stop = (place, role, index = -1) => {
    const label = roleLabel({ role, index });
    const actions = (role === 'waypoint' || place) && <div className="route-stop-actions" onClick={event => event.stopPropagation()}>
      {role === 'waypoint' && <><IconButton kind="ghost" size="sm" label={`${label}を上へ`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></IconButton><IconButton kind="ghost" size="sm" label={`${label}を下へ`} disabled={index === draft.waypoints.length - 1} onClick={() => move(index, 1)}><ArrowDown /></IconButton></>}
      {place && <IconButton kind="ghost" size="sm" label={`${label}を削除`} onClick={() => remove(role, index)}><Close /></IconButton>}
    </div>;
    return <ContainedListItem key={`${role}-${index}`} id={role === 'origin' ? 'route-origin-action' : undefined} className="route-stop-item" onClick={() => setSearchTarget({ role, index })} action={actions}>
      <span className="route-stop-content"><span className="route-stop-marker" aria-hidden="true">{role === 'origin' ? 'O' : role === 'destination' ? 'D' : String.fromCharCode(65 + index)}</span><span className="route-stop-copy"><small>{label}</small><strong>{place?.name || `${label}を追加`}</strong>{place?.address && <span>{place.address}</span>}</span></span>
    </ContainedListItem>;
  };
  const waypointAction = <ContainedListItem className="route-waypoint-action" renderIcon={Add} disabled={draft.waypoints.length >= 25} onClick={() => setSearchTarget({ role: 'waypoint', index: draft.waypoints.length })}>経由地を追加</ContainedListItem>;
  const distanceLabel = selected ? `${(selected.distanceMeters / 1000).toFixed(selected.distanceMeters >= 100000 ? 1 : 2)}km` : '';
  useEffect(() => { onStatusChange({ primaryLabel: selected ? `合計 ${distanceLabel} を適用` : 'この距離を適用', disabled: !selected || loading, hidePrimaryButton: Boolean(searchTarget) }); }, [distanceLabel, loading, onStatusChange, searchTarget, selected]);
  return <>
    {searchTarget ? <PlaceSearch runtime={runtime} target={searchTarget} recent={draft.recentPlaces} onSelect={selectPlace} /> : <div className={`route-planner-shell${mapOpen ? ' map-open' : ''}`}>
      <section className="route-planner-controls" aria-label="地点入力">
        <Callout className="route-planner-callout" kind="warning" title="場所はルーム内で共有されます" subtitle="自宅住所ではなく、近くの施設を指定してください。" lowContrast />
        <ContainedList className="route-stop-list" label="ルート地点" size="lg">{stop(draft.origin, 'origin')}{draft.waypoints.map((place, index) => stop(place, 'waypoint', index))}{stop(draft.destination, 'destination')}{waypointAction}</ContainedList>
        <div className="route-toolbar"><Button kind="tertiary" renderIcon={Map} aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}>{mapOpen ? '地図を閉じる' : '地図を表示'}</Button><Button kind="ghost" renderIcon={SettingsAdjust} aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>{settingsOpen ? 'ルート設定を閉じる' : 'ルート設定'}</Button></div>
        {settingsOpen && <div className="route-options" role="group" aria-label="ルート設定"><Checkbox id="route-use-tolls" labelText="有料道路を使う" checked={!draft.avoidTolls} onChange={(_, { checked }) => option({ avoidTolls: !checked })} /><Checkbox id="route-use-highways" labelText="高速道路を使う" checked={!draft.avoidHighways} onChange={(_, { checked }) => option({ avoidHighways: !checked })} /></div>}
        {error && <InlineNotification kind="error" title="ルートを計算できませんでした" subtitle={error} hideCloseButton lowContrast />}{loading && <InlineLoading description="ルート候補を取得しています" />}
      </section>
      {mapOpen && <section className="route-map-panel" aria-label="ルート地図"><div ref={mapRef} className="route-map" role="application" aria-label="ルート候補の地図">{!runtime.routeService?.renderMap && <p>ルートを選ぶと地図を表示します。</p>}</div></section>}
      <section className="route-planner-results" aria-labelledby="route-results-title"><h3 id="route-results-title">ルート候補</h3>{draft.routes.length ? <div className="route-results" role="radiogroup" aria-label="ルート候補">{draft.routes.map((route, index) => <button type="button" role="radio" aria-checked={index === draft.selectedRouteIndex} className="route-result" key={route.id} onClick={() => persist({ ...draft, selectedRouteIndex: index })}><strong>{route.label}</strong><span>{(route.distanceMeters / 1000).toFixed(route.distanceMeters >= 100000 ? 1 : 2)} km</span><small>{Math.round(route.durationSeconds / 60)}分{route.tollPrice ? `・${route.tollPrice}` : ''}</small></button>)}</div> : <p className="route-empty">出発地と目的地を選択すると、ルート候補を表示します。</p>}{selected && <div className="route-leg-summary"><strong>合計 {distanceLabel}・{Math.round(selected.durationSeconds / 60)}分</strong>{selected.legs?.map((leg, index) => <span key={index}>{leg.fromName || `地点${index + 1}`} → {leg.toName || `地点${index + 2}`}　{(leg.distanceMeters / 1000).toFixed(1)}km・{Math.round(leg.durationSeconds / 60)}分</span>)}</div>}</section>
    </div>}
  </>;
});

export default RoutePlanner;
