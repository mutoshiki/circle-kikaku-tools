const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/cars-members-tray/drag-drop/01-card-drag.css'), 'utf8');
const globalCss = fs.readFileSync(path.join(__dirname, '..', 'assets/css/07-drag-interactions.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/drag-edit-view.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/\.seat-card-will-move\s*\{[\s\S]*?visibility:\s*hidden;[\s\S]*?opacity:\s*0;/.test(css), 'displaced original card must be hidden while previewing');
assert(!/seat-card-will-move\s*\{[\s\S]*?visibility:\s*visible;/.test(css), 'no visible displaced-card rule may remain');
assert(!/:where\(\.member-card\.manual-drag-source, \.driver-seat\.manual-drag-source\)/.test(globalCss), 'global drag CSS must not re-show the hidden source');
assert(js.includes("preview.classList.add('swap-preview-card')"), 'swap preview should remain the single visible destination copy');
console.log('Drag single visual check OK');
