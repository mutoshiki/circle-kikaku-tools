const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/08-control-consistency.css');

assert(css.includes('collect summary color fix: 集める is blue'), 'collect color fix comment missing');
assert(css.includes('--settlement-collect-blue: #2563eb;'), 'collect card should use a blue token in light mode');
assert(css.includes('--settlement-collect-blue: #60a5fa;'), 'collect card should use a readable blue token in dark mode');
assert(css.includes('#seisan-view-area .seisan-summary-card.collect') && css.includes('.seisan-mock-summary.collect'), 'collect blue override should cover real and guide preview cards');
assert(!/collect\s*\{[\s\S]{0,160}#10b981/.test(css.slice(css.lastIndexOf('collect summary color fix'))), 'final collect override should not use green');

console.log('Collect summary blue check OK');
