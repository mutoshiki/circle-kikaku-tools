import fs from 'node:fs';
import assert from 'node:assert/strict';

const carTemplate = fs.readFileSync('assets/js/templates/settlement/03-car-cost-templates.js', 'utf8');
const extraTemplate = fs.readFileSync('assets/js/templates/settlement/04-extra-input-templates.js', 'utf8');
const rowCss = fs.readFileSync('assets/css/settlement/car-inputs/03-extra-costs.css', 'utf8');
const editModalCss = fs.readFileSync('assets/css/settlement/car-inputs/04-edit-modal.css', 'utf8');
const settingsCss = fs.readFileSync('assets/css/settlement/controls/03-settings.css', 'utf8');
const layerCss = fs.readFileSync('assets/css/guides-modals/z-layer/01-z-layer.css', 'utf8');
const generatedEvents = fs.readFileSync('assets/js/features/events/03-generated-action-events.js', 'utf8');
const shareActions = fs.readFileSync('assets/js/features/share-actions.js', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');
const sheetView = fs.readFileSync('assets/js/features/sheet-view.js', 'utf8');

assert.match(carTemplate, /seisan-cost-edit-header[\s\S]*名目[\s\S]*金額[\s\S]*部費[\s\S]*操作/, 'cost list has one shared column header');
assert.match(carTemplate, /seisan-gas-cost-row/, 'movement cost is rendered as a normal row in the shared list');
assert.match(carTemplate, /seisan-gas-cost-row[\s\S]*cds-text-input[\s\S]*readonly[\s\S]*seisan-calculated-amount-field/, 'movement fee name uses the same Carbon input geometry while remaining read-only');
assert.match(carTemplate, /seisan-calculated-amount-field[\s\S]*seisan-calculated-amount-input[\s\S]*readonly/, 'movement amount keeps the same readonly Carbon input surface as normal amounts');
assert.match(carTemplate, /data-action="open-settlement-gas-settings"[\s\S]*data-carbon-icon="settings--adjust"/, 'movement amount field adds a settings-adjust action rather than a displayed amount');
assert.doesNotMatch(carTemplate, /data-settlement-gas-amount/, 'calculated movement amount is not duplicated in the editor');
assert.match(carTemplate, /movementLabel = usesTimesRental \? 'タイムズ移動料金' : 'ガソリン代'/, 'rental mode renames the movement fee');
assert.match(carTemplate, /isTimesDistanceFeeExtra[\s\S]*visibleExtras/, 'generated Times distance fee is represented by the movement row instead of duplicated');
assert.match(carTemplate, /map\(\(ex, index\) => \(\{ ex, index \}\)\)[\s\S]*visibleExtras\.map\(\(\{ ex, index \}\)/, 'filtered Times-only rows preserve original extra indices for editing');
assert.match(carTemplate, /seisan-extra-field--type is-fixed[\s\S]*<cds-toggle size="sm" hide-label disabled/, 'fixed movement burden is expressed as a disabled Carbon small toggle');
assert.match(carTemplate, /seisan-extra-field--action[\s\S]*cds-icon-button[^>]*disabled[\s\S]*trash-can/, 'fixed movement deletion is expressed as a disabled Carbon trash action');
assert.match(carTemplate, /<cds-modal[\s\S]*id="settlementGasEditModal"[\s\S]*size="sm"[\s\S]*rentalType[\s\S]*data-field="dist"[\s\S]*open-route-helper-shortcut/, 'movement settings use a separate small Carbon modal');
assert.doesNotMatch(carTemplate, /<cds-popover|seisan-gas-settings-popover|seisan-gas-settings-surface/, 'movement settings no longer use an anchored popover or inline expansion');
assert.match(carTemplate, /label-text="自家用車"[\s\S]*label-text="タイムズ"/, 'vehicle type wording is concise and specific');
assert.match(carTemplate, /移動距離から移動料金を自動で計算できます。/, 'Times helper copy explains the automatic distance calculation naturally');
assert.match(carTemplate, /data-private-fuel[\s\S]*data-field="eco"[\s\S]*data-private-fuel[\s\S]*data-field="price"/, 'fuel efficiency and unit price remain private-car-only fields');
assert.doesNotMatch(carTemplate, /<div class="seisan-subhead"><strong>諸経費<\/strong>/, 'gas and extras are not split by legacy subheads');

assert.match(extraTemplate, /fixedName = !!timesFeeKind \|\| isReward/, 'Times fee names remain fixed without changing their row layout');
assert.match(extraTemplate, /amountLockedAttr = isReward/, 'Times time fee amount remains editable like a normal expense');
assert.match(extraTemplate, /typeLocked = isReward/, 'Times time fee keeps the normal editable club toggle');
assert.match(extraTemplate, /<cds-toggle size="sm" hide-label data-extra-field="type"/, 'club burden uses a centered Carbon small toggle without a visible row label');
assert.doesNotMatch(extraTemplate, /<cds-select[^>]*data-extra-field="type"/, 'legacy burden select is removed');
assert.doesNotMatch(extraTemplate, /seisan-extra-field-label/, 'row-level repeated column labels are removed');
assert.match(extraTemplate, /data-extra-negative=/, 'signed extra type metadata is preserved without schema changes');

assert.match(generatedEvents, /prepareSettlementCarEditTransition\(\{ allowInvalid: true, preserveSession: true \}\)/, 'movement settings preserve the current edit transaction before switching dialogs');
assert.match(generatedEvents, /settlementCarEdit\?\.hide\?\.\(\{ reason: 'movement-settings' \}\)[\s\S]*await hidden[\s\S]*getOrCreateInstance\?\.\(modal\)\?\.show/, 'the parent editor closes before the movement settings modal opens');
assert.match(generatedEvents, /resumeSettlementCarEditor[\s\S]*restoreCarEditorScroll/, 'closing movement settings restores the car editor and its prior scroll position');
assert.match(generatedEvents, /data-private-fuel[\s\S]*data-times-helper/, 'vehicle type change progressively discloses only relevant calculation fields');
assert.match(generatedEvents, /cds-toggle-changed[\s\S]*data-extra-field=\\?"type/, 'official Carbon toggle event commits the compact burden control');
assert.match(generatedEvents, /split-minus[\s\S]*club-minus|extraNegative/, 'negative extra semantics survive base burden toggles');
assert.match(rowCss, /grid-template-columns:[^;]+64px 48px/, 'desktop rows share four aligned columns');
assert.match(rowCss, /seisan-calculated-amount-input[\s\S]*pointer-events: none/, 'automatic amount keeps a real Carbon field surface without becoming a second editable control');
assert.match(rowCss, /seisan-gas-settings-trigger[\s\S]*position: absolute[\s\S]*margin: auto/, 'settings affordance is centered inside the standard amount field');
assert.match(rowCss, /seisan-extra-field--type cds-toggle[\s\S]*align-items: center[\s\S]*margin: auto/, 'small burden toggles are vertically centered in every cost row');
assert.match(rowCss, /#settlementGasEditModal \.seisan-gas-settings-fields/, 'small movement modal has one Carbon-token layout owner');
assert.match(rowCss, /@media \(max-width: 640px\)[\s\S]*grid-template-columns:/, 'mobile keeps a responsive one-row list');
assert.doesNotMatch(rowCss, /!important/, 'cost-list owner CSS does not use force overrides');
assert.doesNotMatch(layerCss, /body\.app-modal-open\s*\{[^}]*overflow\s*:\s*hidden/, 'app CSS must not duplicate Carbon modal scroll locking on iOS Safari');
assert.match(editModalCss, /width: calc\(100vw - 2rem\)/, 'vehicle editor keeps viewport margins on mobile instead of fullscreen');
assert.match(settingsCss, /width: calc\(100vw - 2rem\)/, 'settlement settings keeps viewport margins on mobile instead of fullscreen');
assert.doesNotMatch(settingsCss, /!important/, 'settings owner CSS does not use force overrides');

assert.match(shareActions, /url\.searchParams\.set\('view', 'sheet'\)/, 'canonical copied URL opens the shared view');
assert.match(shareActions, /navigator\.clipboard\?\.writeText/, 'canonical share uses the browser Clipboard API directly from the header action');
assert.match(shareActions, /showShareCopyStatus\('リンクをコピーしました', 'success'\)/, 'successful copy uses concise Carbon toast feedback');
assert.match(shareActions, /showShareCopyStatus\('リンクをコピーできませんでした', 'error'\)/, 'copy failure remains non-modal and uses Carbon feedback');
assert.doesNotMatch(shareActions, /showCopyFallback|copy-fallback|createElement\(['"](?:input|textarea|button)['"]\)|share-links-modal|車割・班割\(発表用リンク\)|精算用リンク/, 'copy and share actions no longer open legacy dialogs or native fallback controls');
assert.match(app, /requestedView[\s\S]*await switchView\(initialView\)/, 'view query parameter is applied during startup');
assert.match(sheetView, /message: '下にスワイプできます。'/, 'shared-view guidance uses the requested swipe message');
assert.doesNotMatch(sheetView, /1本指で移動、2本指で拡大・縮小できます。/, 'legacy gesture guidance is removed');

console.log('settlement cost editor list v75 contract: PASS');
