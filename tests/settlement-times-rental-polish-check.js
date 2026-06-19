const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stateJs = fs.readFileSync(path.join(root, 'assets/js/features/settlement/01-state.js'), 'utf8');
const calcJs = fs.readFileSync(path.join(root, 'assets/js/features/settlement/02-calculator.js'), 'utf8');
const carTemplate = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/03-car-cost-templates.js'), 'utf8');
const extraTemplate = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/04-extra-input-templates.js'), 'utf8');
const timesCss = [
  'assets/css/settlement/car-inputs/06-times-rental.css',
  'assets/css/settlement/cost-tags/01-cost-tag-base.css'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const eventJs = fs.readFileSync(path.join(root, 'assets/js/features/events/04-settlement-input-events.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(carTemplate.includes("usesTimesRental ? 'タイムズ'"), 'タイムズ時の上部内訳は、ガソリン代なしではなくタイムズ表記にする');
assert(carTemplate.includes('車出し分 -'), '運転手の集金控除は「集金 -」ではなく「車出し分 -」で表示する');
assert(!carTemplate.includes('下の諸経費に、タイムズ時間料金とタイムズ移動料金を自動で入れます'), 'タイムズ利用時の説明文は削除する');
assert(carTemplate.includes('seisan-times-toggle') && carTemplate.includes('type="checkbox" data-field="rentalType"'), '車の種類はセレクトではなくタイムズのオンオフUIにする');
assert(stateJs.includes('extras: [timesTimeExtra, timesDistanceExtra, ...manualExtras]'), 'タイムズ時間料金・移動料金は通常の諸経費配列の上部に固定する');
assert(calcJs.includes('const timesDistanceFee = usesTimesRental ? getTimesDistanceFee(cState.dist) : 0;'), 'タイムズ移動料金は計算時に距離から再計算する');
assert(extraTemplate.includes('data-times-extra=') && extraTemplate.includes('data-extra-field="name"') && extraTemplate.includes('data-extra-field="amount"') && extraTemplate.includes('data-extra-field="type"'), 'タイムズ料金も通常の諸経費入力行で描画する');
assert(!extraTemplate.includes('timesDistanceFeeRow') && !extraTemplate.includes('seisan-auto-label') && !extraTemplate.includes('data-generated-extra') && !extraTemplate.includes('readonly') && !extraTemplate.includes('disabled aria-disabled'), 'タイムズ移動料金の専用UIや固定入力は使わない');
assert(/\.seisan-car-row\.is-times-rental \.seisan-fuel-field\s*{[\s\S]*?display:\s*none;/.test(timesCss), 'タイムズ時は燃費・ガソリン単価欄を隠す');
assert(/\.seisan-car-row\.is-times-rental \.seisan-distance-field\s*{[\s\S]*?grid-column:\s*1 \/ -1;/.test(timesCss), 'タイムズ時は移動距離欄を広く使う');
assert(timesCss.includes('.seisan-extra-type.split') && timesCss.includes('var(--settlement-split-bg)'), '割勘セレクトに色を付ける');
assert(timesCss.includes('.seisan-extra-type.club') && timesCss.includes('var(--settlement-club-bg)'), '部費セレクトに色を付ける');
assert(eventJs.includes('updateTimesDistanceFeeInRow') && eventJs.includes('[data-field="dist"]'), '移動距離の入力中にタイムズ移動料金欄を更新する');

console.log('settlement times rental polish check OK');
