const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssRoot = path.join(root, 'assets', 'css');
const ownerMap = fs.readFileSync(path.join(root, 'CSS_OWNER_MAP.md'), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const allowed = {
  max: new Set([360, 380, 390, 420, 430, 520, 640, 768]),
  min: new Set([641, 769, 860])
};
const errors = [];

for (const file of walk(cssRoot).filter(file => file.endsWith('.css'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const css = fs.readFileSync(file, 'utf8');
  for (const media of css.matchAll(/@media\s*([^{]+)\{/g)) {
    for (const width of media[1].matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
      const kind = width[1];
      const value = Number(width[2]);
      if (!allowed[kind].has(value)) {
        errors.push(`${rel}: unsupported ${kind}-width ${value}px`);
      }
    }
  }
}

if (!ownerMap.includes('## Breakpoint Policy') ||
    !ownerMap.includes('Desktop complement starts at `min-width: 769px`')) {
  errors.push('CSS_OWNER_MAP.md: breakpoint policy or 768/769 boundary missing');
}

const distanceFuel = fs.readFileSync(
  path.join(cssRoot, 'settlement', 'car-inputs', '02-distance-fuel.css'),
  'utf8'
);
const mobileInputs = fs.readFileSync(
  path.join(cssRoot, 'settlement', 'car-inputs', '05-mobile-inputs.css'),
  'utf8'
);

if (distanceFuel.includes('@media (max-width: 374px)')) {
  errors.push('distance/fuel owner must not restore the obsolete 374px breakpoint');
}
if (!mobileInputs.includes('@media (max-width: 380px)') ||
    !mobileInputs.includes('#settlementCarEditModal .seisan-extra-row select')) {
  errors.push('mobile input owner must keep the narrow modal overflow fallback');
}

if (errors.length) {
  console.error(`Breakpoint policy check failed:\n${errors.join('\n')}`);
  process.exit(1);
}

console.log('Breakpoint policy check OK');
