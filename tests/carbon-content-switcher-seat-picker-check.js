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
const state = read('assets/js/core/data-state.js');
const picker = read('assets/js/features/seat-member-picker.js');
const switcherCss = read('assets/css/cars-members-tray/car-card/04-group-mode.css');
const seatCss = read('assets/css/cars-members-tray/car-card/03-seat-grid.css');

assert(html.includes('id="seatMemberPickerModal"') && html.includes('assets/js/features/seat-member-picker.js'), 'empty-seat member picker must be mounted and loaded');
assert(state.includes('role="tab"') && state.includes("'ArrowLeft', 'ArrowRight', 'Home', 'End'"), 'content switcher must expose tab semantics and arrow-key navigation');
assert(switcherCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && switcherCss.includes('--content-switcher-selected-bg'), 'content switcher segments must be equal width with a high-contrast selection');
assert(seatCss.includes('content: "空席\\A メンバーを追加"') && seatCss.includes('content: "→"'), 'empty seats must use a Carbon clickable-tile label and directional icon');
assert(picker.includes("slot.appendChild(card)") && picker.includes('save();'), 'selecting a waiting member must move the existing card and persist the allocation');

console.log('Carbon content switcher and seat picker check OK');
