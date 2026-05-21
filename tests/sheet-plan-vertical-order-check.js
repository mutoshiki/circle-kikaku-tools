const { readText } = require('./helpers/read-project');

const css = readText('assets/css/06-sheet-view.css');
const js = readText('assets/js/features/sheet-view.js');

if (!css.includes('発表ビューは車割を上、班割を下に縦並びで表示する。')) {
  console.error('Missing vertical sheet plan layout comment.');
  process.exit(1);
}

if (!/#sheet-canvas\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*22px;[\s\S]*?\}/.test(css)) {
  console.error('Sheet canvas should stack car/team plan sections vertically.');
  process.exit(1);
}

if (!/typeA === 'car' \? 0 : 1/.test(js) || !/typeB === 'car' \? 0 : 1/.test(js)) {
  console.error('Sheet plan rendering should keep car plans before team plans.');
  process.exit(1);
}

console.log('Sheet plan vertical order check OK');
