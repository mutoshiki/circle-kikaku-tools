const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'assets/css/settlement/summary/01-summary-layout.css');
const css = fs.readFileSync(cssPath, 'utf8');

if (/\.seisan-summary-card\.pay\s*\{[^}]*grid-column\s*:\s*1\s*\/\s*-1/s.test(css)) {
  throw new Error('Payment summary card must not be forced onto a separate row.');
}
if (/\.seisan-flow-arrow--equals\s*\{[^}]*grid-column\s*:\s*1\s*\/\s*-1/s.test(css)) {
  throw new Error('Equals sign must remain between the club and payment cards.');
}
if (!css.includes('grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr) 14px minmax(0, 1fr);')) {
  throw new Error('Mobile settlement summary must keep all three cards in one equal-width row.');
}
if (!css.includes('min-height: 112px;')) {
  throw new Error('Mobile settlement summary cards must share one stable height contract.');
}


const tokenCss = fs.readFileSync(path.join(__dirname, '..', 'assets/css/tokens/05-control-surface-tokens.css'), 'utf8');
const colorCss = fs.readFileSync(path.join(__dirname, '..', 'assets/css/settlement/summary/03-summary-colors.css'), 'utf8');
if (!tokenCss.includes('--settlement-collect-bg: var(--status-split-bg);')) {
  throw new Error('Split summary must use its semantic surface instead of blending into the parent card.');
}
if (!colorCss.includes('color: var(--settlement-split-ink);')) {
  throw new Error('Split summary must use the same semantic ink algorithm as club and payment cards.');
}

console.log('Settlement summary row parity check OK');
