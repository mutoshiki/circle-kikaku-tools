const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const routeTemplate = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/08-route-helper-templates.js'), 'utf8');
const routeLogic = fs.readFileSync(path.join(root, 'assets/js/features/settlement/04-route-helper.js'), 'utf8');

assert(index.includes('移動距離を調べる'), 'modal title should explain the tool purpose');
assert(index.includes('立ち寄る順番を決めて、Googleマップで移動距離を確認します。'), 'lead should briefly explain the tool');
assert(index.includes('立ち寄る場所'), 'destination list should use 立ち寄る場所 wording');
assert(index.includes('出発・帰着地') && index.includes('<small>任意</small>'), 'optional start and return location should be integrated into the stop panel');
assert(!index.includes('route-private-panel'), 'home should not remain as a separate section');
assert(!index.includes('番号をドラッグして並び替え') && !index.includes('候補はタップするとここに追加'), 'operation instruction cards should be removed');
assert(!index.includes('id="routeDistanceModal" tabindex="-1" aria-labelledby="routeDistanceModalTitle" aria-hidden="true">\n      <div class="modal-dialog modal-fullscreen-sm-down'), 'route helper should use a popup instead of fullscreen mobile mode');
assert(index.includes('modal-dialog modal-lg modal-dialog-centered route-helper-dialog'), 'route helper popup should not inherit full-height scrollable dialog sizing');
assert(routeTemplate.includes('title="並び替え"'), 'drag handle should have a concise sorting label');
assert(routeTemplate.includes('fa-grip-vertical'), 'route row should include a visible drag handle icon');
assert(!routeTemplate.includes('<b>${index + 1}</b>'), 'route rows should not display sequence numbers');
assert(routeLogic.includes('立ち寄る場所を1つ以上入力してください。'), 'empty stop error should use 立ち寄る場所 wording');
assert(routeLogic.includes('出発地へ戻るルートを開きました。'), 'round-trip status should mention returning to the origin');

console.log('Route helper simple popup check OK');
