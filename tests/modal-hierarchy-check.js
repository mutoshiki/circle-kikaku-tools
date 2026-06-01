const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const guideIds = ['globalGuideModal', 'guideModal', 'seisanGuideModal'];
const allModalIds = [...guideIds, 'routeDistanceModal', 'historyModal', 'debugModal'];

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

for (const id of guideIds) {
  const start = html.indexOf(`id="${id}"`);
  assert(start !== -1, `${id} is missing`);

  const nextModalStart = html.indexOf('<div class="modal fade"', start + 1);
  const block = nextModalStart === -1 ? html.slice(start) : html.slice(start, nextModalStart);

  assert(block.includes('class="modal-body p-0 unified-guide-body"'), `${id} modal body is missing`);
  assert(/<\/div>\r?\n\s+<div class="modal-footer guide-footer guide-footer--compact">/.test(block), `${id} modal body must close before modal-footer`);
  assert(block.includes('class="modal-footer guide-footer guide-footer--compact"'), `${id} modal footer is missing`);
}

// Ensure top-level modal markers appear in the intended order. This catches accidental modal nesting from missing closing tags.
const positions = allModalIds.map(id => [id, html.indexOf(`id="${id}"`)]);
for (const [id, pos] of positions) assert(pos !== -1, `${id} is missing`);
for (let i = 1; i < positions.length; i++) {
  assert(positions[i][1] > positions[i - 1][1], `${positions[i][0]} appears before ${positions[i - 1][0]}`);
}

console.log('Modal hierarchy check OK');
