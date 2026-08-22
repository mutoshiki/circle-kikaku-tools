import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const js = read('assets/js/features/events/02-static-header-events.js');
const startup = read('assets/js/features/events/01-core-startup-events.js');
const header = read('assets/css/app-shell/header/01-header-base.css');
const room = read('assets/css/app-shell/header/02-room-status.css');

assert.match(html, /id="roomNameInput"[^>]*placeholder="企画名を入力"/);
assert.match(js, /projectTitleEditor/);
assert.match(js, /data-placeholder', '企画名を入力'/);
assert.match(js, /editor\.addEventListener\('blur', syncToSource\)/, 'blur must commit the visible project-title draft before WebKit compositionend ordering can erase it');
assert.doesNotMatch(js, /new MutationObserver\(syncFromSource\)/, 'remote project-title reflection must have one owner instead of a second attribute observer');
assert.match(startup, /function installRoomTitleValueBridge/);
assert.match(startup, /valueDescriptor\.set\.call\(this, next\);[\s\S]*syncEditor\(next\);/, 'programmatic restore writes must flow from roomName into the visible project title');
assert.doesNotMatch(startup, /PROJECT_TITLE_STALE_ECHO_GUARD_MS|pendingLocalTitle|pendingBaseTitle|pendingUntil/, 'project-title sync must not depend on a timing-based stale-echo state machine');
assert.match(js, /PROJECT_TITLE_SCROLL_THRESHOLD = 8/);
assert.match(js, /PROJECT_TITLE_PULL_THRESHOLD = 16/);
assert.match(js, /setProjectTitleExpanded\(false\)/);
assert.match(js, /event\.pointerType === 'touch'/);
assert.match(js, /deltaY <= -PROJECT_TITLE_PULL_THRESHOLD/);
assert.match(js, /event\.deltaY > PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /event\.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /drawer\.replaceChildren\(nav\)/);
assert.match(js, /drawer\.getAttribute\('aria-hidden'\) === 'true'/);
assert.doesNotMatch(js, /setupOverviewMenuFields\(\);/);
for (const [label, url] of [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(js.includes(label), label);
  assert.ok(js.includes(url), url);
}
assert.match(header, /height:\s*256px/);
assert.match(header, /max-width:\s*768px[\s\S]*height:\s*240px/);
assert.match(header, /\.app-nav-link[\s\S]*min-height:\s*48px/);
assert.match(header, /\.app-nav-link:focus-visible/);
assert.match(room, /\.project-title-editor:empty::before[\s\S]*content:\s*attr\(data-placeholder\)/);
assert.doesNotMatch(`${header}\n${room}`, /!important/);
assert.ok(html.includes('./assets/css/app-shell/layout/01-app-frame.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/app-shell/layout/01-app-frame.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/css/app-shell/header/01-header-base.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/app-shell/header/01-header-base.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/css/app-shell/header/02-room-status.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/app-shell/header/02-room-status.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/css/app-shell/header/03-tabs-actions.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/app-shell/header/03-tabs-actions.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/css/guides-modals/overview/01-overview-drawer.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/guides-modals/overview/01-overview-drawer.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/css/guides-modals/overview/02-overview-mobile.css?v=project-title-nav-v73'), 'cache-bust must track v73 owner: ./assets/css/guides-modals/overview/02-overview-mobile.css?v=project-title-nav-v73');
assert.ok(html.includes('./assets/js/features/events/02-static-header-events.js?v=bug-report-nav-v74'), 'cache-bust must track v74 owner: ./assets/js/features/events/02-static-header-events.js?v=bug-report-nav-v74');
assert.ok(html.includes('./assets/js/features/events.js?v=bug-report-nav-v74'), 'cache-bust must track v74 bug report owner: ./assets/js/features/events.js?v=bug-report-nav-v74');
console.log('PASS shell project title and application navigation contract');
