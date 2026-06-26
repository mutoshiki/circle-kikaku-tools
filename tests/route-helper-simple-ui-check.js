const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const routeTemplate = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/08-route-helper-templates.js'), 'utf8');
const routeLogic = fs.readFileSync(path.join(root, 'assets/js/features/settlement/04-route-helper.js'), 'utf8');
const routeCss = fs.readFileSync(path.join(root, 'assets/css/settlement/route-helper/01-route-shell.css'), 'utf8');

assert(index.includes('移動距離計算ツール'), 'modal title should explain the tool purpose');
assert(!index.includes('route-helper-lead'), 'introductory lead should be removed');
assert(!index.includes('出発地点や経由地、終点'), 'destination list heading should be removed');
assert(index.includes('自宅などは入力せず、近くの施設などを代わりに入力してください。ドラッグで並び替えられます。'), 'privacy guidance should include drag sorting guidance');
assert(!index.includes('fa-shield-halved'), 'privacy guidance should not use a prominent icon');
assert(!index.includes('routePrivateOriginBox') && !index.includes('route-private-panel'), 'home input feature should be removed');
assert(index.includes('Google Mapで距離を確認'), 'Google Map action should describe checking distance');
assert(!index.includes('番号をドラッグして並び替え') && !index.includes('候補はタップするとここに追加'), 'operation instruction cards should be removed');
assert(!index.includes('id="routeDistanceModal" tabindex="-1" aria-labelledby="routeDistanceModalTitle" aria-hidden="true">\n      <div class="modal-dialog modal-fullscreen-sm-down'), 'route helper should use a popup instead of fullscreen mobile mode');
assert(index.includes('modal-dialog modal-lg modal-dialog-centered route-helper-dialog'), 'route helper popup should not inherit full-height scrollable dialog sizing');
assert(routeTemplate.includes('title="並び替え"'), 'drag handle should have a concise sorting label');
assert(routeTemplate.includes('fa-grip-vertical'), 'route row should include a visible drag handle icon');
assert(!routeTemplate.includes('<b>${index + 1}</b>'), 'route rows should not display sequence numbers');
assert(routeLogic.includes('forceFallback: true') && routeLogic.includes('fallbackOnBody: true'), 'route stop dragging should use a body-level fallback to keep the card under the finger');
assert(routeLogic.includes("fallbackClass: 'route-stop-drag-fallback'") && routeLogic.includes('onClone: event =>'), 'route stop fallback clone should preserve the source row size');
assert(routeLogic.includes('立ち寄る場所を1つ以上入力してください。'), 'empty stop error should use 立ち寄る場所 wording');
assert(!routeLogic.includes('getRoutePrivateOrigin') && !routeLogic.includes('ROUTE_PRIVATE_ORIGIN_KEY'), 'home origin storage and route logic should be removed');
assert(routeLogic.includes("setRouteHelperStatus('Google Mapを開きました。');"), 'route status should use the new Google Map wording');
assert(routeCss.includes('#routeDistanceModal .modal-header') && routeCss.includes('border-bottom: 0;'), 'route helper header should not have a separator border');
assert(routeCss.includes('#routeDistanceModal .modal-footer') && routeCss.includes('border-top: 0;'), 'route helper footer should not have a separator border');

console.log('Route helper simple popup check OK');
