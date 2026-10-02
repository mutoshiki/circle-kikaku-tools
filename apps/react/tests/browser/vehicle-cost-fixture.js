import { readFileSync } from 'node:fs';
export const vehicleFixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
export async function seedVehicleCostRoom(page, {roomId, room = vehicleFixture}) {
  await page.addInitScript(({key,value}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) { if (query === '失敗') throw Error('fixture network failure'); if (query === 'なし') return []; return [{placeId:query,name:query,address:'テスト住所',latitude:35,longitude:139}]; },
      async resolve(place) { return {...place,latitude:35,longitude:139}; },
      async calculate(state) { return {...state, routes:[{distanceMeters:12345,durationSeconds:1200,description:'候補1',legs:[]},{distanceMeters:18000,durationSeconds:1800,description:'候補2',legs:[]}],selectedRouteIndex:0}; },
    };
  }, {key:`sanpo-react:v1:${roomId}:room`,value:room});
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
