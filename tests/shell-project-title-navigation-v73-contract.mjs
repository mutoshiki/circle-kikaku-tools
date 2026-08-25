import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const js = read('assets/js/features/events/02-static-header-events.js');
const appEvents = read('assets/js/features/events.js');
const startup = read('assets/js/features/events/01-core-startup-events.js');
const header = read('assets/css/app-shell/header/01-header-base.css');
const room = read('assets/css/app-shell/header/02-room-status.css');
const carbonBuild = read('tools/build-carbon-assets.mjs');

assert.match(html, /<cds-header id="app-header"/);
assert.match(html, /<cds-header-menu-button id="overviewMenuBtn"/);
assert.match(html, /<cds-header-name href="\.\/">サークル企画ツール<\/cds-header-name>/);
assert.match(html, /<cds-side-nav id="overviewDrawer"/);
assert.match(html, /<cds-side-nav-link id="bugReportMenuItem"/);
assert.match(html, /id="roomNameInput"[^>]*placeholder="企画名を入力"/);
assert.match(html, /id="projectTitleRegion"[^>]*data-state="expanded"/);
assert.doesNotMatch(html, /<header id="app-header">/);
assert.doesNotMatch(html, /<aside id="overviewDrawer"/);
assert.doesNotMatch(html, /overviewDrawerScrim/);

assert.doesNotMatch(js, /projectTitleEditor|contenteditable|createAppNavigationDrawer|document\.createElement\('a'\)/);
assert.doesNotMatch(startup, /installRoomTitleValueBridge|projectTitleEditor/);
assert.match(appEvents, /editor\.id = 'projectTitleEditor'/);
assert.match(appEvents, /contenteditable', 'plaintext-only'/);
assert.match(appEvents, /installProjectTitleValueBridge/);
assert.match(js, /PROJECT_TITLE_SCROLL_THRESHOLD = 8/);
assert.match(js, /PROJECT_TITLE_PULL_THRESHOLD = 16/);
assert.match(js, /setProjectTitleExpanded\(false\)/);
assert.match(js, /event\.pointerType === 'touch'/);
assert.match(js, /deltaY <= -PROJECT_TITLE_PULL_THRESHOLD/);
assert.match(js, /event\.deltaY > PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /event\.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /drawer\.tagName !== 'CDS-SIDE-NAV'/);
assert.doesNotMatch(js, /setupOverviewMenuFields\(\);/);

for (const [label, url] of [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(html.includes(label), label);
  assert.ok(html.includes(url), url);
}

assert.match(header, /height:\s*256px/);
assert.match(header, /max-width:\s*768px[\s\S]*height:\s*240px/);
assert.match(header, /#overviewDrawer\s*\{[\s\S]*position:\s*fixed[\s\S]*translateX\(-100%\)/);
assert.match(header, /#overviewDrawer\[expanded\][\s\S]*translateX\(0\)/);
assert.doesNotMatch(header, /\.app-nav-link|\.app-nav-drawer/);
assert.match(room, /\.project-title-editor[\s\S]*font-size:\s*3\.375rem/);
assert.match(room, /max-width:\s*768px[\s\S]*font-size:\s*2\.625rem/);
assert.match(room, /\.app-room-field,[\s\S]*clip-path:\s*inset\(50%\)/);
assert.match(room, /#syncStatusBadge\s*\{\s*display:\s*none/);
assert.doesNotMatch(`${header}\n${room}`, /!important/);
assert.match(carbonBuild, /carbon-ui-shell-entry\.js/);
assert.match(carbonBuild, /ui-shell\.min\.js/);
assert.ok(html.includes('./assets/vendor/carbon/ui-shell.min.js?v=official-shell-v97'), 'UI Shell must be self-hosted from the pinned Carbon build');
console.log('PASS Carbon shell with restored project title and visible application navigation contract');
