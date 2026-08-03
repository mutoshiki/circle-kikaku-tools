from __future__ import annotations
import json, re, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'maps-inline'
OUT.mkdir(parents=True, exist_ok=True)
MOCK_SOURCE = (ROOT / 'tests/maps-browser-mock.js').read_text()

def inline_project() -> str:
    html = (ROOT / 'index.html').read_text()
    def repl_link(match):
        attrs, href = match.group(1), match.group(2)
        rel = href.split('?', 1)[0].split('#', 1)[0]
        path = ROOT / rel.removeprefix('./')
        if path.exists() and path.suffix == '.css':
            return f'<style data-source="{rel}">\n{path.read_text()}\n</style>'
        if 'preload' in attrs:
            return ''
        return match.group(0)
    html = re.sub(r'<link\b([^>]*?)href="(\./[^"#?]+(?:\?[^"#]*)?)"[^>]*>', repl_link, html, flags=re.I)

    def repl_script(match):
        before, src, after = match.group(1), match.group(2), match.group(3)
        rel = src.split('?', 1)[0].split('#', 1)[0]
        path = ROOT / rel.removeprefix('./')
        if not path.exists():
            return match.group(0)
        content = path.read_text().replace('</script', '<\\/script')
        return f'<script{before}{after} data-source="{rel}">\n{content}\n</script>'
    html = re.sub(r'<script([^>]*?)src="(\./[^"#?]+(?:\?[^"#]*)?)"([^>]*)>\s*</script>', repl_script, html, flags=re.I)
    bootstrap = r'''<script data-test="inline-bootstrap">
    (() => {
      const makeStorage = () => { const data = new Map(); return { getItem:k=>data.has(String(k))?data.get(String(k)):null, setItem:(k,v)=>data.set(String(k),String(v)), removeItem:k=>data.delete(String(k)), clear:()=>data.clear(), key:i=>Array.from(data.keys())[i]??null, get length(){return data.size;} }; };
      for (const name of ['localStorage','sessionStorage']) { try { Object.defineProperty(window,name,{value:makeStorage(),configurable:true}); } catch (_) {} }
      let inlineHistoryState = null;
      try {
        Object.defineProperty(history, 'state', { configurable: true, get: () => inlineHistoryState });
        history.replaceState = state => { inlineHistoryState = state; };
        history.pushState = state => { inlineHistoryState = state; };
        history.back = () => { inlineHistoryState = null; window.dispatchEvent(new PopStateEvent('popstate', { state: null })); };
      } catch (_) {}
    })();
    </script>'''
    html = html.replace('<head>', '<head>' + bootstrap, 1)
    return html

ORIGIN = dict(placeId='place-origin', name='信州大学工学部', address='長野県長野市若里4丁目17-1', latitude=36.6392, longitude=138.1919)
WAYPOINT = dict(placeId='place-waypoint', name='姨捨サービスエリア', address='長野県千曲市八幡', latitude=36.5044, longitude=138.1108)
DEST = dict(placeId='place-destination', name='松本駅', address='長野県松本市深志1丁目', latitude=36.2306, longitude=137.9646)

def click(page, selector, index=0):
    loc = page.locator(selector).nth(index)
    loc.wait_for(state='attached')
    loc.evaluate('(node) => node.click()')
    page.wait_for_timeout(80)

def select_place(page, selector, data):
    page.evaluate('([selector, data]) => window.__selectMockPlace(selector, data)', [selector, data])

def wait_app(page):
    page.wait_for_function("() => Boolean(customElements.get('cds-button') && customElements.get('cds-modal'))")
    page.wait_for_function("() => typeof window.executeDebugMode === 'function' && typeof window.openRouteDistanceHelperFromShortcut === 'function'")

def seed(page):
    page.evaluate('window.executeDebugMode()')
    page.wait_for_timeout(250)
    page.evaluate("window.switchView('seisan')")
    page.wait_for_timeout(100)

