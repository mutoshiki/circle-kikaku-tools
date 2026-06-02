const { readText } = require('./helpers/read-project');

function hexToRgb(hex) {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Unsupported color: ${hex}`);
  return [0, 2, 4].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(value => (
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

function getVar(css, name) {
  const match = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1];
}

function assertContrast(label, fg, bg, min) {
  const ratio = contrastRatio(fg, bg);
  if (ratio < min) {
    console.error(`${label} contrast ${ratio.toFixed(2)} is below ${min}`);
    process.exit(1);
  }
}

const themeCss = readText('assets/css/theme/00-theme-contract.css');
const surfaceCss = readText('assets/css/tokens/05-control-surface-tokens.css');

const lightBgCard = getVar(themeCss, '--theme-light-bg-card');
const lightText = getVar(themeCss, '--theme-light-text-main');
const lightSub = getVar(themeCss, '--theme-light-text-sub');
const lightAccent = getVar(themeCss, '--theme-light-accent');
const darkBgCard = getVar(themeCss, '--theme-dark-bg-card');
const darkBgBody = getVar(themeCss, '--theme-dark-bg-body');
const darkText = getVar(themeCss, '--theme-dark-text-main');
const darkSub = getVar(themeCss, '--theme-dark-text-sub');
const darkAccent = getVar(themeCss, '--theme-dark-accent');
const splitInk = getVar(surfaceCss, '--settlement-split-ink');
const splitBg = getVar(surfaceCss, '--settlement-split-bg');
const clubInk = getVar(surfaceCss, '--settlement-club-ink');
const clubBg = getVar(surfaceCss, '--settlement-club-bg');

assertContrast('light main text', lightText, lightBgCard, 10);
assertContrast('light secondary text', lightSub, lightBgCard, 4.5);
assertContrast('light primary action', '#ffffff', lightAccent, 4.5);
assertContrast('dark main text', darkText, darkBgCard, 10);
assertContrast('dark secondary text', darkSub, darkBgCard, 4.5);
assertContrast('dark primary action', darkBgBody, darkAccent, 4.5);
assertContrast('settlement split tag', splitInk, splitBg, 4.5);
assertContrast('settlement club tag', clubInk, clubBg, 4.5);

console.log('Standard theme contrast check OK');
