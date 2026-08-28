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
const workspace = read('assets/js/features/assignment-workspace.js');
const userGuide = read('assets/js/templates/user-guide-content.js');
const settlementSettingsCss = read('assets/css/settlement/controls/03-settings.css');
const carbonEntry = read('assets/js/carbon-entry.js');

expect(!index.includes('slot="tooltip-content"'), 'Light-DOM tooltip content remains in index.html');
expect(!index.includes('id="sheet-hint"'), 'Shared-view coach bubble remains');
expect(!/\btitle="[^"]+"/.test(index.match(/<(?:cds-button|cds-icon-button)[\s\S]*?>/g)?.join('\n') || ''), 'Interactive Carbon button title tooltip remains');
expect(runtime.includes('applyCarbonTooltipPolicy'), 'Global Carbon tooltip removal policy is missing');
expect(runtime.includes("'.cds--popover, .cds--tooltip-content { display: none !important"), 'Tooltip popover suppression is missing');
expect(runtime.includes("document.addEventListener('sanpo:carbon-ready'"), 'Tooltip policy is not reapplied after Carbon upgrade');

expect(autoAssign.includes('async function autoAssign()'), 'Random assignment must be a single no-options action.');
expect(autoAssign.includes("title: 'ランダム割り当て'"), 'Random assignment confirmation must use the visible action label.');
expect(autoAssign.includes("lastAutoAssignLabel = 'ランダム割り当て';"), 'Auto-assignment result label must match the visible action.');
expect(!autoAssign.includes("mode === 'fill'") && !autoAssign.includes('optGrade') && !autoAssign.includes('optFemale') && !autoAssign.includes('optMale'), 'Retired fill/condition branches must not remain in auto assignment.');
expect(workspace.includes("label.textContent = 'ランダム割り当て'"), 'Workspace must expose the single action as 「ランダム割り当て」.');
expect(workspace.includes("'fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade'"), 'Workspace must remove legacy assignment settings and fill controls from the runtime UI.');
expect(userGuide.includes('「ランダム割り当て」'), 'User guide must document the single random allocation action.');
expect(!userGuide.includes('「空きを埋める」') && !userGuide.includes('ランダムに割り当て') && !userGuide.includes('ドラッグして配置'), 'User guide must not describe retired allocation actions.');

expect(index.includes('legend-text="協力代の負担"'), 'Driver reward burden heading must match the settlement redesign');
expect(!index.includes('1台あたりの協力代をどこから支払うか選択'), 'Removed driver reward helper copy remains');
expect(index.includes('id="seisanDriverRewardType"') && index.includes('legend-text="協力代の負担"'), 'Driver reward radio group is not programmatically labelled');
expect(index.includes('class="seisan-settings-step seisan-settings-section--method"') && index.includes('data-settlement-step="2"') && index.includes('class="seisan-settings-step seisan-settings-section--reward"') && index.includes('data-settlement-step="3"') && index.includes('class="seisan-settings-step seisan-settings-section--collection"'), 'Settlement settings must keep the three existing setting groups as the three steps');
expect(index.includes('id="seisanDriverCollectionRule"') && index.includes('id="seisanOrganizerRule"') && !index.includes('その他の設定'), 'Settlement collection rules must use explicit radio groups without an ambiguous advanced category');
expect(index.includes('id="settlementSettingsProgress"') && index.includes('data-settlement-step="1"') && index.includes('data-settlement-step="2"') && index.includes('data-settlement-step="3"'), 'Settlement settings must use a three-step progress modal');
expect(index.includes('<cds-progress-indicator') && index.includes('label="車出し協力代"') && index.includes('label="集金ルール"') && !index.includes('label="確認"') && (index.match(/<cds-progress-step/g) || []).length === 3 && carbonEntry.includes("components/progress-indicator/index.js"), 'Settlement settings must use the three existing groups as Carbon Progress Indicator steps');
expect(index.includes('id="seisanSettlementMode"') && index.includes('legend-text="精算方法"') && !index.includes('seisan-settings-help'), 'Settlement method must use the Carbon radio-group legend without duplicated helper copy');
expect(index.includes('has-three-buttons') && index.includes('seisan-settings-footer-spacer') && !index.includes('seisan-settings-footer-actions'), 'Settlement settings footer must use Carbon progress-modal slots without a nested custom action grid');
expect(!index.includes('id="settlementSettingsSummary"') && !index.includes('seisanSettingsImpactValue'), 'Settlement settings must keep the three setting groups as pages without an independent confirmation summary');
expect(index.includes('運転手の人数') && index.includes('同乗者の人数') && index.includes('1台あたりの協力代（円）'), 'Settlement settings field labels must describe the actual values and units');
expect(index.includes('label-text="集金する"') && index.includes('label-text="支払額から控除"') && index.includes('label-text="集金対象外"'), 'Settlement radio labels must avoid repeating their group heading');
expect(!/\.seisan-driver-reward-policy\s*\{[^}]*border-top\s*:/.test(settlementSettingsCss), 'Unnecessary divider remains between driver reward amount and burden method');

expect(sample.includes("roomName: missing ? '入力漏れチェック用サンプル' : '秋名山登山企画'"), 'Sample room title was not updated');
expect(sample.includes(": 'サンプルデータ'"), 'Sample memo was not updated');
expect(!sample.includes('秋名・赤城ツーリング'), 'Old sample room title remains');
expect(!sample.includes('頭文字Dの登場人物を使ったツーリング企画サンプルです。'), 'Old sample memo remains');

expect(sheet.includes('function createSheetMemoSection()'), 'Shared memo section is missing');
expect(sheet.includes('sheet-overview-stack'), 'Timetable and memo are not grouped above/beside the allocation without moving it');
expect(sheet.includes('id="sheetMemoEditInput"'), 'Quick edit memo textarea is missing');
expect(sheetSync.includes('syncSheetMemoToOverview();'), 'Quick edit memo is not committed to overview state');

expect(settlement.includes('function validateAndSaveSettlementSettingsBeforeClose') && settlement.includes('restoreSettlementSettingsOpeningSnapshot();'), 'Settlement settings close must restore the opening draft snapshot');
expect(settlement.includes('saveLocalDraftOnly?.();') && !settlement.includes('promptDiscardInvalidSettlementSettings'), 'Settlement settings dismissal must remain local-only and must not retain the legacy invalid-close prompt');
expect(settlement.includes('restoreSettlementCarEditOpeningSnapshot'), 'Discard does not restore the opening snapshot');
expect(modal.includes('shouldPreserveSettlementCarEditorOnHidden'), 'Modal cleanup does not preserve invalid editor while confirmation is shown');
expect(route.includes('prepareSettlementCarEditTransition({ allowInvalid: true, preserveSession: true })'), 'Route helper no-confirm session preservation is missing');
expect(route.includes('global.resumeSettlementCarEditor || global.openSettlementCarEditor'), 'Route return does not resume the existing editor session');
expect(settlement.includes('function resumeSettlementCarEditor'), 'Settlement editor resume helper is missing');

console.log('PASS comprehensive feature polish contract');
