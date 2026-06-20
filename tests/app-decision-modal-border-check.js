const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/guides-modals/guide/04-mockup-details.css');

assert(
  css.includes('.app-decision-modal .modal-header') && css.includes('border-bottom: 0;'),
  'decision modal header should not have a separator border'
);
assert(
  css.includes('.app-decision-modal .modal-footer') && css.includes('border-top: 0;'),
  'decision modal footer should not have a separator border'
);

console.log('App decision modal border check OK');
