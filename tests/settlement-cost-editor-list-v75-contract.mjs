import fs from 'node:fs';
import assert from 'node:assert/strict';

const carTemplate = fs.readFileSync('assets/js/templates/settlement/03-car-cost-templates.js', 'utf8');
const extraTemplate = fs.readFileSync('assets/js/templates/settlement/04-extra-input-templates.js', 'utf8');
const rowCss = fs.readFileSync('assets/css/settlement/car-inputs/03-extra-costs.css', 'utf8');
const editModalCss = fs.readFileSync('assets/css/settlement/car-inputs/04-edit-modal.css', 'utf8');
const settingsCss = fs.readFileSync('assets/css/settlement/controls/03-settings.css', 'utf8');
const generatedEvents = fs.readFileSync('assets/js/features/events/03-generated-action-events.js', 'utf8');
const shareActions = fs.readFileSync('assets/js/features/share-actions.js', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');
const sheetView = fs.readFileSync('assets/js/features/sheet-view.js', 'utf8');

assert.match(carTemplate, /seisan-cost-edit-header[\s\S]*名目[\s\S]*金額[\s\S]*部費[\s\S]*操作/, 'cost list has one shared column header');
assert.match(carTemplate, /seisan-gas-cost-row/, 'movement cost is rendered as a normal row in the shared list');
assert.match(carTemplate, /seisan-gas-cost-row[\s\S]*cds-text-input[\s\S]*readonly[\s\S]*seisan-calculated-amount-field/, 'movement fee name uses the same Carbon input geometry while remaining read-only');
assert.match(carTemplate, /seisan-calculated-amount-field[\s\S]*open-settlement-gas-settings[\s\S]*data-carbon-icon="settings--adjust"/, 'movement amount field contains the settings action');
assert.doesNotMatch(carTemplate, /data-settlement-gas-amount/, 'calculated movement amount is not duplicated in the editor');
assert.match(carTemplate, /movementLabel = usesTimesRental \? 'タイムズ移動料金' : 'ガソリン代'/, 'rental mode renames the movement fee');
assert.match(carTemplate, /isTimesDistanceFeeExtra[\s\S]*visibleExtras/, 'generated Times distance fee is represented by the movement row instead of duplicated');
assert.match(carTemplate, /seisan-fixed-cell/, 'fixed movement policy uses neutral cells instead of fake disabled controls');
assert.match(carTemplate, /cds-popover[\s\S]*cds-popover-content[\s\S]*rentalType[\s\S]*data-field="dist"[\s\S]*open-route-helper-shortcut/, 'movement settings use a Carbon popover instead of inline expansion');
assert.doesNotMatch(carTemplate, /settlementGasEditPanel|settlementGasEditModal/, 'movement settings no longer use an inline panel or nested modal');
assert.match(carTemplate, /rentalType === 'private'[\s\S]*data-field="eco"[\s\S]*data-field="price"/, 'fuel efficiency and unit price belong only to private-car calculation');
assert.doesNotMatch(carTemplate, /<div class="seisan-subhead"><strong>諸経費<\/strong>/, 'gas and extras are not split by legacy subheads');

assert.match(extraTemplate, /fixedName = !!timesFeeKind \|\| isReward/, 'Times fee names remain fixed without changing their row layout');
assert.match(extraTemplate, /amountLockedAttr = isReward/, 'Times time fee amount remains editable like a normal expense');
assert.match(extraTemplate, /<cds-toggle size="sm" data-extra-field="type"/, 'club burden uses Carbon small toggle for editable expenses');
assert.doesNotMatch(extraTemplate, /<cds-select[^>]*data-extra-field="type"/, 'legacy burden select is removed');
assert.doesNotMatch(extraTemplate, /seisan-extra-field-label/, 'row-level repeated column labels are removed');
assert.match(extraTemplate, /data-extra-negative=/, 'signed extra type metadata is preserved without schema changes');

assert.match(generatedEvents, /setSettlementGasSettingsOpen[\s\S]*popover\.open = !!open[\s\S]*toggleAttribute\('open'/, 'movement settings are opened through the Carbon popover owner');
assert.match(generatedEvents, /cds-toggle-changed[\s\S]*data-extra-field=\\?"type/, 'official Carbon toggle event commits the compact burden control');
assert.match(generatedEvents, /split-minus[\s\S]*club-minus|extraNegative/, 'negative extra semantics survive base burden toggles');
assert.match(rowCss, /grid-template-columns:[^;]+64px 48px/, 'desktop rows share four aligned columns');
assert.match(rowCss, /seisan-gas-settings-trigger[\s\S]*background: var\(--cds-field-01\)/, 'settings affordance keeps Carbon field geometry in the amount column');
assert.match(rowCss, /seisan-gas-settings-surface/, 'popover content has an explicit Carbon-token owner');
assert.match(rowCss, /@media \(max-width: 640px\)[\s\S]*grid-template-columns:/, 'mobile keeps a responsive one-row list');
assert.doesNotMatch(rowCss, /!important/, 'cost-list owner CSS does not use force overrides');
assert.match(editModalCss, /width: calc\(100vw - 2rem\)/, 'vehicle editor keeps viewport margins on mobile instead of fullscreen');
assert.match(settingsCss, /width: calc\(100vw - 2rem\)/, 'settlement settings keeps viewport margins on mobile instead of fullscreen');
assert.doesNotMatch(settingsCss, /!important/, 'settings owner CSS does not use force overrides');

assert.match(shareActions, /url\.searchParams\.set\('view', 'sheet'\)/, 'canonical copied URL opens the shared view');
assert.match(shareActions, /showShareCopyStatus\('リンクをコピーしました', 'success'\)/, 'successful copy uses concise Carbon toast feedback');
assert.match(shareActions, /legacyCopyText/, 'clipboard API failure has a direct copy fallback without opening a modal');
assert.doesNotMatch(shareActions, /showCopyFallback|copy-fallback|share-links-modal|車割・班割\(発表用リンク\)|精算用リンク/, 'copy and share actions no longer open legacy dialogs');
assert.match(app, /requestedView[\s\S]*await switchView\(initialView\)/, 'view query parameter is applied during startup');
assert.match(sheetView, /message: '下にスワイプできます。'/, 'shared-view guidance uses the requested swipe message');
assert.doesNotMatch(sheetView, /1本指で移動、2本指で拡大・縮小できます。/, 'legacy gesture guidance is removed');

console.log('settlement cost editor list v75 contract: PASS');
