const fs = require('fs');
const path = require('path');
const { root, readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const template = readText('assets/js/templates/user-guide-content.js');
const feature = readText('assets/js/features/user-guide.js');
const modalController = readText('assets/js/core/modal-controller.js');
const headerEvents = readText('assets/js/features/events/02-static-header-events.js');
const css = readCssBundle();
const draft = readText('USER_GUIDE_DRAFT.md');

assert(html.includes('id="userGuideBtn"'), 'new guide entry button is missing');
assert(html.includes('id="userGuideModal"'), 'new user guide modal is missing');
assert(html.includes('id="userGuideContent"'), 'new user guide mount point is missing');
assert(modalController.includes('modals.userGuide'), 'new user guide modal is not registered');
assert(headerEvents.includes("bind('userGuideBtn'"), 'new user guide button is not bound');
assert(feature.includes('mountUserGuide'), 'new user guide content is not mounted');

const oldTokens = [
  'globalGuideModal', 'guideModal', 'seisanGuideModal', 'globalGuideBtn',
  'showGuideStep', 'guideNavStep', 'guide-step-', 'guide-feature-', 'app-guide-',
  'seisan-mock-', 'mock-sheet-', 'route-guide-mock'
];
const activeCode = [html, template, feature, modalController, headerEvents, css].join('\n');
for (const token of oldTokens) assert(!activeCode.includes(token), `old guide token remains: ${token}`);

[
  'assets/js/templates/guide-content.js',
  'assets/js/features/guides.js',
  'assets/css/guides-modals/guide',
  'assets/css/settlement/guide-mockups'
].forEach(file => assert(!fs.existsSync(path.join(root, file)), `old guide path still exists: ${file}`));

const imageRefs = [...template.matchAll(/assets\/images\/user-guide\/(\d{2}-[^"']+\.webp)/g)].map(match => match[1]);
assert(new Set(imageRefs).size === 11, `new guide should use 11 unique mobile screenshot crops, found ${new Set(imageRefs).size}`);
for (const file of imageRefs) {
  const full = path.join(root, 'assets/images/user-guide', file);
  assert(fs.existsSync(full), `guide screenshot is missing: ${file}`);
  assert(fs.statSync(full).size > 1000, `guide screenshot looks empty: ${file}`);
}

assert((draft.match(/^\[図\d+：/gm) || []).length === 11, 'draft should contain 11 screenshot insertion markers');
['参加者を登録する', '車割を作る', '班割を作る', '共有画面を整える', '予定を入れて共有する', '精算する', '保存と復元'].forEach(title => {
  assert(template.includes(title), `guide section is missing: ${title}`);
});
assert(css.includes('.user-manual-nav') && css.includes('.user-manual-figure'), 'new manual styles are missing');
assert(template.includes('390px-wide mobile interface'), 'guide screenshots should be documented as mobile captures');
assert(!template.includes('width="1040"') && !template.includes('width="970"'), 'desktop-sized guide screenshots remain');


console.log('User guide rebuild check OK');
