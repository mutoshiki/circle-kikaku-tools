const baseline = require('./css-owner-baseline.json');
const { buildReport } = require('../tools/css-selector-report');

const report = buildReport();
const current = new Map(report.selectors.map(item => [item.selector, item]));
const errors = [];

for (const [selector, rule] of Object.entries(baseline.selectors)) {
  const item = current.get(selector) || {
    definitions: 0,
    baseDefinitions: 0,
    files: []
  };
  if (item.definitions > rule.maxDefinitions) {
    errors.push(`${selector}: definitions ${item.definitions} > ${rule.maxDefinitions}`);
  }
  if (item.baseDefinitions > rule.maxBaseDefinitions) {
    errors.push(`${selector}: base definitions ${item.baseDefinitions} > ${rule.maxBaseDefinitions}`);
  }
  const unexpected = item.files.filter(file => !rule.allowedFiles.includes(file));
  if (unexpected.length) {
    errors.push(`${selector}: new owner files ${unexpected.join(', ')}`);
  }
}

if (errors.length) {
  console.error(`CSS owner regression:\n${errors.join('\n')}`);
  process.exit(1);
}

console.log(`CSS owner regression check OK (${Object.keys(baseline.selectors).length} selectors)`);
