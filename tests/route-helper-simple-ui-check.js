const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const routeTemplate = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/08-route-helper-templates.js'), 'utf8');
const routeLogic = fs.readFileSync(path.join(root, 'assets/js/features/settlement/04-route-helper.js'), 'utf8');

assert(index.includes('移動距離を調べる'), 'modal title should explain the tool purpose');
assert(index.includes('自宅から各地点を回って自宅へ戻るルート'), 'lead should explain home as start and final destination');
assert(index.includes('出発地・最後の到着地'), 'home label should clarify start/final destination');
assert(index.includes('回る場所'), 'destination list should use 回る場所 wording');
assert(index.includes('訪問する順番'), 'route order subtitle should be natural Japanese');
assert(!index.includes('上から順に通ります'), 'awkward old route order wording should not remain');
assert(index.includes('番号をドラッグして並び替え'), 'drag operation should be visible in the UI');
assert(index.includes('候補はタップするとここに追加'), 'candidate tap operation should be visible in the UI');
assert(routeTemplate.includes('ドラッグで順番変更'), 'drag handle title should explain sorting');
assert(routeTemplate.includes('fa-grip-vertical'), 'route row should include a visible drag handle icon');
assert(routeLogic.includes('回る場所を1つ以上入力してください。'), 'empty stop error should use 回る場所 wording');
assert(routeLogic.includes('自宅に戻るルートを開きました。'), 'round-trip status should mention returning home');

console.log('route helper wording and operation hints are clear');
