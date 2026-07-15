const assert = require('assert');
const { readText } = require('./helpers/read-project');

const index = readText('index.html');
const render = readText('assets/js/features/settlement/03-render.js');
const events = readText('assets/js/features/events/03-generated-action-events.js');
const cardCss = readText('assets/css/settlement/car-cost-summary/01-car-cost-card.css');
const toggleCss = readText('assets/css/settlement/car-cost-summary/02-layout-toggle.css');

assert(index.includes('id="seisanCarLayoutToggle"') && index.includes('data-action="toggle-settlement-car-layout"') && index.includes('seisan-layout-grid-icon'), 'driver payment section must expose a 2x2-square icon-only layout toggle');
assert(render.includes("SETTLEMENT_CAR_LAYOUT_STORAGE_KEY = 'syawari_settlement_car_layout'") && render.includes('function toggleSettlementCarLayout()'), 'driver payment layout choice must be switchable and persisted locally');
assert(events.includes("'toggle-settlement-car-layout': () => global.toggleSettlementCarLayout?.()"), 'generated action owner must handle the driver card layout toggle');
assert(cardCss.includes('grid-template-columns: minmax(0, 1fr) var(--settlement-car-tag-col) var(--settlement-car-amount-col);'), 'driver cost rows must use fixed name, badge and amount columns');
assert(cardCss.includes('--amount-font-size: var(--settlement-car-amount-size);') && cardCss.includes('--settlement-car-amount-size: 0.86rem;') && cardCss.includes('--settlement-car-amount-size: 0.78rem;'), 'payment amounts must use the same typography scale as expense names');
assert(toggleCss.includes('.seisan-car-layout-toggle') && toggleCss.includes('.seisan-layout-grid-icon') && toggleCss.includes('grid-template-columns: repeat(2, 6px);'), 'layout toggle must have one canonical 2x2-square icon-button surface');

console.log('Settlement car layout toggle check OK');
