const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readCssBundle(rootDir = root) {
  const cssDir = path.join(rootDir, 'assets', 'css');
  return walk(cssDir)
    .filter(file => file.endsWith('.css'))
    .sort()
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
}


function readSettlementTemplateBundle(rootDir = root) {
  const files = [
    'assets/js/templates/settlement/00-template-utils.js',
    'assets/js/templates/settlement/01-cost-parts.js',
    'assets/js/templates/settlement/02-summary-templates.js',
    'assets/js/templates/settlement/04-extra-input-templates.js',
    'assets/js/templates/settlement/03-car-cost-templates.js',
    'assets/js/templates/settlement/05-collection-check-templates.js',
    'assets/js/templates/settlement/06-driver-pay-templates.js',
    'assets/js/templates/settlement/07-empty-state-templates.js',
    'assets/js/templates/settlement/08-route-helper-templates.js',
    'assets/js/templates/settlement/09-register-settlement-templates.js',
    'assets/js/templates/settlement-templates.js'
  ];
  return files.map(file => fs.readFileSync(path.join(rootDir, file), 'utf8')).join('\n');
}

function listCssFiles(rootDir = root) {
  const cssDir = path.join(rootDir, 'assets', 'css');
  return walk(cssDir).filter(file => file.endsWith('.css')).sort();
}

module.exports = { root, walk, readText, readCssBundle, readSettlementTemplateBundle, listCssFiles };
