from __future__ import annotations
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'maps-focused'
OUT.mkdir(parents=True, exist_ok=True)

ORIGIN = dict(placeId='place-origin', name='信州大学工学部', address='長野県長野市若里4丁目17-1', latitude=36.6392, longitude=138.1919)
WAYPOINT_A = dict(placeId='place-waypoint-a', name='姨捨サービスエリア', address='長野県千曲市八幡', latitude=36.5044, longitude=138.1108)
WAYPOINT_B = dict(placeId='place-waypoint-b', name='安曇野インター', address='長野県安曇野市豊科', latitude=36.3035, longitude=137.9165)
DEST = dict(placeId='place-destination', name='松本駅', address='長野県松本市深志1丁目', latitude=36.2306, longitude=137.9646)


def esc_script(text: str) -> str:
    return text.replace('</script', '<\\/script')


def build_html(theme: str) -> str:
    index = (ROOT / 'index.html').read_text()
    match = re.search(r'(<cds-modal aria-label="Google Maps 距離計算"[\s\S]*?</cds-modal>)\s*<cds-modal aria-label="履歴"', index)
    if not match:
        raise RuntimeError('route modal not found')
    route_modal = match.group(1)
    css_parts = []
    for path in sorted((ROOT / 'assets/css').rglob('*.css')):
        css_parts.append(path.read_text())
    carbon = esc_script((ROOT / 'assets/vendor/carbon/carbon-entry.min.js').read_text())
    maps_mock = esc_script((ROOT / 'tests/maps-browser-mock.js').read_text())
    scripts = [
        ROOT / 'assets/js/core/app-namespace.js',
        ROOT / 'assets/js/templates/settlement/00-template-utils.js',
        ROOT / 'assets/js/templates/settlement/08-route-helper-templates.js',
        ROOT / 'assets/js/features/settlement/route-helper/01-model.js',
        ROOT / 'assets/js/features/settlement/route-helper/02-google-loader.js',
        ROOT / 'assets/js/features/settlement/route-helper/03-route-service.js',
        ROOT / 'assets/js/features/settlement/route-helper/04-map-view.js',
        ROOT / 'assets/js/features/settlement/route-helper/05-controller.js',
        ROOT / 'assets/js/features/settlement/04-route-helper.js',
    ]
    script_tags = '\n'.join(f'<script data-source="{p.name}">{esc_script(p.read_text())}</script>' for p in scripts)
    bootstrap = r'''
<script>
(() => {
  window.escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  window.__saveCount = 0; window.__localSaveCount = 0; window.__renderCount = 0; window.__openedCar = '';
  window.__state = { cars: {
    '車A': { dist: '12', eco: '15', price: '170', rentalType: 'private', extras: [] },
    '車B': { dist: '33', eco: '18', price: '168', rentalType: 'private', extras: [] }
  }, routePlanner: null };
  window.ensureSettlementState = () => window.__state;
  window.normalizeCarSettlementState = car => ({ dist:String(car.dist ?? ''), eco:String(car.eco ?? ''), price:String(car.price ?? ''), rentalType:car.rentalType || 'private', extras:Array.isArray(car.extras)?car.extras:[] });
  window.save = () => { window.__saveCount += 1; };
  window.saveLocalDraftOnly = () => { window.__localSaveCount += 1; };
  window.renderSettlementView = () => { window.__renderCount += 1; const c=window.__state.cars['車A']; window.__derivedGas = Number(c.dist || 0) / Number(c.eco || 1) * Number(c.price || 0); };
  window.__activeSettlementCarEditName = '車A';
  window.getActiveSettlementCarEditName = () => window.__activeSettlementCarEditName;
  window.saveSettlementCarEditDraft = () => {};
  window.showStatus = () => {};
  window.openSettlementCarEditor = encoded => { window.__openedCar = decodeURIComponent(encoded); window.__activeSettlementCarEditName = window.__openedCar; window.modals.settlementCarEdit.show(); };
  const modalAdapter = id => ({ show(){ const el=document.getElementById(id); el.open=true; el.setAttribute('open',''); }, hide(){ const el=document.getElementById(id); el.dispatchEvent(new CustomEvent('sanpo:modal-hiding')); el.open=false; el.removeAttribute('open'); el.dispatchEvent(new CustomEvent('sanpo:modal-hidden')); } });
  window.modals = { routeDistance: modalAdapter('routeDistanceModal'), settlementCarEdit: modalAdapter('settlementCarEditModal') };
  window.__routeHistory = [];
  try { history.pushState = state => { window.__routeHistory.push(state); history.__state = state; }; Object.defineProperty(history,'state',{get(){return history.__state || null}, configurable:true}); history.back = () => window.dispatchEvent(new PopStateEvent('popstate')); } catch(_) {}
  class SortableMock { constructor(host, options){ this.host=host; this.options=options; window.__sortable = this; } destroy(){} }
  window.Sortable = SortableMock;
})();
</script>
'''
    return f'''<!doctype html><html lang="ja" data-theme="{theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{''.join(css_parts)}
body{{margin:0;background:var(--cds-background,#fff);color:var(--cds-text-primary,#161616);font-family:"IBM Plex Sans JP",sans-serif}}#settlementCarEditModal{{display:none}}#settlementCarEditModal[open]{{display:block;position:fixed;inset:16px;background:var(--cds-layer,#f4f4f4);z-index:9999}}</style>{bootstrap}</head><body>
<cds-modal id="settlementCarEditModal" aria-label="車Aの費用"><cds-modal-body><cds-button data-action="open-route-helper-shortcut">距離計算ツール</cds-button></cds-modal-body></cds-modal>
{route_modal}
<script data-test="maps-mock">{maps_mock}</script>
{script_tags}
<script type="module">{carbon}</script>
</body></html>'''


