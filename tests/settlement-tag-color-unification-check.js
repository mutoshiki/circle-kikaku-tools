const { readCssBundle } = require('./helpers/read-project');
function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
const css = readCssBundle();
[
  '--settlement-split-ink:', '--settlement-split-bg:', '--settlement-split-line:',
  '--settlement-club-ink:', '--settlement-club-bg:', '--settlement-club-line:'
].forEach(token => assert(css.includes(token), `${token} should be centralized in design tokens`));
assert(css.includes('.seisan-extra-inline.split') && css.includes('.seisan-extra-inline.club'), 'inline gas/extra labels should inherit the same tokenized selectors');
assert(css.includes('.seisan-cost-type-badge.split') && css.includes('.seisan-cost-type-badge.club'), 'cost badges should use the same tokenized selectors');
assert(css.includes('--settlement-tag-ink') && css.includes('--settlement-tag-bg') && css.includes('--settlement-tag-line'), 'badge styling should use one shared variable set');
assert(css.includes('.seisan-mock-chip.split') && css.includes('.seisan-mock-chip.club'), 'guide chips should use the same tokenized selectors');
assert(css.includes('.seisan-extra-type.split') && css.includes('.seisan-extra-type.club'), 'editing selects should use the same tokenized selectors');
assert(css.includes('border: 1px solid var(--settlement-tag-line') && css.includes('--settlement-tag-line: var(--settlement-split-line)') && css.includes('--settlement-tag-line: var(--settlement-club-line)'), 'border colors should flow through the tag-line variable');
assert(css.includes('background: var(--settlement-tag-bg') && css.includes('--settlement-tag-bg: var(--settlement-split-bg)') && css.includes('--settlement-tag-bg: var(--settlement-club-bg)'), 'background colors should flow through the tag-bg variable');
assert(css.includes('color: var(--settlement-tag-ink') && css.includes('--settlement-tag-ink: var(--settlement-split-ink)') && css.includes('--settlement-tag-ink: var(--settlement-club-ink)'), 'text colors should flow through the tag-ink variable');
console.log('Settlement tag color unification check OK');
