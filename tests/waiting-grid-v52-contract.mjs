import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const workspaceCss = read('assets/css/cars-members-tray/assignment-workspace-refresh.css');
const waiting = read('assets/js/features/waiting-tray.js');
const menuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');

assert.match(
  workspaceCss,
  /body\.assignment-workspace-enabled #bottom-tray\s*\{\s*display:\s*none;/s,
  'the former waiting grid must not remain a visible phone surface'
);
assert.match(
  waiting,
  /Hidden unassigned-pool compatibility feature/,
  'unassigned participants remain available only as an internal compatibility pool'
);
assert.match(
  waiting,
  /tray\.hidden = true;[\s\S]*tray\.style\.display = 'none';/,
  'waiting compatibility owner continuously keeps the retired tray hidden'
);
assert.match(
  menuCss,
  /\.person-overflow-menu:not\(\[open\]\) > \.person-pop-menu \{ display: none; \}/,
  'closed Carbon menu contents cannot enlarge allocation rows'
);

console.log('PASS hidden waiting-pool v52 contract');