def click(page, selector, index=0):
    loc = page.locator(selector).nth(index)
    loc.wait_for(state='attached')
    loc.evaluate('(node) => node.click()')
    page.wait_for_timeout(60)


def select_place(page, selector, data):
    page.evaluate('([selector,data]) => window.__selectMockPlace(selector,data)', [selector, data])


def record(results, name, condition, detail=''):
    results.append({'name': name, 'ok': bool(condition), 'detail': str(detail)})
    if not condition:
        raise AssertionError(f'{name}: {detail}')


def open_helper(page, car='車A'):
    page.evaluate("car => { window.__activeSettlementCarEditName=car; window.openRouteDistanceHelper({targetCarId:car,returnTo:'carSettlement'}); }", car)
    page.wait_for_function("() => document.querySelector('#routeDistanceModal')?.hasAttribute('open')")
    page.wait_for_function("() => Boolean(document.querySelector('#routeOriginAutocompleteHost gmp-place-autocomplete'))")


def run_case(browser, width, height, theme):
    page = browser.new_page(viewport={'width': width, 'height': height}, color_scheme=theme)
    errors=[]; console=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    page.set_content(build_html(theme), wait_until='domcontentloaded')
    page.wait_for_function("() => Boolean(customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-inline-notification'))")
    page.wait_for_function("() => typeof window.openRouteDistanceHelper === 'function'")
    results=[]
    open_helper(page)
    record(results,'target car retained',page.evaluate("getRoutePlannerState().targetCarId")=='車A')
    record(results,'carbon modal visible',page.locator('#routeDistanceModal').get_attribute('open') is not None)
    record(results,'no button auto focus',page.evaluate("document.activeElement?.matches('cds-button,cds-modal-footer-button,cds-modal-close-button')") is False)

    select_place(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', ORIGIN)
    record(results,'no API call while destination absent',page.evaluate('__mapsRequests.length')==0)
    select_place(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', DEST)
    page.wait_for_function("() => document.querySelectorAll('#routeResultList cds-selectable-tile.route-result-tile').length === 4")
    record(results,'all four API route candidates shown',page.locator('#routeResultList cds-selectable-tile.route-result-tile').count()==4)
    record(results,'all alternatives drawn',page.evaluate('getRouteMapRuntimeForTests().polylines.length')==4)
    record(results,'recommended initially selected',page.evaluate('getRoutePlannerState().selectedRouteIndex')==0)
    record(results,'route choices use radiogroup semantics',page.locator('#routeResultList').get_attribute('role')=='radiogroup')
    record(results,'recommended route is visibly tagged',page.locator('#routeResultList cds-selectable-tile.route-result-tile').first.locator('cds-tag').inner_text()=='推奨')
    record(results,'selected route has roving focus',page.locator('#routeResultList cds-selectable-tile.route-result-tile').first.get_attribute('tabindex')=='0' and page.locator('#routeResultList cds-selectable-tile.route-result-tile').nth(1).get_attribute('tabindex')=='-1')
    record(results,'segment distance and time shown',page.locator('#routeLegList .route-leg-row').count()==1 and 'km' in page.locator('#routeLegList .route-leg-row').inner_text() and ('時間' in page.locator('#routeLegList .route-leg-row').inner_text() or '分' in page.locator('#routeLegList .route-leg-row').inner_text()))
    record(results,'total and roundtrip summary shown',all(page.locator(sel).inner_text().strip() not in ('','--') for sel in ['#routeSummaryDistance','#routeSummaryDuration','#routeSummaryRoundTrip']))
    record(results,'toll and highway advisories shown','有料道路' in page.locator('#routeResultList').inner_text() and '高速道路' in page.locator('#routeResultList').inner_text())
    req=page.evaluate('__mapsRequests[0]')
    record(results,'native alternatives requested',req['computeAlternativeRoutes'] is True)
    record(results,'places sent by Place ID',req['origin']['location']==f"places/{ORIGIN['placeId']}" and req['destination']['location']==f"places/{DEST['placeId']}")
    record(results,'toll computation requested','TOLLS' in req['extraComputations'])
    record(results,'cash toll estimate does not assume ETC','tollPasses' not in req['routeModifiers'])
    record(results,'road instructions requested','legs.steps.instructions' in req['fields'])
    autocomplete=page.evaluate("() => { const widget=document.querySelector('#routeOriginAutocompleteHost gmp-place-autocomplete'); return {lang:widget.lang,bias:widget.locationBias}; }")
    record(results,'autocomplete uses Japanese UI and Japan bias',autocomplete['lang']=='ja' and bool(autocomplete['bias']))
    record(results,'official Carbon selectable tiles used for every candidate',page.locator('#routeResultList cds-selectable-tile.route-result-tile').count()==4)

    click(page,'#routeResultList cds-selectable-tile.route-result-tile',1)
    record(results,'list selection synchronized',page.evaluate('getRoutePlannerState().selectedRouteIndex')==1)
    page.locator('#routeResultList cds-selectable-tile.route-result-tile').nth(1).focus()
    page.keyboard.press('ArrowRight')
    record(results,'keyboard route selection synchronized',page.evaluate('getRoutePlannerState().selectedRouteIndex')==2 and page.locator('#routeResultList cds-selectable-tile.route-result-tile').nth(2).get_attribute('tabindex')=='0')
    page.evaluate("getRouteMapRuntimeForTests().polylines[2].trigger('click')")
    record(results,'map selection synchronized',page.evaluate('getRoutePlannerState().selectedRouteIndex')==2)
    record(results,'selected route visually marked',page.locator('#routeResultList cds-selectable-tile.route-result-tile').nth(2).get_attribute('data-selected')=='true')
    retained_id=page.evaluate('getRoutePlannerState().routes[getRoutePlannerState().selectedRouteIndex].id')
    page.evaluate("refreshRoutes('manual')")
    page.wait_for_function("() => getRoutePlannerState().routes.length === 4 && document.querySelector('#routeLoading')?.hidden === true")
    record(results,'manual refresh retains selected route',page.evaluate('getRoutePlannerState().routes[getRoutePlannerState().selectedRouteIndex].id')==retained_id)
    record(results,'recommended metadata persisted',page.evaluate("getRoutePlannerState().routes.some(route => route.isRecommended && route.routeLabels.includes('DEFAULT_ROUTE'))"))

    click(page,'#routeCancelBtn')
    page.wait_for_function("() => !document.querySelector('#routeDistanceModal')?.hasAttribute('open')")
    open_helper(page)
    page.wait_for_function("() => document.querySelectorAll('#routeResultList cds-selectable-tile.route-result-tile').length === 4")
    record(results,'saved route candidates restore after reopen',page.evaluate('getRoutePlannerState().routes.length')==4 and page.evaluate('getRouteMapRuntimeForTests().polylines.length')==4)
    record(results,'selected route restores after reopen',page.evaluate('getRoutePlannerState().routes[getRoutePlannerState().selectedRouteIndex].id')==retained_id)

    typed_before=page.evaluate('__mapsRequests.length')
    page.locator('#routeOriginAutocompleteHost gmp-place-autocomplete').evaluate("node => { node.value='信州'; node.dispatchEvent(new Event('input',{bubbles:true,composed:true})); }")
    page.wait_for_function("() => getRoutePlannerState().origin === null")
    record(results,'plain text invalidates Google place selection',page.evaluate('getRoutePlannerState().origin') is None)
    record(results,'plain text does not call Routes API',page.evaluate('__mapsRequests.length')==typed_before)
    select_place(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', ORIGIN)
    page.wait_for_function("() => getRoutePlannerState().routes.length === 4")

    click(page,'#routeAddWaypointBtn'); page.wait_for_function("() => Boolean(document.querySelector('#routeWaypointAutocompleteHost0 gmp-place-autocomplete'))")
    select_place(page,'#routeWaypointAutocompleteHost0 gmp-place-autocomplete',WAYPOINT_A)
    page.wait_for_function("() => __mapsRequests.at(-1).intermediates?.length === 1")
    click(page,'#routeAddWaypointBtn'); page.wait_for_function("() => Boolean(document.querySelector('#routeWaypointAutocompleteHost1 gmp-place-autocomplete'))")
    select_place(page,'#routeWaypointAutocompleteHost1 gmp-place-autocomplete',WAYPOINT_B)
    page.wait_for_function("() => __mapsRequests.at(-1).intermediates?.length === 2")
    waypoint_req=page.evaluate('__mapsRequests.at(-1)')
    record(results,'waypoints sent in displayed order',[x['location'] for x in waypoint_req['intermediates']]==[f"places/{WAYPOINT_A['placeId']}",f"places/{WAYPOINT_B['placeId']}"])
    record(results,'native alternatives disabled with waypoints',waypoint_req['computeAlternativeRoutes'] is False)
    reorder_before=page.evaluate('__mapsRequests.length')
    page.evaluate("__sortable.options.onEnd({oldIndex:0,newIndex:1})")
    page.wait_for_function("() => getRoutePlannerState().waypoints[0]?.placeId === 'place-waypoint-b'")
    page.wait_for_function('(n) => __mapsRequests.length > n', arg=reorder_before)
    record(results,'sortable reorder persisted',page.evaluate("getRoutePlannerState().waypoints.map(x=>x.placeId)")==[WAYPOINT_B['placeId'],WAYPOINT_A['placeId']])
    reordered_req=page.evaluate('__mapsRequests.at(-1)')
    record(results,'reordered waypoints sent in new order',[x['location'] for x in reordered_req['intermediates']]==[f"places/{WAYPOINT_B['placeId']}",f"places/{WAYPOINT_A['placeId']}"])
    click(page,'[data-route-waypoint-delete]',1)
    page.wait_for_function("() => getRoutePlannerState().waypoints.length === 1")
    record(results,'waypoint deletion persisted',page.evaluate("getRoutePlannerState().waypoints.map(x=>x.placeId)")==[WAYPOINT_B['placeId']])

    for cid,key in [('routeAvoidTolls','avoidTolls'),('routeAvoidHighways','avoidHighways'),('routeAvoidFerries','avoidFerries')]:
        before=page.evaluate('__mapsRequests.length')
        page.locator('cds-checkbox#'+cid).evaluate("node => { node.checked=true; node.dispatchEvent(new Event('change',{bubbles:true,composed:true})); }")
        page.wait_for_function('(n) => __mapsRequests.length > n', arg=before)
        record(results,f'{key} modifier applied',page.evaluate(f"__mapsRequests.at(-1).routeModifiers.{key}") is True)

    state=page.evaluate('getRoutePlannerState()')
    record(results,'place structure persisted',all(k in state['origin'] for k in ['placeId','name','address','latitude','longitude']))
    record(results,'route selection persisted',len(state['routes'])>0 and state['calculatedAt']>0)
    record(results,'complete route structure persisted',all(k in state['routes'][0] for k in ['id','distanceMeters','durationSeconds','legs','viewport','polyline','hasTolls','hasHighways','warnings']))
    before_dedupe=page.evaluate('__mapsRequests.length')
    page.evaluate("refreshRoutes('restore')")
    page.wait_for_timeout(180)
    record(results,'identical automatic refresh is deduplicated',page.evaluate('__mapsRequests.length')==before_dedupe)

    page.locator('cds-checkbox#routeRoundTrip').evaluate("node => { node.checked=true; node.dispatchEvent(new Event('change',{bubbles:true,composed:true})); }")
    record(results,'round-trip total updates summary',page.evaluate("() => { const state=getRoutePlannerState(); const route=state.routes[state.selectedRouteIndex]; return document.querySelector('#routeSummaryRoundTrip').textContent === SanpoApp.settlementTemplateParts.formatRouteDistance(route.distanceMeters*2); }"))
    before_cars=page.evaluate("structuredClone(__state.cars)")
    route=page.evaluate('getRoutePlannerState().routes[getRoutePlannerState().selectedRouteIndex]')
    click(page,'#routeApplyBtn')
    page.wait_for_function("() => __openedCar === '車A'")
    after=page.evaluate('structuredClone(__state.cars)')
    expected=round(route['distanceMeters']*2/1000,1)
    record(results,'distance applied only to source car',abs(float(after['車A']['dist'])-expected)<0.11 and after['車B']['dist']==before_cars['車B']['dist'])
    record(results,'dependent calculations rerendered',page.evaluate('__renderCount')>0 and page.evaluate('__derivedGas')>0)
    record(results,'remote save invoked',page.evaluate('__saveCount')>0)
    record(results,'returned to exact source car',page.evaluate('__openedCar')=='車A')

    # reopen and cancel return
    page.evaluate("openRouteDistanceHelper({targetCarId:'車B',returnTo:'carSettlement'})")
    page.wait_for_function("() => document.querySelector('#routeDistanceModal')?.hasAttribute('open')")
    click(page,'#routeCancelBtn')
    page.wait_for_function("() => __openedCar === '車B'")
    record(results,'cancel returns to source car',page.evaluate('__openedCar')=='車B')

    # A non-car caller must never inherit a stale target from the last editor.
    page.evaluate("openRouteDistanceHelper()")
    page.wait_for_function("() => document.querySelector('#routeDistanceModal')?.hasAttribute('open')")
    record(results,'standalone open clears stale target car',page.evaluate("getRoutePlannerState().targetCarId")=='')
    record(results,'standalone open cannot apply to stale car',page.evaluate("document.querySelector('#routeApplyBtn').disabled === true && document.querySelector('#routeApplyBtn').getAttribute('aria-disabled') === 'true'"))
    click(page,'#routeCancelBtn')
    page.wait_for_function("() => !document.querySelector('#routeDistanceModal')?.hasAttribute('open')")

    # loading/error/empty and stale protection
    page.evaluate("openRouteDistanceHelper({targetCarId:'車A',returnTo:'carSettlement'})")
    page.wait_for_function("() => document.querySelector('#routeDistanceModal')?.hasAttribute('open')")
    page.evaluate("__mockRouteMode='error'; refreshRoutes('quota-test')")
    page.wait_for_function("() => !document.querySelector('#routeHelperStatus').hidden")
    record(results,'API error uses Carbon notification','API利用上限' in page.locator('#routeHelperStatusMessage').inner_text())
    page.evaluate("__mockRouteMode='empty'; refreshRoutes('empty-test')")
    page.wait_for_function("() => document.querySelector('#routeResultsNote').textContent.includes('取得できませんでした')")
    record(results,'no-route state rendered','取得できませんでした' in page.locator('#routeResultsNote').inner_text())
    page.evaluate("__mockRouteMode='success'; __mockRouteDelay=100")
    page.evaluate("refreshRoutes('old-race')")
    page.wait_for_timeout(5)
    page.evaluate("__mockRouteDelay=0; refreshRoutes('new-race')")
    page.wait_for_function("() => getRoutePlannerState().routes.length > 0")
    record(results,'newest request wins',page.evaluate('getRoutePlannerState().routes.length')>0)

    record(results,'no horizontal document overflow',page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'))
    route_box=page.locator('#routeDistanceModal').bounding_box()
    record(results,'modal fits viewport',bool(route_box and route_box['width'] <= width+1))
    shot=OUT/f'maps-{width}-{theme}.png'
    page.screenshot(path=str(shot),full_page=False)
    serious=[x for x in console if 'feature-flags' not in x and 'Attempting to re-define' not in x]
    record(results,'no page errors',not errors,'; '.join(errors))
    record(results,'no relevant console errors',not serious,'; '.join(serious[:5]))
    page.close()
    return results, str(shot)


def main():
    all_results=[]; screenshots=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(390,844),(1280,900)]:
            for theme in ('light','dark'):
                results,shot=run_case(browser,width,height,theme)
                all_results.extend([{**r,'viewport':width,'theme':theme} for r in results]); screenshots.append(shot)
        browser.close()
    summary={'total':len(all_results),'passed':sum(1 for r in all_results if r['ok']),'failed':sum(1 for r in all_results if not r['ok']),'results':all_results,'screenshots':screenshots}
    (OUT/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps({k:summary[k] for k in ['total','passed','failed']},ensure_ascii=False))
    return 1 if summary['failed'] else 0

if __name__=='__main__': sys.exit(main())
