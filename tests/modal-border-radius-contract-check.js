const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const modal = fs.readFileSync(path.join(root, 'assets/css/guides-modals/modal/01-modal-base.css'), 'utf8');
const overview = fs.readFileSync(path.join(root, 'assets/css/guides-modals/overview/01-overview-drawer.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/\.modal-content\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--radius-xl\);/.test(modal), 'popup frame must be borderless with equal corner radii');
assert(modal.includes('.modal-dialog.modal-fullscreen-sm-down .modal-content') && modal.includes('border-radius: 0;'), 'fullscreen mobile dialogs must use equal zero radii');
assert(/#commonEditModal \.modal-content\s*\{[\s\S]*?border:\s*0;/.test(modal), 'capacity change popup must be borderless at its owner');
assert(/\.overview-drawer\s*\{[\s\S]*?border:\s*0;/.test(overview), 'overview drawer frame must be borderless');
assert(/\.overview-panel\s*\{[\s\S]*?border:\s*0;/.test(overview), 'overview panels must be borderless');
console.log('Modal border/radius contract check OK');
