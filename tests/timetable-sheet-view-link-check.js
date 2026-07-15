const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const readText = file => fs.readFileSync(path.join(root, file), 'utf8');
const { readCssBundle } = require('./helpers/read-project');
const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const sheet = readText('assets/js/features/sheet-view.js');
const viewport = readText('assets/js/features/sheet/02-viewport-controls.js');
const events = readText('assets/js/features/events/02-static-header-events.js');
const css = readCssBundle();
const sync = readText('assets/js/core/sync-controller.js');
const state = readText('assets/js/core/data-state.js');

assert(sheet.includes('function createSheetTimetableSection()'), 'Sheet view should render a timetable section.');
assert(sheet.includes('content.appendChild(timetableSection)'), 'Timetable should be appended under car/team plan sections inside the scalable content wrapper.');
assert(sheet.includes('linkifySheetTimetableText') && sheet.includes('class="sheet-timetable-link"'), 'Timetable URLs should be linkified in the sheet view.');
assert(sheet.includes('target="_blank"') && sheet.includes('rel="noopener noreferrer"'), 'Sheet timetable links should open safely.');
assert(viewport.includes('isSheetInteractiveTarget(event.target)'), 'Sheet panning should not steal taps from timetable links.');
assert(css.includes('発表ビュー: タイムテーブルを最初の車割の左側に表示する'), 'Timetable sheet CSS note is missing.');
assert(css.includes('.sheet-timetable-link') && css.includes('var(--accent-color)'), 'Timetable links should use the semantic accent treatment.');
assert(events.includes('global.SanpoOverview') && events.includes('getSnapshot') && events.includes('applySnapshot'), 'Overview data should expose a shared snapshot API.');
assert(state.includes('overview: window.SanpoOverview?.getSnapshot?.()'), 'App data snapshot should include overview/timetable data.');
assert(state.includes("hasOwnProperty.call(d, 'overview')"), 'Legacy local timetable drafts should not be wiped when old data has no overview field.');
assert(sync.includes('overview: d.overview'), 'Remote sync should include overview/timetable data.');
