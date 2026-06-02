const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
const finalBlock = css;

[
  '--settlement-split-ink: #245a3b',
  '--settlement-split-bg: #e8f5ee',
  '--settlement-split-line: rgba(55, 118, 79, 0.36)',
  '--settlement-club-ink: #694816',
  '--settlement-club-bg: #f7eddb',
  '--settlement-club-line: rgba(145, 101, 35, 0.36)',
].forEach(token => assert(finalBlock.includes(token), `${token} should be centralized in the final block`));

assert(finalBlock.includes('.seisan-extra-inline.split') && finalBlock.includes('.seisan-extra-inline.club'), 'inline gas/extra labels should inherit the same tokenized selectors');
assert(finalBlock.includes('.seisan-cost-type-badge.split') && finalBlock.includes('.seisan-cost-type-badge.club'), 'cost badges should use the same tokenized selectors');
assert(finalBlock.includes('--settlement-tag-ink') && finalBlock.includes('--settlement-tag-bg') && finalBlock.includes('--settlement-tag-line'), 'final badge styling should use one shared variable set for text, background, and border');
assert(finalBlock.includes('.seisan-mock-chip.split') && finalBlock.includes('.seisan-mock-chip.club'), 'guide chips should use the same tokenized selectors');
assert(finalBlock.includes('.seisan-extra-type.split') && finalBlock.includes('.seisan-extra-type.club'), 'editing selects should use the same tokenized selectors');
assert(finalBlock.includes('border: 1px solid var(--settlement-tag-line') && finalBlock.includes('--settlement-tag-line: var(--settlement-split-line)') && finalBlock.includes('--settlement-tag-line: var(--settlement-club-line)'), 'border colors should flow through the same tag-line variable');
assert(finalBlock.includes('background: var(--settlement-tag-bg') && finalBlock.includes('--settlement-tag-bg: var(--settlement-split-bg)') && finalBlock.includes('--settlement-tag-bg: var(--settlement-club-bg)'), 'background colors should flow through the same tag-bg variable');
assert(finalBlock.includes('color: var(--settlement-tag-ink') && finalBlock.includes('--settlement-tag-ink: var(--settlement-split-ink)') && finalBlock.includes('--settlement-tag-ink: var(--settlement-club-ink)'), 'text colors should flow through the same tag-ink variable');

console.log('Settlement tag color unification check OK');
