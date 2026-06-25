const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const modalIds = ['userGuideModal', 'settlementSettingsModal', 'settlementCarEditModal', 'routeDistanceModal', 'historyModal', 'debugModal'];

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const guideStart = html.indexOf('id="userGuideModal"');
assert(guideStart !== -1, 'userGuideModal is missing');
const nextModalStart = html.indexOf('<div class="modal fade"', guideStart + 1);
const guideBlock = nextModalStart === -1 ? html.slice(guideStart) : html.slice(guideStart, nextModalStart);
assert(guideBlock.includes('id="userGuideContent" class="modal-body"'), 'user guide body is missing');
assert(!guideBlock.includes('modal-footer'), 'single-page user guide should not have old step navigation footer');

const positions = modalIds.map(id => [id, html.indexOf(`id="${id}"`)]);
for (const [id, pos] of positions) assert(pos !== -1, `${id} is missing`);
for (let i = 1; i < positions.length; i++) {
  assert(positions[i][1] > positions[i - 1][1], `${positions[i][0]} appears before ${positions[i - 1][0]}`);
}

console.log('Modal hierarchy check OK');
