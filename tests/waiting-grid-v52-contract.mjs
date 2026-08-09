import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const gridCss = read('assets/css/cars-members-tray/waiting-tray/06-action-and-list-layout.css');
const menuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const index = read('index.html');

assert.match(
  gridCss,
  /@media \(max-width: 768px\), \(pointer: coarse\) and \(max-width: 1024px\)[\s\S]*#waiting-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/,
  'phone and touch-tablet trays use an explicit two-column grid'
);
assert.match(
  gridCss,
  /#waiting-list > \.member-card \{ min-width: 0; \}/,
  'waiting cards may shrink to their two-column track'
);
assert.match(
  menuCss,
  /\.person-overflow-menu:not\(\[open\]\) > \.person-pop-menu \{ display: none; \}/,
  'closed Carbon menu contents cannot enlarge a waiting card scroll area'
);
assert.match(index, /06-action-and-list-layout\.css\?v=waiting-grid-v52/, 'grid CSS is cache-busted');
assert.match(index, /03-person-menu\.css\?v=waiting-grid-v52/, 'menu overflow CSS is cache-busted');

console.log('PASS waiting grid v52 contract');
