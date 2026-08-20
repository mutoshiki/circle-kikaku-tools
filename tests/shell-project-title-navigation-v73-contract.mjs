import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const js = read('assets/js/features/events/02-static-header-events.js');
const header = read('assets/css/app-shell/header/01-header-base.css');
const room = read('assets/css/app-shell/header/02-room-status.css');

assert.match(html, /id="roomNameInput"[^>]*placeholder="企画名を入力"/);
assert.match(js, /projectTitleEditor/);
assert.match(js, /data-placeholder', '企画名を入力'/);
assert.match(js, /PROJECT_TITLE_SCROLL_THRESHOLD = 8/);
assert.match(js, /PROJECT_TITLE_PULL_THRESHOLD = 16/);
assert.match(js, /setProjectTitleExpanded(false)/);
assert.match(js, /event.pointerType === 'touch'/);
assert.match(js, /event.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /drawer.replaceChildren(nav)/);
assert.doesNotMatch(js, /setupOverviewMenuFields();/);
for (const [label, url] of [
  ['山歩会フォームメイカー', 'https://script.google.com/macros/s/AKfycbwveM99euD8V5dxB6xLPYlpHuIc-KJlaaP8LHffh6ZMQBnAmO6XwX_ijQG-brUgqZmj/exec'],
  ['提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ポータル', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(js.includes(label), label);
  assert.ok(js.includes(url), url);
}
assert.match(header, /height:s*256px/);
assert.match(header, /max-width:s*768px[sS]*height:s*240px/);
assert.match(header, /.app-nav-link[sS]*min-height:s*48px/);
assert.match(header, /.app-nav-link:focus-visible/);
assert.match(room, /.project-title-editor:empty::before[sS]*content:s*attr(data-placeholder)/);
assert.doesNotMatch(header + '\n' + room, /!important/);
console.log('PASS shell project title and application navigation contract');