def open_first_car(page):
    target = page.evaluate("Object.keys(window.ensureSettlementState().cars)[0]")
    page.evaluate("target => window.openSettlementCarEditor(encodeURIComponent(target))", target)
    page.wait_for_function("document.querySelector('#settlementCarEditModal')?.open === true")
    page.evaluate('window.openRouteDistanceHelperFromShortcut()')
    page.locator('#routeDistanceModal').wait_for(state='attached')
    page.wait_for_function("document.querySelector('#routeDistanceModal')?.open === true")
    page.wait_for_function("document.querySelector('#routeOriginAutocompleteHost gmp-place-autocomplete')")
    return target

def check(condition, name, detail=''):
    if not condition:
        raise AssertionError(f'{name}: {detail}')
    return {'name': name, 'ok': True, 'detail': detail}

def run_viewport(browser, html, width, height, theme):
    context = browser.new_context(viewport={'width': width, 'height': height}, color_scheme='dark' if theme == 'dark' else 'light')
    page = context.new_page()
    errors=[]; console=[]
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.on('console', lambda msg: console.append(f'{msg.type}: {msg.text}') if msg.type in ('error','warning') else None)
    page.set_content(html, wait_until='domcontentloaded')
    wait_app(page)
    page.evaluate(MOCK_SOURCE)
    page.evaluate("theme => { document.documentElement.dataset.theme = theme; }", theme)
    seed(page)
    target=open_first_car(page)
    select_place(page, '#routeOriginAutocompleteHost gmp-place-autocomplete', ORIGIN)
    req0=page.evaluate('window.__mapsRequests.length')
    check(req0==0, 'no route call until both places selected', str(req0))
    select_place(page, '#routeDestinationAutocompleteHost gmp-place-autocomplete', DEST)
    page.wait_for_function("document.querySelectorAll('#routeResultList cds-selectable-tile.route-result-tile').length === 4")
    checks=[]
    checks.append(check(page.locator('#routeResultList cds-selectable-tile.route-result-tile').count()==4,'all four route candidates'))
    checks.append(check(page.evaluate('window.getRouteMapRuntimeForTests().polylines.length')==4,'all alternatives on map'))
    checks.append(check(page.evaluate('window.getRoutePlannerState().selectedRouteIndex')==0,'recommended route initially selected'))
    first_req=page.evaluate('window.__mapsRequests[0]')
    checks.append(check(first_req['computeAlternativeRoutes'] is True,'computeAlternativeRoutes enabled'))
    checks.append(check(first_req['routeModifiers']['avoidTolls'] is False,'avoid tolls default false'))
    # list selection
    click(page, '#routeResultList cds-selectable-tile.route-result-tile', 1)
    checks.append(check(page.evaluate('window.getRoutePlannerState().selectedRouteIndex')==1,'list selects route'))
    # map selection
    page.evaluate("window.getRouteMapRuntimeForTests().polylines[2].trigger('click')")
    checks.append(check(page.evaluate('window.getRoutePlannerState().selectedRouteIndex')==2,'map selects route'))
    # waypoint + modifier
    click(page, '#routeAddWaypointBtn')
    page.wait_for_function("document.querySelector('#routeWaypointAutocompleteHost0 gmp-place-autocomplete')")
    before=page.evaluate('window.__mapsRequests.length')
    select_place(page, '#routeWaypointAutocompleteHost0 gmp-place-autocomplete', WAYPOINT)
    page.wait_for_function('(n) => window.__mapsRequests.length > n', arg=before)
    last=page.evaluate('window.__mapsRequests.at(-1)')
    checks.append(check(last['computeAlternativeRoutes'] is False,'waypoint disables native alternatives'))
    checks.append(check(len(last['intermediates'])==1,'waypoint sent in order'))
    page.locator('cds-checkbox#routeAvoidHighways').evaluate("node => {node.checked=true; node.dispatchEvent(new Event('change',{bubbles:true,composed:true}))}")
    page.wait_for_function("window.__mapsRequests.at(-1).routeModifiers.avoidHighways === true")
    checks.append(check(True,'modifier triggers refresh'))
    page.wait_for_function("window.getRoutePlannerState().routes.length > 0 && document.querySelector('#routeApplyBtn')?.disabled === false")
    # apply exact car with roundtrip
    page.locator('cds-checkbox#routeRoundTrip').evaluate("node => {node.checked=true; node.dispatchEvent(new Event('change',{bubbles:true,composed:true}))}")
    before_cars=page.evaluate("Object.fromEntries(Object.entries(window.ensureSettlementState().cars).map(([n,c])=>[n,c.dist]))")
    selected_route=page.evaluate('window.getRoutePlannerState().routes[window.getRoutePlannerState().selectedRouteIndex]')
    click(page, '#routeApplyBtn')
    page.wait_for_function("target => document.querySelector('#settlementCarEditModal')?.open === true && window.getActiveSettlementCarEditName?.() === target", arg=target)
    after_cars=page.evaluate("Object.fromEntries(Object.entries(window.ensureSettlementState().cars).map(([n,c])=>[n,c.dist]))")
    expected=round(selected_route['distanceMeters']*2/1000,1)
    checks.append(check(abs(float(after_cars[target])-expected)<0.11,'distance applied to exact car',f'{after_cars[target]} vs {expected}'))
    for name, value in after_cars.items():
        if name!=target:
            checks.append(check(value==before_cars[name],f'other car unchanged: {name}'))
    checks.append(check(page.evaluate('window.getActiveSettlementCarEditName?.()')==target,'returns to source car'))
    # persisted state
    stored=page.evaluate('window.getRoutePlannerState()')
    checks.append(check(stored['origin']['placeId']==ORIGIN['placeId'],'origin persisted'))
    checks.append(check(stored['selectedRouteIndex']>=0,'route selection persisted'))
    # close/reopen restores
    page.evaluate('window.openRouteDistanceHelperFromShortcut()')
    page.wait_for_function("document.querySelector('#routeDistanceModal')?.open === true")
    page.wait_for_function("document.querySelectorAll('#routeResultList cds-selectable-tile.route-result-tile').length > 0")
    checks.append(check(page.locator('#routeResultList cds-selectable-tile.route-result-tile').count()>0,'routes restored after reopen'))
    # error state
    page.evaluate("window.__mockRouteMode='error'")
    page.evaluate("window.refreshRoutes('error-test')")
    page.wait_for_function("document.querySelector('#routeHelperStatus') && !document.querySelector('#routeHelperStatus').hidden")
    checks.append(check('API利用上限' in page.locator('#routeHelperStatusMessage').inner_text(),'API error notification'))
    # visual/layout
    overflow=page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
    checks.append(check(overflow,'no document horizontal overflow'))
    modal_box=page.locator('#routeDistanceModal').bounding_box()
    checks.append(check(modal_box is not None,'route modal visible'))
    screenshot=OUT/f'maps-{width}-{theme}.png'
    page.screenshot(path=str(screenshot), full_page=False)
    relevant_errors = [e for e in errors if "Failed to execute 'write' on 'Document'" not in e]
    checks.append(check(not relevant_errors,'no page errors','; '.join(relevant_errors)))
    serious=[x for x in console if not ('favicon' in x.lower() or 'font' in x.lower() or 'Settlement template split is incomplete' in x)]
    checks.append(check(not serious,'no relevant console warnings/errors','; '.join(serious[:5])))
    context.close()
    return checks, str(screenshot)

def main():
    html=inline_project()
    results=[]; screenshots=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(390,844),(768,900),(1280,900)]:
            for theme in ('light','dark'):
                print(f'RUN {width} {theme}', flush=True)
                checks, shot=run_viewport(browser,html,width,height,theme)
                results.extend([{**c,'viewport':width,'theme':theme} for c in checks]); screenshots.append(shot)
        browser.close()
    summary={'total':len(results),'passed':sum(1 for r in results if r['ok']),'failed':sum(1 for r in results if not r['ok']),'results':results,'screenshots':screenshots}
    (ROOT/'test-results/maps-inline-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps({'total':summary['total'],'passed':summary['passed'],'failed':summary['failed']},ensure_ascii=False))
    return 1 if summary['failed'] else 0

if __name__=='__main__':
    sys.exit(main())
