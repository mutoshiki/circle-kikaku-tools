from __future__ import annotations
import json, sys
from importlib.machinery import SourceFileLoader
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'carbon-python-regression'
OUT.mkdir(parents=True,exist_ok=True)
inline=SourceFileLoader('maps_inline',str(ROOT/'tests/run-maps-inline-smoke.py')).load_module()


def host_click(page,selector,index=0):
    loc=page.locator(selector).nth(index); loc.wait_for(state='attached'); loc.evaluate('(n)=>n.click()'); page.wait_for_timeout(80)

def set_value(page,selector,value,index=-1):
    loc=page.locator(selector).nth(index)
    loc.evaluate("(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true,composed:true}));n.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}",value)
    page.wait_for_timeout(60)

def add(results,name,condition,detail=''):
    ok=bool(condition); results.append({'name':name,'ok':ok,'detail':str(detail)})
    if not ok: raise AssertionError(f'{name}: {detail}')

def visible(page,selector):
    return page.locator(selector).is_visible()

def seed(page):
    page.evaluate('window.executeDebugMode()'); page.wait_for_timeout(250)
    page.evaluate("document.querySelectorAll('.app-status-toast').forEach(n=>n.classList.remove('visible'))")

def run_case(browser,width,height,theme):
    context=browser.new_context(viewport={'width':width,'height':height},color_scheme=theme)
    page=context.new_page(); errors=[]; logs=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    page.set_content(inline.inline_project(),wait_until='domcontentloaded')
    inline.wait_app(page); page.evaluate("t=>document.documentElement.dataset.theme=t",theme); seed(page)
    results=[]
    add(results,'app shell visible',visible(page,'#app-layout'))
    add(results,'bottom tool switcher visible',visible(page,'#app-view-navigation'))
    for view in ['list','sheet','seisan']:
        page.evaluate('v=>window.switchView(v)',view); page.wait_for_timeout(100)
        add(results,f'{view} view switches',visible(page,'#app-view-navigation'))
        add(results,f'{view} no document overflow',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'))

    before=page.evaluate('document.documentElement.dataset.theme')
    host_click(page,'#themeToggleBtn')
    add(results,'theme toggle works',page.evaluate('document.documentElement.dataset.theme')!=before)
    host_click(page,'#overviewMenuBtn'); add(results,'overview drawer opens',page.locator('#overviewDrawer').get_attribute('aria-hidden')=='false')
    rows=page.locator('.overview-timetable-row').count(); host_click(page,'#overviewTimetableAddBtn'); add(results,'overview timetable row adds',page.locator('.overview-timetable-row').count()==rows+1)
    set_value(page,'#overviewMemoInput','回帰確認'); host_click(page,'#overviewDrawerCloseBtn'); add(results,'overview drawer closes',page.locator('#overviewDrawer').get_attribute('aria-hidden')=='true')

    page.evaluate("window.switchView('list')"); page.wait_for_timeout(100)
    host_click(page,'#car-plan-switcher cds-content-switcher-item[value="team"]'); add(results,'team mode works',page.evaluate('getActiveCarPlan().templateType')=='team')
    host_click(page,'#car-plan-switcher cds-content-switcher-item[value="car"]'); add(results,'car mode works',page.evaluate('getActiveCarPlan().templateType')=='car')
    expanded=page.locator('#tray-handle').get_attribute('aria-expanded'); host_click(page,'#tray-handle'); add(results,'tray toggles',page.locator('#tray-handle').get_attribute('aria-expanded')!=expanded)
    host_click(page,'#tray-handle'); host_click(page,'#traySettingsBtn'); add(results,'allocation settings opens',page.locator('#autoAssignPopover').evaluate('(n)=>n.open===true'))
    for cid in ['optFemale','optMale','optGrade']:
        page.locator('cds-checkbox#'+cid).evaluate("n=>{n.checked=true;n.dispatchEvent(new Event('change',{bubbles:true,composed:true}))}")
    add(results,'allocation settings summary updates',page.locator('#autoAssignSummary').inner_text().strip()!='条件：なし')
    page.keyboard.press('Escape'); page.wait_for_timeout(80); add(results,'allocation settings closes',page.locator('#autoAssignPopover').evaluate('(n)=>n.open===false'))

    menu_selector='.member-menu-btn,.driver-menu-btn'
    if page.locator(menu_selector).count():
        host_click(page,menu_selector)
        add(results,'person menu uses Carbon menu',page.locator('cds-menu.person-pop-menu cds-menu-item').count()>=4)
        add(results,'person menu has no tooltip bubble',page.locator('cds-tooltip[open]').count()==0)
        page.keyboard.press('Escape')
    if page.locator('[data-action="edit-capacity"]').count():
        host_click(page,'[data-action="edit-capacity"]'); set_value(page,'#editModalInput','4'); host_click(page,'#saveEditBtn')
        add(results,'capacity edit saves',page.locator('.car-box').first.get_attribute('data-capacity')=='4')
    host_click(page,'#shuffleAssignBtn'); add(results,'random assignment respects capacity',page.evaluate('getData().cars.every(c=>c.members.length<=c.capacity)'))

    # Major modal focus and close
    cases=[('window.modals.userGuide.show()','userGuideModal'),('showHistory()','historyModal'),('openPlanningCheck()','planningCheckModal'),('openDebugModal()','debugModal'),('openSettlementSettings()','settlementSettingsModal'),('openBatchModal()','batchImportModal')]
    for command,mid in cases:
        page.evaluate(command); page.wait_for_timeout(70)
        add(results,f'{mid} opens',page.locator('#'+mid).get_attribute('open') is not None)
        add(results,f'{mid} heading receives focus',page.evaluate('id=>document.activeElement?.id===id+"Title"',mid))
        page.locator(f'#{mid} cds-modal-close-button').evaluate('(n)=>n.click()'); page.wait_for_timeout(80)
        add(results,f'{mid} closes',page.locator('#'+mid).get_attribute('open') is None)

    # Shared quick edit
    page.evaluate("window.switchView('sheet')"); page.wait_for_timeout(120)
    if page.locator('#sheet-quick-edit-btn').count() and page.locator('#sheet-quick-edit-btn').is_visible():
        host_click(page,'#sheet-quick-edit-btn'); add(results,'shared quick edit enters',page.evaluate("document.body.classList.contains('quick-edit-mode')"))
        before_rows=page.locator('.sheet-timetable-edit-row').count()
        add_sel='[data-action="add-sheet-timetable-row"]'
        host_click(page,add_sel); add(results,'shared timetable adds row',page.locator('.sheet-timetable-edit-row').count()==before_rows+1)
        if page.locator('.sheet-timetable-delete').count(): host_click(page,'.sheet-timetable-delete',page.locator('.sheet-timetable-delete').count()-1)
        add(results,'shared timetable deletes row',page.locator('.sheet-timetable-edit-row').count()==before_rows)
        host_click(page,'#sheet-quick-edit-btn'); add(results,'shared quick edit exits',not page.evaluate("document.body.classList.contains('quick-edit-mode')"))

    # Settlement and extra validation
    page.evaluate("window.switchView('seisan')"); page.wait_for_timeout(120)
    if page.locator('[data-action="open-settlement-settings"]').count():
        host_click(page,'[data-action="open-settlement-settings"]'); add(results,'settlement settings opens',page.locator('#settlementSettingsModal').get_attribute('open') is not None)
        add(results,'rounding uses one Content Switcher',page.locator('#settlementSettingsModal cds-content-switcher').count()==1)
        host_click(page,'#settlementSettingsModal [data-action="save-settlement-settings"]')
    host_click(page,'[data-action="open-settlement-car-edit"]')
    add(results,'car settlement editor opens',page.locator('#settlementCarEditModal').get_attribute('open') is not None)
    placeholders=[page.locator(f'#settlementCarEditModal [data-field="{f}"]').get_attribute('placeholder') for f in ['dist','eco','price']]
    add(results,'vehicle placeholders retained',placeholders==['例：186','例：18','例：158'],placeholders)
    host_click(page,'#settlementCarEditModal [data-action="add-settlement-extra"]')
    host_click(page,'#settlementCarEditModal [data-action="save-settlement-car-edit"]')
    host_click(page,'[data-action="open-settlement-car-edit"]')
    add(results,'empty extra shows two Carbon errors',page.locator('#settlementCarEditModal [data-extra-field][invalid]').count()==2)
    set_value(page,'#settlementCarEditModal [data-extra-field="name"]','高速代')
    set_value(page,'#settlementCarEditModal [data-extra-field="amount"]','1234')
    add(results,'extra errors clear after valid input',page.locator('#settlementCarEditModal [data-extra-field][invalid]').count()==0)

    # Accessible visible controls
    quality=page.evaluate("""() => { const vis=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'}; const nodes=[...document.querySelectorAll('cds-button,cds-icon-button,cds-overflow-menu,cds-content-switcher-item,cds-checkbox,cds-toggle,a,[role=button]')].filter(vis); const smallNodes=nodes.filter(e=>e.tagName!=='CDS-CHECKBOX').filter(e=>{const b=e.getBoundingClientRect();return b.width<40||b.height<40}); return {unnamed:nodes.filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('label')||e.getAttribute('label-text')||e.textContent.trim()||e.title)).length,small:smallNodes.length,smallDetails:smallNodes.map(e=>{const b=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,cls:e.className?.toString?.()||'',text:e.textContent.trim().slice(0,30),w:b.width,h:b.height}})}; }""")
    add(results,'visible controls have accessible names',quality['unnamed']==0,quality)
    add(results,'visible controls have usable touch size',quality['small']==0,quality)
    add(results,'final no document overflow',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'))
    relevant=[x for x in logs if 'Settlement template split is incomplete' not in x and 'favicon' not in x.lower() and 'font' not in x.lower()]
    add(results,'no page errors',not errors,'; '.join(errors))
    add(results,'no relevant console errors',not relevant,'; '.join(relevant[:5]))
    shot=OUT/f'carbon-{width}-{theme}.png'; page.screenshot(path=str(shot),full_page=False)
    context.close(); return results,str(shot)


def main():
    all_results=[]; shots=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height,theme in [(390,844,'light'),(390,844,'dark'),(1280,900,'light'),(1280,900,'dark')]:
            print('RUN',width,theme,flush=True)
            try:
                results,shot=run_case(browser,width,height,theme)
            except Exception as exc:
                print('FAILED',width,theme,exc,flush=True); browser.close(); raise
            all_results.extend([{**r,'viewport':width,'theme':theme} for r in results]); shots.append(shot)
        browser.close()
    summary={'total':len(all_results),'passed':sum(r['ok'] for r in all_results),'failed':sum(not r['ok'] for r in all_results),'results':all_results,'screenshots':shots}
    (OUT/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps({k:summary[k] for k in ['total','passed','failed']},ensure_ascii=False))
    return 1 if summary['failed'] else 0

if __name__=='__main__': sys.exit(main())
