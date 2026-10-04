import { readFileSync } from 'node:fs';
export const vehicleFixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
export async function seedVehicleCostRoom(page, {roomId, room = vehicleFixture, routeMode = 'normal'}) {
  await page.addInitScript(({key,value,routeMode}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    let calculations=0;
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) { if (query === '遅い') await new Promise(r=>setTimeout(r,700)); if (query === '失敗') throw Error('fixture network failure'); if (query === 'なし') return []; return [{placeId:query,name:query,address:'テスト住所'}]; },
      async resolve(place) { if (place.name === '解決失敗') throw Error('fixture resolve failure'); return {...place,latitude:35,longitude:139}; },
      async calculate(state) { if (routeMode === 'retry' && ++calculations === 1) throw Error('fixture routes failure'); return {...state, routes:[{distanceMeters:12345,durationSeconds:1200,label:'候補1',legs:[]},{distanceMeters:18000,durationSeconds:1800,label:'候補2',legs:[]}],selectedRouteIndex:0}; },
      async renderMap(element,state){if(routeMode!=='held-map')throw Error('fixture map failure');await new Promise(resolve=>window.__releaseRouteMap=resolve);element.textContent=`地図: ${state.routes[state.selectedRouteIndex].label}`;},
    };
  }, {key:`sanpo-react:v1:${roomId}:room`,value:room,routeMode});
}
export async function costNav(page, name) {
  const trigger = page.getByRole('button',{name:'企画メニューを開く'});
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole('link',{name,exact:true}).first().click();
}
export async function editFee(page,name) {
  const link=page.getByRole('link',{name:`${name}を編集`,exact:true});
  if (!await link.count()) await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await link.click();
}
