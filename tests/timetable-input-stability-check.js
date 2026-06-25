const fs = require('fs');
const path = require('path');
const { readCssBundle } = require('./helpers/read-project');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'assets/js/features/events/02-static-header-events.js'), 'utf8');
const css = readCssBundle();

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(js.includes('function createTimetableRow'), 'Timetable rows should be created by a reusable row factory.');
assert(js.includes('root.appendChild(createTimetableRow())'), 'Adding a timetable row should append only the new row.');
assert(!js.includes('focusTimetableTitleAfterTime'), 'Time input should not auto-shift focus after value changes.');
assert(!js.includes('lastElementChild?.querySelector(\'[data-field="time"]\')?.focus'), 'Add button should not force-focus the time input.');
assert(js.includes('placeholder="内容"'), 'Timetable text field should use the 内容 label.');

assert(css.includes('grid-template-columns: minmax(0, 76px) minmax(0, 1fr) 30px'), 'Timetable row should reserve a compact fixed time column.');
assert(css.includes('box-sizing: border-box'), 'Timetable inputs should include padding inside their width.');
assert(css.includes('input[data-field="time"]'), 'Time input should have a field-specific compact rule.');
assert(css.includes('max-width: 100%'), 'Timetable inputs should not overflow their grid columns.');

console.log('Timetable input stability check OK');
