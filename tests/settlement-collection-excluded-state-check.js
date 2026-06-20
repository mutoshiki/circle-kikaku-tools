const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const template = readText('assets/js/templates/settlement/05-collection-check-templates.js');
const css = readText('assets/css/settlement/checklists/03-driver-payment-list.css');

assert(template.includes("'支払い額から差し引き済'"), 'excluded drivers should explain that the amount was already deducted');
assert(template.includes('aria-disabled="true"'), 'excluded collection rows should expose their disabled state');
assert(css.includes('.seisan-check-item.excluded') && css.includes('cursor: not-allowed;'), 'excluded collection rows should look non-interactive');
assert(css.includes('filter: grayscale(1);'), 'excluded checkboxes should be visibly muted');

console.log('Settlement collection excluded state check OK');
