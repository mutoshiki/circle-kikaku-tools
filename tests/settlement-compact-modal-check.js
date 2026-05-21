const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const templates = readText('assets/js/templates/settlement-templates.js');
const render = readText('assets/js/features/settlement/03-render.js');
const events = readText('assets/js/features/events/03-generated-action-events.js');
const css = readCssBundle();

assert(html.includes('settlementSettingsModal'), 'settlement settings should edit in a modal');
assert(html.includes('settlementCarEditModal'), 'settlement car costs should edit in a modal');
assert(html.includes('seisan-settings-summary'), 'settings card should show a compact summary');
assert(templates.includes('function carSummary'), 'car list should render compact summaries');
assert(templates.includes('data-action="open-settlement-car-edit"'), 'car summary needs an edit action');
assert(render.includes('renderSettlementSettingSummaryHtml'), 'settings summary should be rendered from state');
assert(events.includes('open-settlement-settings') && events.includes('save-settlement-car-edit'), 'modal edit actions should be delegated');
assert(html.includes('settlement-edit-dialog--car') && html.includes('settlement-edit-modal-content'), 'car edit modal should share settings popup shell');
assert(css.includes('width: min(calc(100vw - 24px), 360px);'), 'car edit modal should use the same compact popup width as settings');
assert(templates.includes('seisan-summary-pills--single'), 'settings summary should render as one compact row');
assert(!html.includes('id="settlementCarEditModal" tabindex="-1" aria-labelledby="settlementCarEditModalTitle" aria-hidden="true">\n      <div class="modal-dialog modal-fullscreen-sm-down'), 'car edit modal should not use fullscreen mobile shell');
assert(!html.includes('modal-dialog-centered modal-dialog-scrollable modal-sm settlement-edit-dialog settlement-edit-dialog--car'), 'car edit modal should use the same outer shell as settings and scroll only inside the body');
assert(css.includes('.settlement-edit-dialog--car') && css.includes('width: min(calc(100vw - 24px), 360px);'), 'shared settlement popup shell CSS missing');

console.log('Settlement compact modal check OK');
