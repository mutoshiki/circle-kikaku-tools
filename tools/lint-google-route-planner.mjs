import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const routeFiles = [
  'maps-config.js',
  'assets/js/core/google-maps-loader.js',
  'assets/js/features/settlement/04-route-helper.js',
  'assets/js/templates/settlement/08-route-helper-templates.js',
  'assets/css/settlement/route-helper/01-route-shell.css',
  'assets/css/settlement/route-helper/02-route-stops.css',
  'assets/css/settlement/route-helper/03-route-candidates.css'
];

for (const file of routeFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

const allFirstParty = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'test-results', 'playwright-report', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|html|css|json)$/.test(entry.name)) allFirstParty.push(full);
  }
}
walk(root);

const keyMatch = read('maps-config.js').match(/apiKey:\s*['"]([^'"]+)['"]/);
const key = keyMatch?.[1] || '';
if (!key) failures.push('maps-config.js must define one apiKey');
const keyOwners = allFirstParty.filter(file => fs.readFileSync(file, 'utf8').includes(key));
if (keyOwners.length !== 1 || path.relative(root, keyOwners[0]) !== 'maps-config.js') {
  failures.push(`Google Maps API key must exist only in maps-config.js; found ${keyOwners.map(file => path.relative(root, file)).join(', ')}`);
}

const routeSource = read('assets/js/features/settlement/04-route-helper.js');
for (const forbidden of ['DirectionsService', 'DistanceMatrixService', 'AutocompleteService', 'google.maps.places.Autocomplete(']) {
  if (routeSource.includes(forbidden)) failures.push(`legacy Google API usage: ${forbidden}`);
}
for (const required of ['PlaceAutocompleteElement', 'gmp-select', 'requestedRegion', 'requestedLanguage', 'locationBias', 'Route.computeRoutes', 'computeAlternativeRoutes', 'routeModifiers', 'requestSequence', 'scheduleRouteRequest']) {
  if (!routeSource.includes(required)) failures.push(`missing route contract: ${required}`);
}



if (!/JAPAN_SEARCH_BIAS\s*=\s*Object\.freeze\(\{\s*north:[\s\S]*south:[\s\S]*east:[\s\S]*west:/.test(routeSource)) failures.push('Japan search bias must be a rectangular soft viewport');
const invalidBiasRadius = routeSource.match(/JAPAN_SEARCH_BIAS[\s\S]{0,160}radius\s*:\s*(\d+(?:\.\d+)?)/);
if (invalidBiasRadius && Number(invalidBiasRadius[1]) > 50000) failures.push('Places circular locationBias radius exceeds 50,000 meters');
if (!routeSource.includes('retryRoutePlanner')) failures.push('Google API failures need an explicit retry path');

if (/includedRegionCodes\s*=/.test(routeSource)) failures.push('Japan search must be biased, not hard-restricted');
if (/requestedReferenceRoutes/.test(routeSource)) failures.push('unrequested reference routes increase API work');

for (const file of routeFiles.filter(file => file.endsWith('.css'))) {
  const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) failures.push(`unbalanced CSS braces: ${file}`);
  if (/!important/.test(css)) failures.push(`route owner must not use !important: ${file}`);
}

for (const file of routeFiles.filter(file => /\.m?js$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: ${result.stderr || result.stdout}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Google route planner lint: PASS (${routeFiles.length} owner files)`);
