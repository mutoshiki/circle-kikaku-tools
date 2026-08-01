const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const html = read('index.html');
const entry = read('assets/js/carbon-entry.js');
const state = read('assets/js/core/data-state.js');
const picker = read('assets/js/features/seat-member-picker.js');
const switcherCss = read('assets/css/cars-members-tray/car-card/04-group-mode.css');
const lightThemeCss = read('assets/css/tokens/01-color-scheme.css');
const darkThemeCss = read('assets/css/tokens/01-theme-modes.css');
const seatCss = read('assets/css/cars-members-tray/car-card/03-seat-grid.css');

assert(html.includes('id="seatMemberPickerModal"') && html.includes('assets/js/features/seat-member-picker.js'), 'empty-seat member picker must be mounted and loaded');
assert(html.includes('<button class="view-tab" id="tab-list" aria-label="車割・班割">'), 'top-level allocation navigation must remain a separate existing button');
assert(entry.includes('@carbon/web-components/es/components/content-switcher/index.js'), 'official Carbon content switcher module must be bundled');
assert(state.includes('<cds-content-switcher') && state.includes('<cds-content-switcher-item'), 'car/team selector must render official Carbon content switcher elements');
assert(state.includes('role="tablist"') && state.includes('aria-controls="cars-container"'), 'content switcher must retain tablist and aria-controls contracts');
assert(!state.includes('target="cars-container"'), 'Carbon must not own visibility of the shared allocation business region');
assert(state.includes("'Home', 'End'") && state.includes("'cds-content-switcher-selected'"), 'Content Switcher must retain Home/End and connect the official selection event');
assert(!state.includes('<button type="button" role="tab" class="car-plan-template-chip'), 'legacy content switcher buttons must be removed');
assert(switcherCss.includes('.allocation-mode-toggle cds-content-switcher') && switcherCss.includes('min-height: 48px'), 'content switcher host must fill the toolbar and retain a 48px touch target');
assert(!switcherCss.includes('.car-plan-template-chip'), 'CSS must not depend on the removed legacy switcher buttons');
assert(!/shadowRoot|::part|cds--content-switcher/.test(switcherCss), 'application CSS must not depend on Carbon Shadow DOM internals');
assert(lightThemeCss.includes('--cds-layer-selected-inverse: #161616') && darkThemeCss.includes('--cds-layer-selected-inverse: #f4f4f4'), 'light and dark themes must expose the official selected-layer inverse token');
assert(state.includes('activeCarPlanId: active.id') && state.includes('if (persist) save();'), 'active plan persistence must remain owned by the existing data state controller');
assert(state.includes('function switchCarPlan(id, { persist = true } = {})') && state.includes('function updateActiveCarPlanTemplate(templateType)'), 'existing car/team business switching functions must remain outside Carbon');
assert(seatCss.includes('content: "空席\\A メンバーを追加"') && seatCss.includes('content: "→"'), 'empty seats must use a Carbon clickable-tile label and directional icon');
assert(picker.includes("slot.appendChild(card)") && picker.includes('save();'), 'selecting a waiting member must move the existing card and persist the allocation');

console.log('Carbon content switcher and seat picker check OK');
