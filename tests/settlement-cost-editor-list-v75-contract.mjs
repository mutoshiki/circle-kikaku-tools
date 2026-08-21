import fs from 'node:fs';
import assert from 'node:assert/strict';

const carTemplate = fs.readFileSync('assets/js/templates/settlement/03-car-cost-templates.js', 'utf8');
const extraTemplate = fs.readFileSync('assets/js/templates/settlement/04-extra-input-templates.js', 'utf8');
const rowCss = fs.readFileSync('assets/css/settlement/car-inputs/03-extra-costs.css', 'utf8');
const generatedEvents = fs.readFileSync('assets/js/features/events/03-generated-action-events.js', 'utf8');

assert.match(carTemplate, /seisan-cost-edit-header[\s\S]*名目[\s\S]*金額[\s\S]*部費[\s\S]*操作/, 'cost list has one shared column header');
assert.match(carTemplate, /seisan-gas-cost-row/, 'gasoline is rendered as a row in the shared cost list');
assert.match(carTemplate, /seisan-gas-amount-control[\s\S]*data-settlement-gas-amount[\s\S]*open-settlement-gas-settings/, 'gas amount and settings action share the amount cell');
assert.match(carTemplate, /settlementGasEditModal[\s\S]*rentalType[\s\S]*data-field="dist"[\s\S]*data-field="eco"[\s\S]*data-field="price"[\s\S]*open-route-helper-shortcut/, 'gas settings modal owns vehicle type, fuel inputs and distance helper');
assert.doesNotMatch(carTemplate, /<div class="seisan-subhead"><strong>諸経費<\/strong>/, 'gas and extras are not split by legacy subheads');

assert.match(extraTemplate, /<cds-toggle size="sm" data-extra-field="type"/, 'club burden uses Carbon small toggle');
assert.doesNotMatch(extraTemplate, /<cds-select[^>]*data-extra-field="type"/, 'legacy burden select is removed');
assert.doesNotMatch(extraTemplate, /seisan-extra-field-label/, 'row-level repeated column labels are removed');
assert.match(extraTemplate, /data-extra-negative=/, 'signed extra type metadata is preserved without schema changes');

assert.match(generatedEvents, /cds-toggle-changed[\s\S]*data-extra-field=\\?"type/, 'official Carbon toggle event commits the compact burden control');
assert.match(generatedEvents, /split-minus[\s\S]*club-minus|extraNegative/, 'negative extra semantics survive base burden toggles');
assert.match(rowCss, /grid-template-columns:[^;]+64px 48px/, 'desktop rows share four aligned columns');
assert.match(rowCss, /@media \(max-width: 640px\)[\s\S]*grid-template-columns:/, 'mobile keeps a responsive one-row list');
assert.doesNotMatch(rowCss, /!important/, 'owner CSS does not use force overrides');

console.log('settlement cost editor list v75 contract: PASS');
