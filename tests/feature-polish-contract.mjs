import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const runtime = read('assets/js/core/runtime.js');
const sheet = read('assets/js/features/sheet-view.js');
const sheetSync = read('assets/js/features/sheet/00-data-sync.js');
const settlement = read('assets/js/features/settlement/03-render.js');
const modal = read('assets/js/core/modal-controller.js');
const route = read('assets/js/features/settlement/04-route-helper.js');
const sample = read('assets/js/features/sample-data-history.js');
const autoAssign = read('assets/js/features/auto-assign.js');
const userGuide = read('assets/js/templates/user-guide-content.js');
const settlementSettingsCss = read('assets/css/settlement/controls/03-settings.css');

expect(!index.includes('slot="tooltip-content"'), 'Light-DOM tooltip content remains in index.html');
expect(!index.includes('id="sheet-hint"'), 'Shared-view coach bubble remains');
expect(!/\btitle="[^"]+"/.test(index.match(/<(?:cds-button|cds-icon-button)[\s\S]*?>/g)?.join('\n') || ''), 'Interactive Carbon button title tooltip remains');
expect(runtime.includes('applyCarbonTooltipPolicy'), 'Global Carbon tooltip removal policy is missing');
expect(runtime.includes("'.cds--popover, .cds--tooltip-content { display: none !important"), 'Tooltip popover suppression is missing');
expect(runtime.includes("document.addEventListener('sanpo:carbon-ready'"), 'Tooltip policy is not reapplied after Carbon upgrade');

expect(index.includes('>埋める</span>'), 'Fill-empty button label is not 埋める');
expect(index.match(/id="shuffleAssignBtn"[\s\S]{0,220}data-carbon-icon="shuffle"/), 'Random action does not use the official Carbon shuffle icon');
expect(!index.includes('carbon-dice-icon'), 'Legacy dice icon remains');
expect(autoAssign.includes("if (mode === 'fill') return '埋める';"), 'Auto-assignment result label is not 埋める');
expect(userGuide.includes('「埋める」「ランダム」'), 'User guide still documents the old 空席 label');

expect(index.includes('車出し協力代の負担方法'), 'Driver reward burden heading is unclear');
expect(!index.includes('1台あたりの協力代をどこから支払うか選択'), 'Removed driver reward helper copy remains');
expect(index.includes('aria-labelledby="seisanDriverRewardTypeLabel"'), 'Driver reward switcher is not programmatically labelled');
expect(!/\.seisan-driver-reward-policy\s*\{[\s\S]*?border-top\s*:/.test(settlementSettingsCss), 'Unnecessary divider remains between driver reward amount and burden method');

expect(sample.includes("roomName: missing ? '入力漏れチェック用サンプル' : '秋名山登山企画'"), 'Sample room title was not updated');
expect(sample.includes(": 'サンプルデータ'"), 'Sample memo was not updated');
expect(!sample.includes('秋名・赤城ツーリング'), 'Old sample room title remains');
expect(!sample.includes('頭文字Dの登場人物を使ったツーリング企画サンプルです。'), 'Old sample memo remains');

expect(sheet.includes('function createSheetMemoSection()'), 'Shared memo section is missing');
expect(sheet.includes('sheet-overview-stack'), 'Timetable and memo are not grouped above/beside the allocation without moving it');
expect(sheet.includes('id="sheetMemoEditInput"'), 'Quick edit memo textarea is missing');
expect(sheetSync.includes('syncSheetMemoToOverview();'), 'Quick edit memo is not committed to overview state');

expect(settlement.includes("title: '入力内容を破棄'"), 'Invalid-close discard confirmation is missing');
expect(settlement.includes("okText: '破棄して閉じる'"), 'Discard confirmation action copy is missing');
expect(settlement.includes("cancelText: '編集を続ける'"), 'Continue-editing action copy is missing');
expect(settlement.includes('restoreSettlementCarEditOpeningSnapshot'), 'Discard does not restore the opening snapshot');
expect(modal.includes('shouldPreserveSettlementCarEditorOnHidden'), 'Modal cleanup does not preserve invalid editor while confirmation is shown');
expect(route.includes('prepareSettlementCarEditTransition({ allowInvalid: true, preserveSession: true })'), 'Route helper no-confirm session preservation is missing');
expect(route.includes('global.resumeSettlementCarEditor || global.openSettlementCarEditor'), 'Route return does not resume the existing editor session');
expect(settlement.includes('function resumeSettlementCarEditor'), 'Settlement editor resume helper is missing');

console.log('PASS comprehensive feature polish contract');
