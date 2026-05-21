
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssRoot = path.join(root, 'assets', 'css');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const cssFiles = walk(cssRoot).filter(file => file.endsWith('.css'));
const loadedCss = [...html.matchAll(/\.\/assets\/css\/([^\"]+\.css)/g)].map(match => match[1]);

for (const file of cssFiles) {
  const rel = path.relative(cssRoot, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  if (/^\s*@import\b/m.test(content)) {
    console.error('CSS @import is forbidden. Use direct links instead:', rel);
    process.exit(1);
  }
  if (loadedCss.includes(rel) && Buffer.byteLength(content, 'utf8') > 70000) {
    console.error('Loaded CSS file is too large and should be split:', rel);
    process.exit(1);
  }
}

const componentFiles = cssFiles.filter(file => {
  const rel = path.relative(cssRoot, file).replace(/\\/g, '/');
  return !['00-base-tokens.css', '02-theme-appearance.css', '08-control-consistency.css'].includes(rel);
});

const literalColorPattern = /(?<![\w-])#(?:[0-9a-fA-F]{3,8})\b|rgba?\(\s*(?:0|15|255)\s*,\s*(?:0|23|255)\s*,\s*(?:0|42|255)\s*,/;
for (const file of componentFiles) {
  const rel = path.relative(cssRoot, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = content.match(literalColorPattern);
  if (match) {
    console.error(`Hard-coded color found in component CSS ${rel}: ${match[0]}`);
    process.exit(1);
  }
}

const zNumberPattern = /z-index:\s*\d+\b/;
for (const file of componentFiles) {
  const rel = path.relative(cssRoot, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = content.match(zNumberPattern);
  if (match) {
    console.error(`Numeric z-index found in component CSS ${rel}: ${match[0]}`);
    process.exit(1);
  }
}

function stripAtRuleBlocks(css) {
  // Cheap duplicate selector guard for top-level exact selectors. It intentionally
  // avoids nested media rules because the same selector may be valid at breakpoints.
  return css.replace(/@(?:media|supports|container|keyframes)[^{]*\{[\s\S]*?\n\}/g, '');
}

const selectorPattern = /([^{}@]+)\{/g;
for (const file of componentFiles) {
  const rel = path.relative(cssRoot, file).replace(/\\/g, '/');
  const content = stripAtRuleBlocks(fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
  const seen = new Map();
  let match;
  while ((match = selectorPattern.exec(content))) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('from') || selector.startsWith('to')) continue;
    seen.set(selector, (seen.get(selector) || 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 5);
  if (duplicates.length) {
    console.error('Excessive duplicate selector definitions in', rel, duplicates.slice(0, 5));
    process.exit(1);
  }
}

console.log('CSS quality guard OK');
